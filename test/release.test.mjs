import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath, symlink, access, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { checkRelease } from '../lib/release.mjs';
const execute = promisify(execFile);

test('exports the release checker described by the contract', () => {
  assert.equal(typeof checkRelease, 'function');
});

async function json(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function git(projectRoot, ...args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const result = await execute('git', ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.invalid', '-C', projectRoot, ...args], { env, shell: false });
  return result.stdout.trim();
}

async function fixture(t, { version = '1.2.3', packageName = 'widget' } = {}) {
  const tempBase = await realpath(tmpdir());
  const owned = await mkdtemp(path.join(tempBase, 'tywf-release-'));
  t.after(async () => {
    assert.equal(path.dirname(owned), tempBase);
    assert.ok(path.basename(owned).startsWith('tywf-release-'));
    await rm(owned, { recursive: true, force: true });
  });
  const projectRoot = path.join(owned, 'project');
  await mkdir(projectRoot);
  const configPath = path.join(projectRoot, '.github', 'project-workflow.json');
  const candidatePath = path.join(projectRoot, 'work', 'candidate.json');
  const stem = packageName.replace(/^@/, '').replace('/', '-');
  const assetPath = `work/${stem}-${version}.tgz`;
  const asset = Buffer.from('An opaque fixture archive: archive internals have not been checked.');
  await mkdir(path.join(projectRoot, 'work'));
  await writeFile(path.join(projectRoot, assetPath), asset);
  await json(path.join(projectRoot, 'package.json'), { name: packageName, version });
  await json(path.join(projectRoot, 'package-lock.json'), {
    name: packageName, version, lockfileVersion: 3,
    packages: { '': { name: packageName, version } },
  });
  await git(projectRoot, 'init', '-q');
  await git(projectRoot, 'add', '--', 'package.json', 'package-lock.json');
  await git(projectRoot, 'commit', '-qm', 'Fixture source');
  const sourceCommit = await git(projectRoot, 'rev-parse', 'HEAD');
  try {
    await git(projectRoot, 'check-ref-format', `refs/tags/v${version}`);
    await git(projectRoot, 'tag', `v${version}`);
  } catch (error) {
    if (!version.includes('..')) throw error;
  }
  const preview = version.split('+')[0].includes('-');
  const installTarget = `npm install ${packageName}@${version}`;
  const config = {
    schema: 1, toolkitVersion: '0.1.0-alpha.1', repository: 'example/widget', profile: 'npm',
    release: {
      productId: 'widget', displayName: 'Widget', packageName, manifest: 'package.json', tagPrefix: 'v',
      installTarget: 'npm install {packageName}@{version}',
      channels: {
        stable: { prerelease: false, npmTag: 'latest', latestEligible: true },
        preview: { prerelease: true, npmTag: 'next', latestEligible: false },
      },
    },
  };
  const candidate = {
    productId: 'widget', version, tag: `v${version}`, title: `Widget v${version}`,
    channel: preview ? 'preview' : 'stable', prerelease: preview, makeLatest: !preview,
    npmTag: preview ? 'next' : 'latest', sourceCommit,
    notes: `Widget ${version} fixes the release identity validation and preserves compatible behavior. Install using: ${installTarget}. Archive inspection, installation and runtime acceptance remain separate checks.`,
    installTarget,
    assets: [{ path: assetPath, sha256: createHash('sha256').update(asset).digest('hex') }],
  };
  await json(configPath, config);
  await json(candidatePath, candidate);
  return {
    owned, projectRoot, configPath, candidatePath, config, candidate,
    async save() { await json(configPath, config); await json(candidatePath, candidate); },
    async check(options = {}) { return checkRelease({ projectRoot, candidatePath, ...options }); },
  };
}

function failed(result, id) {
  assert.equal(result.ok, false);
  assert.ok(result.checks.some(check => check.id === id && check.ok === false), JSON.stringify(result.checks));
}

test('accepts a coherent candidate but explicitly leaves archive and runtime evidence unverified', async t => {
  const f = await fixture(t);
  const result = await f.check();
  assert.equal(result.ok, true, JSON.stringify(result.checks));
  assert.equal(result.gateScope, 'metadata-and-asset-integrity');
  for (const scope of ['archive-contents', 'installation', 'runtime', 'registry-publication']) {
    assert.ok(result.notVerified.includes(scope));
  }
  assert.equal(result.assets[0].actualSha256, f.candidate.assets[0].sha256);
  assert.equal(result.sourceCommit, f.candidate.sourceCommit);
});

for (const version of ['0.0.0-alpha.1+build.001', '1.2.3-0', '1.2.3+001']) {
  test(`accepts SemVer ${version} without confusing build metadata with a preview`, async t => {
    const f = await fixture(t, { version });
    assert.equal((await f.check()).ok, true);
  });
}

for (const version of ['01.2.3', '1.02.3', '1.2.03', '1.2.3-01', '1.2.3-alpha.01', '1.2.3-alpha..1', '1.2.3+']) {
  test(`rejects invalid SemVer ${version}`, async t => {
    const f = await fixture(t, { version });
    failed(await f.check(), 'version.semver');
  });
}

test('expands a scoped npm package to the actual npm pack filename', async t => {
  const f = await fixture(t, { packageName: '@example/widget' });
  assert.equal((await f.check()).ok, true);
});

test('rejects product identity, root package identity and lockfile drift separately', async t => {
  const f = await fixture(t);
  f.candidate.productId = 'another-product';
  await f.save();
  failed(await f.check(), 'identity.product');
  f.candidate.productId = 'widget';
  await f.save();
  await json(path.join(f.projectRoot, 'package.json'), { name: 'another-package', version: '1.2.3' });
  failed(await f.check(), 'manifest.identity');
  await json(path.join(f.projectRoot, 'package.json'), { name: 'widget', version: '1.2.3' });
  await json(path.join(f.projectRoot, 'package-lock.json'), {
    name: 'widget', version: '1.2.3', packages: { '': { name: 'widget', version: '1.2.2' } },
  });
  failed(await f.check(), 'lockfile.identity');
});

test('does not accept a different checked-out manifest version merely because the old tag exists', async t => {
  const f = await fixture(t);
  await json(path.join(f.projectRoot, 'package.json'), { name: 'widget', version: '1.2.4' });
  failed(await f.check(), 'manifest.identity');
});

test('rejects title/tag and preview/latest disagreements', async t => {
  const f = await fixture(t, { version: '1.3.0-preview.1' });
  f.candidate.title = 'Some Other Product v1.3.0-preview.1';
  f.candidate.makeLatest = true;
  f.candidate.npmTag = 'latest';
  await f.save();
  const result = await f.check();
  failed(result, 'identity.title');
  failed(result, 'channel.latest');
  failed(result, 'channel.npm');
});

test('requires prerelease SemVer and GitHub flags to agree with the declared channel', async t => {
  const f = await fixture(t, { version: '1.3.0-community.4' });
  f.candidate.channel = 'stable';
  f.candidate.prerelease = false;
  f.candidate.npmTag = 'latest';
  f.candidate.makeLatest = false;
  await f.save();
  failed(await f.check(), 'channel.version');
  f.candidate.channel = 'preview';
  f.candidate.npmTag = 'next';
  await f.save();
  failed(await f.check(), 'channel.prerelease');
});

test('allows a stable maintenance release without moving latest and supports configured preview npm tags', async t => {
  const f = await fixture(t);
  f.candidate.makeLatest = false;
  await f.save();
  assert.equal((await f.check()).ok, true);
  const p = await fixture(t, { version: '1.3.0-rc.1' });
  p.config.release.channels.preview.npmTag = 'canary';
  p.candidate.npmTag = 'canary';
  await p.save();
  assert.equal((await p.check()).ok, true);
});

test('rejects an unsafe configuration that maps a preview channel to npm latest', async t => {
  const f = await fixture(t);
  f.config.release.channels.preview.npmTag = 'latest';
  await f.save();
  await assert.rejects(f.check(), /preview|prerelease|latest/i);
});

test('compares a local tag to the declared commit instead of trusting candidate text', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.projectRoot, 'change.txt'), 'A later source revision.');
  await git(f.projectRoot, 'add', '--', 'change.txt');
  await git(f.projectRoot, 'commit', '-qm', 'Another revision');
  f.candidate.sourceCommit = await git(f.projectRoot, 'rev-parse', 'HEAD');
  await f.save();
  failed(await f.check(), 'git.tag');
});

