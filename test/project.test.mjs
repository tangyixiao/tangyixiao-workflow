import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SOURCE_ROOT, adoptProject, checkProject, inspectProject, toolkitVersion, upgradeProject } from '../lib/project.mjs';

const PARENT = path.dirname(SOURCE_ROOT);
async function fixture(t) {
  const root = await mkdtemp(path.join(PARENT, '.tywf-project-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), PARENT);
    assert.equal((await lstat(root)).isSymbolicLink(), false);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
async function put(root, name, text) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await writeFile(path.join(root, name), text);
}
async function snapshot(root) {
  const result = {};
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const filename = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile()) result[path.relative(root, filename)] = (await readFile(filename)).toString('base64');
    }
  }
  await walk(root);
  return result;
}

test('inspection detects npm identity without modifying manifests or git state', async t => {
  const root = await fixture(t);
  await put(root, 'package.json', JSON.stringify({ name: 'actual-project', version: '2.0.0', repository: { url: 'git+https://github.com/example/actual-project.git' } }));
  await put(root, '.git/HEAD', 'ref: refs/heads/work-in-progress\n');
  const before = await snapshot(root);
  const result = await inspectProject(root);
  assert.equal(result.profile, 'npm');
  assert.equal(result.repository, 'example/actual-project');
  assert.equal(result.adopted, false);
  assert.deepEqual(await snapshot(root), before);
});

test('inspection detects static and generic profiles and ignores worktree pointer targets', async t => {
  const root = await fixture(t);
  await put(root, '.git', 'gitdir: ../../unrelated-private-checkout/.git/worktrees/a\n');
  assert.equal((await inspectProject(root)).profile, 'generic');
  await put(root, 'site/index.html', '<!doctype html><title>Site</title>');
  assert.equal((await inspectProject(root)).profile, 'static');
});

test('adoption defaults to a read-only plan and preserves existing toss and AGENTS', async t => {
  const root = await fixture(t);
  await put(root, 'AGENTS.md', '# Existing rules\nPreserve this exact text.\n');
  await put(root, '.github/toss.json', '{"local":"untouched"}\n');
  const before = await snapshot(root);
  const result = await adoptProject({ projectRoot: root, repository: 'example/project', profile: 'generic' });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'plan');
  assert.equal(result.applied, false);
  assert.equal(result.changes.length, 3);
  assert.deepEqual(await snapshot(root), before);
});

test('explicit adoption is idempotent and owns only the inserted AGENTS block', async t => {
  const root = await fixture(t);
  const original = '# Existing rules\nDo not rewrite this.\n';
  await put(root, 'AGENTS.md', original);
  await put(root, '.github/toss.json', '{"retain":true}\n');
  assert.equal((await adoptProject({ projectRoot: root, repository: 'example/project', apply: true })).ok, true);
  const first = await snapshot(root);
  const repeated = await adoptProject({ projectRoot: root, apply: true });
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.changes, []);
  assert.deepEqual(await snapshot(root), first);
  const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith(original));
  await put(root, 'AGENTS.md', agents + '\nUnrelated notes added later.\n');
  const upgraded = await upgradeProject({ projectRoot: root, apply: true });
  assert.equal(upgraded.ok, true);
  assert.match(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /Unrelated notes added later/);
  assert.equal(await readFile(path.join(root, '.github/toss.json'), 'utf8'), '{"retain":true}\n');
});

test('schema 1 adoption preserves unknown configuration, release settings and resource overrides', async t => {
  const root = await fixture(t);
  const existing = { schema: 1, repository: 'example/project', profile: 'npm', futureSetting: { keep: ['a', 'b'] },
    release: { productId: 'independent-product' }, resources: { maxLogMiB: 7, customLimit: 23 } };
  await put(root, '.github/project-workflow.json', JSON.stringify(existing));
  const result = await adoptProject({ projectRoot: root, apply: true });
  assert.equal(result.ok, true);
  const config = JSON.parse(await readFile(path.join(root, '.github/project-workflow.json'), 'utf8'));
  assert.deepEqual(config.futureSetting, existing.futureSetting);
  assert.deepEqual(config.release, existing.release);
  assert.equal(config.resources.maxLogMiB, 7);
  assert.equal(config.resources.customLimit, 23);
  assert.equal(config.resources.freeSpaceReserveGiB, 10);
  assert.equal(config.toolkitVersion, await toolkitVersion());
});

test('an unmanaged conflicting identity or unsupported schema is reported without any writes', async t => {
  const root = await fixture(t);
  await put(root, '.github/project-workflow.json', '{"schema":1,"repository":"other/product","profile":"static","unknown":true}\n');
  let before = await snapshot(root);
  let result = await adoptProject({ projectRoot: root, repository: 'example/project', apply: true });
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some(item => /repository/.test(item.reason)));
  assert.deepEqual(await snapshot(root), before);
  await put(root, '.github/project-workflow.json', '{"schema":2,"repository":"other/product"}\n');
  before = await snapshot(root);
  result = await adoptProject({ projectRoot: root, apply: true });
  assert.equal(result.ok, false);
  assert.deepEqual(await snapshot(root), before);
});

test('receipt hash changes stop apply before touching config, AGENTS or the receipt', async t => {
  const root = await fixture(t);
  await adoptProject({ projectRoot: root, repository: 'example/project', apply: true });
  const configFile = '.github/project-workflow.json';
  const config = JSON.parse(await readFile(path.join(root, configFile), 'utf8'));
  config.ownerChange = 'must survive';
  await put(root, configFile, JSON.stringify(config));
  const before = await snapshot(root);
  const result = await adoptProject({ projectRoot: root, apply: true });
  assert.equal(result.ok, false);
  assert.equal((await inspectProject(root)).configurationModified, true);
  assert.deepEqual(await snapshot(root), before);
});

