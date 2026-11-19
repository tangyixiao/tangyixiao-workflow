# Documentation mode

Apply the [public writing guide](public-writing.md) to README and Wiki work in
any repository. Check the destination's established structure and language first.

Write for the receiving project's users and contributors. State its purpose, a
working way to start, actual support and limitations, and where to get help. Keep
repository file inventories and maintenance detail out of the primary product pitch.

## README and website content

- Use real identity, useful images, installation/download links, one tested example,
  and the project's own license and contacts. Copying a template does not confer
  another project's product name, capabilities, release history, or asset rights.
- Keep native Markdown text and links useful. Prefer individual small images and
  supported `picture` markup to a screenshot of the entire README. Verify actual
  GitHub rendering and external image loading, not just sanitized HTML output.
- Provide language entry points and keep translated claims consistent. Separate
  translated documentation from the application's available interface languages.
  Register complete locales rather than copying whole websites for each language.
- Keep theme choices, same-page language switching, keyboard use, and mobile
  readability coherent when the website supports them. Test real Chinese text.
- Publish project facts. Do not copy chat labels, approval history, instructions
  from a particular conversation, private preferences, or obsolete PR-stage prose
  into public product copy. Normal software-user and authorization roles remain valid.
- Where attribution of a personal decision is actually relevant, name its real
  decision-maker (Tangyixiao for this toolkit), rather than an observer's "user" or
  "human". Merely replacing "the user requested" with "Tangyixiao requested" does
  not turn a task transcript into useful public copy. In personal learning records,
  use the learner's own first-person voice where appropriate; do not confuse that
  author with an application's users or operating-system accounts.
- Badges, counters, platform maturity, releases, and demo footage need evidence.
  External charts may cache or fail; provide an ordinary link and no embedded token.

## Check what is actually delivered

Reuse project checks for local links, fragments, HTML `src`/`srcset` in Markdown,
images, locale consistency, and generated-source drift. Exercise documented commands
in a bounded workspace when authorized; do not call a command tested merely because
it appears in a code block. Keep format/spelling tools in the existing toolchain.
Bound external-link requests and review rate limiting separately from broken URLs.

For published packages, inspect the exact package's README, license/notices, public
entry points, file list, repository URLs, version, and install instructions. A source
README is not proof the registry artifact contains the right material.

Selected examples: [native README snapshots](https://github.com/tangyixiao/.github/tree/f65a02e71a771249700e2239ae1091bed9d7dc31/examples/readme)
and [multilingual website source](https://github.com/tangyixiao/.github/tree/843e1909f82dad054f9dbfef748392c436d850a5/site).
The toolkit source's `docs/provenance.md` records their scope. Treat them as
references, not a bundled asset library. The
installed CLI's `check` validates adoption state; these content checks still need
the receiving project's own validators and actual presentation review.
