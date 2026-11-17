import { lstat, readdir, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  SOURCE_ROOT, assertSafePath, isWithin, parseJson, readLocalFile,
  sha256, toolkitVersion, writeManagedFile,
} from './project.mjs';

const RECEIPT = '.project-workflow-install.json';
const KIND = 'project-workflow-skill-installation';
const SKILL_NAME = 'tangyixiao-workflow';
const MAX_FILES = 256;
const MAX_BYTES = 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.posix.isAbsolute(value)
      || path.win32.isAbsolute(value) || value.includes(':') || path.posix.normalize(value) !== value
      || value.split('/').some(part => !/^[A-Za-z0-9_.-]+$/.test(part) || part === '.' || part === '..')) {
    throw new Error(`Unsafe installation receipt path: ${String(value)}`);
  }
  return value;
}

function allowedFile(value) {
  return value === 'SKILL.md' || /^references\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.md$/.test(value)
    || value === 'agents/openai.yaml'
    || /^runtime\/(?:bin|lib)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.mjs$/.test(value)
    || ['runtime/package.json', 'runtime/LICENSE', 'runtime/NOTICE'].includes(value);
}

function validateReceipt(value) {
  if (!value) return null;
  if (value.schema !== 1 || value.kind !== KIND || value.skill !== SKILL_NAME || typeof value.toolkitVersion !== 'string'
      || !Array.isArray(value.files) || value.files.length > MAX_FILES || !Array.isArray(value.createdDirectories)
      || typeof value.createdDestination !== 'boolean') throw new Error('Unrecognized skill installation receipt');
  const seen = new Set();
  for (const file of value.files) {
    const name = relativePath(file?.path);
    if (!allowedFile(name) || !HASH.test(file.sha256) || seen.has(name)) throw new Error(`Invalid managed file in installation receipt: ${name}`);
    seen.add(name);
  }
  const directories = new Set();
  for (const item of value.createdDirectories) {
    const name = relativePath(item);
    if (!(name === 'references' || name === 'agents' || name === 'runtime' || name.startsWith('references/') || name.startsWith('agents/') || name.startsWith('runtime/'))
        || directories.has(name)) throw new Error('Invalid created directory in installation receipt');
    directories.add(name);
  }
  return value;
}

async function sourceLocations() {
  const normalSkill = path.join(SOURCE_ROOT, 'skills', SKILL_NAME);
  if (await readLocalFile(path.join(normalSkill, 'SKILL.md'))) return { skill: normalSkill, runtime: SOURCE_ROOT };
  // An installed skill can execute its bundled runtime without retaining the checkout.
  const parent = path.dirname(SOURCE_ROOT);
  if (path.basename(SOURCE_ROOT) === 'runtime' && await readLocalFile(path.join(parent, 'SKILL.md'))) return { skill: parent, runtime: SOURCE_ROOT };
  throw new Error(`Skill source is missing: skills/${SKILL_NAME}/SKILL.md`);
}

async function destinationPath(destination, { copying = false } = {}) {
  const absolute = await assertSafePath(destination);
  if (absolute === path.parse(absolute).root) throw new Error('The filesystem root cannot be a skill destination');
  if (!copying) return { absolute };
  const sources = await sourceLocations();
  for (const source of [sources.skill, sources.runtime]) {
    await assertSafePath(source, { allowMissing: false });
    if (isWithin(source, absolute) || isWithin(absolute, source)) throw new Error('Skill destination overlaps its source tree; recursive or destructive copying is prohibited');
  }
  return { absolute, sources };
}

async function entries(directory, { maximum = MAX_FILES } = {}) {
  await assertSafePath(directory);
  let names;
  try { names = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const output = [];
  let visited = 0;
  async function walk(base, children, depth) {
    if (depth > 16) throw new Error('Skill directory nesting exceeds the inspection limit');
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      visited += 1;
      if (visited > maximum * 4) throw new Error('Skill directory contains too many entries for bounded inspection');
      const full = path.join(base, child.name);
      await assertSafePath(full, { allowMissing: false });
      const info = await lstat(full);
      if (info.isDirectory()) await walk(full, await readdir(full, { withFileTypes: true }), depth + 1);
      else if (info.isFile()) {
        output.push({ full, path: path.relative(directory, full).split(path.sep).join('/') });
        if (output.length > maximum) throw new Error('Skill directory contains too many files for bounded inspection');
      } else throw new Error(`Unsupported filesystem entry: ${full}`);
    }
  }
  await walk(directory, names, 0);
  return output;
}

