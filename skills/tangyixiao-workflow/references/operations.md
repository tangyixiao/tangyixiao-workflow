# Repository operations mode

At handoff, use [repository stewardship](repository-stewardship.md) for the
reader-facing update check, maintenance ownership and discoverability. Use
[files and devices](files-and-devices.md) when staging material, choosing an
audience, or verifying a handoff to another environment.

For About metadata, Wiki navigation, workflow names, check summaries and bot
comments, use the [public writing guide](public-writing.md). The existing
repository determines the publishing surface and local conventions.

When adding or updating an Action that writes commits, follow the
[bot co-authorship guidance](public-writing.md#自动化提交的联合署名) at the step
that creates the commit. For a dependency PR, verify the author and trailers
on the commit that reaches the default branch.

Inspect the repository's real stack and existing automation before proposing a
baseline. GitHub's account-level `.github` community defaults do not automatically
install workflows, labels, bot configuration, licenses, settings, or this skill in
other repositories. Verify each receiving project's actual adoption.

## A small applicable baseline

- Prefer one dependency-update manager per ecosystem. Dependabot is a reasonable
  GitHub-only starting point; consider Renovate when its cross-ecosystem features
  address an actual need. Use a weekly grouped cadence with a small open-PR limit,
  keep major upgrades reviewable, and handle urgent security updates separately.
- Pin third-party Actions to verified release commits and maintain updates. Check
  current GitHub support before claiming SHA pins are covered by vulnerability
  alerts. Do not assume green checks establish all supply-chain coverage.
- Use a few meaningful labels. Forms can add issue types; path automation should
  add areas, not infer severity or publication readiness. Keep permissions minimal.
  Privileged metadata jobs must never execute code from untrusted PRs.
- Evaluate dependency review, CodeQL, secret scanning, and push protection for
  actual languages, manifests, visibility, and account entitlements. Verify results
  and coverage; Android Kotlin analysis needs its real build path.
- Avoid default stale closures, repetitive welcome/report comments, universal
  automerge, empty project boards, and fabricated sponsor destinations.

For public websites, inspect the actual deployment URL, subpath, language URLs,
canonical/social metadata, sitemap, 404 behavior, and indexing intent. Preview
deployments should not masquerade as the canonical product website. Metadata does
not establish discoverability or guarantee search ranking.

## Distribution and maintenance

Select a channel by the artifact: website deployment for sites, npm for an actual
JS library/CLI, PyPI for an installable Python package, GHCR for an actual container,
and signed application releases for native apps. Do not create a package just to
populate a repository's Packages area. Verify consumer authentication requirements;
public GitHub Packages npm and public GHCR do not have identical access behavior.

Prefer supported trusted publishing or narrowly scoped platform credentials for
real publishing. Keep checks separate from privileged publication. Review current
official platform documentation before enabling features, changing plan limits,
or recommending account-specific settings.

Bound cache keys, artifacts, logs, timeouts, and concurrent jobs. Cache only when
there is a measured benefit; retain release downloads through the intended channel,
not expiring CI artifacts. Cloud storage and local disk are separate inventories.

`adopt`, `check`, and `upgrade` handle local toolkit adoption state. They do not
configure GitHub, install bots, publish packages, or prove downstream inheritance.
