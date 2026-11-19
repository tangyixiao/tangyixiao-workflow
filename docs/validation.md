# Alpha validation scope

PR #1 merged to `main` on 2026-11-19. Linux (Node 22), Windows (Node 24),
macOS (Node 24) and the reusable project check passed on merge commit
`d2b1698`. The website check passed on the PR revision with the same source tree.
[Main CI](https://github.com/tangyixiao/tangyixiao-workflow/actions/runs/44529619254) ·
[Website CI](https://github.com/tangyixiao/tangyixiao-workflow/actions/runs/44528848459)

## Local behavior

- Project adoption was applied to this toolkit itself and passed strict checks.
- An independent forward test followed the Skill and getting-started guide with
  an existing npm fixture. Existing project files and AGENTS content survived;
  adoption, installed-runtime checks, reviewed budget customization and guarded
  uninstall were exercised through real CLI calls.
- Removal retained edited references and an unrelated private file. A resulting
  partial-installation status ambiguity was corrected and regression-tested.
- The native Codex Skill folder was installed with its self-contained runtime,
  license and UI metadata. Its runtime checked this project and read back complete
  unchanged managed-file state. New-session discovery and automatic invocation
  remain separate acceptance steps.

The forward test exercised same-version customization acceptance. It does not
claim a real historical migration between published toolkit versions.

## ZCode inspection

A read-only pilot used the existing ZCode Bridge checkout. It produced an
adoption plan without applying it. The branch, HEAD and git status were identical
before and after. The observed release candidate surfaced an inconsistent public
title, a repeated body title, and checkout/source mismatch. No attachment was
downloaded, so its asset-integrity check deliberately remained unverified.

That pilot does not establish an end-to-end production ZCode rollout, runtime
inference, historical asset equivalence or registry publication. The two
[release-note examples](../examples/release-notes/zcode-0.6.3.md) are reviewed
format/content drafts; they have not been substituted into online Releases.

## Scope of the checks

Meaningful regression checks exercise preservation, plan/apply, idempotence,
custom configuration acceptance, paths and links, receipt manipulation, release
product/version/channel/checkout mismatch, real file hashes and notes hygiene.
The source/link validator and package dry-run are additional checks, not evidence
of client activation or publishing.

The standard Skill validator was attempted but its Python interpreter lacked
PyYAML. No dependency was installed to satisfy that optional validator. Native
metadata/reference checks and independent use were performed; they should not be
described as a successful run of the unavailable validator.
