# Tangyixiao Workflow

[简体中文](README.md) · [Get started](docs/getting-started.md) · [Modules and limits](docs/modules.md) · [Client support](docs/client-support.md)

Use this Skill to write a repository README, prepare a pull request, or draft
release notes. Its local CLI checks an adopted project's configuration, the
managed section of its AGENTS file, and release candidate files.

This is development version **0.1.0-alpha.1**, requiring **Node.js 22 or newer** and **Git**.
Source: [tangyixiao/tangyixiao-workflow](https://github.com/tangyixiao/tangyixiao-workflow).
It is not yet a published npm package or product Release. `@tangyixiao/workflow`
is the project package name and `tywf` is its command alias. The examples below
invoke source directly rather than assuming a global command exists.

## Install for Codex

For a first install, [download the main source ZIP](https://github.com/tangyixiao/tangyixiao-workflow/archive/refs/heads/main.zip), extract it and open a shell in the directory containing `bin/pwf.mjs`. If you already have the source, open that directory.

Run `doctor` to check the environment. Use `install` to preview the plan, then add `--apply` to install in the chosen Skill directory. Run `status` and check that `state` is `complete`.

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

## Write for your repository or contribute upstream

Invoke the Skill directly in the target checkout. Running `adopt` is optional.
Start with the project's contribution guide, templates, and recent accepted
contributions. For example, after adding an installation command to an upstream
README, ask:

> Use $tangyixiao-workflow to read this project's contribution guide, PR template, and my diff. Draft an English PR title and description for the README change.

| Where the text appears | What the reader needs |
| --- | --- |
| README, repository About, and Wiki | Give a first-time reader steps and an expected result in the README. Describe the project's purpose in one sentence in About. Walk through one task per Wiki page. |
| Pull requests, commits, issues, and discussions | Explain the change and how to verify it in a PR. Name the individual change in a commit. Give reproduction steps or a use case in an issue. Ask a question contributors can answer in a discussion. |
| Releases and GitHub Actions | Tell readers what changed and how to get or upgrade the release. Name Actions steps for what they check, and use the summary to show the result and where to look after a failure. |

For drafting, checking claims, and verifying published text, see the [public writing guide](skills/tangyixiao-workflow/references/public-writing.md) (Chinese).

Use the [planning guide](skills/tangyixiao-workflow/references/planning-and-decisions.md) to clarify a request or map work across milestones. At handoff, review affected pages using the [maintenance checklist](skills/tangyixiao-workflow/references/repository-stewardship.md). The [file and device guide](skills/tangyixiao-workflow/references/files-and-devices.md) covers publication choices and environment checks on another machine. These guides are in Chinese.

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

## Project website

Edit a draft on the [English release-note workbench](https://tangyixiao.github.io/tangyixiao-workflow/en/), check it locally, then copy the task to your own Codex chat. Watch the [recorded terminal session](https://tangyixiao.github.io/tangyixiao-workflow/media/terminal-session.mp4) or switch to [简体中文](https://tangyixiao.github.io/tangyixiao-workflow/). After downloading the source, open the [local English](project-website/site/en/index.html) or [local Chinese](project-website/site/index.html) homepage.
