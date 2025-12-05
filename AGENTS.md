# AGENTS notes for `p7d-markdown-it-figure-with-p-caption`

## 1. Purpose
- Wrap media/table/code/blockquote blocks with `<figure>` and upgrade nearby caption paragraphs to `<figcaption>`.
- Hand off label formatting/numbering to `p7d-markdown-it-p-captions`; this plugin focuses on detection, wrapping, and figure-level classes.
- Preserve `{.class #id}` metadata and renderer-specific styling hooks (markdown-it-attrs, custom fence/image renderers).

## 2. Processing Flow
1. Registration: `md.use(mditFigureWithPCaption, opts)` adds the `figure_with_caption` core rule right before `replacements`, after markdown-it-attrs has decorated paragraphs.
2. Traversal: `figureWithCaptionCore` walks token arrays recursively, honoring container boundaries (blockquote/list/definition) while skipping tight lists to avoid invalid HTML.
3. Detection: helpers flag qualifying ranges — `detectCheckTypeOpen` (table/pre/blockquote), `detectFenceToken` (fence and `samp`), `detectHtmlBlockToken` (video/audio/iframe/social embeds/div wrappers), `detectImageParagraph` (img-only paragraphs, including multi-image layouts with orientation suffixes).
4. Caption pairing: `checkPrevCaption` / `checkNextCaption` locate caption paragraphs; auto caption fallbacks inject temporary paragraphs when alt/title data qualifies.
5. Wrapping: `wrapWithFigure` splices figure tokens around the detected block and `changePrevCaptionPosition` / `changeNextCaptionPosition` convert chosen caption paragraphs into `figcaption` tokens in place.

## 3. Caption & Numbering Logic
- Priority order: explicit caption paragraph → labeled `alt` text → `title` attribute. Fallbacks can prepend language-aware labels via `autoAltCaption` / `autoTitleCaption`.
- Once a fallback consumes alt/title text we blank those attributes so downstream renderers do not duplicate the caption.
- Language sniffing looks at the first sentence to decide when to switch default labels to Japanese; the resolved label per media type is cached for the render pass.
- Auto-generated caption paragraphs are inserted immediately before the figure, then re-run through `setCaptionParagraph` so numbering hooks stay consistent.
- `setCaptionParagraph` records its decision in `sp.captionDecision` (mark, label text, numbering presence), allowing slide wrappers or other consumers to react without re-parsing inline tokens.
- `ensureAutoFigureNumbering` finds the label span via `opt.labelClassLookup`, respects hand-authored numbers, and increments counts only for marks enabled by `setLabelNumbers` / `autoLabelNumber`.

## 4. Figure Classes & Label Mirroring
- `resolveFigureClassName` picks a baseline class: `allIframeTypeFigureClassName` overrides every iframe/social embed; otherwise we differentiate among iframes (`f-iframe`), known videos (`f-video`), social blockquotes (`figureClassThatWrapsIframeTypeBlockquote`, default `f-img`), and standard blocks (`f-img`, `f-table`, etc.).
- Slide-aware override: `setCaptionParagraph` surfaces the detected mark (e.g., `slide`), and `figureClassThatWrapsSlides` (default `f-slide`) swaps the figure class whenever that mark appears. If `allIframeTypeFigureClassName` is provided we skip the slide override so iframe/social embeds always share the global class; otherwise you can opt out by setting the slide option to an empty string or swap in a custom class such as `f-slide-deck`. Auto-generated captions re-run this check so inferred slides still get the override when eligible.
- Attribute forwarding: when `styleProcess` is enabled we merge attributes gathered from the caption paragraph (via markdown-it-attrs) and image token styles onto the `<figure>` to match VS Code’s markdown preview behavior.
- Label span mirroring: `p7d-markdown-it-p-captions` exposes `labelClassFollowsFigure` plus `figureToLabelClassMap`. Because `sp.figureClassName` is known before `setCaptionParagraph`, the caption renderer can mirror figure classes onto the label/joint/body spans (e.g., `f-embed → caption-embed caption-social`, `f-iframe → caption-slide-label caption-slide-extra`). Duplicates are stripped before appending `-label`, `-label-joint`, `-body` suffixes.

## 5. Options Snapshot
- Wrapper behavior: `oneImageWithoutCaption`, `videoWithoutCaption`, `audioWithoutCaption`, `iframeWithoutCaption`, `iframeTypeBlockquoteWithoutCaption` force wrapping even without captions; `figureClassThatWrapsSlides` / `figureClassThatWrapsIframeTypeBlockquote` handle special classes; `allIframeTypeFigureClassName` replaces every iframe/social/embed class (including slide overrides) with a single namespace like `f-embed`.
- Caption formatting (forwarded to `p7d-markdown-it-p-captions`): `strongFilename`, `dquoteFilename`, `jointSpaceUseHalfWidth`, `bLabel`/`strongLabel`, `removeUnnumberedLabel`, `removeUnnumberedLabelExceptMarks`, `removeMarkNameInCaptionClass`, `wrapCaptionBody`, `hasNumClass`.
- Auto detection: `autoCaptionDetection`, `autoAltCaption`, `autoTitleCaption`.
- Numbering: `setLabelNumbers`, `autoLabelNumber`.

## 6. Test Coverage
- Fixtures under `test/*.txt` feed `test/test.js` (`npm test`).
- `examples-figure-class-that-wraps-slides.txt` ensures `figureClassThatWrapsSlides` overrides correctly (default and custom values).
- `examples-option-label-class-follows-figure.txt` and `examples-option-figure-to-label-class-map.txt` verify that label classes mirror figure classes.

## 7. Future Work
- Investigate a token factory/pool for `wrapWithFigure` to reduce GC churn on huge documents.
- Expand `getHtmlReg` caching with tag + media subtype hints (e.g., iframe + YouTube) to avoid recreating regexes for embed-heavy posts.
- Explore an opt-in strategy for tight lists (temporary split/merge or diagnostics) so captions aren’t silently skipped.
- Cache `{.class #id}` parsing in `detectImageParagraph` to avoid redundant regex work on large attribute blocks.
