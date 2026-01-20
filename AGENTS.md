# AGENTS notes for `p7d-markdown-it-figure-with-p-caption`

## 1. Scope
- Wrap media/table/code/blockquote blocks in `<figure>` and convert adjacent caption paragraphs to `<figcaption>`.
- Delegate caption label parsing/numbering to `p7d-markdown-it-p-captions`; this plugin focuses on detection, wrapping, and figure-level classes.
- Preserve markdown-it-attrs metadata and renderer-specific styling hooks.

## 2. Core Pipeline
- Registers the `figure_with_caption` core rule before `replacements` (after markdown-it-attrs has decorated paragraphs).
- `figureWithCaptionCore` walks token arrays recursively, respecting container boundaries (`blockquote`, `list_item`, `dd`).
- Tight list paragraphs (`token.hidden`) are skipped to avoid invalid HTML.

## 3. Detection Inputs
- Block tokens: `table_open`, `pre_open`, `blockquote_open` via `detectCheckTypeOpen`.
- Fences: `fence` tokens become `pre-code` or `pre-samp` when info matches `samp|shell|console`.
- HTML blocks: `video`, `audio`, `iframe`, `blockquote`, and iframe-like `div` wrappers; social blockquotes (Twitter/Mastodon/etc.) are treated as iframe-type embeds.
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
- Trailing `{...}` attrs are parsed only when `styleProcess` is enabled; parsed attrs are forwarded to the `<figure>`.

## 5. Caption Pairing & Auto Caption
- `checkPrevCaption` / `checkNextCaption` call `setCaptionParagraph` (from p-captions), then convert paragraphs into `figcaption` tokens.
- Caption detection trusts `sp.captionDecision.mark` from p-captions rather than re-parsing class strings.
- `labelPrefixMarker` (optional) strips a prefix marker before a label; `allowLabelPrefixMarkerWithoutLabel` allows marker-only captions.
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
  - attrs gathered from captions and image tokens (`styleProcess` path).
- `figure_open` / `figure_close` inherit `.map` from the wrapped range to improve VS Code click/scroll sync.

## 8. Performance Notes
- Regex caches (`htmlRegCache`, `cleanCaptionRegCache`) reduce repeated allocations.
- HTML detection uses tag hints before regex checks and skips regex when no `<` exists in the block.
- Numbering skips trailing-digit regex work unless the label actually ends with digits.
- Label span lookups avoid `split()` allocations; alt text aggregation avoids temporary arrays.

## 9. Tests
- Fixtures under `test/*.txt` feed `test/test.js` (`npm test`).
- Image-only coverage includes single/multi-image layouts, attrs, auto-caption detection, and invalid trailing text cases.
- Dedicated examples cover slide class overrides and label class mirroring.

## 10. Future Work
- Investigate token pooling in `wrapWithFigure` to reduce GC churn on huge documents.
- Expand HTML tag caching with subtype hints (e.g., iframe + YouTube).
- Explore an opt-in strategy for tight lists (temporary split/merge or diagnostics).