async function sourceManifest(sources) {
  const files = [];
  async function add(source, target, optional = false) {
    const content = await readLocalFile(source);
    if (content === null) { if (optional) return; throw new Error(`Required runtime file is missing: ${source}`); }
    files.push({ path: relativePath(target), content, sha256: sha256(content) });
  }
  await add(path.join(sources.skill, 'SKILL.md'), 'SKILL.md');
  await add(path.join(sources.skill, 'agents/openai.yaml'), 'agents/openai.yaml', true);
  for (const item of await entries(path.join(sources.skill, 'references'))) if (item.path.endsWith('.md')) await add(item.full, `references/${item.path}`);
  await add(path.join(sources.runtime, 'package.json'), 'runtime/package.json');
  for (const directory of ['bin', 'lib']) {
    for (const item of await entries(path.join(sources.runtime, directory))) if (item.path.endsWith('.mjs')) await add(item.full, `runtime/${directory}/${item.path}`);
  }
  if (!files.some(file => file.path === 'runtime/bin/pwf.mjs')) throw new Error('Bundled CLI bin/pwf.mjs is missing');
  for (const file of ['LICENSE', 'NOTICE']) await add(path.join(sources.runtime, file), `runtime/${file}`);
  if (files.length > MAX_FILES || files.reduce((sum, file) => sum + file.content.length, 0) > MAX_BYTES) throw new Error('Bundled skill exceeds its bounded source budget');
  for (const file of files) if (!allowedFile(file.path)) throw new Error(`Unsupported runtime source path: ${file.path}`);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function stateFor(destination) {
  const bytes = await readLocalFile(path.join(destination, RECEIPT));
  const receipt = validateReceipt(parseJson(bytes, RECEIPT));
  const actual = await entries(destination);
  const known = new Map(receipt?.files.map(file => [file.path, file]) ?? []);
  const managed = [];
  for (const [name, file] of known) {
    const content = await readLocalFile(path.join(destination, ...name.split('/')));
    managed.push({ path: name, status: content === null ? 'missing' : sha256(content) === file.sha256 ? 'unchanged' : 'modified' });
  }
  return { bytes, receipt, managed, foreign: actual.filter(file => file.path !== RECEIPT && !known.has(file.path)).map(file => file.path) };
}

async function missingDirectories(destination, files) {
  const result = new Set();
  for (const file of files) {
    let current = path.posix.dirname(file.path);
    while (current !== '.') {
      try { await lstat(path.join(destination, ...current.split('/'))); }
      catch (error) { if (error.code !== 'ENOENT') throw error; result.add(current); }
      current = path.posix.dirname(current);
    }
  }
  return [...result].sort();
}

export async function skillStatus({ destination } = {}) {
  const { absolute } = await destinationPath(destination);
  const state = await stateFor(absolute);
  const names = new Set(state.managed.filter(file => file.status !== 'missing').map(file => file.path));
  const complete = Boolean(state.receipt) && names.has('SKILL.md') && names.has('runtime/bin/pwf.mjs') && names.has('runtime/package.json') && state.managed.every(file => file.status !== 'missing');
  const modified = state.managed.some(file => file.status === 'modified');
  return { ok: true, destination: absolute, installed: complete, complete, tracked: Boolean(state.receipt), state: !state.receipt ? 'unmanaged-or-absent' : !complete ? 'partial' : modified ? 'modified' : 'complete', toolkitVersion: state.receipt?.toolkitVersion ?? null,
    managed: state.managed, modified: state.managed.filter(file => file.status === 'modified').map(file => file.path), foreign: state.foreign, receipt: RECEIPT };
}

export async function installSkill({ destination, apply = false } = {}) {
  if (typeof apply !== 'boolean') throw new Error('apply must be a boolean');
  const { absolute, sources } = await destinationPath(destination, { copying: true });
  const version = await toolkitVersion();
  const manifest = await sourceManifest(sources);
  const state = await stateFor(absolute);
  const previous = new Map(state.receipt?.files.map(file => [file.path, file]) ?? []);
  const conflicts = [], pending = [];
  for (const file of manifest) {
    const current = await readLocalFile(path.join(absolute, ...file.path.split('/')));
    const old = previous.get(file.path);
    if (current && (!old || sha256(current) !== old.sha256)) {
      conflicts.push({ path: file.path, reason: old ? 'Managed file was modified; it will not be overwritten' : 'Unmanaged file already exists; it will not be overwritten' });
    } else if (current === null || !current.equals(file.content)) pending.push({ ...file, previous: current, action: current === null ? 'create' : 'update' });
  }
  const targets = new Set(manifest.map(file => file.path));
  const retired = [];
  for (const file of state.receipt?.files ?? []) {
    if (targets.has(file.path)) continue;
    const current = await readLocalFile(path.join(absolute, ...file.path.split('/')));
    if (current === null) continue;
    if (sha256(current) !== file.sha256) conflicts.push({ path: file.path, reason: 'Retired managed file was modified; it will be retained' });
    else retired.push(file);
  }
  let destinationExists = true;
  try { await lstat(absolute); } catch (error) { if (error.code !== 'ENOENT') throw error; destinationExists = false; }
  const receipt = { schema: 1, kind: KIND, skill: SKILL_NAME, toolkitVersion: version,
    createdDestination: state.receipt?.createdDestination ?? !destinationExists,
    createdDirectories: [...new Set([...(state.receipt?.createdDirectories ?? []), ...await missingDirectories(absolute, manifest)])].sort(),
    files: manifest.map(({ path: name, sha256: hash }) => ({ path: name, sha256: hash })) };
  const receiptContent = jsonBytes(receipt), receiptChanged = state.bytes === null || !state.bytes.equals(receiptContent);
  const changes = [...pending.map(file => ({ path: file.path, action: file.action })), ...retired.map(file => ({ path: file.path, action: 'delete' }))];
  if (receiptChanged) changes.push({ path: RECEIPT, action: state.bytes === null ? 'create' : 'update' });
  if (apply && !conflicts.length) {
    for (const file of pending) await writeManagedFile(path.join(absolute, ...file.path.split('/')), file.content, file.previous === null ? null : sha256(file.previous));
    for (const file of retired) await removeMatchingFile(absolute, file);
    if (receiptChanged) await writeManagedFile(path.join(absolute, RECEIPT), receiptContent, state.bytes === null ? null : sha256(state.bytes));
  }
  return { ok: conflicts.length === 0, mode: apply ? 'apply' : 'plan', applied: Boolean(apply && !conflicts.length),
    destination: absolute, toolkitVersion: version, changes, conflicts, foreign: state.foreign,
    receipt: RECEIPT, changed: Boolean(apply && !conflicts.length && changes.length) };
}

async function removeMatchingFile(destination, file) {
  const target = path.join(destination, ...relativePath(file.path).split('/'));
  await assertSafePath(target);
  const bytes = await readLocalFile(target);
  if (bytes === null) return;
  if (sha256(bytes) !== file.sha256) throw new Error(`Managed file changed since planning: ${file.path}`);
  await unlink(target);
}

export async function uninstallSkill({ destination, apply = false } = {}) {
  if (typeof apply !== 'boolean') throw new Error('apply must be a boolean');
  const { absolute } = await destinationPath(destination);
  const state = await stateFor(absolute);
  if (!state.receipt) return { ok: true, mode: apply ? 'apply' : 'plan', applied: false, installed: false, destination: absolute, changes: [], retained: state.foreign.map(name => ({ path: name, reason: 'Unmanaged file' })) };
  const unchanged = new Set(state.managed.filter(file => file.status === 'unchanged').map(file => file.path));
  const modified = new Set(state.managed.filter(file => file.status === 'modified').map(file => file.path));
  const changes = state.receipt.files.filter(file => unchanged.has(file.path)).map(file => ({ path: file.path, action: 'delete' }));
  const retained = [...modified].map(name => ({ path: name, reason: 'Modified managed file' })).concat(state.foreign.map(name => ({ path: name, reason: 'Unmanaged file' })));
  changes.push({ path: RECEIPT, action: modified.size ? 'update' : 'delete' });
  if (apply) {
    // Receipt ownership is checked again before any deletion.
    const currentReceipt = await readLocalFile(path.join(absolute, RECEIPT));
    if (!currentReceipt || sha256(currentReceipt) !== sha256(state.bytes)) throw new Error('Installation receipt changed since planning');
    for (const file of state.receipt.files) if (unchanged.has(file.path)) await removeMatchingFile(absolute, file);
    if (modified.size) {
      const receipt = { ...state.receipt, files: state.receipt.files.filter(file => modified.has(file.path)) };
      await writeManagedFile(path.join(absolute, RECEIPT), jsonBytes(receipt), sha256(state.bytes));
    } else {
      await removeMatchingFile(absolute, { path: RECEIPT, sha256: sha256(state.bytes) });
    }
    const directories = [...state.receipt.createdDirectories].sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a));
    for (const name of directories) {
      const target = path.join(absolute, ...name.split('/'));
      await assertSafePath(target);
      try { await rmdir(target); } catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error; }
    }
    if (!modified.size && state.receipt.createdDestination) {
      await assertSafePath(absolute);
      try { await rmdir(absolute); } catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error; }
    }
  }
  return { ok: true, mode: apply ? 'apply' : 'plan', applied: apply, destination: absolute,
    installed: Boolean(modified.size), complete: retained.length === 0, changes, retained,
    receipt: modified.size ? RECEIPT : null };
}
