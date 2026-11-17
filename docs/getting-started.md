# Get started with Tangyixiao Workflow

[中文 README](../README.md) · [English README](../README.en.md)

Use an existing Node.js 22+ runtime and the existing source checkout. This alpha
requires no runtime dependencies, npm publication, daemon, or second clone of the
receiving project. Run commands from the toolkit checkout unless noted otherwise.

## Inspect, install, and discover

```sh
node bin/pwf.mjs --help
node bin/pwf.mjs doctor
```

For PowerShell:

```powershell
$skillDir = Join-Path $env:USERPROFILE '.codex/skills/tangyixiao-workflow'
node bin/pwf.mjs install --destination "$skillDir"
node bin/pwf.mjs install --destination "$skillDir" --apply
node bin/pwf.mjs status --destination "$skillDir"
```

For a POSIX shell, pass `"$HOME/.codex/skills/tangyixiao-workflow"` as the
destination instead. The destination names the skill folder, not the entire
client home. Inspect the plan before applying it; do not install into a folder
owned by another tool. The installer must preserve unmanaged or modified content
and reject unsafe links rather than silently taking ownership.

The installed skill includes `SKILL.md`, selected references, and the required
`runtime/bin/pwf.mjs` with its local support files. It does not need the source
checkout to remain beside it. Installation does not change client credentials,
provider settings, other skills, or project repositories.

Let the client discover the new folder through its supported reload/new-session
mechanism, then explicitly try `$tangyixiao-workflow`. A successful file status is
not proof the client loaded or invoked it. See [client support](client-support.md).

## Preview adoption before writing

Inspect the receiving project's instructions, branch and dirty work. Choose its
actual repository and one profile:

- `npm`: an existing project with a package manifest.
- `static`: a static project without a package installation requirement.
- `generic`: a project whose stack does not need an npm-specific assumption.

```sh
node bin/pwf.mjs adopt --project /path/to/project --repository owner/repository --profile npm
```

Review proposed paths and any conflicts. If those changes are authorized:

```sh
node bin/pwf.mjs adopt --project /path/to/project --repository owner/repository --profile npm --apply
node bin/pwf.mjs check --project /path/to/project
```

The project receives `.github/project-workflow.json` and, where applicable, a
small managed AGENTS block. The configuration path deliberately retains its
initial internal name. Commit appropriate project configuration through the
project's normal workflow so another session can inspect it. Include the project
receipt `.github/project-workflow.receipt.json` and managed AGENTS changes in that
adoption commit so CI can verify ownership/hashes. Keep machine-local Skill
installation receipts and task scratch separate from public project source.

`check` validates toolkit configuration and managed-content state. It does not
run the project's tests, validate a website visually, or enable GitHub features.
Continue with applicable project commands and the relevant [module](modules.md).

## Run from the installed copy

When outside the toolkit checkout, use the absolute installed runtime path, for
example in PowerShell:

```powershell
$pwf = Join-Path $skillDir 'runtime/bin/pwf.mjs'
node "$pwf" doctor
node "$pwf" check --project 'D:/path/to/project'
```

If using the source Skill before installation, its executable is the repository's
`bin/pwf.mjs`, not a nonexistent `runtime/` folder. `tywf` is the package's intended
command alias; these instructions do not assume it has been linked globally.

## Release checks and completion

Configure the optional [release contract](release-contract.md) and a local
candidate first; the checker does not infer a package's product or channel.

```sh
node bin/pwf.mjs release-check --project /path/to/project --candidate /path/to/candidate.json
node bin/pwf.mjs notes-check --notes /path/to/notes.md --title "Product v1.2.3"
node bin/pwf.mjs finish --project /path/to/project
```

The release checker consumes local metadata and declared files; it is not a
publisher or archive inspector. The notes checker catches structural/narrative
problems, not unsupported feature claims. The finish command reports registered
resources and a cleanup plan; it does not delete files or stop processes. Read the
Skill's release/resources references before using those modes.

## Upgrade or remove

After updating toolkit source, run `install --destination ...` again to inspect a
skill upgrade and apply only its allowed changes. Separately inspect project
upgrades with `upgrade --project ...`, then use `--apply` for an authorized change.
Edited managed files require conflict review rather than an overwrite.

If a valid project configuration was intentionally customized, review it and use
`upgrade --project ... --accept-config` to inspect preservation of those changes;
add `--apply` for the authorized upgrade. This flag does not accept arbitrary
edits to other managed files or disable validation.

To remove an installation, first run `uninstall --destination ...`; then add
`--apply` only for the reviewed removal scope. Modified/unmanaged files remain
protected. Uninstalling a Skill does not automatically revert project adoption.

`status` distinguishes a complete installation from partial residue. If edited
files remain after uninstall, `tracked: true` can coexist with `installed: false`
and `state: partial`. Review the retained files; a remaining receipt alone does
not mean an executable Skill remains installed.

Report installation, discovery, invocation, project checks, CI and actual delivery
separately. The source version is an alpha implementation, not a promise of
cross-client validation or live platform integration.

## Add the repository check to CI

The source includes `.github/workflows/project-check.yml` as a reusable workflow.
Each receiving repository must explicitly call it and supply `toolkit-ref` as the
reviewed full 40-character toolkit commit SHA. Pin the workflow reference to that
same reviewed revision; do not substitute `main` or an unverified example SHA.

The workflow checks out the receiving project and toolkit into separate paths and
runs strict adoption checks. It does not need publishing credentials or execute
the receiving project's scripts. Configure and observe its first real run before
claiming CI adoption; the account-level `.github` repository does not inherit this
workflow into other projects automatically.
