import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { reviewReleaseNotes } from './notes.mjs';

const execute = promisify(execFile);
const MAX_JSON_BYTES = 1024 * 1024;
const MAX_TRACKED_FILTER_PATHS = 10000;
const FILTER_PATHS_PER_BATCH = 100;
const MAX_FILTER_BATCHES = 100;
const NOT_VERIFIED = Object.freeze([
  'archive-contents', 'installation', 'runtime', 'registry-publication', 'build-provenance',
]);

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be a nonempty, trimmed string without control characters.`);
  }
  return value;
}

function unsafe(message) {
  const error = new Error(message);
  error.code = 'UNSAFE_RELEASE_PATH';
  return error;
}

function inputPath(value, base, boundary) {
  text(value, 'Input path');
  if (value.split(/[\\/]/).includes('..')) throw unsafe(`Path traversal is not allowed: ${value}`);
  if (process.platform !== 'win32' && (/^[A-Za-z]:/.test(value) || value.startsWith('\\'))) {
    throw unsafe('A foreign absolute path cannot be resolved safely on this platform.');
  }
  const resolved = path.resolve(base, value);
  const relative = boundary ? path.relative(boundary, resolved) : null;
  if (boundary && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) {
    throw unsafe(`Path is outside the project boundary: ${value}`);
  }
  // An alternate data stream is not a release file. The drive separator is outside this portion.
  if (path.relative(path.parse(resolved).root, resolved).includes(':')) throw unsafe('Alternate data stream paths are not allowed.');
  return resolved;
}

async function noSymlinks(absolute, { missingAllowed = false } = {}) {
  const parsed = path.parse(absolute);
  let current = parsed.root;
  let info = await lstat(current);
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      info = await lstat(current);
    } catch (error) {
      if (missingAllowed && error.code === 'ENOENT') return null;
      throw error;
    }
    if (info.isSymbolicLink()) throw unsafe(`Symbolic links are not allowed in release input paths: ${current}`);
  }
  return info;
}

async function openRegularFile(absolute) {
  const before = await noSymlinks(absolute);
  if (!before.isFile()) throw new Error(`Release input must be a regular file: ${absolute}`);
  let handle;
  try {
    handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    const after = await noSymlinks(absolute);
    if (!opened.isFile() || before.ino !== opened.ino || before.dev !== opened.dev || after.ino !== opened.ino || after.dev !== opened.dev) {
      throw unsafe(`Release input changed while it was opened: ${absolute}`);
    }
    return { handle, info: opened };
  } catch (error) {
    await handle?.close();
    if (error.code === 'ELOOP') throw unsafe(`Symbolic links are not allowed: ${absolute}`);
    throw error;
  }
}

async function readJson(absolute) {
  const { handle, info } = await openRegularFile(absolute);
  try {
    if (info.size > MAX_JSON_BYTES) throw new Error(`JSON input exceeds the 1 MiB metadata limit: ${absolute}`);
    const content = await handle.readFile({ encoding: 'utf8' });
    if (Buffer.byteLength(content, 'utf8') > MAX_JSON_BYTES) throw new Error(`JSON input exceeds the metadata limit: ${absolute}`);
    try {
      return object(JSON.parse(content), `JSON input ${absolute}`);
    } catch (error) {
      throw new Error(`Invalid JSON object in ${absolute}`, { cause: error });
    }
  } finally {
    await handle.close();
  }
}

function semver(version) {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match || match[4]?.split('.').some(part => /^[0-9]+$/.test(part) && part.length > 1 && part.startsWith('0'))) return null;
  return { prerelease: match[4] ?? null, build: match[5] ?? null };
}

function safeTag(tag) {
  return typeof tag === 'string' && tag.length > 0 && tag.length <= 240 &&
    !tag.startsWith('-') && !tag.startsWith('/') && !tag.endsWith('/') && !tag.endsWith('.') &&
    !/[\u0000-\u0020\u007f~^:?*\[\\]/.test(tag) && !tag.includes('..') && !tag.includes('@{') &&
    !tag.includes('//') && !tag.split('/').some(part => part.startsWith('.') || part.endsWith('.lock'));
}

function npmTag(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9._-]*$/.test(value) && !/^v[0-9]/.test(value);
}

function expand(pattern, values, label) {
  const result = text(pattern, label).replace(/\{([A-Za-z]+)\}/g, (token, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Unknown placeholder ${token} in ${label}.`);
    return values[key];
  });
  if (/[{}]/.test(result)) throw new Error(`Unresolved placeholder in ${label}.`);
  return result;
}

