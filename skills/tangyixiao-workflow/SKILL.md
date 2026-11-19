---
name: tangyixiao-workflow
description: Write or review public repository content, including README, About, Wiki, Actions output, commits, pull requests, issues, discussions and releases in any project. Also supports project setup, website delivery, demo videos, resource closeout and local release checks.
---

# Tangyixiao Workflow

Use this skill to turn a project workflow into a scoped plan, useful changes, and
evidence of the result. Preserve the receiving project's identity, existing work,
license, and explicit instructions. A sample project is not the identity of every
project that adopts it.

## Locate the executable

For a writing task, start with the [public writing guide](references/public-writing.md).
It applies in personal repositories, forks and upstream projects, including
projects with no toolkit configuration. Follow the destination's language,
templates and contribution rules. Use the CLI when the task calls for a check.

Resolve the directory containing this `SKILL.md` first.

- Installed skill: use its adjacent `runtime/bin/pwf.mjs` with the existing Node.js.
- Source checkout: if that runtime is absent, use the source repository's
  `bin/pwf.mjs`, two directories above this skill folder.
- Use an absolute executable path when running from the receiving project. Read
  `--help` if the local interface differs; do not assume a global `tywf` or a
  published npm package exists.

Run `doctor` when runtime capabilities are uncertain. It reports local conditions,
not whether another AI client has loaded this skill.

## Choose only the relevant guidance

Read the matching reference before substantial work in that mode; do not load
every reference for a small request.

| Task | Reference | Executable support in this version |
| --- | --- | --- |
| Any text another person will see in a repository, its metadata, or an automation | [Public writing](references/public-writing.md) | Editorial workflow for drafting, review and publication within scope |
| New website or substantial visual redesign | [Design](references/design.md) | Guidance; visual research and review use the available tools |
| README, website content, translations, examples | [Documentation](references/documentation.md) | Guidance; project-specific validators remain separate |
| Repository operations, bots, labels, SEO, distribution | [Operations](references/operations.md) | Adoption/configuration checks; platform settings require separate verification |
| Product identity, version, channel, candidate assets, public notes | [Release](references/release.md) | Offline `release-check` and editorial `notes-check` |
| Scratch ownership, disk use, task completion | [Resources](references/resources.md) | Registration and read-only `finish` plan; no automatic deletion |
| Product demonstration or distribution video | [Video](references/video.md) | Guidance; no bundled recorder or renderer |

For adoption, inspect the current checkout, dirty work, existing instructions,
project type, and requested scope. Use `adopt` without `--apply` to inspect the
plan. Choose only applicable modules rather than filling every platform feature.

## Execute within the request

- `install`, `uninstall`, `adopt`, and `upgrade` preview changes by default;
  `--apply` requests their documented local mutation. Existing authorization for
  an exact target still counts; do not repeat an approval question for routine
  work already authorized.
- A skill is not authorization to publish, send messages, edit historical
  releases, change accounts, or delete unrelated files. A read-only request stays
  read-only. When a decision is required, make its concrete proposed result
  reviewable first.
- Use `check --project` for adopted configuration and managed-file drift. It does
  not run a project's tests, certify its design, or verify GitHub settings.
- A release candidate must identify its actual product. Do not rewrite separate
  historical products into one lineage because their repository now has a new name.
- `finish --project` reports owned scratch and a cleanup plan. It does not stop
  processes or delete paths. Inspect active consumers and recovery needs before
  any separately authorized manual cleanup.

## Leave a usable result

Use the public writing guide for titles, descriptions, comments and other visible
text. Consult the documentation or release reference for the corresponding format.

Report relevant local checks, CI, merge, deployment, publication, and actual use
separately. State what was not checked. Preserve useful source and final evidence;
reconcile task-owned scratch in the existing task record rather than creating a
new routine report for every command.

Use project-specific configuration for local contacts, identities, budget changes,
and delivery channels. Keep personal settings and private conversations out of
reusable public documentation. Update this workflow through a versioned source
change; do not maintain divergent copies inside multiple agent adapters.