test('fails when the release tag or declared commit is missing', async t => {
  const f = await fixture(t);
  await git(f.projectRoot, 'tag', '-d', f.candidate.tag);
  failed(await f.check(), 'git.tag');
  f.candidate.sourceCommit = '0'.repeat(40);
  await f.save();
  failed(await f.check(), 'git.source');
});

test('checks real asset bytes and requires the versioned product asset', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.projectRoot, f.candidate.assets[0].path), 'tampered bytes');
  failed(await f.check(), 'assets.integrity');
  f.candidate.assets = [];
  await f.save();
  failed(await f.check(), 'assets.required');
});

test('reports missing assets as a failed gate and honors custom required asset patterns', async t => {
  const f = await fixture(t);
  await rm(path.join(f.projectRoot, f.candidate.assets[0].path));
  failed(await f.check(), 'assets.integrity');
  f.config.release.requiredAssets = ['desktop-{version}.zip'];
  const bytes = Buffer.from('An opaque desktop ZIP fixture.');
  await writeFile(path.join(f.projectRoot, 'work', 'desktop-1.2.3.zip'), bytes);
  f.candidate.assets = [{ path: 'work/desktop-1.2.3.zip', sha256: createHash('sha256').update(bytes).digest('hex') }];
  await f.save();
  assert.equal((await f.check()).ok, true);
});

