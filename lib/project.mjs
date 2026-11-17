import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = '.github/project-workflow.json';
const RECEIPT_PATH = '.github/project-workflow.receipt.json';
const BEGIN = '<!-- BEGIN PROJECT-WORKFLOW MANAGED -->';
const END = '<!-- END PROJECT-WORKFLOW MANAGED -->';
const HASH = /^[a-f0-9]{64}$/;
const MAX_TEXT = 1024 * 1024;
const PROFILES = new Set(['npm', 'static', 'generic']);
export const DEFAULT_RESOURCES = Object.freeze({
  freeSpaceReserveGiB: 10,
  temporaryGrowthReviewGiB: 1,
  optionalGrowthLimitGiB: 2,
  maxLogMiB: 20,
  maxHeavyJobs: 1,
});

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function comparable(value) {
  const absolute = path.resolve(value);
  return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

export function isWithin(parent, child) {
  const relative = path.relative(comparable(parent), comparable(child));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Check every existing component before following or mutating a filesystem path. */
export async function assertSafePath(value, { allowMissing = true } = {}) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error('A non-empty local path is required');
  if (process.platform === 'win32' && value.startsWith('\\\\')) throw new Error('Network and device paths are not supported');
  const absolute = path.resolve(value);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (let i = 0; i <= segments.length; i += 1) {
    if (i) current = path.join(current, segments[i - 1]);
    let entry;
    try { entry = await lstat(current); }
    catch (error) {
      if (error.code === 'ENOENT' && allowMissing) return absolute;
      throw error;
    }
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links or reparse paths are not allowed: ${current}`);
    if (i < segments.length && !entry.isDirectory()) throw new Error(`A parent is not a directory: ${current}`);
    const resolved = await realpath(current);
    if (comparable(resolved) !== comparable(current)) throw new Error(`Path resolves outside its lexical location: ${current}`);
  }
  return absolute;
}

export async function ensureSafeDirectory(directory) {
  const absolute = await assertSafePath(directory);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    await assertSafePath(current);
    try { await mkdir(current); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await assertSafePath(current, { allowMissing: false });
    if (!(await lstat(current)).isDirectory()) throw new Error(`Not a directory: ${current}`);
  }
  return absolute;
}

export async function readLocalFile(filename, { maximum = MAX_TEXT } = {}) {
  await assertSafePath(filename);
  let entry;
  try { entry = await lstat(filename); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!entry.isFile()) throw new Error(`Expected a regular file: ${filename}`);
  if (entry.size > maximum) throw new Error(`File exceeds the ${maximum}-byte read limit: ${filename}`);
  const bytes = await readFile(filename);
  if (bytes.length > maximum) throw new Error(`File grew beyond the read limit: ${filename}`);
  return bytes;
}

export function parseJson(bytes, label) {
  if (bytes === null) return null;
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')); }
  catch { throw new Error(`Invalid UTF-8 JSON: ${label}`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Expected a JSON object: ${label}`);
  return value;
}

export async function toolkitVersion() {
  const manifest = parseJson(await readLocalFile(path.join(SOURCE_ROOT, 'package.json')), 'toolkit package.json');
  return typeof manifest?.version === 'string' && manifest.version ? manifest.version : '0.1.0-alpha.1';
}

/** Atomic replacement with a last-moment content guard; no unrelated file removal. */
export async function writeManagedFile(filename, bytes, expectedHash) {
  await ensureSafeDirectory(path.dirname(filename));
  const previous = await readLocalFile(filename);
  if ((previous === null ? null : sha256(previous)) !== expectedHash) throw new Error(`File changed since planning: ${filename}`);
  const temporary = path.join(path.dirname(filename), `.${path.basename(filename)}.pwf-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    await assertSafePath(filename);
    const latest = await readLocalFile(filename);
    if ((latest === null ? null : sha256(latest)) !== expectedHash) throw new Error(`File changed during apply: ${filename}`);
    await rename(temporary, filename);
  } finally {
    await assertSafePath(temporary);
    try { await unlink(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function repositoryName(value) {
  if (typeof value !== 'string') return null;
  let candidate = value.trim().replace(/^git\+/, '').replace(/\.git$/, '');
  candidate = candidate.replace(/^github:/, '').replace(/^git@github\.com:/, '').replace(/^https?:\/\/github\.com\//, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate) || candidate.split('/').some(x => x === '.' || x === '..')) return null;
  return candidate;
}

function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`); }

function blockFor(version) {
  return `${BEGIN}\n## Tangyixiao Workflow\n\nUse the tangyixiao-workflow skill and .github/project-workflow.json for project checks,\nrelease-candidate verification and bounded task scratch. Toolkit version: ${version}.\nInspect existing work and loaded instructions first. Plans are read-only; apply\nchanges only within the human-authorized scope. Preserve unrelated changes,\ncredentials and client settings. Keep local checks, CI, publication and actual use\nas separate evidence. Reuse existing workspaces and runtimes, keep scratch bounded,\nand clean only verified task-owned disposable resources.\n${END}`;
}

function locateBlock(text) {
  const starts = [...text.matchAll(new RegExp(BEGIN, 'g'))];
  const ends = [...text.matchAll(new RegExp(END, 'g'))];
  if (!starts.length && !ends.length) return null;
  if (starts.length !== 1 || ends.length !== 1 || ends[0].index < starts[0].index) throw new Error('AGENTS.md has ambiguous or incomplete project-workflow markers');
  const start = starts[0].index, end = ends[0].index + END.length;
  return { start, end, text: text.slice(start, end) };
}

function validateReceipt(receipt) {
  if (!receipt) return;
  if (receipt.schema !== 1 || receipt.kind !== 'project-workflow-project' || !Array.isArray(receipt.files) || !Array.isArray(receipt.blocks)) throw new Error('Unrecognized project adoption receipt');
  if (receipt.files.length !== 1 || receipt.files[0].path !== CONFIG_PATH || !HASH.test(receipt.files[0].sha256)) throw new Error('Invalid project configuration receipt');
  if (receipt.blocks.length !== 1 || receipt.blocks[0].path !== 'AGENTS.md' || !HASH.test(receipt.blocks[0].sha256)) throw new Error('Invalid AGENTS block receipt');
}

function configurationChecks(config, { complete = true } = {}) {
  const checks = [];
  const add = (id, ok, message) => checks.push({ id, ok: Boolean(ok), message });
  add('configuration.schema', config?.schema === 1, 'Configuration schema must be 1');
  if (complete || config?.repository !== undefined) add('configuration.repository', typeof config?.repository === 'string' && repositoryName(config.repository) === config.repository, 'Repository must be a canonical owner/repository identity');
  if (complete || config?.profile !== undefined) add('configuration.profile', PROFILES.has(config?.profile), 'Profile must be npm, static or generic');
  if (complete || config?.toolkitVersion !== undefined) add('configuration.version', typeof config?.toolkitVersion === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(config.toolkitVersion), 'Toolkit version must be a version string');
  const resources = config?.resources;
  const resourcesObject = resources !== null && typeof resources === 'object' && !Array.isArray(resources);
  if (complete || resources !== undefined) add('configuration.resources', resourcesObject, 'Resources must be an object');
  if (resourcesObject) {
    for (const key of Object.keys(DEFAULT_RESOURCES)) {
      if (!complete && resources[key] === undefined) continue;
      const value = resources[key];
      const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0
        && (key !== 'maxHeavyJobs' || (Number.isInteger(value) && value >= 1)) && (key !== 'maxLogMiB' || value > 0);
      add(`configuration.resources.${key}`, valid, `${key} must be a valid non-negative budget${key === 'maxHeavyJobs' ? ' (a positive integer)' : ''}`);
    }
    if (resources.temporaryGrowthReviewGiB !== undefined && resources.optionalGrowthLimitGiB !== undefined) add('configuration.resources.order', resources.temporaryGrowthReviewGiB <= resources.optionalGrowthLimitGiB, 'Temporary growth review point must not exceed the optional limit');
  }
  if (config?.release !== undefined) add('configuration.release', config.release !== null && typeof config.release === 'object' && !Array.isArray(config.release), 'Release settings must be an object when present');
  return checks;
}

export async function checkProject(projectRoot) {
  const root = await assertSafePath(projectRoot, { allowMissing: false });
  const checks = [];
  const add = (id, ok, message) => checks.push({ id, ok: Boolean(ok), message });
  let configBytes, agentsBytes, receipt, config;
  try {
    configBytes = await readLocalFile(path.join(root, CONFIG_PATH));
    config = parseJson(configBytes, CONFIG_PATH);
    receipt = parseJson(await readLocalFile(path.join(root, RECEIPT_PATH)), RECEIPT_PATH);
    validateReceipt(receipt);
    agentsBytes = await readLocalFile(path.join(root, 'AGENTS.md'));
  } catch (error) {
    return { ok: false, projectRoot: root, checks: [{ id: 'configuration.input', ok: false, message: error.message }] };
  }
  add('configuration.exists', config !== null, 'Project adoption configuration must exist');
  add('receipt.exists', receipt !== null, 'Project adoption receipt must exist');
  if (config) checks.push(...configurationChecks(config));
  add('configuration.hash', Boolean(receipt && configBytes && sha256(configBytes) === receipt.files[0].sha256), 'Configuration must match its recorded adoption hash; review customizations before accepting a new baseline');
  try {
    const text = agentsBytes === null ? '' : new TextDecoder('utf-8', { fatal: true }).decode(agentsBytes);
    const block = locateBlock(text);
    add('agents.block', Boolean(receipt && block && sha256(Buffer.from(block.text)) === receipt.blocks[0].sha256), 'The managed AGENTS block must match its receipt; unrelated AGENTS content may change');
  } catch (error) { add('agents.block', false, error.message); }
  return { ok: checks.every(check => check.ok), projectRoot: root, checks, adopted: Boolean(receipt) };
}

export async function inspectProject(projectRoot) {
  const root = await assertSafePath(projectRoot, { allowMissing: false });
  if (!(await stat(root)).isDirectory()) throw new Error('projectRoot must be a directory');
  const manifest = parseJson(await readLocalFile(path.join(root, 'package.json')), 'project package.json');
  const configBytes = await readLocalFile(path.join(root, CONFIG_PATH));
  const config = parseJson(configBytes, CONFIG_PATH);
  const receipt = parseJson(await readLocalFile(path.join(root, RECEIPT_PATH)), RECEIPT_PATH);
  validateReceipt(receipt);
  let profile = manifest ? 'npm' : 'generic';
  if (!manifest) {
    for (const filename of ['index.html', 'site/index.html']) if (await readLocalFile(path.join(root, filename))) { profile = 'static'; break; }
  }
  let detectedRepository = repositoryName(typeof manifest?.repository === 'object' ? manifest.repository.url : manifest?.repository);
  if (!detectedRepository) {
    const gitPath = path.join(root, '.git');
    await assertSafePath(gitPath);
    let gitEntry;
    try { gitEntry = await lstat(gitPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Worktree .git pointer files are identified but never followed outside this project.
    if (gitEntry?.isDirectory()) {
      const gitConfig = await readLocalFile(path.join(gitPath, 'config'), { maximum: 65536 });
      const origin = gitConfig?.toString('utf8').match(/\[remote\s+"origin"\]([^\[]*)/m)?.[1].match(/^\s*url\s*=\s*(.+)$/m)?.[1];
      detectedRepository = repositoryName(origin);
    }
  }
  const configurationModified = Boolean(receipt && (!configBytes || sha256(configBytes) !== receipt.files[0].sha256));
  return { ok: !configurationModified, projectRoot: root, profile: PROFILES.has(config?.profile) ? config.profile : profile,
    repository: repositoryName(config?.repository) ?? detectedRepository, detectedProfile: profile,
    configuration: config, adopted: Boolean(receipt), configurationModified,
    paths: { configuration: CONFIG_PATH, receipt: RECEIPT_PATH, agents: 'AGENTS.md' } };
}

export async function adoptProject({ projectRoot, repository, profile, apply = false, acceptConfig = false } = {}) {
  if (typeof apply !== 'boolean') throw new Error('apply must be a boolean');
  if (typeof acceptConfig !== 'boolean') throw new Error('acceptConfig must be a boolean');
  const inspection = await inspectProject(projectRoot);
  const root = inspection.projectRoot;
  const version = await toolkitVersion();
  const configFile = path.join(root, CONFIG_PATH), agentsFile = path.join(root, 'AGENTS.md'), receiptFile = path.join(root, RECEIPT_PATH);
  const [previousConfig, previousAgents, previousReceipt] = await Promise.all([readLocalFile(configFile), readLocalFile(agentsFile), readLocalFile(receiptFile)]);
  const config = parseJson(previousConfig, CONFIG_PATH), receipt = parseJson(previousReceipt, RECEIPT_PATH);
  validateReceipt(receipt);
  const conflicts = [];
  const desiredRepository = repository === undefined ? inspection.repository : repositoryName(repository);
  const desiredProfile = profile === undefined ? inspection.profile : profile;
  const configDrift = Boolean(receipt && (!previousConfig || sha256(previousConfig) !== receipt.files[0].sha256));
  const customizationValid = Boolean(config && configurationChecks(config).every(check => check.ok));
  if (!desiredRepository) conflicts.push({ path: CONFIG_PATH, reason: 'Provide a valid owner/repository identity; no usable repository was detected' });
  if (!PROFILES.has(desiredProfile)) conflicts.push({ path: CONFIG_PATH, reason: 'profile must be npm, static or generic' });
  if (config && config.schema !== 1) conflicts.push({ path: CONFIG_PATH, reason: 'Existing configuration has an unsupported or missing schema; preserve it and review manually' });
  if (config?.resources !== undefined && (!config.resources || typeof config.resources !== 'object' || Array.isArray(config.resources))) conflicts.push({ path: CONFIG_PATH, reason: 'Existing resources must be an object; no replacement was made' });
  if (config) for (const check of configurationChecks(config, { complete: false })) if (!check.ok) conflicts.push({ path: CONFIG_PATH, reason: check.message });
  if (configDrift && !(acceptConfig && customizationValid)) conflicts.push({ path: CONFIG_PATH, reason: 'Configuration changed since the recorded adoption hash; review the diff, then explicitly use acceptConfig with a valid configuration' });
  if (!receipt && config) {
    for (const [key, wanted] of [['repository', desiredRepository], ['profile', desiredProfile], ['toolkitVersion', version]]) {
      if (config[key] !== undefined && config[key] !== wanted) conflicts.push({ path: CONFIG_PATH, reason: `Unmanaged configuration has a different ${key}; review before adoption` });
    }
  }
  const nextConfig = { ...config, schema: 1, toolkitVersion: version, repository: desiredRepository, profile: desiredProfile,
    resources: { ...DEFAULT_RESOURCES, ...config?.resources } };
  const nextBlock = blockFor(version);
  let agentsText;
  try { agentsText = previousAgents === null ? '' : new TextDecoder('utf-8', { fatal: true }).decode(previousAgents); }
  catch { throw new Error('AGENTS.md is not valid UTF-8; it was preserved'); }
  const block = locateBlock(agentsText);
  if (receipt && (!block || sha256(Buffer.from(block.text)) !== receipt.blocks[0].sha256)) conflicts.push({ path: 'AGENTS.md', reason: 'Managed AGENTS block changed or was removed; unrelated content is preserved' });
  if (!receipt && block && block.text !== nextBlock) conflicts.push({ path: 'AGENTS.md', reason: 'An unowned project-workflow block already exists; review it before adoption' });
  const nextAgents = block ? agentsText.slice(0, block.start) + nextBlock + agentsText.slice(block.end)
    : agentsText + (agentsText ? (agentsText.endsWith('\n') ? '\n' : '\n\n') : '') + nextBlock + '\n';
  const configContent = jsonBytes(nextConfig), agentsContent = Buffer.from(nextAgents);
  const nextReceipt = { schema: 1, kind: 'project-workflow-project', toolkitVersion: version,
    files: [{ path: CONFIG_PATH, sha256: sha256(configContent) }],
    blocks: [{ path: 'AGENTS.md', sha256: sha256(Buffer.from(nextBlock)) }] };
  const candidates = [
    { path: CONFIG_PATH, filename: configFile, previous: previousConfig, content: configContent },
    { path: 'AGENTS.md', filename: agentsFile, previous: previousAgents, content: agentsContent },
    { path: RECEIPT_PATH, filename: receiptFile, previous: previousReceipt, content: jsonBytes(nextReceipt) },
  ].filter(item => item.previous === null || !item.previous.equals(item.content));
  const changes = candidates.map(item => ({ path: item.path, action: item.previous === null ? 'create' : 'update' }));
  if (apply && !conflicts.length) for (const item of candidates) await writeManagedFile(item.filename, item.content, item.previous === null ? null : sha256(item.previous));
  return { ok: conflicts.length === 0, mode: apply ? 'apply' : 'plan', applied: Boolean(apply && !conflicts.length),
    projectRoot: root, toolkitVersion: version, repository: desiredRepository, profile: desiredProfile,
    changes, conflicts, unknownFieldsPreserved: Object.keys(config ?? {}).filter(key => !['schema', 'toolkitVersion', 'repository', 'profile', 'resources'].includes(key)),
    receipt: RECEIPT_PATH, changed: Boolean(apply && !conflicts.length && changes.length),
    acceptedCustomization: Boolean(acceptConfig && configDrift && !conflicts.length && apply),
    customizationReview: { requested: acceptConfig, configurationChanged: configDrift, valid: customizationValid } };
}

export async function upgradeProject(options) { return adoptProject(options); }