async function gitCommand(projectRoot, args, { noMatchAllowed = false, redactError = false } = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  Object.assign(env, {
    GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
    GIT_ALLOW_PROTOCOL: '',
  });
  try {
    const result = await execute('git', [
      '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'protocol.allow=never', '-C', projectRoot,
      ...args,
    ], { shell: false, env, timeout: 5000, maxBuffer: 256 * 1024 });
    return { ok: true, stdout: result.stdout.trim() };
  } catch (error) {
    if (noMatchAllowed && error.code === 1 && !String(error.stdout ?? '').trim() && !String(error.stderr ?? '').trim()) {
      return { ok: true, stdout: '' };
    }
    return { ok: false, error: redactError ? 'Git filter configuration could not be read.'
      : error.code === 'ENOENT' ? 'Git is unavailable.' : String(error.stderr || error.message).trim().slice(0, 300) };
  }
}

async function gitRead(projectRoot, revision) {
  const result = await gitCommand(projectRoot, ['rev-parse', '--verify', '--end-of-options', revision]);
  if (!result.ok) return result;
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(result.stdout)) return { ok: false, error: 'Git did not return one full commit ID.' };
  return { ok: true, sha: result.stdout.toLowerCase() };
}

function nulRecords(value) {
  if (!value) return [];
  if (!value.endsWith('\0') || value.includes('\uFFFD')) return null;
  return value.slice(0, -1).split('\0');
}

