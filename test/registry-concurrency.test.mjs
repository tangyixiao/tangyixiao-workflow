import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { registerResource, unregisterResource, finishResources } from '../lib/resources.mjs'

const registryModule = new URL('../lib/resources.mjs', import.meta.url).href
const prefix = 'work/project-workflow/demo/'

async function fixture(t) {
  const base = await realpath(os.tmpdir())
  const root = await mkdtemp(path.join(base, 'pwf-registry-'))
  const jobs = []
  t.after(async () => {
    for (const { child } of jobs) if (child.exitCode === null && child.signalCode === null) child.kill()
    await Promise.all(jobs.map(job => job.exited))
    assert.equal(path.dirname(root), base)
    assert.equal((await lstat(root)).isSymbolicLink(), false)
    await rm(root, { recursive: true, force: true })
  })
  const directory = path.join(root, 'work/project-workflow')
  const record = path.join(directory, 'resources.json')
  function options(name) {
    return { projectRoot: root, task: 'demo', resourcePath: prefix + name, purpose: 'test resource', apply: true }
  }
  async function create(name) {
    await mkdir(path.join(directory, 'demo'), { recursive: true })
    await writeFile(path.join(directory, 'demo', name), name)
    return options(name)
  }
  return { root, record, directory, options, create, jobs }
}

// Pause a real writer after it stages its update, or signal that a second writer hit its lock.
// The other fs operations and the registry implementation run unmodified in separate OS processes.
const worker = `
  import fs from 'node:fs/promises'
  import { once } from 'node:events'
  import { syncBuiltinESMExports } from 'node:module'
  const [url, operation, options, record, action] = process.argv.slice(1)
  if (action === 'pause') {
    const rename = fs.rename
    let staged = false
    fs.rename = async (source, destination) => {
      if (destination === record && !staged) {
        staged = true
        const released = once(process, 'message')
        process.send('staged')
        await released
      }
      return rename(source, destination)
    }
  } else {
    const open = fs.open
    let reported = false
    fs.open = async (...args) => {
      try { return await open(...args) } catch (error) {
        if (args[0] === record + '.lock' && error.code === 'EEXIST' && !reported) {
          reported = true
          process.send('contended')
        }
        throw error
      }
    }
  }
  syncBuiltinESMExports()
  const api = await import(url)
  await api[operation](JSON.parse(options))
  process.disconnect()
`

function startWriter(f, operation, options, action) {
  const { record } = f
  const child = spawn(process.execPath, ['--input-type=module', '-e', worker, registryModule, operation, JSON.stringify(options), record, action], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true,
  })
  let stderr = ''
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal, stderr }))
  })
  const checkpoint = Promise.race([
    new Promise(resolve => child.once('message', resolve)),
    exited.then(result => { throw new Error('Writer exited before its checkpoint: ' + JSON.stringify(result)) }),
  ])
  f.jobs.push({ child, exited })
  return { child, checkpoint, exited }
}

test('competing add and remove processes retain each committed update and publish complete JSON', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  const obsolete = await f.create('obsolete')
  await registerResource(obsolete)
  await unlink(path.join(f.root, obsolete.resourcePath))
  const [first, second, third] = await Promise.all(['first', 'second', 'third'].map(f.create))
  const initial = await readFile(f.record, 'utf8')
  const holder = startWriter(f, 'registerResource', first, 'pause')
  assert.equal(await holder.checkpoint, 'staged')

  const waiting = [
    startWriter(f, 'registerResource', second, 'wait'),
    startWriter(f, 'unregisterResource', obsolete, 'wait'),
    startWriter(f, 'registerResource', third, 'wait'),
  ]
  assert.deepEqual(await Promise.all(waiting.map(job => job.checkpoint)), ['contended', 'contended', 'contended'])
  assert.equal(await readFile(f.record, 'utf8'), initial)
  assert.equal((await finishResources({ projectRoot: f.root })).entries[0].state, 'absent')
  holder.child.send('publish')
  let finished = false
  const completion = Promise.all([holder, ...waiting].map(job => job.exited)).then(result => { finished = true; return result })
  let previous = new Set([obsolete.resourcePath])
  do {
    const data = JSON.parse(await readFile(f.record, 'utf8'))
    assert.equal(data.schema, 1)
    const paths = new Set(data.entries.map(entry => entry.path))
    assert.equal(paths.size, data.entries.length)
    for (const added of [first, second, third]) if (previous.has(added.resourcePath)) assert.ok(paths.has(added.resourcePath))
    if (!previous.has(obsolete.resourcePath)) assert.ok(!paths.has(obsolete.resourcePath))
    previous = paths
  } while (!finished)
  for (const result of await completion) assert.equal(result.code, 0, result.stderr)
  const committed = JSON.parse(await readFile(f.record, 'utf8')).entries
  assert.deepEqual(committed.map(entry => entry.path).sort(), [first, second, third].map(o => o.resourcePath).sort())
  assert.deepEqual((await readdir(f.directory)).sort(), ['demo', 'resources.json'])
})

