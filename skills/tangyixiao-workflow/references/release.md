# Release mode

Begin with the destination project's [public writing conventions](public-writing.md).
Use its release format when one exists. The Tangyixiao profiles are defaults for
projects that select them.

Separate stable product identity from display names, registry coordinates, and
repository names. A repository may contain multiple independently versioned
products. Historical releases keep their original product lineage; a later rename
does not justify renaming every old product or moving old tags.

## Scope a release update

Interpret “publish an update” using the product's established delivery route.
Before changing anything, read its release configuration, runbook, and last
successful release on the requested channel. In the existing task or release
record, state two things:

1. **What ships.** Name the product or package, audience, stable or preview
   channel, previous published version and target version or revision. Build
   the change list from the previous published tag or deployment revision on
   that product line through the candidate. In a multi-product repository,
   include shared changes that affect the product. For a first release, say so
   and identify the starting contents. A single PR or the latest commit can
   omit changes made since the last release.
2. **Where people will get it.** List the established destinations in scope
   and what will prove each is ready. For “full release”, include every
   applicable destination for that product and channel, including established
   installation or activation targets covered by the request. If the product,
   channel, or authority for a consequential destination is genuinely ambiguous,
   ask about that specific gap. Continue the already-authorized steps.

Use the same completion rule each time. A commit identifies source, a merge
lands it on the target branch, and green CI records checks on that revision.
For a release request, continue through the authorized publishing steps and
read back the version or artifact at the destination people actually use. If a
push or a CI job triggers publication, verify its published result. A site may
ship through deployment; a library may ship through a registry. A request
limited to committing, merging, running CI, or preparing a release candidate
ends at the named step.

Report each in-scope destination with its version, observed state and evidence.
For example, a plugin could be available from the registry and its GitHub
Release, installed and exercised in Desktop, and still awaiting a Web runtime
check or third-party catalog approval. Verify Desktop and Web independently
when both are in scope. A submitted catalog PR or an accepted support request
counts as submitted until the public listing resolves to the intended version.
If an item is blocked, name the remaining action and who can take it. Lead the
handoff with where the update can be used now; reserve “fully released” for the
point when every agreed destination meets its acceptance condition.

## Offline candidate check

Use the source/runtime `release-check --project PROJECT --candidate CANDIDATE.json`.
It reads local configuration, manifests, candidate metadata, and declared assets.
It does not publish or contact a registry. Inspect the CLI's exact reported checks
and limitations rather than converting one `ok` into a release claim.

The project configuration is `.github/project-workflow.json`. Its optional release
section declares `productId`, `displayName`, `packageName`, `manifest`, `tagPrefix`,
`installTarget`, and `channels`. Example channel policy:

```json
{
  "stable": { "prerelease": false, "npmTag": "latest", "latestEligible": true },
  "preview": { "prerelease": true, "npmTag": "next", "latestEligible": false }
}
```

A candidate supplies `productId`, `version`, `tag`, `title`, `channel`, `prerelease`,
`makeLatest`, `npmTag`, `sourceCommit`, `notes`, `installTarget`, and
`assets: [{"path": "relative/file", "sha256": "digest"}]`. Title follows
`displayName + " " + tag`; source commit is a full Git SHA. Optional
`release.requiredAssets` lists expected versioned filenames with `{packageName}`,
`{version}`, or `{displayName}` substitutions; the default is
`{packageName}-{version}.tgz`. Optional `release.lockfile` selects a JSON npm
lockfile; otherwise existing npm lockfiles are checked.

Before publication, require product/package identity, manifest/lockfile version,
tag/title, channel, installation target, versioned assets, and hashes to agree.
Preview versions have a SemVer prerelease suffix, GitHub `prerelease=true`, and a
non-stable npm tag. A stable maintenance release need not become GitHub Latest.
GitHub Latest is repository-wide; secondary products should not displace the
intended default product by accident. Git tags and npm dist-tags are different.

## Evidence beyond this check

This first version verifies declared file integrity and metadata, plus the local
source commit and local tag target. It does not inspect archive internals, verify
remote tag state, execute installations, verify signatures, or prove
registry/publication state. Perform
the relevant exact-artifact checks separately; do not claim these from `ok`.

Use the exact tested package or installer for publication, with meaningful notes,
compatibility limits, install instructions, and checksums. Re-read the uploaded
assets and registry metadata afterward. Explain any source-only, unsigned,
preview, or untested-platform boundary in user-facing terms.

Correct historical metadata narrowly against the facts at that release. Preserve
versions, tag targets, immutable assets, and independent product names. Fixing an
old prerelease flag must not silently change today's correct stable dist-tag.
Use a documented migration when a package genuinely changes identity.

## Edit for the release's readers

Public notes explain changes, user impact, installation/upgrade, required
compatibility, and material known limitations. A plugin user does not need an
agent's handoff or acceptance transcript.

- Follow the single [release-note format reference](release-format.md). Bind
  `release.notesFormat` to the product's chosen language profile and keep it across
  releases; do not temporarily rename headings, installation labels, or the folded
  evidence summary. Do not repeat the Release page title in the body.
- Use the profile's complete primary language. Put a complete translation in a
  separate linked document with its corresponding profile, not alternating fragments.
- Keep real boundaries that affect use: host/runtime requirements, missing
  preview features, unsupported platforms, and genuinely unverified live flows.
  Do not remove them mechanically to make a release sound finished.
- Move test counts, CI/source links and technical evidence into a short folded
  evidence section or a separate verification document. Checksums normally belong
  in asset attachments. If a historical release had only an inline checksum,
  preserve that fact instead of inventing a missing attachment.
- Omit private-chat authorization, localhost/port-conflict diagnosis and retry
  chronology, and statements about an agent's local preview installation. State
  supported upgrade paths instead. Keep source integration status only when it
  establishes a material support or compatibility limitation.
- Do not merely change "the user requested" to "Tangyixiao requested". Publish
  project facts; name the real decision-maker only when personal attribution is
  necessary. Normal product users and authorization mechanisms remain valid terms.
- Include implementation detail only when it explains a user-visible effect,
  migration requirement, or compatibility constraint.
- Include only genuine installation routes for that release. Do not invent an
  npm/Web command or unsupported platform entry merely to match another version.

Run `notes-check --notes NOTES.md --title "Product v1.2.3" --format PROFILE_ID`
for the selected format and obvious narrative problems. It is a limited check, not a translation,
fact checker, license review, or proof of behavior. Review meaning against actual
source and assets. Editorial cleanup does not authorize publication or changes to
historical tags, assets, or dist-tags.

Official semantics: [GitHub Releases](https://docs.github.com/en/rest/releases/releases),
[SemVer](https://semver.org/spec/v2.0.0.html),
[npm dist-tags](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/).