test('requires notes to explain the release and show the configured installation target', async t => {
  const f = await fixture(t);
  f.candidate.notes = 'Follow the upgrade.';
  await f.save();
  failed(await f.check(), 'notes.content');
  f.candidate.notes = `Widget 1.2.3 fixes version identity and includes extensive compatible changes for existing users. Install using: zcode plugins install another-product. Archive and runtime acceptance remain separate.`;
  await f.save();
  failed(await f.check(), 'notes.install');
  f.candidate.installTarget = 'zcode plugins install another-product';
  await f.save();
  failed(await f.check(), 'identity.installTarget');
});

test('permits explicitly supplied external config/candidate files without permitting external assets', async t => {
  const f = await fixture(t);
  const externalConfig = path.join(f.owned, 'external-config.json');
  const externalCandidate = path.join(f.owned, 'external-candidate.json');
  await json(externalConfig, f.config);
  await json(externalCandidate, f.candidate);
  assert.equal((await f.check({ configPath: externalConfig, candidatePath: externalCandidate })).ok, true);
  const outsideAsset = path.join(f.owned, 'foreign.tgz');
  await writeFile(outsideAsset, 'private fixture outside the project');
  f.candidate.assets[0].path = outsideAsset;
  await json(externalCandidate, f.candidate);
  await assert.rejects(f.check({ configPath: externalConfig, candidatePath: externalCandidate }), /outside|boundary/i);
});

test('rejects traversal segments before resolving an input or asset path', async t => {
  const f = await fixture(t);
  await assert.rejects(f.check({ candidatePath: 'work/../work/candidate.json' }), /traversal|\.\./i);
  f.candidate.assets[0].path = '../foreign.tgz';
  await f.save();
  await assert.rejects(f.check(), /traversal|outside|boundary/i);
});

