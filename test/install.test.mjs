import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installSkill, skillStatus, uninstallSkill } from '../lib/install.mjs';
import { SOURCE_ROOT, sha256, toolkitVersion } from '../lib/project.mjs';

const PARENT = path.dirname(SOURCE_ROOT);
const RECEIPT = '.project-workflow-install.json';
async function fixture(t) {
  const root = await mkdtemp(path.join(PARENT, '.tywf-install-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), PARENT);
    assert.equal((await lstat(root)).isSymbolicLink(), false);
    await rm(root, { recursive: true, force: true });
  });
  return { root, destination: path.join(root, 'client-skills', 'tangyixiao-workflow') };
}
async function put(filename, text) { await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, text); }
async function receipt(destination) { return JSON.parse(await readFile(path.join(destination, RECEIPT), 'utf8')); }
async function snapshot(root) {
  const result = {};
  async function walk(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.isFile()) result[path.relative(root, full)] = (await readFile(full)).toString('base64');
    }
  }
  await walk(root);
  return result;
}

test('install is a plan by default and does not even create destination parents', async t => {
  const { root, destination } = await fixture(t);
  const result = await installSkill({ destination });
  assert.equal(result.ok, true);
  assert.equal(result.applied, false);
  assert.ok(result.changes.some(file => file.path === 'runtime/bin/pwf.mjs'));
  assert.deepEqual(await readdir(root), []);
});

test('applied install includes a bounded self-contained runtime and repeats byte-identically', async t => {
  const { root, destination } = await fixture(t);
  const first = await installSkill({ destination, apply: true });
  assert.equal(first.ok, true);
  const record = await receipt(destination);
  assert.equal(record.toolkitVersion, await toolkitVersion());
  assert.ok(record.files.some(file => file.path === 'runtime/lib/project.mjs'));
  assert.ok(record.files.some(file => file.path === 'runtime/lib/install.mjs'));
  assert.ok(record.files.some(file => file.path === 'runtime/package.json'));
  assert.ok(record.files.every(file => !/(?:^|\/)(?:test|docs|images|node_modules|\.git)(?:\/|$)/.test(file.path)));
  for (const file of record.files) assert.equal(sha256(await readFile(path.join(destination, file.path))), file.sha256);
  const before = await snapshot(root);
  const repeated = await installSkill({ destination, apply: true });
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.changes, []);
  assert.deepEqual(await snapshot(root), before);
  const status = await skillStatus({ destination });
  assert.equal(status.installed, true);
  assert.deepEqual(status.modified, []);
});

test('an unmanaged target file blocks install without changing any files', async t => {
  const { root, destination } = await fixture(t);
  await put(path.join(destination, 'SKILL.md'), '# Owner skill\n');
  await put(path.join(destination, 'foreign.txt'), 'owner data');
  const before = await snapshot(root);
  const result = await installSkill({ destination, apply: true });
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some(file => file.path === 'SKILL.md'));
  assert.deepEqual(await snapshot(root), before);
});

test('upgrade replaces unchanged old managed bytes and preserves unrelated files', async t => {
  const { destination } = await fixture(t);
  await installSkill({ destination, apply: true });
  const record = await receipt(destination);
  const old = Buffer.from('# Earlier managed skill\n');
  await writeFile(path.join(destination, 'SKILL.md'), old);
  record.toolkitVersion = '0.0.0';
  record.files.find(file => file.path === 'SKILL.md').sha256 = sha256(old);
  await writeFile(path.join(destination, RECEIPT), JSON.stringify(record));
  await writeFile(path.join(destination, 'foreign.txt'), 'keep these bytes');
  const result = await installSkill({ destination, apply: true });
  assert.equal(result.ok, true);
  assert.ok(result.changes.some(file => file.path === 'SKILL.md' && file.action === 'update'));
  assert.equal(await readFile(path.join(destination, 'foreign.txt'), 'utf8'), 'keep these bytes');
  assert.equal((await receipt(destination)).toolkitVersion, await toolkitVersion());
});

test('modified managed files stop the entire upgrade and appear in status', async t => {
  const { root, destination } = await fixture(t);
  await installSkill({ destination, apply: true });
  await writeFile(path.join(destination, 'SKILL.md'), '# Local customizations\n');
  const before = await snapshot(root);
  const result = await installSkill({ destination, apply: true });
  assert.equal(result.ok, false);
  assert.deepEqual((await skillStatus({ destination })).modified, ['SKILL.md']);
  assert.deepEqual(await snapshot(root), before);
});

test('uninstall plans are read-only and applied uninstall retains modified and foreign files', async t => {
  const { root, destination } = await fixture(t);
  await installSkill({ destination, apply: true });
  await writeFile(path.join(destination, 'SKILL.md'), '# Keep modified skill\n');
  await writeFile(path.join(destination, 'foreign.txt'), 'keep foreign');
  const before = await snapshot(root);
  const plan = await uninstallSkill({ destination });
  assert.equal(plan.applied, false);
  assert.deepEqual(await snapshot(root), before);
  const result = await uninstallSkill({ destination, apply: true });
  assert.equal(result.complete, false);
  assert.equal(await readFile(path.join(destination, 'SKILL.md'), 'utf8'), '# Keep modified skill\n');
  assert.equal(await readFile(path.join(destination, 'foreign.txt'), 'utf8'), 'keep foreign');
  assert.deepEqual((await receipt(destination)).files.map(file => file.path), ['SKILL.md']);
  assert.ok(result.retained.some(file => file.path === 'foreign.txt'));
});