test('an interrupted writer leaves the old JSON readable and its lock for confirmed manual recovery', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  await registerResource(await f.create('original'))
  const next = await f.create('next')
  const original = await readFile(f.record, 'utf8')
  const holder = startWriter(f, 'registerResource', next, 'pause')
  assert.equal(await holder.checkpoint, 'staged')
  const lock = f.record + '.lock'
  const metadata = JSON.parse(await readFile(lock, 'utf8'))
  assert.equal(metadata.pid, holder.child.pid)
  assert.equal(metadata.host, os.hostname())
  holder.child.kill()
  const stopped = await holder.exited
  assert.notEqual(stopped.code, 0)
  assert.equal((await registerResource({ ...next, apply: false })).mode, 'plan')
  assert.equal((await finishResources({ projectRoot: f.root })).entries.length, 1)
  await assert.rejects(registerResource(next), /confirming its writer has stopped/)
  assert.equal(await readFile(f.record, 'utf8'), original)
  assert.deepEqual(JSON.parse(await readFile(lock, 'utf8')), metadata)
  await unlink(lock)
  await registerResource(next)
  assert.equal(JSON.parse(await readFile(f.record, 'utf8')).entries.length, 2)
})

test('a full registry permits updates, rejects entry 1001, and recovers an older overflow by removing only an absent path', async t => {
  const f = await fixture(t)
  const first = await f.create('0')
  const extra = await f.create('extra')
  const entries = Array.from({ length: 1000 }, (_, i) => ({
    task: 'demo', path: prefix + i, purpose: '中'.repeat(500), disposable: true, createdAt: '2025-01-01T00:00:00.000Z',
  }))
  await writeFile(f.record, JSON.stringify({ schema: 1, entries }))
  const before = await readFile(f.record)
  assert.ok(before.length > 1024 * 1024)
  for (const apply of [false, true]) await assert.rejects(registerResource({ ...extra, apply }), /full \(1000 entries\)/)
  assert.deepEqual(await readFile(f.record), before)
  const updated = await registerResource(first)
  assert.equal(updated.entry.createdAt, entries[0].createdAt)
  const overflow = [...entries, { ...entries[0], path: extra.resourcePath }]
  await writeFile(f.record, JSON.stringify({ schema: 1, entries: overflow }))
  await assert.rejects(registerResource(first), /exceeds 1000/)
  await assert.rejects(unregisterResource(extra), /still exists/)
  const absent = f.options('813')
  const plan = await unregisterResource({ ...absent, apply: false })
  assert.equal(plan.mode, 'plan')
  assert.equal(plan.changed, true)
  assert.deepEqual(JSON.parse(await readFile(f.record, 'utf8')).entries, overflow)
  await unregisterResource(absent)
  assert.deepEqual(JSON.parse(await readFile(f.record, 'utf8')).entries, overflow.filter(e => e.path !== absent.resourcePath))
  const again = await unregisterResource(absent)
  assert.equal(again.changed, false)
  assert.equal(again.entry, null)
  await registerResource(first)
  assert.deepEqual((await readdir(f.directory)).sort(), ['demo', 'resources.json'])
})

test('unregister leaves a fresh project untouched and refuses foreign paths, existing resources and linked parents', async t => {
  const f = await fixture(t)
  const absent = f.options('missing')
  assert.equal((await unregisterResource(absent)).changed, false)
  assert.deepEqual(await readdir(f.root), [])
  const kept = await f.create('kept')
  await registerResource(kept)
  const before = await readFile(f.record, 'utf8')
  await assert.rejects(unregisterResource(kept), /still exists/)
  await assert.rejects(unregisterResource({ ...kept, task: 'foreign' }), /must stay under/)
  await assert.rejects(unregisterResource({ ...absent, resourcePath: prefix + '../escape' }), /unsafe segment/)
  assert.equal(await readFile(path.join(f.root, kept.resourcePath), 'utf8'), 'kept')
  assert.equal(await readFile(f.record, 'utf8'), before)
  const linked = path.join(f.directory, 'demo/linked')
  try { await symlink(f.directory, linked, process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (error.code === 'EPERM') return; throw error }
  for (const name of ['linked', 'linked/missing']) await assert.rejects(unregisterResource(f.options(name)), /Linked path/)
  assert.equal(await readFile(f.record, 'utf8'), before)
})
