# AGENTS notes for `p7d-markdown-it-figure-with-p-caption`

## 1. Scope
- Wrap media/table/code/blockquote blocks in `<figure>` and convert adjacent caption paragraphs to `<figcaption>`.
- Delegate caption label parsing/numbering to `p7d-markdown-it-p-captions`; this plugin focuses on detection, wrapping, and figure-level classes.
- Preserve markdown-it-attrs metadata and renderer-specific styling hooks.

## 2. Core Pipeline
- Registers the `figure_with_caption` core rule before `replacements` (after markdown-it-attrs has decorated paragraphs).
- `figureWithCaptionCore` walks token arrays recursively, respecting container boundaries (`blockquote`, `list_item`, `dd`).
- Tight list paragraphs (`token.hidden`) are skipped to avoid invalid HTML.
- Caption detection (delegated to p-captions) intentionally skips paragraphs that appear immediately after `list_item_open`; first-block captions inside list items are treated as non-captions.

## 3. Detection Inputs
- Block tokens: `table_open`, `pre_open`, `blockquote_open` via `detectCheckTypeOpen`.
- Fences: `fence` tokens become `pre-code` or `pre-samp` when info matches `samp|shell|console`.
- HTML blocks: `video`, `audio`, `iframe`, `blockquote`, and `div` wrappers that contain an `<iframe>`; social blockquotes (Twitter/Mastodon/etc.) are treated as iframe-type embeds only when known embed class patterns match.
- Image paragraphs: inline children that start with an `image` and meet the image-only rules below.

## 4. Image Paragraph Rules
- A valid image-only paragraph can include:
  - one or more `image` tokens,
  - spaces (`text` tokens of only ASCII spaces),
  - softbreaks (for vertical layouts),
  - and an optional trailing `{.class #id}` block in the last text token.
- Any other text content invalidates wrapping (prevents accidental figures when text follows images).
- Multi-image wrapping uses `multipleImages` and sets the figure class suffix:
  - `-horizontal` (spaces only), `-vertical` (softbreak only), or `-multiple` (mixed).
- Trailing `{...}` attrs from inline text are parsed only when `styleProcess` is enabled; parsed attrs are forwarded to the `<figure>`.
- Image paragraph attrs already materialized on tokens by `markdown-it-attrs` are forwarded to `<figure>` regardless of `styleProcess`.

## 5. Caption Pairing & Auto Caption
- `checkPrevCaption` / `checkNextCaption` call `setCaptionParagraph` (from p-captions), then convert paragraphs into `figcaption` tokens.
- Caption detection trusts `sp.captionDecision.mark` from p-captions rather than re-parsing class strings.
- `labelPrefixMarker` (optional) strips a prefix marker before a label; `allowLabelPrefixMarkerWithoutLabel` allows marker-only captions.
- Caption regex resolution is language-aware via p-captions helper state (`getMarkRegStateForLanguages`); image auto-caption uses precomputed `opt.imgCaptionMarkReg` from that state.
- Auto caption for images runs only when no caption paragraph exists:
  - uses labeled `alt` or `title` text (`markReg.img`),
  - or fallback labels (`autoAltCaption` / `autoTitleCaption`) with language-aware defaults.
- Consumed `alt`/`title` attributes are cleared to avoid duplicate captions in downstream renderers.

## 6. Numbering Integration
- `ensureAutoFigureNumbering` locates the label span via `opt.labelClassLookup` and updates counters only for enabled marks (`autoLabelNumberSets` / `autoLabelNumber`).
- Manual numbers in captions win and update internal counters.

## 7. Figure Tokens, Classes, and Attrs
- `wrapWithFigure` inserts `figure_open` / `figure_close` and forwards:
  - figure class names (prefix + type, or iframe overrides),
  - attrs from image paragraphs/image tokens (`styleProcess` path), especially trailing `{...}` attrs on image-only paragraphs.
- Caption paragraph attrs remain on the converted `figcaption` token (not moved onto `figure`).
- `figure_open` / `figure_close` inherit `.map` from the wrapped range to improve VS Code click/scroll sync.

## 8. Performance Notes
- Regex caches reduce repeated allocations; `htmlRegCache` is module-level and `cleanCaptionRegCache` is instance-scoped on `opt` to avoid cross-instance leakage.
- HTML detection uses tag hints before regex checks and skips regex when no `<` exists in the block.
- `detectHtmlBlockToken` has an early non-target tag guard (`video/audio/iframe/blockquote/div`) before expensive checks.
- `htmlWrapWithoutCaption` options are precomputed once and reused in HTML detection.
- Numbering uses a trailing-integer parser (char scan) instead of regex on hot paths.
- Label span lookups avoid `split()` allocations; alt text aggregation avoids temporary arrays.
- `wrapWithFigure` must create distinct newline tokens; do not reuse one token object across multiple insert positions.

## 9. Tests
- Fixtures under `test/*.txt` feed `test/test.js` (`npm test`).
- Image-only coverage includes single/multi-image layouts, attrs, auto-caption detection, and invalid trailing text cases.
- Dedicated examples cover slide class overrides and label class mirroring.
- Additional dependency-focused checks run from repository-controlled paths: `npm run test:p-captions` and `npm run test:all`.
- Performance/robustness checks run via `npm run perf` (`test/performance/benchmark.js`) with render medians/p95 and deep blockquote probe output.
- Consumer repos may not include upstream dependency test files under `node_modules`; keep integration checks in root-owned scripts/tests.
- Do not rely on durable tests under `node_modules`; treat those as ephemeral.

## 10. Future Work
- Investigate token pooling in `wrapWithFigure` to reduce GC churn on huge documents.
- Expand HTML tag caching with subtype hints (e.g., iframe + YouTube).
- Explore an opt-in strategy for tight lists (temporary split/merge or diagnostics).
