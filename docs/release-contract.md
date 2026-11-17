# Tangyixiao Workflow release candidate contract

`checkRelease({ projectRoot, configPath, candidatePath })` is an asynchronous, local gate exported by `lib/release.mjs`. It reads JSON, the declared local files, and existing Git commit/tag objects. It does not create tags, publish packages, edit Releases, run package scripts, unpack archives, install anything, or contact a registry.

The CLI entry is `tywf release-check --project <directory> --candidate <json>`. `--config <json>` overrides the default `.github/project-workflow.json`. Node.js 22+ and an existing Git executable are required; there are no package dependencies to install for this gate.

## Configuration

The `release` property of project configuration contains the product's durable identity and channel policy. This example is illustrative; choose the actual product, package and installation target rather than copying this identity into unrelated projects.

```json
{
  "schema": 1,
  "toolkitVersion": "0.1.0-alpha.1",
  "repository": "example/widget",
  "profile": "npm",
  "release": {
    "productId": "widget",
    "displayName": "Widget",
    "packageName": "@example/widget",
    "manifest": "package.json",
    "tagPrefix": "v",
    "installTarget": "npm install {packageName}@{version}",
    "requiredAssets": ["{packageName}-{version}.tgz", "SHA256SUMS.txt"],
    "channels": {
      "stable": {"prerelease": false, "npmTag": "latest", "latestEligible": true},
      "preview": {"prerelease": true, "npmTag": "next", "latestEligible": false}
    }
  }
}
```

- `productId` identifies the product independently of branding. `displayName` is the public product name; `packageName` is its npm-compatible package identity. Two products in one source repository need separate, explicit configurations.
- `manifest` defaults to `package.json` and must resolve inside `projectRoot`. Its `name` and `version` must match the configured package and candidate. It must also belong to the tracked source (`manifest.source`); an untracked manifest cannot establish the tagged source's version. A currently checked-out manifest with another version fails even if an older release tag exists.
- By default, existing `package-lock.json` and `npm-shrinkwrap.json` beside the manifest are checked. Top-level name/version must agree; modern lockfiles must also contain a matching `packages[""]` entry. Every checked lockfile must belong to the tracked source (`lockfile.source`). Optional `release.lockfile` selects an explicit project-local JSON lockfile instead. A configured missing lockfile is an input error. If neither default lockfile exists, the result explicitly reports lockfile checking as not applicable. Other lockfile formats are not parsed in this first version.
- `tagPrefix` defaults to `v`. The exact tag is `${tagPrefix}${version}` and the exact title is `${displayName} ${tag}`. The prefix can distinguish products, for example `widget-v`; unsafe Git ref syntax is rejected.
- `installTarget` is a literal installation destination or command template. Supported placeholders are `{packageName}`, `{version}` and `{displayName}`. For a command template, `{packageName}` retains the full scoped identity, such as `@example/widget`. A sufficiently specific target makes accidental cross-product installation instructions easier to detect. The gate never executes it.
- `requiredAssets` defaults to `["{packageName}-{version}.tgz"]`. At least one pattern must contain `{version}`. Patterns expand to plain filenames, not glob patterns or executable expressions. In asset names only, `{packageName}` follows the npm pack filename stem: `@example/widget` becomes `example-widget`. Other supported placeholders keep their meanings. Configure ZIP or other product outputs explicitly when appropriate. Additional declared assets are permitted, but all are checked for file integrity; required names are not a proof of their contents.
- Channel names are configurable. Their `prerelease` and `latestEligible` values must be booleans; npm tags use portable lowercase names such as `latest`, `next`, `community` or `canary`. A preview channel cannot map to `latest` or be latest-eligible. Aliases with different purposes should be represented and reviewed explicitly rather than inferred from a title.

## Candidate metadata

```json
{
  "productId": "widget",
  "version": "1.2.3",
  "tag": "v1.2.3",
  "title": "Widget v1.2.3",
  "channel": "stable",
  "prerelease": false,
  "makeLatest": true,
  "npmTag": "latest",
  "sourceCommit": "1111111111111111111111111111111111111111",
  "notes": "Fix startup in Widget 1.2.3. Install: npm install @example/widget@1.2.3.",
  "installTarget": "npm install @example/widget@1.2.3",
  "assets": [
    {"path": "work/release/example-widget-1.2.3.tgz", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
    {"path": "work/release/SHA256SUMS.txt", "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
  ]
}
```

The example commit and digests are placeholders: replace them with observed evidence. The gate requires an existing local tag; it never creates one. `sourceCommit` must be the full 40- or 64-character commit ID itself. Annotated release tags are peeled to their commit and must point at that source. Supplying the SHA of an annotated tag object as `sourceCommit` fails. A missing local object/tag fails closed without fetching it.

The current checkout HEAD must equal `sourceCommit` (`git.checkout`). Staged or unstaged tracked changes fail `git.tracked-clean`. Untracked or ignored candidate JSON, attachments and other task scratch do not fail the tracked-state gate; manifest and checked lockfile evidence must nevertheless be tracked. A same-version commit after the tag is still another source revision and cannot pass by reusing the older declared tag. These checks read state without resetting, staging or modifying the checkout.