test('clean uninstall removes only owned empty directories and keeps pre-existing empty directories', async t => {
  const { root, destination } = await fixture(t);
  await mkdir(path.join(destination, 'references'), { recursive: true });
  await mkdir(path.join(destination, 'owner-empty'));
  await installSkill({ destination, apply: true });
  const result = await uninstallSkill({ destination, apply: true });
  assert.equal(result.ok, true);
  assert.deepEqual((await readdir(destination)).sort(), ['owner-empty', 'references']);
  assert.equal((await lstat(root)).isDirectory(), true);
});

test('uninstall without a receipt never deletes foreign content', async t => {
  const { root, destination } = await fixture(t);
  await put(path.join(destination, 'SKILL.md'), 'not installer owned');
  const before = await snapshot(root);
  const result = await uninstallSkill({ destination, apply: true });
  assert.equal(result.installed, false);
  assert.deepEqual(await snapshot(root), before);
});

test('receipt traversal, backslashes, absolute paths and duplicate entries are rejected before deletion', async t => {
  const { root, destination } = await fixture(t);
  await installSkill({ destination, apply: true });
  const original = await receipt(destination);
  const outside = path.join(root, 'outside.txt');
  await writeFile(outside, 'must survive');
  for (const dangerous of ['../outside.txt', 'runtime\\lib\\project.mjs', '/outside.txt', 'C:/outside.txt']) {
    const changed = structuredClone(original);
    changed.files.push({ path: dangerous, sha256: sha256(Buffer.from('must survive')) });
    await writeFile(path.join(destination, RECEIPT), JSON.stringify(changed));
    await assert.rejects(uninstallSkill({ destination, apply: true }), /Unsafe|Invalid/);
    assert.equal(await readFile(outside, 'utf8'), 'must survive');
    assert.equal((await lstat(path.join(destination, 'SKILL.md'))).isFile(), true);
  }
  const duplicated = structuredClone(original);
  duplicated.files.push(duplicated.files[0]);
  await writeFile(path.join(destination, RECEIPT), JSON.stringify(duplicated));
  await assert.rejects(uninstallSkill({ destination, apply: true }), /Invalid/);
});

test('source overlap and symlink/junction destination parents are rejected without copying', async t => {
  const { root } = await fixture(t);
  for (const destination of [SOURCE_ROOT, path.dirname(SOURCE_ROOT), path.join(SOURCE_ROOT, 'nested-skill')]) {
    await assert.rejects(installSkill({ destination, apply: true }), /overlaps/);
  }
  await mkdir(path.join(root, 'actual'));
  await symlink(path.join(root, 'actual'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(installSkill({ destination: path.join(root, 'linked', 'skill'), apply: true }), /Symbolic links|reparse|resolves outside/);
  assert.deepEqual(await readdir(path.join(root, 'actual')), []);
});

test('a linked managed directory is never followed during status or uninstall', async t => {
  const { root, destination } = await fixture(t);
  await installSkill({ destination, apply: true });
  await mkdir(path.join(root, 'external'));
  await writeFile(path.join(root, 'external', 'owner.txt'), 'keep outside');
  const managed = path.join(destination, 'runtime', 'lib');
  const archived = path.join(root, 'original-lib');
  // Move our fixture's owned files; never delete a user directory to create a link.
  const { rename } = await import('node:fs/promises');
  await rename(managed, archived);
  await symlink(path.join(root, 'external'), managed, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(skillStatus({ destination }), /Symbolic links|reparse|resolves outside/);
  await assert.rejects(uninstallSkill({ destination, apply: true }), /Symbolic links|reparse|resolves outside/);
  assert.equal(await readFile(path.join(root, 'external', 'owner.txt'), 'utf8'), 'keep outside');
});

test('installed runtime can reinstall a second self-contained skill without the source layout', async t => {
  const { root, destination } = await fixture(t);
  await installSkill({ destination, apply: true });
  const bundled = await import(pathToFileURL(path.join(destination, 'runtime/lib/install.mjs')).href);
  const second = path.join(root, 'other-client', 'tangyixiao-workflow');
  const result = await bundled.installSkill({ destination: second, apply: true });
  assert.equal(result.ok, true);
  assert.equal(await readFile(path.join(second, 'SKILL.md'), 'utf8'), await readFile(path.join(destination, 'SKILL.md'), 'utf8'));
  const names = (await receipt(second)).files.map(file => file.path);
  assert.ok(names.includes('runtime/bin/pwf.mjs'));
  assert.ok(names.includes('runtime/LICENSE'));
  assert.ok(names.includes('runtime/NOTICE'));
  assert.ok(names.every(name => !name.includes('runtime/runtime') && !name.includes('runtime/skills')));
});

test('installed runtime can inspect and uninstall its own unchanged installation', async t => {
  const { destination } = await fixture(t);
  await installSkill({ destination, apply: true });
  const bundled = await import(pathToFileURL(path.join(destination, 'runtime/lib/install.mjs')).href);
  const status = await bundled.skillStatus({ destination });
  assert.equal(status.installed, true);
  assert.equal(status.complete, true);
  assert.deepEqual(status.modified, []);
  const plan = await bundled.uninstallSkill({ destination });
  assert.equal(plan.applied, false);
  assert.equal((await lstat(path.join(destination, 'SKILL.md'))).isFile(), true);
  const result = await bundled.uninstallSkill({ destination, apply: true });
  assert.equal(result.applied, true);
  await assert.rejects(lstat(path.join(destination, 'SKILL.md')), { code: 'ENOENT' });
});

test('preserved edited residue after uninstall is not reported as a complete installation', async t => {
  const { destination } = await fixture(t);
  await installSkill({ destination, apply:true });
  await writeFile(path.join(destination,'references/resources.md'),'Private edited guidance');
  await uninstallSkill({ destination, apply:true });
  const status = await skillStatus({ destination });
  assert.equal(status.tracked,true);
  assert.equal(status.installed,false);
  assert.equal(status.complete,false);
  assert.equal(status.state,'partial');
});
