# Tangyixiao Workflow website

The first-time visitor is deciding whether the Skill helps with a real
repository task. A maintainer who already knows the tool should be able to get
straight to the installation guide. Use actual public material for the first
journey and a stable, direct link for the second.

## Current site

- Four pages per language cover home, features, installation and participation.
  Keep equivalent destinations when switching between Chinese and English.
  The source download includes a working offline site.
- `site/style.css` defines the responsive grid, spacing, light/system/dark color
  roles, system sans-serif stack with Chinese fallbacks, and keyboard focus
  treatment. Use those tokens for routine work. Check the actual rendered
  Chinese glyphs, long English identifiers, and inline command/file names.
- The homepage introduces the tool with a blue masthead and an editable draft.
  Give the editor and check results adjacent space on desktop and a single
  reading order on mobile. Use visible labels, text and keyboard focus in both
  themes. Examples identify their source, and the actual terminal recording is
  available to play on demand.
- The stdlib renderer shares the header, footer, navigation and controls between
  pages. Keep browser-native disclosure and links where they meet the need.
  A new component library should solve a specific interaction this site lacks.

## Design decisions for a substantial change

The homepage should identify Tangyixiao Workflow before introducing a case
from another project. Start a comparison with real toolkit output, for example
the files a first adoption would create or update. If an original illustration
accompanies the example, keep filenames, commands and results in real text.
Keep the key action recognizable in either language. Try independent Chinese
semantic line breaks and English line lengths, with controls sized to their
labels. Compare the same homepage in both languages on all three review widths.

1. Pick one thing a reader should understand or do in the first viewport.
   Bring an exact excerpt, a real output, or a legible crop that demonstrates it.
   Wireframe alternative *reading sequences* with that same material.
2. Trial the key fragment with Chinese and English copy. Write down which
   treatment is easiest to read, which action looks primary and which detail
   gives this particular project its identity. Date the selected overview and
   record the approved type, palette, spacing, grid, reusable controls and
   responsive behavior here before implementing that direction.
3. Compare equivalent before/after screenshots at 1440, 768 and 390 CSS pixels.
   Inspect a light and dark state, mobile navigation, language switching and
   keyboard interaction. A page can fit its viewport while a Chinese word,
   file path or command breaks at an awkward point. Check those visually.
4. Report a concrete issue and its actual result after revision. Link the
   evidence from the PR and keep the artifact short-lived. Record an owner's
   design choice separately from independent review or user-testing results.

The [browser check instructions](README.md) describe capture commands and
the [shared design guide](../skills/tangyixiao-workflow/references/design.md)
describes the reusable process.
