import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath, lstat } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { registerResource, finishResources } from '../lib/resources.mjs'

async function fixture(t) {
  const base = await realpath(os.tmpdir())
  const root = await mkdtemp(path.join(base, 'pwf-resources-'))
  t.after(async () => {
    assert.equal(path.dirname(root),base)
    assert.equal((await lstat(root)).isSymbolicLink(),false)
    await rm(root, { recursive:true, force:true })
  })
  await mkdir(path.join(root,'work/project-workflow/demo'), { recursive:true })
  await writeFile(path.join(root,'work/project-workflow/demo/check.txt'),'owned')
  return root
}

test('resource registration is plan-first and finish never deletes', async t => {
  const projectRoot = await fixture(t)
  const options = { projectRoot, task:'demo', resourcePath:'work/project-workflow/demo/check.txt', purpose:'bounded evidence', disposable:true }
  assert.equal((await registerResource(options)).mode,'plan')
  assert.equal((await finishResources({ projectRoot })).entries.length,0)
  await registerResource({ ...options, apply:true })
  const result = await finishResources({ projectRoot,task:'demo' })
  assert.equal(result.ok,true)
  assert.equal(result.measuredBytes,5)
  assert.equal(result.deletedBytes,0)
  assert.equal(result.entries[0].cleanupCandidate,true)
  assert.equal(await readFile(path.join(projectRoot,options.resourcePath),'utf8'),'owned')
})

test('resource ownership rejects traversal, foreign paths and malformed receipts', async t => {
  const projectRoot = await fixture(t)
  for (const resourcePath of ['../outside','work/project-workflow/other/check.txt','work\\project-workflow\\demo','C:/Users/private','work/project-workflow/demo/../resources.json']) {
    await assert.rejects(registerResource({projectRoot,task:'demo',resourcePath,purpose:'test',apply:true}))
  }
  await writeFile(path.join(projectRoot,'work/project-workflow/resources.json'),JSON.stringify({schema:1,entries:[{task:'demo',path:'../outside',disposable:true}]}))
  const result = await finishResources({ projectRoot })
  assert.equal(result.ok,false)
  assert.equal(result.entries[0].state,'review-required')
})

test('resource links are reported without following their contents', async t => {
  const projectRoot = await fixture(t)
  const target = path.join(projectRoot,'work/project-workflow/demo/linked')
  try { await symlink(path.join(projectRoot,'work/project-workflow/demo'),target,process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (error.code === 'EPERM') { t.skip('Symlink privilege unavailable'); return } throw error }
  await assert.rejects(registerResource({projectRoot,task:'demo',resourcePath:'work/project-workflow/demo/linked',purpose:'link',apply:true}))
})

const demo = 'work/project-workflow/demo'

async function registerPaths(projectRoot, paths) {
  for (const resourcePath of paths) {
    await registerResource({ projectRoot, task: 'demo', resourcePath, purpose: 'test evidence', apply: true })
  }
}

for (const order of ['parent first', 'child first']) {
  test(`finish counts overlapping resources once with ${order}`, async t => {
    const projectRoot = await fixture(t)
    const parent = `${demo}/out`
    const child = `${parent}/nested`
    const leaf = `${child}/result`
    const sibling = `${demo}/output`
    await mkdir(path.join(projectRoot, child), { recursive: true })
    await writeFile(path.join(projectRoot, leaf), 'abc')
    await writeFile(path.join(projectRoot, parent, 'note'), 'de')
    await writeFile(path.join(projectRoot, sibling), 'fghi')
    const paths = order === 'parent first' ? [parent, child, leaf, sibling] : [leaf, child, parent, sibling]
    await registerPaths(projectRoot, paths)

    const result = await finishResources({ projectRoot, task: 'demo' })
    assert.equal(result.ok, true)
    assert.equal(result.measuredBytes, 9)
    assert.equal(result.deletedBytes, 0)
    assert.deepEqual(result.entries.map(entry => entry.path), paths)
    assert.ok(result.entries.every(entry => entry.state === 'retained' && entry.deleted === false))
    assert.deepEqual(Object.fromEntries(result.entries.map(entry => [entry.path, [entry.bytes, entry.files]])), {
      [parent]: [5, 2], [child]: [3, 1], [leaf]: [3, 1], [sibling]: [4, 1],
    })
  })
}

test('missing or unsafe registrations leave retained children measurable', async t => {
  const projectRoot = await fixture(t)
  const child = `${demo}/check.txt`
  const missing = `${demo}/gone`
  await writeFile(path.join(projectRoot, missing), 'removed after registration')
  await registerPaths(projectRoot, [demo, child, missing])
  await rm(path.join(projectRoot, missing))
  const link = path.join(projectRoot, demo, 'linked')
  try { await symlink(projectRoot, link, process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (error.code === 'EPERM') { t.skip('Symlink privilege unavailable'); return } throw error }

  const result = await finishResources({ projectRoot })
  assert.equal(result.ok, false)
  assert.deepEqual(result.entries.map(entry => entry.state), ['review-required', 'retained', 'absent'])
  assert.equal(result.measuredBytes, 5)
  assert.equal(result.deletedBytes, 0)
})

test('resource aliases respect filesystem case sensitivity', async t => {
  const projectRoot = await fixture(t)
  const original = `${demo}/check.txt`
  const variant = `${demo}/CHECK.TXT`
  let expectedBytes = 5
  try {
    await writeFile(path.join(projectRoot, variant), 'other', { flag: 'wx' })
    expectedBytes += 5
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  await registerPaths(projectRoot, [original, variant])
  const result = await finishResources({ projectRoot })
  assert.equal(result.ok, true)
  assert.deepEqual(result.entries.map(entry => entry.bytes), [5, 5])
  assert.equal(result.measuredBytes, expectedBytes)
})
