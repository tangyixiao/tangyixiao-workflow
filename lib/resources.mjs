import { lstat, readFile, readdir, realpath, mkdir, writeFile, statfs } from 'node:fs/promises'
import path from 'node:path'

const RECORD = 'work/project-workflow/resources.json'
const TASK = /^[a-z0-9][a-z0-9-]{0,63}$/

async function noLinks(target) {
  const absolute = path.resolve(target)
  const parsed = path.parse(absolute)
  let current = parsed.root
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    const info = await lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error })
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

async function context(projectRoot) {
  const root = await realpath(await noLinks(projectRoot))
  const record = await noLinks(path.join(root, RECORD))
  let data
  try { data = JSON.parse(await readFile(record, 'utf8')) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    data = { schema: 1, entries: [] }
  }
  if (data.schema !== 1 || !Array.isArray(data.entries) || data.entries.length > 1000) throw new Error('Invalid resource record')
  return { root, record, data }
}

async function ownedPath(root, task, relative) {
  if (!TASK.test(task)) throw new Error('Task must use lowercase letters, digits and hyphens (max 64 characters)')
  relativePath(relative)
  const boundary = `work/project-workflow/${task}`
  if (relative !== boundary && !relative.startsWith(`${boundary}/`)) throw new Error(`Task resources must stay under ${boundary}`)
  if (task === 'resources') throw new Error('Reserved task identifier')
  return noLinks(path.join(root, relative))
}

export async function registerResource({ projectRoot, task, resourcePath, purpose, disposable = false, apply = false }) {
  const { root, record, data } = await context(projectRoot)
  const absolute = await ownedPath(root, task, resourcePath)
  await lstat(absolute)
  if (typeof purpose !== 'string' || !purpose.trim() || purpose.length > 500) throw new Error('Provide a short purpose (1–500 characters)')
  if (data.entries.some(entry => entry.path === resourcePath && entry.task !== task)) throw new Error('Resource already belongs to another task')
  const existing = data.entries.find(entry => entry.path === resourcePath)
  const entry = { task, path: resourcePath, purpose, disposable, createdAt: existing?.createdAt ?? new Date().toISOString() }
  const updated = { schema: 1, entries: [...data.entries.filter(item => item.path !== resourcePath), entry] }
  if (apply) {
    await mkdir(path.dirname(record), { recursive: true })
    await noLinks(record)
    await writeFile(record, JSON.stringify(updated, null, 2) + '\n', { flag: 'w' })
  }
  return { ok: true, mode: apply ? 'applied' : 'plan', entry, record: RECORD, automaticDeletion: false }
}

async function measure(target, budget) {
  if (++budget.count > 10000) throw new Error('Resource inspection exceeds 10,000 entries; narrow its scope')
  const info = await lstat(target)
  if (info.isSymbolicLink()) throw new Error(`Linked resource requires manual review: ${target}`)
  if (info.isFile()) return { bytes: info.size, files: 1 }
  if (!info.isDirectory()) throw new Error(`Special resource requires manual review: ${target}`)
  let bytes = 0, files = 0
  for (const name of await readdir(target)) {
    const child = await measure(path.join(target, name), budget)
    bytes += child.bytes
    files += child.files
  }
  return { bytes, files }
}

export async function finishResources({ projectRoot, task }) {
  const { root, data } = await context(projectRoot)
  if (task !== undefined && !TASK.test(task)) throw new Error('Invalid task identifier')
  const entries = []
  const budget = { count: 0 }
  for (const entry of data.entries.filter(item => task === undefined || item.task === task)) {
    try {
      const absolute = await ownedPath(root, entry.task, entry.path)
      const size = await measure(absolute, budget)
      entries.push({ ...entry, ...size, state: 'retained', cleanupCandidate: entry.disposable === true, requires: ['active-consumer-check', 'dirty-work-and-recovery-check'], deleted: false })
    } catch (error) {
      entries.push({ task: entry.task, path: entry.path, state: error.code === 'ENOENT' ? 'absent' : 'review-required', message: error.message, deleted: false })
    }
  }
  const disk = await statfs(root)
  return { ok: entries.every(entry => entry.state !== 'review-required'), mode: 'plan', entries, measuredBytes: entries.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0), freeBytes: Number(disk.bavail) * Number(disk.bsize), deletedBytes: 0, automaticDeletion: false, processInspection: 'not-performed', note: 'Only registered paths were inspected. Verify active consumers and recovery needs before authorized cleanup.' }
}
