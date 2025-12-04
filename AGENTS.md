# AGENTS notes for `p7d-markdown-it-figure-with-p-caption`

## Overview
`p7d-markdown-it-figure-with-p-caption` walks markdown-it’s block token stream and wraps single images, tables, code blocks, blockquotes, audio/video embeds, and iframe-like content (YouTube, Bluesky, etc.) with `<figure>` + `<figcaption>`. Label formatting and numbering are delegated to `p7d-markdown-it-p-captions`, while code block rendering is typically handled by `@peaceroad/markdown-it-renderer-fence`. Most examples assume it is used together with `markdown-it-attrs` and `@peaceroad/markdown-it-renderer-image` so that `{.class #id}` and width/height attributes are preserved.

## Typical Workflow
1. In Markdown, authors write a caption paragraph immediately before or after the block (`Figure. A cat.`). Multiple-image blocks rely on softbreaks/whitespace to determine layout (`f-img-horizontal`, `f-img-vertical`, `f-img-multiple`).
2. On the markdown-it side, call `md.use(mditFigureWithPCaption, opts)` (optionally chain `markdown-it-attrs` and `@peaceroad/markdown-it-renderer-fence`). During `md.render` the target block is converted into `<figure class="f-…">` with `<figcaption>`.
3. Loose lists, blockquotes, and description lists are supported, but tight lists (`token.hidden === true`) are intentionally skipped. Users need blank lines inside list items if they want figure conversion.
4. Options like `{dquoteFilename:true}` / `{strongFilename:true}` emphasize filenames inside captions, while `{oneImageWithoutCaption:true}` / `videoWithoutCaption` / `audioWithoutCaption` / `iframeWithoutCaption` / `iframeTypeBlockquoteWithoutCaption` force `<figure>` even without captions.
5. `{imgAltCaption:'Figure'}` / `{imgTitleCaption:'Figure'}` treat alt/title text as captions and are mutually exclusive with the standard caption-paragraph syntax. These modes force `oneImageWithoutCaption: true` / `multipleImages: false` internally, and when active the block rule `imgAttrToPCaption` fabricates paragraph tokens so the downstream flow stays the same.

## Implementation Notes
- The block rule `imgAttrToPCaption` synthesizes caption paragraphs only when `imgAltCaption`/`imgTitleCaption` are enabled. Afterwards `md.core.ruler.before('replacements', 'figure_with_caption', …)` invokes `figureWithCaptionCore`.
- `figureWithCaptionCore` recursively walks tokens, using `detectCheckTypeOpen`, `detectFenceToken`, `detectHtmlBlockToken`, and `detectImageParagraph` to identify targets. `checkPrevCaption` / `checkNextCaption` detect captions, and `createAutoCaptionParagraph` injects fallback captions when needed.
- `wrapWithFigure` inserts `<figure>` tokens and handles special cases (iframe/blockquote/video classes). `changePrevCaptionPosition` / `changeNextCaptionPosition` convert caption paragraphs into `<figcaption>` nodes inside the figure.
- `detectHtmlBlockToken` supports `<video>`, `<audio>`, `<iframe>`, `<blockquote>`, and `<div>` wrappers (Vimeo, Bluesky, Twitter, etc.). Recent optimization removed candidate-array copies and redundant regex calls.
- `detectImageParagraph` validates the inline children (image/text/softbreak only), collects trailing `{.class}` attributes, and determines multi-image suffixes. The `isOnlySpacesText` helper avoids regex-based whitespace checks.
- `isInListItem` uses a WeakMap cache to track whether a token is inside a list item; tight lists are skipped.

## Automatic Caption Detection
- Priority order: caption paragraphs (before/after) > image alt text > image title. If a caption paragraph is found, auto detection (`autoCaptionDetection`, enabled by default) is skipped.
- Alt/title strings must match `p7d-markdown-it-p-captions`’ `markReg.img` (e.g., `Figure.`, `図`). If not, the plugin leaves them untouched unless `autoAltCaption` / `autoTitleCaption` is enabled, in which case it either applies a custom label (string option) or auto-detects the language and chooses `Figure`/`Table` vs. `図`/`表` when the option is `true`. The first fallback per type caches that decision so later captions stay consistent within the same render.
- Whether the caption comes from a direct label match or a fallback, the consumed `alt`/`title` attributes are cleared so the caption text isn’t duplicated across `<img>` and `<figcaption>`.
- The auto language heuristic scans the first sentence of the caption text (until `.?!。？！` or a newline): any Hiragana/Katakana/Kanji before that boundary switch the document to Japanese labels, otherwise it defaults to English. Once cached, the stored label is reused for the remainder of the document unless a string override is provided.
- When a fallback consumes alt/title text, the image attributes are cleared (`alt=""`, `title` removed) so the caption is the sole source. This prevents duplicate narration and avoids conflicts with renderer plugins that use `title` for sizing.
- Auto-generated caption paragraphs are inserted immediately before the block, then converted into `<figcaption>` via `changePrevCaptionPosition`, preserving the “caption-first” layout and class names (`.f-img-label`, etc.).
- Regression tests: `examples-automatic-caption-detection*.txt`, `examples-alt-caption-fallback*.txt`, `examples-title-caption-fallback*.txt`, and the numbered variants ensure fallbacks + counters stay in sync.

## Automatic Numbering
- Option `setLabelNumbers` accepts an array such as `['img']`, `['table']`, or `['img', 'table']` (arrays are the preferred form, though older boolean/object forms are still normalized internally). The option is normalized once, and a `labelClassLookup` map is built so child scanning can find `.f-img-label` / `.f-table-label` without recomputing class names. `autoLabelNumber: true` is a shorthand that enables the image counter by internally toggling `setLabelNumbers.img = true`.
- Legacy `setFigureNumber` (from `p7d-markdown-it-p-captions`) still works; when it is enabled the plugin intentionally skips `setLabelNumbers`/`autoLabelNumber` to avoid injecting two numbering systems at once. Document this for users so they pick one numbering strategy.
- Priority order: manually authored number > auto counter. If a caption already contains digits (`Figure 5.`), the counter syncs to that value; otherwise, the plugin injects `Figure 1`, `図1`, etc. Alt/title fallback captions are treated the same way.
- Numbering reuses `setCaptionParagraph`’s inline children. The helper updates both the text node and `inline.content` to keep downstream renderers consistent.
- Regression tests: `examples-set-label-with-numbers.txt`, `examples-alt-caption-fallback-numbered.txt`, and `examples-automatic-caption-detection-numbered.txt` cover manual numbering, auto counters, and fallback scenarios.

## Potential Future Work
- `wrapWithFigure` still instantiates new tokens on every call; a simple factory or token pool could reduce GC pressure if profiling shows it’s a hotspot.
- `getHtmlReg` currently caches only by tag name. Extending the cache key to tag+type (e.g., iframe + youtube) might cut down on RegExp creation for common embeds.
- `{.class #id}` parsing in `detectImageParagraph` relies on multiple regexes; a dedicated parser or pre-scan could shorten the hot path.
- Tight list handling is strict (figure conversion skipped). If UX feedback suggests otherwise, consider an opt-in that allows figures inside tight lists or emits warnings for skipped blocks.