test('refuses symlinked config, candidate and asset directories', async t => {
  const f = await fixture(t);
  const store = path.join(f.owned, 'metadata');
  await mkdir(store);
  await json(path.join(store, 'config.json'), f.config);
  await json(path.join(store, 'candidate.json'), f.candidate);
  const linked = path.join(f.owned, 'linked');
  await symlink(store, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.check({ configPath: path.join(linked, 'config.json') }), /symlink|symbolic/i);
  await assert.rejects(f.check({ candidatePath: path.join(linked, 'candidate.json') }), /symlink|symbolic/i);
  const assetLink = path.join(f.projectRoot, 'work', 'linked-assets');
  await symlink(path.join(f.projectRoot, 'work'), assetLink, process.platform === 'win32' ? 'junction' : 'dir');
  f.candidate.assets[0].path = `work/linked-assets/${path.basename(f.candidate.assets[0].path)}`;
  await f.save();
  await assert.rejects(f.check(), /symlink|symbolic/i);
});

test('rejects a symlinked manifest and never executes manifest scripts', async t => {
  const f = await fixture(t);
  const marker = path.join(f.owned, 'must-not-exist');
  await json(path.join(f.projectRoot, 'package.json'), {
    name: 'widget', version: '1.2.3',
    scripts: { prepublishOnly: `node -e "require('fs').writeFileSync(${JSON.stringify(marker)},'executed')"` },
  });
  await git(f.projectRoot, 'add', '--', 'package.json');
  await git(f.projectRoot, 'commit', '-qm', 'Freeze manifest containing an inert script');
  f.candidate.sourceCommit = await git(f.projectRoot, 'rev-parse', 'HEAD');
  await git(f.projectRoot, 'tag', '-d', f.candidate.tag);
  await git(f.projectRoot, 'tag', f.candidate.tag);
  await f.save();
  assert.equal((await f.check()).ok, true);
  await assert.rejects(access(marker), { code: 'ENOENT' });
  const link = path.join(f.projectRoot, 'linked-manifest');
  await symlink(f.projectRoot, link, process.platform === 'win32' ? 'junction' : 'dir');
  f.config.release.manifest = 'linked-manifest/package.json';
  await f.save();
  await assert.rejects(f.check(), /symlink|symbolic/i);
});

test('does not let ambient GIT_DIR redirect source verification to another repository', async t => {
  const f = await fixture(t);
  const previous = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(f.owned, 'missing-git-directory');
  try {
    assert.equal((await f.check()).ok, true);
  } finally {
    if (previous === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previous;
  }
});

test('rejects malformed JSON instead of evaluating it', async t => {
  const f = await fixture(t);
  await writeFile(f.candidatePath, '({ version: process.exit(99) })');
  await assert.rejects(f.check(), /JSON/i);
});

test('requires the root package entry in a modern npm lockfile', async t => {
  const f = await fixture(t);
  await json(path.join(f.projectRoot, 'package-lock.json'), {
    name: 'widget', version: '1.2.3', lockfileVersion: 3, packages: {},
  });
  failed(await f.check(), 'lockfile.identity');
});

test('peels annotated release tags but requires sourceCommit itself to identify a commit', async t => {
  const f = await fixture(t);
  await git(f.projectRoot, 'tag', '-d', f.candidate.tag);
  await git(f.projectRoot, 'tag', '-a', '-m', 'A release tag', f.candidate.tag);
  assert.equal((await f.check()).ok, true);
  f.candidate.sourceCommit = await git(f.projectRoot, 'rev-parse', `refs/tags/${f.candidate.tag}`);
  await f.save();
  failed(await f.check(), 'git.source');
});

test('blocks an empty attachment even when its declared hash is correct', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.projectRoot, f.candidate.assets[0].path), '');
  f.candidate.assets[0].sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  await f.save();
  failed(await f.check(), 'assets.integrity');
});

test('includes public-note hygiene failures and preserves nonblocking editorial advisories', async t => {
  const f = await fixture(t);
  f.candidate.notes += ' Published from this source with user authorization.';
  await f.save();
  failed(await f.check(), 'notes-no-private-instructions');
  f.candidate.notes = `Widget 1.2.3 fixes startup identity checks for existing users. Install using: npm install widget@1.2.3. Validation: 283 offline tests passed.`;
  await f.save();
  const result = await f.check();
  assert.equal(result.ok, true);
  assert.ok(result.advisories.some(advisory => advisory.id === 'validation-in-main-copy'));
});