test('modified managed block is retained, including unrelated AGENTS text', async t => {
  const root = await fixture(t);
  await put(root, 'AGENTS.md', '# Keep me\n');
  await adoptProject({ projectRoot: root, repository: 'example/project', apply: true });
  const agents = (await readFile(path.join(root, 'AGENTS.md'), 'utf8')).replace('Plans are read-only', 'Owner-customized plan rule');
  await put(root, 'AGENTS.md', agents);
  const before = await snapshot(root);
  const result = await adoptProject({ projectRoot: root, apply: true });
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some(item => item.path === 'AGENTS.md'));
  assert.deepEqual(await snapshot(root), before);
});

test('missing identity and invalid profile cannot create adoption files', async t => {
  const root = await fixture(t);
  const result = await adoptProject({ projectRoot: root, profile: 'unsupported', apply: true });
  assert.equal(result.ok, false);
  assert.equal(result.conflicts.length, 2);
  assert.deepEqual(await readdir(root), []);
});

test('strict check rejects an unadopted package and only allows changes outside its managed AGENTS block', async t => {
  const root = await fixture(t);
  await put(root, 'package.json', '{"name":"plain-project","version":"1.0.0"}');
  assert.equal((await inspectProject(root)).ok, true);
  assert.equal((await checkProject(root)).ok, false);
  await adoptProject({ projectRoot: root, repository: 'example/project', apply: true });
  assert.equal((await checkProject(root)).ok, true);
  let text = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
  await put(root, 'AGENTS.md', text + '\nOwner note outside the block\n');
  assert.equal((await checkProject(root)).ok, true);
  text = (await readFile(path.join(root, 'AGENTS.md'), 'utf8')).replace('Plans are read-only', 'Locally changed managed text');
  await put(root, 'AGENTS.md', text);
  assert.equal((await checkProject(root)).ok, false);
});

test('explicitly reviewed valid configuration can become a new baseline without dropping custom fields', async t => {
  const root = await fixture(t);
  await adoptProject({ projectRoot: root, repository: 'example/project', apply: true });
  const filename = '.github/project-workflow.json';
  const config = JSON.parse(await readFile(path.join(root, filename), 'utf8'));
  config.resources.maxLogMiB = 8;
  config.release = { productId: 'actual-project' };
  config.future = { preserved: true };
  await put(root, filename, JSON.stringify(config));
  assert.equal((await checkProject(root)).ok, false);
  const before = await snapshot(root);
  const plan = await upgradeProject({ projectRoot: root, acceptConfig: true });
  assert.equal(plan.ok, true);
  assert.equal(plan.acceptedCustomization, false);
  assert.deepEqual(await snapshot(root), before);
  const applied = await upgradeProject({ projectRoot: root, acceptConfig: true, apply: true });
  assert.equal(applied.acceptedCustomization, true);
  assert.equal((await checkProject(root)).ok, true);
  const result = JSON.parse(await readFile(path.join(root, filename), 'utf8'));
  assert.equal(result.resources.maxLogMiB, 8);
  assert.deepEqual(result.release, config.release);
  assert.deepEqual(result.future, config.future);
});

test('acceptConfig cannot approve invalid budgets or modified managed AGENTS text', async t => {
  const root = await fixture(t);
  await adoptProject({ projectRoot: root, repository: 'example/project', apply: true });
  const filename = '.github/project-workflow.json';
  const config = JSON.parse(await readFile(path.join(root, filename), 'utf8'));
  config.resources.maxHeavyJobs = -1;
  await put(root, filename, JSON.stringify(config));
  const before = await snapshot(root);
  assert.equal((await upgradeProject({ projectRoot: root, acceptConfig: true, apply: true })).ok, false);
  assert.deepEqual(await snapshot(root), before);
  config.resources.maxHeavyJobs = 1;
  await put(root, filename, JSON.stringify(config));
  await put(root, 'AGENTS.md', (await readFile(path.join(root, 'AGENTS.md'), 'utf8')).replace('Plans are read-only', 'Changed managed rule'));
  const agentsBefore = await snapshot(root);
  assert.equal((await upgradeProject({ projectRoot: root, acceptConfig: true, apply: true })).ok, false);
  assert.deepEqual(await snapshot(root), agentsBefore);
});

test('symlink/junction project parents and .github parents are rejected', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'actual'));
  await symlink(path.join(root, 'actual'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(inspectProject(path.join(root, 'linked')), /Symbolic links|reparse|resolves outside/);
  await symlink(path.join(root, 'actual'), path.join(root, '.github'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(adoptProject({ projectRoot: root, repository: 'example/project', apply: true }), /Symbolic links|reparse|resolves outside/);
  assert.deepEqual(await readdir(path.join(root, 'actual')), []);
});

test('malformed receipts and ambiguous AGENTS markers fail closed', async t => {
  const root = await fixture(t);
  await put(root, '.github/project-workflow.receipt.json', '{"schema":1,"files":[]}');
  await assert.rejects(adoptProject({ projectRoot: root, repository: 'example/project', apply: true }), /receipt/);
  await rm(path.join(root, '.github/project-workflow.receipt.json'));
  await put(root, 'AGENTS.md', '<!-- BEGIN PROJECT-WORKFLOW MANAGED -->\nowner text\n');
  await assert.rejects(adoptProject({ projectRoot: root, repository: 'example/project', apply: true }), /markers/);
});
