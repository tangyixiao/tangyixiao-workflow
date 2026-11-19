# Public release-note format profiles

Use this file as the single format reference. For the same product and language,
keep the selected profile across releases; do not invent new heading names,
levels, order, platform-label styles, or evidence summaries for each version.
Content may differ with the release. Uniform formatting must not fabricate a
supported platform, package channel, asset, test, or compatibility claim.

## Profile definitions

| Element, in order | `tangyixiao-zh-v1` | `tangyixiao-en-v1` |
| --- | --- | --- |
| Opening | One concise prose summary of the user impact | One concise prose summary of the user impact |
| First H2 | `更新内容` | `Changes` |
| Second H2 | `安装与升级` | `Installation and upgrade` |
| First H3 inside installation | `运行要求` | `Requirements` |
| Second H3 inside installation | `安装方式` | `Installation` |
| Third H2 | `兼容性与已知限制` | `Compatibility and known limitations` |
| Final disclosure summary | `校验与验证记录` | `Checksums and validation` |
| First bold label inside disclosure | `校验信息` | `Checksum` |
| Second bold label inside disclosure | `验证范围` | `Validation` |
| Third bold label inside disclosure | `源码` | `Source` |

## Formatting rules

1. Start with the summary, not a body H1 or a repetition of the Release page title.
   Use exactly the three H2 sections above in that order. Keep the opening useful
   rather than repeating every bullet below it.
2. Use short unordered bullets for changes and for compatibility/known limits,
   including a release with only one change or limitation. Keep actual runtime,
   host, preview-feature, and unverified-flow boundaries.
3. Installation always contains the two H3 sections in order. State actual
   requirements, then use consistent bold platform labels followed by a colon,
   for example `**DSH Desktop**：` in Chinese or `**DSH Desktop**:` in English.
   Use the same label for the same route across a product's releases.
4. Include only installation routes actually available in that release. A TGZ-only
   release does not gain an npm/Web command to match another release's length.
   Put real shell commands in a labelled code fence; keep filenames as inline
   code rather than making them look like commands. Omit unsupported route entries.
5. Finish with one `<details>` block and the exact `<summary>` above. Within it,
   put the three exact bold labels on their own lines in order, with their content
   below each label. Keep this block after the known-limits section.
6. Link a real checksum attachment when it exists. For a historical release with
   only an inline hash, preserve that hash and explain the missing attachment.
   Keep validation coverage concise and source links identifiable; do not put
   local debugging chronology or private task instructions here.
7. Use one complete language per profile document. Provide a complete translation
   through a separate linked document using its corresponding profile; do not
   alternate translated fragments or add differently named headings to this body.

## Bind and check

Set `release.notesFormat` to the selected profile id in the project's release
configuration, or explicitly select the same profile for a standalone check:

```sh
node bin/pwf.mjs notes-check --notes release-notes.md --title "Product v1.2.3" --format tangyixiao-zh-v1
```

An installed Skill uses its own `runtime/bin/pwf.mjs`; a source checkout uses
`bin/pwf.mjs`. Check the executable's actual output. Format validation establishes
structure and consistency, not the truth of release facts, complete editorial
quality, or successful publication. See [release guidance](release.md) for those
boundaries. No format change permits rewriting historical product lineage.