async function inspectGitStatusSafety(projectRoot) {
  const stage = await gitCommand(projectRoot, ['ls-files', '--stage', '-z']);
  const records = stage.ok ? nulRecords(stage.stdout) : null;
  const trackedNames = new Set();
  let gitlinks = 0;
  let valid = records !== null;
  for (const record of records ?? []) {
    const match = /^(\d{6}) ([a-f0-9]{40}|[a-f0-9]{64}) [0-3]\t([\s\S]+)$/i.exec(record);
    if (!match) { valid = false; break; }
    if (match[1] === '160000') gitlinks++;
    trackedNames.add(match[3]);
  }
  if (!valid || trackedNames.size > MAX_TRACKED_FILTER_PATHS) {
    return { trackedNames: null, submodules: { ok: false, message: 'Tracked source inspection is incomplete or exceeds its bounded input limit; Git status was skipped.' },
      filters: { ok: false, message: 'Cannot establish filter safety without a complete tracked-path list; Git status was skipped.' } };
  }
  if (gitlinks) {
    return { trackedNames, submodules: { ok: false, message: `${gitlinks} tracked gitlink entry or entries require separate trusted submodule-worktree and packaging acceptance. This alpha does not inspect submodule worktrees; Git status was skipped.` },
      filters: { ok: false, message: 'Submodule filter safety is unverified; Git status was skipped.' } };
  }
  const submodules = { ok: true, message: 'No tracked gitlinks require entering submodule worktrees.' };
  const config = await gitCommand(projectRoot, ['config', '--null', '--get-regexp', '^filter\\..*\\.(clean|process)$'], { noMatchAllowed: true, redactError: true });
  const configRecords = config.ok ? nulRecords(config.stdout) : null;
  if (configRecords === null) return { trackedNames, submodules, filters: { ok: false, message: 'Effective filter configuration could not be safely inspected; Git status was skipped.' } };
  // Git returns matching entries in configuration order; the last value for a scalar key wins.
  const commandValues = new Map();
  for (const record of configRecords) {
    const separator = record.indexOf('\n');
    const name = record.slice(0, separator);
    if (separator < 0 || !/^filter\..+\.(clean|process)$/.test(name) || /[\u0000-\u001f\u007f]/.test(name)) {
      return { trackedNames, submodules, filters: { ok: false, message: 'Unrecognized effective filter configuration evidence; Git status was skipped.' } };
    }
    commandValues.set(name, record.slice(separator + 1));
  }
  const activeDrivers = new Map();
  for (const [name, value] of commandValues) {
    if (!value.trim()) continue;
    const driver = name.slice('filter.'.length, name.lastIndexOf('.'));
    if (!activeDrivers.has(driver)) activeDrivers.set(driver, []);
    activeDrivers.get(driver).push(name);
  }
  if (!activeDrivers.size) return { trackedNames, submodules, filters: { ok: true, message: 'No effective clean/process filter commands are configured.' } };
  const paths = [...trackedNames];
  const batches = Math.ceil(paths.length / FILTER_PATHS_PER_BATCH);
  if (batches > MAX_FILTER_BATCHES) return { trackedNames, submodules, filters: { ok: false, message: 'Filter inspection exceeds its batch limit; Git status was skipped.' } };
  const referenced = new Set();
  for (let start = 0; start < paths.length; start += FILTER_PATHS_PER_BATCH) {
    const batch = paths.slice(start, start + FILTER_PATHS_PER_BATCH);
    const attrs = await gitCommand(projectRoot, ['check-attr', '-z', 'filter', '--', ...batch]);
    const triples = attrs.ok ? nulRecords(attrs.stdout) : null;
    if (triples === null || triples.length !== batch.length * 3) {
      return { trackedNames, submodules, filters: { ok: false, message: 'Tracked filter attributes could not be completely inspected; Git status was skipped.' } };
    }
    for (let index = 0; index < batch.length; index++) {
      const offset = index * 3;
      if (triples[offset] !== batch[index] || triples[offset + 1] !== 'filter') {
        return { trackedNames, submodules, filters: { ok: false, message: 'Unrecognized tracked filter attribute evidence; Git status was skipped.' } };
      }
      for (const name of activeDrivers.get(triples[offset + 2]) ?? []) referenced.add(name);
    }
  }
  return { trackedNames, submodules, filters: referenced.size
    ? { ok: false, message: `Tracked paths reference executable filter configuration: ${[...referenced].map(name => JSON.stringify(name)).join(', ')}. Git status was skipped. Use a trusted checkout without active source filters or perform separate trusted packaging acceptance; the gate does not change filter settings.` }
    : { ok: true, message: 'No tracked path references an effective clean/process filter command; unused configured drivers do not block the gate.' } };
}

async function hashAsset(absolute) {
  const { handle, info } = await openRegularFile(absolute);
  try {
    const hash = createHash('sha256');
    for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await handle.stat();
    const current = await noSymlinks(absolute);
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || current.ino !== info.ino || current.dev !== info.dev) {
      throw unsafe(`Asset changed during integrity verification: ${absolute}`);
    }
    return { sha256: hash.digest('hex'), bytes: after.size };
  } finally {
    await handle.close();
  }
}

