# AGENTS notes for `p7d-markdown-it-figure-with-p-caption`

## 1. Goal
- Wrap media/table/code/blockquote blocks in `<figure>` and convert adjacent caption paragraphs to `<figcaption>`.
- Delegate caption label parsing/numbering to `p7d-markdown-it-p-captions`; this plugin focuses on detection, wrapping, and figure-level classes.
- Preserve markdown-it-attrs metadata and renderer-specific styling hooks.

## 2. Registration & Traversal
- `md.use(mditFigureWithPCaption, opts)` registers the `figure_with_caption` core rule before `replacements` (after markdown-it-attrs has decorated paragraphs).
- `figureWithCaptionCore` walks token arrays recursively, respecting container boundaries (`blockquote`, `list_item`, `dd`), and skips tight list paragraphs (`token.hidden`) to avoid invalid HTML.
- Blockquotes are re-entered so nested figures can still be detected inside them.

## 3. Detection Paths
- Block tokens: `table_open`, `pre_open`, `blockquote_open` via `detectCheckTypeOpen` (finds the matching close token).
- Fences: `fence` tokens become `pre-code` or `pre-samp` when the info string matches `samp|shell|console`.
- HTML blocks: `video`, `audio`, `iframe`, `blockquote`, and iframe-like `div` wrappers; social blockquotes (Twitter/Mastodon/etc.) are treated as iframe-type embeds.
- Image paragraphs: paragraphs whose inline children start with an `image`, including multi-image layouts and trailing `{.class #id}` attribute blocks.
- Detection only runs for candidate token types (`paragraph_open`, `html_block`, `fence`, and block open tokens) to avoid per-token overhead.

## 4. Caption Pairing & Auto Caption
- `checkPrevCaption` / `checkNextCaption` call `setCaptionParagraph` (from p-captions) to mark caption paragraphs, then convert them to `figcaption`.
- Caption detection trusts `sp.captionDecision.mark` from p-captions rather than re-parsing class strings, so classPrefix changes stay consistent.
- `labelPrefixMarker` (optional) lets caption paragraphs start with a symbol like `*` or `>` before the label; the marker is stripped once a caption is accepted.
- `allowLabelPrefixMarkerWithoutLabel` when `true` allows marker-only paragraphs (e.g., `*Caption`) to become captions without labels; if `labelPrefixMarker` is an array, the first entry is used for the previous caption and the second for the next.
- Auto caption for images runs only when no caption paragraph exists:
  - uses labeled `alt` or `title` text (via `markReg.img`),
  - or fallback labels (`autoAltCaption` / `autoTitleCaption`) with language-aware defaults.
- Consumed `alt`/`title` attributes are cleared to avoid duplicate captions in downstream renderers.
- Auto captions are injected as temporary paragraphs and re-run through `setCaptionParagraph` so numbering hooks remain consistent.

## 5. Numbering Integration
- `ensureAutoFigureNumbering` locates the label span via `opt.labelClassLookup` and updates counters only for enabled marks (`autoLabelNumberSets` / `autoLabelNumber`).
- Manual numbers in the caption win and update internal counters.

## 6. Figure Classes & Attribute Forwarding
- `resolveFigureClassName` assigns base classes (`classPrefix + '-img'`, `classPrefix + '-table'`, `classPrefix + '-pre-*'`, `classPrefix + '-video'`, `classPrefix + '-iframe'`) unless `allIframeTypeFigureClassName` overrides iframe/social embeds.
- Blockquote-based embeds use `figureClassThatWrapsIframeTypeBlockquote`; slide labels can override to `figureClassThatWrapsSlides` unless a global iframe class is set.
- `styleProcess` merges attrs gathered from caption paragraphs and image tokens onto the `<figure>` (VS Code preview compatibility). Caption class cleanup respects the configured class prefix.

## 7. Performance Notes
- Regex caches: `htmlRegCache` and `cleanCaptionRegCache` reduce repeated allocations.
- HTML detection uses tag hints before regex checks to avoid unnecessary `RegExp` work.
- Numbering skips trailing-digit regex work unless the label actually ends with digits.
- Label span lookups avoid `split()` allocations; alt text aggregation avoids temporary arrays.

## 8. Options Snapshot
- Wrapping behavior: `oneImageWithoutCaption`, `videoWithoutCaption`, `audioWithoutCaption`, `iframeWithoutCaption`, `iframeTypeBlockquoteWithoutCaption`, `multipleImages`, `roleDocExample`.
- Classes: `classPrefix`, `figureClassThatWrapsSlides`, `figureClassThatWrapsIframeTypeBlockquote`, `allIframeTypeFigureClassName`, `styleProcess`.
- Auto captions: `autoCaptionDetection`, `autoAltCaption`, `autoTitleCaption`.
- Marker captions: `labelPrefixMarker`, `allowLabelPrefixMarkerWithoutLabel`.
- Numbering: `autoLabelNumberSets`, `autoLabelNumber`.
- Caption formatting (forwarded): `strongFilename`, `dquoteFilename`, `bLabel`, `strongLabel`, `jointSpaceUseHalfWidth`, `removeUnnumberedLabel`, `removeUnnumberedLabelExceptMarks`, `removeMarkNameInCaptionClass`, `wrapCaptionBody`, `hasNumClass`, plus label mirroring (`labelClassFollowsFigure`, `figureToLabelClassMap`).

## 9. Test Coverage
- Fixtures under `test/*.txt` feed `test/test.js` (`npm test`).
- Dedicated examples cover slide class overrides and label class mirroring.

## 10. Future Work
- Investigate a token factory/pool for `wrapWithFigure` to reduce GC churn on huge documents.
- Expand `getHtmlReg` caching with tag + media subtype hints (e.g., iframe + YouTube).
- Explore an opt-in strategy for tight lists (temporary split/merge or diagnostics).