test('accepts concise release information without encouraging padding', async t => {
  const f = await fixture(t);
  f.candidate.notes = 'Fix startup in 1.2.3. Install: npm install widget@1.2.3.';
  await f.save();
  assert.equal((await f.check()).ok, true);
});

test('rejects a different checkout HEAD even when package version and the declared tag still match', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.projectRoot, 'another-source.txt'), 'A different source revision at the same package version.');
  await git(f.projectRoot, 'add', '--', 'another-source.txt');
  await git(f.projectRoot, 'commit', '-qm', 'Change source without changing package version');
  const result = await f.check();
  assert.ok(result.checks.some(check => check.id === 'git.tag' && check.ok));
  assert.ok(result.checks.some(check => check.id === 'manifest.identity' && check.ok));
  failed(result, 'git.checkout');
});

test('rejects staged and unstaged tracked edits while allowing untracked or ignored candidate scratch', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.projectRoot, 'work', 'extra-untracked.txt'), 'Disposable evidence scratch.');
  await writeFile(path.join(f.projectRoot, '.git', 'info', 'exclude'), '*.scratch\n');
  await writeFile(path.join(f.projectRoot, 'ignored.scratch'), 'Ignored task evidence.');
  assert.equal((await f.check()).ok, true);
  await json(path.join(f.projectRoot, 'package.json'), { name: 'widget', version: '1.2.3', description: 'Uncommitted tracked change.' });
  failed(await f.check(), 'git.tracked-clean');
  await git(f.projectRoot, 'add', '--', 'package.json');
  failed(await f.check(), 'git.tracked-clean');
});

for (const flag of ['assume-unchanged', 'skip-worktree']) {
  test(`refuses a changed tracked source hidden by ${flag} without changing the index flag`, async t => {
    const f = await fixture(t);
    const sourcePath = path.join(f.projectRoot, 'source.txt');
    await writeFile(sourcePath, 'Accepted release source.\n');
    await git(f.projectRoot, 'add', '--', 'source.txt');
    await git(f.projectRoot, 'commit', '-qm', 'Freeze tracked release source');
    f.candidate.sourceCommit = await git(f.projectRoot, 'rev-parse', 'HEAD');
    await git(f.projectRoot, 'tag', '-d', f.candidate.tag);
    await git(f.projectRoot, 'tag', f.candidate.tag);
    await f.save();
    assert.equal((await f.check()).ok, true);
    await git(f.projectRoot, 'update-index', `--${flag}`, '--', 'source.txt');
    await writeFile(sourcePath, 'Changed release source hidden from normal Git status.\n');
    assert.equal(await git(f.projectRoot, 'status', '--porcelain=v1', '--untracked-files=no'), '');
    const indexBefore = await git(f.projectRoot, 'ls-files', '-v', '-z');
    const result = await f.check();
    failed(result, 'git.index-flags');
    assert.match(result.checks.find(check => check.id === 'git.index-flags').message, /clear|complete checkout/i);
    assert.equal(await git(f.projectRoot, 'ls-files', '-v', '-z'), indexBefore);
    assert.equal(await git(f.projectRoot, 'rev-parse', 'HEAD'), f.candidate.sourceCommit);
    assert.equal(await readFile(sourcePath, 'utf8'), 'Changed release source hidden from normal Git status.\n');
  });
}

