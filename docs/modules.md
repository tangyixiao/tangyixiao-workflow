# Modules and execution boundaries

Tangyixiao Workflow combines a small executable with task-specific Skill guidance.
The receiving project's facts, instructions, license, stack and authorization set
the scope. Personal choices from a private conversation are not universal policy.

| Module | Local executable | Guided work / separately verified evidence |
| --- | --- | --- |
| Installation | `install`, `status`, `uninstall` | Client discovery and actual Skill invocation |
| Project adoption | `adopt`, `check`, `upgrade` | Project tests, representative adoption, project-owned customization |
| Design | No site generator in this CLI | Real reference research, approved desktop/mobile overview, Chinese typography and visual comparison |
| Documentation | No generic proof of content correctness | Native README, factual claims, meaningful screenshots, languages/themes, local links and actual examples |
| Operations | Adoption configuration only | GitHub settings, one dependency manager, bounded bot PRs, labels, SEO, package-channel selection and runtime checks |
| Release | `release-check`, `notes-check` | Exact archive internals, installation, signatures, registry state and consumer access |
| Resources | Registration and `finish` inspection | Verified ownership, active consumers, recoverability, stopping task-owned jobs and separately authorized cleanup |
| Video | No recorder or renderer | Real product operations, suitable 60 fps MP4, horizontal/vertical recomposition, subtitles, covers and platform requirements |

## Release content has an audience

Public notes answer: what changed, who it affects, how to install/upgrade, and which
compatibility or known limitations matter. They are not an agent handoff or an
acceptance report. Preserve useful boundaries such as an unverified real-account
flow, required host versions, or a preview-only feature missing from a stable line.

Keep test counts, detailed source/CI evidence, and implementation internals in a
short disclosure section, a folded evidence block, or a separate verified link;
provide checksum attachments for new release assets. Do not include private chat
authorization, localhost diagnosis/retry history, duplicate body H1s, or alternating
single-sentence translations. Use one complete language section, optionally with
a complete translation in its own section/link.

The [release-note examples](../examples/release-notes/zcode-0.6.3.md) demonstrate
editing against dated source facts. They are local editorial drafts, not evidence
that those remote releases were edited or republished. The
[0.5.1 example](../examples/release-notes/zcode-0.5.1.md) preserves its original TGZ
distribution and preview compatibility boundary rather than inventing current
registry history.

## Configuration is adoption, not account administration

`.github/project-workflow.json` uses schema 1 and records toolkit version,
repository, profile, configurable resource defaults and optional release policy.
It does not install workflows or set remote account permissions merely by existing.
GitHub's special `.github` repository continues to supply supported community-file
defaults independently of this toolkit.

An installed runtime is versioned from the source once; it does not silently track
an upstream branch. Preview updates and conflicts instead of maintaining separate
editable rule copies in a plugin, Skill, template and global AGENTS file. A later
plugin may package the same source, but no plugin/MCP service is part of this alpha.

Use `--help` and the executable's actual results as the interface authority. A
module described here is not a claim that its platform settings, browser checks,
production render, release or client integration has run.