/** Read local release evidence. Passing this gate never publishes or installs anything. */
export async function checkRelease({ projectRoot, configPath, candidatePath } = {}) {
  const root = inputPath(projectRoot, process.cwd());
  if (!(await noSymlinks(root)).isDirectory()) throw new Error('projectRoot must be a directory.');
  const configFile = inputPath(configPath ?? '.github/project-workflow.json', root);
  const candidateFile = inputPath(candidatePath, root);
  const config = await readJson(configFile);
  const candidate = await readJson(candidateFile);
  const release = object(config.release, 'config.release');
  for (const key of ['productId', 'displayName', 'packageName', 'installTarget']) text(release[key], `release.${key}`);
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(release.packageName)) throw new Error('release.packageName must be a valid portable npm package identity.');
  const channels = object(release.channels, 'release.channels');
  if (Object.keys(channels).length === 0) throw new Error('At least one release channel must be configured.');
  for (const [name, value] of Object.entries(channels)) {
    const channel = object(value, `release.channels.${name}`);
    if (typeof channel.prerelease !== 'boolean' || typeof channel.latestEligible !== 'boolean' || !npmTag(channel.npmTag)) {
      throw new Error(`Channel ${name} requires boolean prerelease/latestEligible and a valid npmTag.`);
    }
    if (channel.prerelease && (channel.npmTag === 'latest' || channel.latestEligible)) {
      throw new Error(`A preview/prerelease channel cannot use npm latest or be latestEligible: ${name}`);
    }
  }
  const version = text(candidate.version, 'candidate.version');
  const parsedVersion = semver(version);
  const prefix = release.tagPrefix ?? 'v';
  if (typeof prefix !== 'string') throw new Error('release.tagPrefix must be a string.');
  const expectedTag = `${prefix}${version}`;
  const expectedTitle = `${release.displayName} ${expectedTag}`;
  if (parsedVersion && !safeTag(expectedTag)) throw new Error('The configured tag prefix/version cannot form a safe Git tag.');
  const values = { packageName: release.packageName, version, displayName: release.displayName };
  const expectedInstall = expand(release.installTarget, values, 'release.installTarget');
  const checks = [];
  const add = (id, ok, message) => checks.push({ id, ok: Boolean(ok), message });
  add('version.semver', parsedVersion !== null, parsedVersion ? `Valid SemVer: ${version}` : `Invalid SemVer: ${version}`);
  add('identity.product', candidate.productId === release.productId, 'Candidate productId must match the configured product.');
  add('identity.tag', candidate.tag === expectedTag, `Expected tag: ${expectedTag}`);
  add('identity.title', candidate.title === expectedTitle, `Expected title: ${expectedTitle}`);
  add('identity.installTarget', candidate.installTarget === expectedInstall, `Expected installation target: ${expectedInstall}`);

  const manifestFile = inputPath(release.manifest ?? 'package.json', root, root);
  const manifest = await readJson(manifestFile);
  add('manifest.identity', manifest.name === release.packageName && manifest.version === version,
    `Checked-out manifest must identify ${release.packageName}@${version}; found ${manifest.name ?? '(missing name)'}@${manifest.version ?? '(missing version)'}.`);
  const lockPaths = release.lockfile === undefined
    ? ['package-lock.json', 'npm-shrinkwrap.json'].map(name => path.join(path.dirname(manifestFile), name))
    : [inputPath(release.lockfile, root, root)];
  let lockCount = 0;
  const inspectedLocks = [];
  for (const lockPath of lockPaths) {
    if (!(await noSymlinks(lockPath, { missingAllowed: release.lockfile === undefined }))) continue;
    const lock = await readJson(lockPath);
    const packageRoot = lock.packages && Object.hasOwn(lock.packages, '') ? lock.packages[''] : undefined;
    const rootRequired = Number(lock.lockfileVersion) >= 2 || Object.hasOwn(lock, 'packages');
    const matches = lock.name === release.packageName && lock.version === version &&
      ((!rootRequired && packageRoot === undefined) || (packageRoot?.name === release.packageName && packageRoot?.version === version));
    add('lockfile.identity', matches, `${path.relative(root, lockPath)} must agree with the root package identity and version.`);
    inspectedLocks.push(lockPath);
    lockCount++;
  }
  if (!lockCount) add('lockfile.identity', true, 'No npm JSON lockfile is present; lockfile consistency is not applicable.');

  const channel = typeof candidate.channel === 'string' && Object.hasOwn(channels, candidate.channel) ? channels[candidate.channel] : undefined;
  add('channel.declared', Boolean(channel), 'Candidate channel must be explicitly configured.');
  add('channel.version', Boolean(channel && parsedVersion && Boolean(parsedVersion.prerelease) === channel.prerelease),
    'Stable versions have no SemVer prerelease suffix; preview versions require one. Build metadata does not make a preview.');
  add('channel.prerelease', Boolean(channel && typeof candidate.prerelease === 'boolean' && candidate.prerelease === channel.prerelease),
    'GitHub prerelease flag must match the configured channel.');
  add('channel.latest', Boolean(channel && typeof candidate.makeLatest === 'boolean' && (!candidate.makeLatest || (channel.latestEligible && !channel.prerelease))),
    'Only a stable latest-eligible channel may move latest; maintenance releases may leave latest unchanged.');
  add('channel.npm', Boolean(channel && npmTag(candidate.npmTag) && candidate.npmTag === channel.npmTag && !(channel.prerelease && candidate.npmTag === 'latest')),
    'Candidate npm dist-tag must match its channel; previews cannot use latest.');

  const sourceValid = typeof candidate.sourceCommit === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(candidate.sourceCommit);
  const source = sourceValid ? await gitRead(root, `${candidate.sourceCommit}^{commit}`) : { ok: false, error: 'sourceCommit must be a full 40- or 64-character Git SHA.' };
  if (source.ok && source.sha !== candidate.sourceCommit.toLowerCase()) {
    source.ok = false;
    source.error = 'sourceCommit must identify the commit itself, not an annotated tag object.';
  }
  add('git.source', source.ok, source.ok ? `Source commit exists locally: ${source.sha}` : `Source commit is not verified: ${source.error}`);
  const tag = safeTag(candidate.tag) ? await gitRead(root, `refs/tags/${candidate.tag}^{commit}`) : { ok: false, error: 'Unsafe or missing tag name.' };
  add('git.tag', Boolean(source.ok && tag.ok && source.sha === tag.sha),
    tag.ok ? `Tag resolves to ${tag.sha}; it must equal the declared source commit.` : `Local tag is not verified: ${tag.error}`);
  const checkout = await gitRead(root, 'HEAD^{commit}');
  add('git.checkout', Boolean(source.ok && checkout.ok && checkout.sha === source.sha),
    checkout.ok ? `Checkout HEAD is ${checkout.sha}; it must equal the declared source commit.` : `Checkout HEAD is not verified: ${checkout.error}`);
  const safety = await inspectGitStatusSafety(root);
  add('git.submodules', safety.submodules.ok, safety.submodules.message);
  add('git.filter-commands', safety.filters.ok, safety.filters.message);
  const trackedKeys = safety.trackedNames === null ? null : new Set([...safety.trackedNames].map(name => process.platform === 'win32' ? name.toLowerCase() : name));
  const isTracked = absolute => trackedKeys?.has((process.platform === 'win32' ? path.relative(root, absolute).toLowerCase() : path.relative(root, absolute)).split(path.sep).join('/'));
  add('manifest.source', isTracked(manifestFile), 'The release manifest must belong to the tracked source, not only exist as untracked working bytes.');
  for (const lockPath of inspectedLocks) add('lockfile.source', isTracked(lockPath), 'Each checked release lockfile must belong to the tracked source.');
  const tracked = safety.submodules.ok && safety.filters.ok
    ? await gitCommand(root, ['status', '--porcelain=v1', '--untracked-files=no', '--ignore-submodules=untracked'])
    : { ok: false, error: 'Git status was skipped because submodule or filter safety is unverified.' };
  add('git.tracked-clean', tracked.ok && tracked.stdout === '',
    !tracked.ok ? `Tracked state is not verified: ${tracked.error}` : tracked.stdout === ''
      ? 'Git status reports no staged or unstaged tracked changes; index visibility is checked separately. Untracked and ignored task evidence is allowed.'
      : 'Tracked source has staged or unstaged changes; freeze the intended source before accepting this candidate.');
  const index = await gitCommand(root, ['ls-files', '-v', '-z']);
  const indexEntries = index.ok ? index.stdout.split('\0').filter(Boolean) : [];
  const indexFormatValid = indexEntries.every(entry => /^[A-Za-z] /.test(entry));
  const hiddenEntries = indexEntries.filter(entry => /^[a-zS] /.test(entry));
  add('git.index-flags', index.ok && indexFormatValid && hiddenEntries.length === 0,
    !index.ok ? `Index visibility is not verified: ${index.error}` : !indexFormatValid
      ? 'Unrecognized git ls-files index evidence; use a complete checkout and recheck.'
      : hiddenEntries.length
        ? `${hiddenEntries.length} tracked entry or entries use assume-unchanged or skip-worktree flags that can hide source changes. Preserve local work, explicitly clear these flags or use a complete checkout, then recheck. The gate does not modify the index.`
        : 'No assume-unchanged or skip-worktree flags hide tracked source from status.');

  if (!Array.isArray(candidate.assets)) throw new Error('candidate.assets must be an array.');
  const patterns = release.requiredAssets ?? ['{packageName}-{version}.tgz'];
  if (!Array.isArray(patterns) || !patterns.length || !patterns.some(pattern => typeof pattern === 'string' && pattern.includes('{version}'))) {
    throw new Error('release.requiredAssets must include at least one versioned asset pattern.');
  }
  const assetValues = { ...values, packageName: release.packageName.replace(/^@/, '').replace('/', '-') };
  const requiredNames = patterns.map(pattern => {
    const name = expand(pattern, assetValues, 'release.requiredAssets');
    if (name.includes('/') || name.includes('\\') || name === '.' || name === '..' || name.includes(':')) throw new Error('Required asset patterns must produce plain filenames.');
    return name;
  });
  const assets = [];
  const seenPaths = new Set();
  const seenNames = new Set();
  for (const entry of candidate.assets) {
    object(entry, 'Asset');
    const absolute = inputPath(entry.path, root, root);
    const key = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
    const name = path.basename(absolute);
    const duplicate = seenPaths.has(key) || seenNames.has(name);
    seenPaths.add(key);
    seenNames.add(name);
    if (duplicate) add('assets.unique', false, `Duplicate asset path or filename: ${name}`);
    await noSymlinks(absolute, { missingAllowed: true });
    const expectedHash = typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(entry.sha256) ? entry.sha256.toLowerCase() : null;
    let evidence;
    try {
      evidence = await hashAsset(absolute);
      const matches = evidence.bytes > 0 && expectedHash !== null && expectedHash === evidence.sha256;
      add('assets.integrity', matches, matches ? `${name}: local SHA-256 matches declared evidence.` : `${name}: empty file or invalid/mismatched SHA-256 evidence.`);
    } catch (error) {
      if (error.code === 'UNSAFE_RELEASE_PATH') throw error;
      add('assets.integrity', false, `${name}: cannot verify local file (${error.code ?? 'invalid file'}).`);
    }
    assets.push({ path: path.relative(root, absolute).split(path.sep).join('/'), name, expectedSha256: expectedHash,
      actualSha256: evidence?.sha256 ?? null, bytes: evidence?.bytes ?? null });
  }
  add('assets.required', requiredNames.every(name => seenNames.has(name)), `Required candidate assets: ${requiredNames.join(', ')}`);

  const notes = typeof candidate.notes === 'string' ? candidate.notes.trim() : '';
  add('notes.content', notes.length > 0 && notes.includes(version), 'Notes must be nonempty and identify the candidate version; usefulness requires editorial review.');
  add('notes.install', notes.includes(expectedInstall) && /\binstall(?:ation)?\b|安装|升级|更新/i.test(notes),
    'Notes must include an installation section and the exact configured installation target.');
  const notesReview = reviewReleaseNotes({ notes, title: candidate.title, format: release.notesFormat });
  checks.push(...notesReview.checks);
  return {
    ok: checks.every(check => check.ok) && notesReview.ok,
    gateScope: 'metadata-and-asset-integrity', checks, advisories: notesReview.advisories ?? [],
    editorialReview: notesReview.editorialReview ?? 'required',
    productId: release.productId, packageName: release.packageName, version, tag: candidate.tag,
    sourceCommit: source.ok ? source.sha : candidate.sourceCommit, assets,
    notVerified: [...NOT_VERIFIED],
  };
}
