# Tangyixiao Workflow implementation contract

Tangyixiao Workflow is a versioned source repository, a discoverable Skill and a
Node.js standard-library CLI. Its baseline is the Tangyixiao Open Source Standard
(TOSS). Account-level `.github` community defaults remain a separate GitHub
mechanism. Version `0.1.0-alpha.1` is a development version, not an npm publication.

## Components

| Component | Responsibility |
| --- | --- |
| `bin/pwf.mjs` / `tywf` | Strict option parsing, command dispatch and structured results |
| `lib/project.mjs` | Read-only discovery, strict project checks, planned adoption and guarded upgrades |
| `lib/install.mjs` | Self-contained Skill installation, hash-based updates and preservation during removal |
| `lib/release.mjs` | Offline product, version, channel, Git and local asset integrity checks |
| `lib/notes.mjs` | Specific publishing-hygiene failures and nonblocking editorial findings |
| `lib/resources.mjs` | Bounded resource registration and read-only completion plans |
| `skills/tangyixiao-workflow/` | Short discoverable instructions, client UI metadata and conditional references |

## Project state and ownership

The project configuration is `.github/project-workflow.json`. It records schema
1, toolkit version, canonical repository, profile, resource defaults and optional
release configuration. Supported profiles are npm, static and generic.

The project receipt tracks the configuration hash and inserted AGENTS block.
AGENTS content outside that block remains project-owned. Upgrades preserve
unknown project fields and settings. A changed configuration requires review and
explicit `--accept-config` before it becomes a new baseline; changed managed
instructions remain a conflict. [Getting started](getting-started.md) describes
the exact plan/apply workflow.

Installed Skills bundle the required runtime, selected references, and LICENSE /
NOTICE. Their private receipt records individual file hashes and created
directories. Installation rejects overlap with its source and linked paths.
Removal deletes only unchanged managed files and empty owned directories;
modified files and unrelated content remain. Partial residue is reported as
partial, not a complete installation.

## Execution boundaries

Every mutation command defaults to a plan and accepts explicit `--apply`.
Instructions, metadata, filenames and installation text are data, not executable
shell fragments. The implementation adds no network publisher, credential,
daemon, database, telemetry or dependency installation.

Release checks verify the local checkout and tag, manifest/lockfile identities,
declared channel mapping, required asset names and actual SHA-256 values. They
report archive internals, installation, runtime, registry publication and build
provenance as unverified. [Release contract](release-contract.md) defines the
candidate format and limits. Notes checks do not establish editorial quality.

Resource records live within `work/project-workflow/`. Registration requires an
explicit task namespace and purpose. Completion scans only recorded paths, with
entry limits and link checks. It does not infer ownership from age, kill
processes, recursively delete scratch or enforce OS quotas. The executing agent
must separately finish authorized, verified cleanup.

## Validation

Meaningful tests cover plan/apply behavior, idempotence, preservation of existing
content, customization acceptance, partial uninstall, path traversal/links,
release/channel/checkout mismatch and notes hygiene. Reusable CI runs the same
strict project check against explicitly adopted projects. Local source checks,
hosted CI, actual client discovery, publication and end-to-end use are separate
evidence.