Ordinary Git status can hide modified source when an index entry uses `assume-unchanged` or `skip-worktree`. The separate `git.index-flags` gate therefore reads fixed `git ls-files -v -z` evidence and refuses lowercase status markers (assume-unchanged) or `S` (skip-worktree, including sparse-checkout entries). It also fails closed if the index evidence cannot be read or parsed. Preserve any local changes, explicitly clear the flags or use a complete checkout, then recheck. The gate never clears flags, expands a sparse checkout, or modifies the index automatically. NUL-delimited parsing keeps whitespace and newlines in filenames from changing which entries are checked.

Git status itself can invoke configured source filters. Before permitting it, the gate reads tracked entries with fixed `git ls-files --stage -z`, inspects effective clean/process filter configuration with `git config --null --get-regexp`, then reads each tracked path's effective filter attribute with `git check-attr -z filter -- ...paths`. The last configured value for each scalar key wins. Unused global drivers such as Git LFS do not block a normal project; a tracked path referencing a driver with an effective nonempty clean/process command fails `git.filter-commands`, and status is skipped. Only configuration key names appear in the result, never command values. No-match config exit 1 with no error output is normal; other query errors or incomplete evidence fail closed. Filter settings are preserved, not automatically removed or run.

The alpha also refuses mode `160000` gitlink entries (`git.submodules`) and skips status instead of entering submodule worktrees whose filters have not been inspected. Such source needs separate trusted submodule-worktree and packaging acceptance. Inspection is bounded to 10,000 tracked paths and 100 batches of at most 100 paths; each Git query retains the 5-second/256-KiB output limit. Unparseable names, failed attribute batches or exceeded limits prevent status and acceptance. This is a deliberately limited offline gate, not universal support for filtered/sparse/submodule checkouts.

Versions follow SemVer 2 rules. Core numeric components and numeric prerelease identifiers reject leading zeroes. `1.2.3-rc.1` is a prerelease; `1.2.3+build.001` is stable with build metadata. Stable channel policy requires no prerelease suffix; preview policy requires one. Candidate GitHub `prerelease`, npm tag and `makeLatest` must agree with the configured channel. Stable maintenance releases may set `makeLatest` to false. These are checks of intended metadata, not assertions about existing remote settings or registry aliases.

Asset paths are resolved from `projectRoot`, must stay inside it, and cannot contain `..`. Every attachment must be a nonempty regular file with matching SHA-256. Hashing streams actual file bytes instead of trusting the declared digest. Duplicate paths or filenames fail. A missing file, missing required filename or mismatched digest fails the candidate. Checksum sidecars are themselves hashed; this version does not parse their internal lines or prove that they list the other attachments correctly.

Notes must be nonempty, identify the version and contain the configured installation target and an installation/update cue. There is no minimum character count: a concise fix should not require filler. `reviewReleaseNotes({notes,title})` supplies the shared public-note hygiene checks and nonblocking advisories. A failed hygiene check fails this gate; advisories and `editorialReview: "required"` remain visible. The literal checks cannot determine whether a command works, whether changes are described honestly, or whether prose reads well. Review the actual product changes and user impact. Keep internal debugging, private instructions and approval history in the task record, while retaining concrete user-facing limitations in public notes.

## Paths and execution boundary

The default config path and relative explicit paths resolve from the project. Explicit absolute `configPath` and `candidatePath` may be outside the project, enabling a read-only audit from a separate suite checkout. Their files and every parent component must still be free of symbolic links or junctions. Asset, manifest and configured lockfile paths always remain project-local. Windows alternate data streams, traversal components and symbolic links are rejected. JSON metadata is limited to 1 MiB per file, parsed as data, and never evaluated.

Files are checked before opening, after opening and after hashing. Where supported, file opens also use `O_NOFOLLOW`. These checks prevent normal symlink/path escapes and detect common file replacement races; they are not an OS sandbox against an attacker who can continuously mutate the filesystem concurrently. Use a stable, trusted checkout during acceptance.

Git uses only fixed `rev-parse`, `config`, `ls-files`, `check-attr` and conditionally safe `status` operations through `execFile` with `shell: false`, bounded time/output, disabled optional locks/fsmonitor and denied transport. Ambient `GIT_*` overrides are removed; replacement objects, prompts and lazy fetching are disabled. Normal Git worktree metadata is handled by Git itself. No lifecycle hook, manifest script or configured command is invoked. A missing Git executable or unresolvable object is reported as failed Git evidence.

## Result and limits

The JSON-serializable result includes:

- `ok`, plus `checks: [{id,ok,message}]` for every evaluated gate;
- product/package/version/tag and resolved source evidence;
- attachment paths, byte counts, expected and observed SHA-256;
- public-note `advisories` and required editorial review;
- `gateScope: "metadata-and-asset-integrity"`;
- `notVerified: ["archive-contents", "installation", "runtime", "registry-publication", "build-provenance"]`.

Unreadable/malformed JSON, unsafe paths and invalid policy configuration throw normal Errors. Candidate disagreements and missing/bad assets return a failed gate with checks. There is no tarball extraction, manifest-from-archive comparison, installation, network request or publication. A clean tracked source and matching tag still do not prove that an attachment was built from that commit: untracked/ignored inputs and the build process remain outside this gate. Source, archive internals, platform flags, registry aliases, installation and actual use need their own evidence.

An opaque fixture file can pass its filename/hash gate while archive internals remain explicitly unverified. A matching TGZ digest must never be reported as proof of the package version inside it or as authorization to publish.
