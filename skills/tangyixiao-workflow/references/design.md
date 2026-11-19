# Design mode

Use for a new website or substantial visual redesign. Keep small fixes within an
already approved direction moving without another concept approval cycle.

## Establish a direction before implementation

For a public homepage, first follow one visitor's path from arrival to a useful
outcome. Identify the first decision the current page fails to support. On a
substantial redesign, sketch two materially different ways to support that
decision using the same verified content. Examples include comparing a short
original and revision in place, or selecting a task and opening its worked
example. Test the decisive fragment at reading size before adding the page shell.
Use original material or label paraphrases. Verify every example shown in a
mockup against its source before using it as product evidence.

Select two or three relevant references. For each, record the design decision,
the reader problem it solves and what transfers to this product. A useful
process reference shows what the designer tried, changed or rejected. Dan Mall
documents how real interface fragments helped the team explore a publication's
visual voice. Rauno Freiberg explains why a consistent grid helped readers
follow page transitions and how the team studied several widths.
[Entertainment Weekly case study](https://v3.danmall.com/articles/responsive-mobile-entertainment-weekly/) ·
[Vercel homepage case study](https://rauno.me/craft/vercel)

Inspect the project's real purpose, content, current UI, constraints, and any
approved design evidence. Research relevant real websites and inspect their pages;
repository stars or lists of URLs do not establish visual quality. Use one primary
design method, with supporting references only where they improve the task. Check
source, permissions, dependencies, and maintenance before adopting third-party tools.

Prepare a visual overview using the project's real content. Show the desktop
composition and a mobile arrangement, including meaningful Chinese typography
where Chinese is supported. When direction is open, offer a small number of
meaningfully different compositions. Obtain an explicit choice or approval before
implementing the new direction; silence is not approval. Reuse a previously
approved overview when it still covers the requested scope.

## Build and compare

Record the selected direction in the project's existing design document or a
short `DESIGN.md`. Include text styles for supported languages, color roles,
spacing, layout, shared controls and responsive/interaction states. Choose
existing components that fit the current stack; inspect support, dependencies,
permissions and asset terms before introducing a library. A static page can
reuse the renderer's shared navigation, links and native controls.

For substantial visual changes, capture a baseline and a revised render at
1440, 768 and 390 CSS pixels, with the same viewport height, locale, theme,
content and interaction state for each comparison. Use the existing browser
suite (Playwright, WebDriver or the host browser). Inspect each image at
reading size. Check line breaks, alignment, pacing, contrast, hierarchy and
what is visible before scrolling. Open the navigation, switch language and
theme, and follow the primary action to its result. Check reduced motion when
the change introduces animation.

Have a fresh reviewer describe a visitor's task and point to a concrete feature
of the rendered page before showing them the implementer's rationale. Keep one
line per finding with its viewport, visible problem, correction and second
observation. An unchanged screenshot may confirm stability; visual acceptance
requires looking and exercising the page. Store compact review evidence and
report the publicly verified URL or local artifact, remaining issues and
unverified states. Comparative testing with actual visitors is needed for
claims about comprehension or conversion.

Implement the selected composition faithfully. Use product images, platform names,
and illustrations when they explain the product. Label illustrative UI; do not
present it as a running application, a real account, or measured user activity.
Preserve brand proportions, attribution, and any conditions on third-party assets.

Compare actual desktop and mobile output against the approved overview. Check
Chinese and English wrapping, hierarchy, spacing, image readability, theme states,
navigation, and interactive states. Functional, accessibility, and performance
checks help, but do not substitute for visual review. Continue routine defect fixes
without repeated approval; ask again if changing the approved visual direction or
the authorized scope.

Keep variants and retained screenshots bounded. Reuse the current suitable project
and toolchain; keep the selected concept and useful final evidence, not every
intermediate render. If browsing, image generation, or the application is unavailable,
state the missing evidence instead of claiming visual validation.
