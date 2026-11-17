#!/usr/bin/env node
import { readFile, readdir, lstat, statfs } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { inspectProject, checkProject, adoptProject, upgradeProject, readLocalFile } from '../lib/project.mjs'
import { installSkill, uninstallSkill, skillStatus } from '../lib/install.mjs'
import { checkRelease } from '../lib/release.mjs'
import { finishResources, registerResource } from '../lib/resources.mjs'
import { reviewReleaseNotes } from '../lib/notes.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const help = `Tangyixiao Workflow ${manifest.version}
Usage: node bin/pwf.mjs <command> [options]

  doctor       --project <directory>                 inspect local prerequisites
  adopt        --project <directory> --repository owner/name [--profile npm|static|generic] [--apply]
  upgrade      --project <directory> [--accept-config] [--apply] update managed content
  check        --project <directory>                 check adoption and managed-content drift
  install      --destination <skill-directory> [--apply]
  status       --destination <skill-directory>       inspect installed skill hashes
  uninstall    --destination <skill-directory> [--apply]
  release-check --project <directory> --candidate <json> [--config <json>]
  notes-check  --notes <markdown> --title <release-title> check public/private publishing boundaries
  finish       --project <directory> [--task <id>]    report registered resources; no deletion
  resource-add --project <directory> --task <id> --path <relative> --purpose <text> [--disposable] [--apply]
  self-check                                         validate toolkit source and linked references

All commands accept --json. Mutation defaults to a plan. This alpha has no daemon,
registry publisher or automatic scratch deletion. Node >=22 is required.
`

function parse(args) {
  const command = args.shift() ?? 'help'
  const booleans = new Set(['apply', 'json', 'disposable', 'accept-config'])
  const values = new Set(['project', 'repository', 'profile', 'destination', 'candidate', 'config', 'task', 'path', 'purpose', 'notes', 'title'])
  const options = {}
  while (args.length) {
    const token = args.shift()
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    if (key in options) throw new Error(`Duplicate option: ${token}`)
    if (booleans.has(key)) options[key] = true
    else if (values.has(key)) {
      if (!args.length || args[0].startsWith('--')) throw new Error(`Missing value: ${token}`)
      options[key] = args.shift()
    } else throw new Error(`Unknown option: ${token}`)
  }
  return { command, options }
}

function requireOption(options, key) {
  if (!options[key]) throw new Error(`--${key} is required`)
  return options[key]
}

async function selfCheck() {
  const required = ['README.md', 'README.en.md', 'LICENSE', 'NOTICE', 'skills/tangyixiao-workflow/SKILL.md', 'docs/getting-started.md', 'docs/release-contract.md']
  for (const filename of required) if (!(await lstat(path.join(root, filename))).isFile()) throw new Error(`Missing ${filename}`)
  const skill = await readFile(path.join(root, 'skills/tangyixiao-workflow/SKILL.md'), 'utf8')
  if (!/^---\r?\n[\s\S]*?name: tangyixiao-workflow\r?\n[\s\S]*?description:/m.test(skill)) throw new Error('Invalid skill discovery metadata')
  const references = []
  for (const folder of ['', 'docs', 'skills/tangyixiao-workflow', 'skills/tangyixiao-workflow/references']) {
    for (const name of await readdir(path.join(root, folder))) {
      if (!name.endsWith('.md')) continue
      const file = path.join(root, folder, name)
      const text = (await readFile(file, 'utf8')).replace(/```[\s\S]*?```/g, '')
      for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) {
        const target = match[1]
        if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue
        const resolved = path.resolve(path.dirname(file), decodeURIComponent(target.split('#')[0]))
        if (!resolved.startsWith(root + path.sep)) throw new Error(`Reference leaves toolkit: ${target}`)
        await lstat(resolved)
        references.push(target)
      }
    }
  }
  if (manifest.dependencies && Object.keys(manifest.dependencies).length) throw new Error('Unexpected runtime dependencies')
  return { ok: true, version: manifest.version, localReferences: references.length, runtimeDependencies: 0, scope: 'toolkit-source-only' }
}

async function main() {
  const { command, options } = parse(process.argv.slice(2))
  if (['help', '--help', '-h'].includes(command)) { console.log(help); return }
  if (command === '--version' || command === 'version') { console.log(manifest.version); return }
  const allowed = {
    doctor: ['project'], adopt: ['project','repository','profile','apply','accept-config'], upgrade: ['project','apply','accept-config'], check: ['project'],
    install: ['destination','apply'], status: ['destination'], uninstall: ['destination','apply'],
    'release-check': ['project','candidate','config'], 'notes-check':['notes','title'], finish: ['project','task'],
    'resource-add': ['project','task','path','purpose','disposable','apply'], 'self-check': []
  }
  if (!(command in allowed)) throw new Error(`Unknown command: ${command}`)
  for (const key of Object.keys(options)) if (key !== 'json' && !allowed[command].includes(key)) throw new Error(`--${key} does not apply to ${command}`)
  const projectRoot = path.resolve(options.project ?? process.cwd())
  let result
  if (command === 'doctor') {
    let git
    try { git = execFileSync('git', ['--version'], { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:5000 }).trim() } catch { git = null }
    const disk = await statfs(projectRoot)
    const freeBytes = Number(disk.bavail) * Number(disk.bsize)
    result = { ok: Number(process.versions.node.split('.')[0]) >= 22 && git !== null, version:manifest.version, node:process.version, git, freeBytes, reserveBytes:10 * 1024 ** 3, diskReserveMet:freeBytes >= 10 * 1024 ** 3, project:await inspectProject(projectRoot), scope:'local-read-only', clientActivation:'not-verified' }
  } else if (command === 'adopt') result = await adoptProject({ projectRoot, repository:requireOption(options,'repository'), profile:options.profile, apply:options.apply, acceptConfig:options['accept-config'] })
  else if (command === 'upgrade') result = await upgradeProject({ projectRoot, apply:options.apply, acceptConfig:options['accept-config'] })
  else if (command === 'check') result = await checkProject(projectRoot)
  else if (command === 'install') result = await installSkill({ destination:requireOption(options,'destination'), apply:options.apply })
  else if (command === 'status') result = await skillStatus({ destination:requireOption(options,'destination') })
  else if (command === 'uninstall') result = await uninstallSkill({ destination:requireOption(options,'destination'), apply:options.apply })
  else if (command === 'release-check') result = await checkRelease({ projectRoot, configPath:options.config, candidatePath:path.resolve(requireOption(options,'candidate')) })
  else if (command === 'notes-check') {
    const content = await readLocalFile(path.resolve(requireOption(options,'notes')))
    if (content === null) throw new Error('Notes file does not exist')
    result = reviewReleaseNotes({ notes:new TextDecoder('utf-8',{fatal:true}).decode(content), title:requireOption(options,'title') })
  }
  else if (command === 'finish') result = await finishResources({ projectRoot, task:options.task })
  else if (command === 'resource-add') result = await registerResource({ projectRoot, task:requireOption(options,'task'), resourcePath:requireOption(options,'path'), purpose:requireOption(options,'purpose'), disposable:options.disposable ?? false, apply:options.apply })
  else result = await selfCheck()
  if (options.json) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`${result.ok ? 'PASS' : 'ATTENTION'} ${command} · Tangyixiao Workflow ${manifest.version}${result.mode ? ` · ${result.mode}` : ''}`)
    console.log(JSON.stringify(result, null, 2))
  }
  if (!result.ok) process.exitCode = 1
}

main().catch(error => { console.error(JSON.stringify({ ok:false, error:error.message })); process.exitCode = 1 })
