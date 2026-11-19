import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdtemp, mkdir, writeFile, rm, realpath, lstat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DEFAULT_RESOURCES } from '../lib/project.mjs'

const cli = fileURLToPath(new URL('../bin/pwf.mjs',import.meta.url))
function run(args) { return spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:10000}) }

test('CLI rejects mutation flags on read-only commands and ambiguous options', () => {
  for (const args of [['doctor','--apply'],['install','--destination'],['adopt','--project','x','--project','y'],['finish','--force'],['adopt','--profile','npm','unexpected']]) {
    const result = run(args)
    assert.equal(result.status,1)
    assert.equal(JSON.parse(result.stderr).ok,false)
  }
})

test('CLI provides a usable discoverable entry and structured errors', () => {
  const help = run(['--help'])
  assert.equal(help.status,0)
  assert(help.stdout.includes('Tangyixiao Workflow'))
  const missing = run(['release-check'])
  assert.equal(missing.status,1)
  assert.equal(JSON.parse(missing.stderr).error,'--candidate is required')
})

async function temporaryProject(t) {
  const base = await realpath(os.tmpdir())
  const root = await mkdtemp(path.join(base,'tywf-cli-'))
  t.after(async () => {
    assert.equal(path.dirname(root),base)
    assert.equal((await lstat(root)).isSymbolicLink(),false)
    await rm(root,{recursive:true,force:true})
  })
  await mkdir(path.join(root,'.github'))
  return root
}

test('CLI checks a plain project without pretending adoption is complete', async t => {
  const root = await temporaryProject(t)
  await writeFile(path.join(root,'package.json'),JSON.stringify({name:'sample-project',version:'1.0.0'}))
  const result = run(['check','--project',root,'--json'])
  assert.equal(result.status,1)
  assert.equal(JSON.parse(result.stdout).ok,false)
})

test('doctor reports host capacity and applies the target project disk reserve', async t => {
  const root = await temporaryProject(t)
  const readDoctor = () => {
    const result = run(['doctor','--project',root,'--json'])
    assert.equal(result.status,0,result.stderr)
    return JSON.parse(result.stdout)
  }
  const report = readDoctor()
  const defaultBytes = DEFAULT_RESOURCES.freeSpaceReserveGiB * 1024 ** 3
  assert.equal(report.project.projectRoot,root)
  assert.equal(report.reserveBytes,defaultBytes)
  assert(Number.isInteger(report.freeBytes) && report.freeBytes >= 0)
  assert.equal(report.diskReserveMet,report.freeBytes >= defaultBytes)
  assert(Number.isInteger(report.availableParallelism) && report.availableParallelism >= 1)
  assert(report.totalMemoryBytes > 0 && report.freeMemoryBytes >= 0 && report.freeMemoryBytes <= report.totalMemoryBytes)
  assert.equal(report.gpu.utilizationPercent,null)
  assert.equal(report.gpu.freeVramBytes,null)

  for (const [reserveGiB,expectedBytes] of [[0,0],[0.5,2 ** 29],['1',defaultBytes]]) {
    await writeFile(path.join(root,'.github','project-workflow.json'),JSON.stringify({schema:1,resources:{freeSpaceReserveGiB:reserveGiB}}))
    const configured = readDoctor()
    assert.equal(configured.reserveBytes,expectedBytes)
    assert.equal(configured.diskReserveMet,configured.freeBytes >= expectedBytes)
  }
})
