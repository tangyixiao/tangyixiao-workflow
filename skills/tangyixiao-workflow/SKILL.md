---
name: tangyixiao-workflow
description: Write repository documentation and handoffs for people or agents, discover requirements, plan work, review Git visibility and cross-device setup, and check project delivery. Covers README, About, Wiki, PRs, releases, Pages, branches, resource estimates and cleanup.
---

# Tangyixiao Workflow

Use this skill to turn a project workflow into a scoped plan, useful changes, and
evidence of the result. Preserve the receiving project's identity, existing work,
license, and explicit instructions. A sample project is not the identity of every
project that adopts it.

Before building a tool or feature, find the implementation this project already
uses. Check existing issues, PRs, dependencies, standard tools and maintained
upstream options as appropriate. Use or adapt a suitable one. For a custom
implementation, record the specific gap in the existing issue, PR or task note.
Use [development guidance](references/development.md) to choose the branch,
base, name and post-merge disposition. For a heavy job, use the
[resource guide](references/resources.md) to compare estimated peak demand
with available capacity before starting it.

## Locate the executable

For public repository text, start with the [public writing guide](references/public-writing.md).
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
| Choose a technology stack for any project or assess a migration | [Stack selection](references/development.md#选择技术栈) | Check delivery constraints and existing tools, then validate the deciding trade-off in the target environment |
| Write or resume a handoff for another maintainer, agent or device | [Handoff writing](references/handoff.md) | Use an available `handoff` for a short session brief, `session-handoff` for longer-running work, or the project's existing record for a durable transfer |
| Changes that warrant an independent reviewer, disputed findings | [Independent review](references/independent-review.md) | Use a fresh reviewer and verify each finding against the actual revision and evidence |
| Understand a request, write a phased plan, decide whether to ask | [Planning and decisions](references/planning-and-decisions.md) | Review existing evidence, resolve consequential decisions and report in plain language |
| Maintain the repository, reach its audience, and check publication surfaces at handoff | [Repository stewardship](references/repository-stewardship.md) | Check actual branch, release and deployment state through the host |
| Choose what to commit or disclose, or move work between devices | [Files and devices](references/files-and-devices.md) | Inspect the diff, rights, environment and transfer results |
| Any text another person will see in a repository, its metadata, or an automation | [Public writing](references/public-writing.md) | Editorial workflow for drafting, review and publication within scope |
| New website, page added to an existing site, or substantial visual redesign | [Design](references/design.md) | Reuse the design of related pages and sites. Review representative pages side by side and navigate between them |
| README, website content, translations, examples | [Documentation](references/documentation.md) | Guidance; project-specific validators remain separate |
| Repository operations, bots, labels, SEO, distribution | [Operations](references/operations.md) | Adoption/configuration checks; platform settings require separate verification |
| Any bot that creates Git commits, regardless of host, runner or task | [Bot co-authorship](references/public-writing.md#自动化提交的联合署名) | Keep the bot as primary author and verify the project's co-author trailer on every bot commit that lands |
| Product identity, version, channel, candidate assets, public notes | [Release](references/release.md) | Offline `release-check` and editorial `notes-check` |
| Resource estimates and task closeout | [Resources](references/resources.md) | `doctor` reports host capacity. `finish` inspects registered scratch. |
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
- Use `finish --project` to inspect registered scratch. As part of closing the
  task, reconcile other owned paths and processes, verify what can be removed,
  carry out routine cleanup using the host's supported operations, and check the
  result. After a merge, check whether the task branch and worktree can retire.

## Leave a usable result

At each handoff, check whether the change affects README, the actual default
branch, releases, discussions and the deployed website. Use the repository
stewardship guide to update relevant surfaces within scope. Tell the person
what they can use now, what remains and any decision only they can make.

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
