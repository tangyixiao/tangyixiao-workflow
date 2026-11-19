import { lstat, open, readdir, realpath, statfs, unlink } from 'node:fs/promises'
import { hostname } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { readLocalFile, sha256, writeManagedFile } from './project.mjs'

const RECORD = 'work/project-workflow/resources.json'
const TASK = /^[a-z0-9][a-z0-9-]{0,63}$/
const ENTRY_LIMIT = 1000
const REGISTRY_READ = { maximum: 16 * 1024 * 1024 }

async function inspectIfPresent(target) {
  try { return await lstat(target) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

async function noLinks(target) {
  const absolute = path.resolve(target)
  const parsed = path.parse(absolute)
  let current = parsed.root
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    const info = await inspectIfPresent(current)
    if (info?.isSymbolicLink()) throw new Error(`Linked path is not allowed: ${current}`)
  }
  return absolute
}

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') || value.includes('\0') || path.isAbsolute(value)) throw new Error('Use a relative forward-slash path')
  const parts = value.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('Path contains an unsafe segment')
  return value
}

function parseRecord(bytes, removing = false) {
  const data = bytes === null ? { schema: 1, entries: [] } : JSON.parse(bytes.toString('utf8'))
  if (data?.schema !== 1 || !Array.isArray(data.entries)) throw new Error('Invalid resource record')
  // The earlier writer could append once to a full registry, leaving exactly 1001 entries.
  if (data.entries.length > ENTRY_LIMIT + Number(removing)) throw new Error('Resource record exceeds 1000 entries; remove a registered path that is already absent')
  return data
}

async function context(projectRoot) {
  const root = await realpath(await noLinks(projectRoot))
  const data = parseRecord(await readLocalFile(path.join(root, RECORD), REGISTRY_READ))
  return { root, data }
}

async function ownedPath(root, task, relative) {
  if (typeof task !== 'string' || !TASK.test(task)) throw new Error('Task must use lowercase letters, digits and hyphens (max 64 characters)')
  relativePath(relative)
  const boundary = `work/project-workflow/${task}`
  if (relative !== boundary && !relative.startsWith(`${boundary}/`)) throw new Error(`Task resources must stay under ${boundary}`)
  if (task === 'resources') throw new Error('Reserved task identifier')
  return noLinks(path.join(root, relative))
}

async function withRecordLock(record, update) {
  const lock = `${record}.lock`
  const deadline = performance.now() + 5000
  let handle
  for (;;) {
    await noLinks(path.dirname(lock))
    try { handle = await open(lock, 'wx', 0o600); break }
    catch (error) { if (error.code !== 'EEXIST') throw error }
    const current = await inspectIfPresent(lock)
    if (current && !current.isFile()) throw new Error(`Expected a regular registry lock file: ${lock}`)
    if (performance.now() >= deadline) {
      throw new Error(`Registry is locked: ${lock}. Retry after the writer finishes. After an interruption, remove this lock manually only after confirming its writer has stopped on the owning host.`)
    }
    await delay(40)
  }
  try {
    await handle.writeFile(JSON.stringify({ host: hostname(), pid: process.pid, acquiredAt: new Date().toISOString() }) + '\n')
    return await update()
  } finally {
    try {
      const owner = await handle.stat({ bigint: true })
      await noLinks(path.dirname(lock))
      const current = await lstat(lock, { bigint: true })
      if (!current.isFile() || current.dev !== owner.dev || current.ino !== owner.ino) throw new Error(`Registry lock ownership changed: ${lock}`)
      await unlink(lock)
    } finally { await handle.close() }
  }
}

async function editRecord({ projectRoot, task, resourcePath, apply = false }, removing, edit) {
  const root = await realpath(await noLinks(projectRoot))
  const record = await noLinks(path.join(root, RECORD))
  async function change(bytes) {
    const data = parseRecord(bytes, removing)
    const absolute = await ownedPath(root, task, resourcePath)
    const matches = data.entries.filter(item => item.path === resourcePath)
    if (matches.some(item => item.task !== task)) throw new Error('Resource already belongs to another task')
    if (matches.length > 1) throw new Error('Duplicate resource registrations require manual review')
    const { entries, result } = await edit(absolute, data.entries, matches[0])
    if (entries) {
      const updated = JSON.stringify({ ...data, entries }, null, 2) + '\n'
      if (Buffer.byteLength(updated) > REGISTRY_READ.maximum) throw new Error('Resource record exceeds the 16 MiB limit')
      if (apply) await writeManagedFile(record, updated, bytes === null ? null : sha256(bytes), REGISTRY_READ)
    }
    return { ok: true, mode: apply ? 'applied' : 'plan', ...result, record: RECORD, automaticDeletion: false }
  }
  if (removing && !await inspectIfPresent(path.dirname(record))) return change(null)
  const run = async () => change(await readLocalFile(record, REGISTRY_READ))
  return apply ? withRecordLock(record, run) : run()
}