for (const filterType of ['clean', 'process']) {
  test(`does not execute a configured ${filterType} filter while inspecting changed tracked source`, async t => {
    const f = await fixture(t);
    const marker = path.join(f.owned, 'filter-executed');
    const sourcePath = path.join(f.projectRoot, 'source.txt');
    const command = 'node filter.cjs';
    await writeFile(sourcePath, `${'A'.repeat(128)}\n`);
    await writeFile(path.join(f.projectRoot, '.gitattributes'), 'source.txt filter=probe\n');
    await writeFile(path.join(f.projectRoot, 'filter.cjs'),
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed');\n` +
      (filterType === 'clean' ? 'process.stdin.pipe(process.stdout);\n' : 'process.exit(0);\n'));
    await git(f.projectRoot, 'add', '--', 'source.txt', '.gitattributes', 'filter.cjs');
    await git(f.projectRoot, 'commit', '-qm', 'Freeze tracked filter fixture');
    f.candidate.sourceCommit = await git(f.projectRoot, 'rev-parse', 'HEAD');
    await git(f.projectRoot, 'tag', '-d', f.candidate.tag);
    await git(f.projectRoot, 'tag', f.candidate.tag);
    await f.save();
    await git(f.projectRoot, 'config', '--local', `filter.probe.${filterType}`, command);
    // Matching byte length forces Git to inspect content instead of relying on a size-only change.
    await writeFile(sourcePath, `${'B'.repeat(128)}\n`);
    const changedAt = new Date(Date.now() + 2000);
    await utimes(sourcePath, changedAt, changedAt);
    await rm(marker, { force: true });
    const indexBefore = await readFile(path.join(f.projectRoot, '.git', 'index'));
    const result = await f.check();
    await assert.rejects(access(marker), { code: 'ENOENT' });
    failed(result, 'git.filter-commands');
    assert.match(result.checks.find(check => check.id === 'git.filter-commands').message, new RegExp(`filter\\.probe\\.${filterType}`));
    assert.equal(JSON.stringify(result).includes(command), false);
    assert.deepEqual(await readFile(path.join(f.projectRoot, '.git', 'index')), indexBefore);
    assert.equal(await git(f.projectRoot, 'config', '--local', '--get', `filter.probe.${filterType}`), command);
  });
}

test('allows a configured filter driver that no tracked path uses', async t => {
  const f = await fixture(t);
  await git(f.projectRoot, 'config', '--local', 'filter.unused.clean', 'node this-filter-must-not-run.cjs');
  assert.equal((await f.check()).ok, true);
});

test('refuses a tracked gitlink without entering a submodule worktree', async t => {
  const f = await fixture(t);
  await git(f.projectRoot, 'update-index', '--add', '--cacheinfo', `160000,${f.candidate.sourceCommit},nested`);
  await git(f.projectRoot, 'commit', '-qm', 'Freeze a gitlink fixture without cloning a submodule');
  f.candidate.sourceCommit = await git(f.projectRoot, 'rev-parse', 'HEAD');
  await git(f.projectRoot, 'tag', '-d', f.candidate.tag);
  await git(f.projectRoot, 'tag', f.candidate.tag);
  await f.save();
  const result = await f.check();
  failed(result, 'git.submodules');
  assert.match(result.checks.find(check => check.id === 'git.tracked-clean').message, /skipped/i);
  await assert.rejects(access(path.join(f.projectRoot, 'nested')), { code: 'ENOENT' });
});

test('does not accept untracked manifest or lockfile bytes as evidence of the tagged source', async t => {
  const f = await fixture(t);
  await git(f.projectRoot, 'rm', '--cached', '--', 'package.json', 'package-lock.json');
  await git(f.projectRoot, 'commit', '-qm', 'Remove metadata from the tracked source but retain working files');
  f.candidate.sourceCommit = await git(f.projectRoot, 'rev-parse', 'HEAD');
  await git(f.projectRoot, 'tag', '-d', f.candidate.tag);
  await git(f.projectRoot, 'tag', f.candidate.tag);
  await f.save();
  assert.equal(await git(f.projectRoot, 'status', '--porcelain=v1', '--untracked-files=no'), '');
  const result = await f.check();
  assert.ok(result.checks.some(check => check.id === 'manifest.identity' && check.ok));
  failed(result, 'manifest.source');
  failed(result, 'lockfile.source');
});
