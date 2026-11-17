# Tangyixiao Workflow

[简体中文](README.md) · [Get started](docs/getting-started.md) · [Modules and limits](docs/modules.md) · [Client support](docs/client-support.md)

Adopt a project delivery workflow that remains usable next session: a discoverable
Skill, a dependency-free local CLI, and checked project configuration. Select the
design, documentation, website, operations, release, video, or resource guidance
that fits the task; an isolated small edit does not need every module.

This is development version **0.1.0-alpha.1**, requiring **Node.js 22 or newer**.
Source: [tangyixiao/tangyixiao-workflow](https://github.com/tangyixiao/tangyixiao-workflow).
It is not yet a published npm package or product Release. `@tangyixiao/workflow`
is the project package name and `tywf` is its command alias. The examples below
invoke source directly rather than assuming a global command exists.

## Install for Codex

Run from this source checkout. The first install invocation previews a plan; the
second writes only to the explicitly selected skill directory.

```sh
node bin/pwf.mjs doctor
node bin/pwf.mjs install --destination "$HOME/.codex/skills/tangyixiao-workflow"
node bin/pwf.mjs install --destination "$HOME/.codex/skills/tangyixiao-workflow" --apply
node bin/pwf.mjs status --destination "$HOME/.codex/skills/tangyixiao-workflow"
```

The installed copy carries its necessary CLI/runtime and references. No network
or dependency installation is required. After the client discovers it, invoke
`$tangyixiao-workflow`, for example:

> Use $tangyixiao-workflow to inspect this project and preview adoption, preserving its customized README and uncommitted work.

Installation, client discovery, actual invocation, and compatibility with other
clients are separate checks. [Support scope](docs/client-support.md)

## Adopt an existing project

Replace the project path and repository with real values. Choose the applicable
`npm`, `static`, or `generic` profile.

```sh
node bin/pwf.mjs adopt --project /path/to/project --repository owner/repository --profile npm
node bin/pwf.mjs adopt --project /path/to/project --repository owner/repository --profile npm --apply
node bin/pwf.mjs check --project /path/to/project
```

Configuration lives in `.github/project-workflow.json`; this path is retained for
compatibility. Applied adoption may add a managed AGENTS block. Preserve existing
customization, licenses and unrelated files; inspect conflicts before proceeding.
Installing a skill and adopting a project are separate operations.

## Executable scope

| Capability | This version |
| --- | --- |
| `install` / `status` / `uninstall` | Explicit skill-folder plans, installation state, and preservation of modified files |
| `adopt` / `check` / `upgrade` | Project adoption, managed-content drift checks, and upgrade plans; mutation requires `--apply` |
| `release-check` | Offline product/version/channel and declared-file integrity checks; no publishing, archive inspection, or installation proof |
| `notes-check` | Structural and obvious handoff-narrative checks on release notes; no proof of feature claims |
| `finish` | Registered task resources and a cleanup plan; no deletion or process termination |
| Design, documentation, operations, video references | Guidance and evidence requirements; no bundled site platform, recorder, renderer or bot service |

Use `node bin/pwf.mjs --help` for the actual interface. Project tests, GitHub
settings, CI, merge, publication, and runtime behavior need their own evidence.
Resource defaults are configurable planning agreements, not OS quotas.

## Keep, share, and upgrade

The Skill is the entry point, project configuration persists across sessions, and
the source repository is the version authority. After updating core source, preview
skill installation and project upgrade changes before applying the intended scope;
do not overwrite every project. Preview `uninstall --destination ...` before
removal; modified files remain protected.

See [provenance](docs/provenance.md) for selected README/website snapshots, the
earlier standard, and release-note editing examples. Account-level `.github`
community defaults remain separate. This tool has no daemon and cannot control
all agents automatically.

Code and original documentation use [Apache-2.0](LICENSE); see [NOTICE](NOTICE).
Referenced projects and third-party material retain their own rights and attribution.