export async function registerResource(options) {
  const { task, resourcePath, purpose, disposable = false } = options
  if (typeof purpose !== 'string' || !purpose.trim() || purpose.length > 500) throw new Error('Provide a short purpose (1–500 characters)')
  return editRecord(options, false, async (absolute, entries, existing) => {
    const info = await lstat(absolute)
    if (!info.isFile() && !info.isDirectory()) throw new Error(`Special resource requires manual review: ${absolute}`)
    if (!existing && entries.length >= ENTRY_LIMIT) throw new Error('Resource record is full (1000 entries); remove a registered path that is already absent')
    const entry = { task, path: resourcePath, purpose, disposable, createdAt: existing?.createdAt ?? new Date().toISOString() }
    return { entries: [...entries.filter(item => item !== existing), entry], result: { entry } }
  })
}

export async function unregisterResource(options) {
  const { task, resourcePath } = options
  return editRecord(options, true, async (absolute, entries, existing) => {
    if (await inspectIfPresent(absolute)) throw new Error(`Resource still exists: ${resourcePath}`)
    return {
      entries: existing ? entries.filter(item => item !== existing) : null,
      result: { task, path: resourcePath, entry: existing ?? null, changed: Boolean(existing) },
    }
  })
}

async function measure(target, canonical, inspection) {
  const cached = inspection.sizes.get(canonical)
  if (cached) return cached
  if (++inspection.count > 10000) throw new Error('Resource inspection exceeds 10,000 entries; narrow its scope')
  const info = await lstat(target)
  if (info.isSymbolicLink()) throw new Error(`Linked resource requires manual review: ${target}`)
  const size = { bytes: 0, files: 0 }
  if (info.isFile()) {
    size.bytes = info.size
    size.files = 1
  } else if (info.isDirectory()) {
    for (const name of await readdir(target)) {
      const child = await measure(path.join(target, name), path.join(canonical, name), inspection)
      size.bytes += child.bytes
      size.files += child.files
    }
  } else {
    throw new Error(`Special resource requires manual review: ${target}`)
  }
  inspection.sizes.set(canonical, size)
  return size
}

function hasRetainedAncestor(target, retained) {
  while (target !== path.dirname(target)) {
    target = path.dirname(target)
    if (retained.has(target)) return true
  }
  return false
}

export async function finishResources({ projectRoot, task }) {
  const { root, data } = await context(projectRoot)
  if (task !== undefined && !TASK.test(task)) throw new Error('Invalid task identifier')
  const entries = []
  const inspection = { count: 0, sizes: new Map() }
  const retained = new Map()
  for (const entry of data.entries.filter(item => task === undefined || item.task === task)) {
    try {
      const absolute = await ownedPath(root, entry.task, entry.path)
      const canonical = await realpath(absolute)
      const size = await measure(absolute, canonical, inspection)
      retained.set(canonical, size)
      entries.push({ ...entry, ...size, state: 'retained', cleanupCandidate: entry.disposable === true, requires: ['active-consumer-check', 'dirty-work-and-recovery-check'], deleted: false })
    } catch (error) {
      entries.push({ task: entry.task, path: entry.path, state: error.code === 'ENOENT' ? 'absent' : 'review-required', message: error.message, deleted: false })
    }
  }
  let measuredBytes = 0
  for (const [target, size] of retained) {
    if (!hasRetainedAncestor(target, retained)) measuredBytes += size.bytes
  }
  const disk = await statfs(root)
  return { ok: entries.every(entry => entry.state !== 'review-required'), mode: 'plan', entries, measuredBytes, freeBytes: Number(disk.bavail) * Number(disk.bsize), deletedBytes: 0, automaticDeletion: false, processInspection: 'not-performed', note: 'measuredBytes counts logical file bytes once across retained paths. Verify active consumers and recovery needs before authorized cleanup.' }
}
