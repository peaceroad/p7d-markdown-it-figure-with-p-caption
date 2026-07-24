# Behavior and options reference

This document contains the detailed behavior and option reference for
`@peaceroad/markdown-it-figure-with-p-caption`. For installation, quick-start
guidance, recommended options, and representative conversions, start with the
[project README](../README.md).

## Contents

- [Behavior](#behavior)
- [Behavior customization](#behavior-customization)
- [Basic usage](#basic-usage)
- [Recommended options](#recommended-options)
- [Automatic numbering and integration API](numbering.md)
- [Complete conversion and option examples](examples.md)

## Behavior

Calling `.use(mditFigureWithPCaption)` more than once on the same markdown-it instance is intentionally a no-op after the first successful call, before later options are validated. Initial setup validates and registers the rule before setting its installed sentinel, so a failed first setup can be corrected on the same markdown-it instance. Create a separate instance when you need a different successful option set.

### Image

- Pure image paragraphs (`![...](...)`) become `<figure class="f-img">` blocks as soon as a caption paragraph (previous or next) or an auto-detected caption exists.
- Auto detection runs per image paragraph when `autoCaptionDetection` is `true` (default). The priority is:
    1. Caption paragraphs immediately before or after the image (standard syntax).
    2. Image `alt` text that `p7d-markdown-it-p-captions` recognizes as an image caption start (`Figure. `, `Figure 1. `, `図　`, `図1　`, etc.).
    3. Image `title` attribute that matches the same labels.
    4. Optional fallbacks (`autoAltCaption`, `autoTitleCaption`) that inject the label when the alt/title lacks one.
        - `autoAltCaption`: `false`/`null` (off), `true`, or a string label. `true` uses locale-aware generated-label defaults from `p7d-markdown-it-p-captions`, so the label text and punctuation stay aligned with the upstream caption language data. A string is treated as a label stem that must be recognized by `p7d-markdown-it-p-captions`; setup throws if it cannot be parsed as an image caption label. Other value types are rejected. This plugin appends the default joint/space unless the string already ends with a recognized joint such as `.` / `。` / `:` / `　`. Empty alt text does not generate a fallback caption.
        - `autoTitleCaption`: same behavior but sourced from the image `title`. It stays off by default so other plugins can keep using the `title` attribute for metadata.
- Set `autoCaptionDetection: false` to disable the auto-caption workflow entirely.
- Multi-image paragraphs are still wrapped as one figure when `multipleImages: true` (default). Layout-specific classes help with styling:
  - `f-img-horizontal` when images sit on the same line (space-delimited).
  - `f-img-vertical` when separated only by soft breaks.
  - `f-img-multiple` for mixed layouts.
- Automatic detection inspects only the first image in the paragraph. If it yields a caption, the entire figure reuses that caption while later images keep their own `alt`/`title`.
- Paragraphs that contain only images also convert when they appear inside loose lists (leave blank lines between items), blockquotes, or description lists.
- Caption detection intentionally skips paragraphs that are the first block inside a list item (`list_item_open` immediately before the paragraph). In practice, `- Figure. ...` followed by an image in the same item is treated as plain text unless you insert another block first.
- A media candidate that ultimately cannot be wrapped (for example, an image paragraph with trailing prose) no longer causes an adjacent caption paragraph to be decorated as a side effect. This is an intentional correctness fix from 0.19.0; valid figures retain the existing output.

### Table

- Markdown tables (including those produced by `markdown-it-multimd-table` or similar) convert into `<figure class="f-table">` blocks.
- Caption paragraphs immediately before/after the table become `<figcaption>` element ahead of the `<table>`.

### Code block

- Captions labeled `Code. `, `Terminal. `, etc. wrap the fence in `<figure class="f-pre-code">` / `<figure class="f-pre-samp">`.
- If `roleDocExample: true`, these figures add `role="doc-example"`.

### Blockquote

- Captioned blockquotes (e.g., `Source. A paragraph.` written immediately before or after `> ...`) become `<figure class="f-blockquote">` while keeping the original blockquote intact.

### Video & Audio

- Block HTML `<video>` and `<audio>` tags are detected as media figures (`<figure class="f-video">` and `<figure class="f-audio">`). A single-line tag parsed by markdown-it as inline HTML is not promoted to a block figure.
- A caption paragraph labeled `Video. ` / `Audio. ` (or any registered label) is promoted to `<figcaption>` before/after the media so controls remain unobstructed.

### Embedded content by iframe

- HTML blocks containing `<iframe>` elements become `<figure class="f-video">` when they point to known video hosts (YouTube `www.youtube.com`, `youtube.com`, `www.youtube-nocookie.com`, `youtube-nocookie.com`, Vimeo `player.vimeo.com`).
- `<div>` wrappers are treated as iframe-type embeds only when the same HTML block contains an `<iframe ...>` tag (for example common video wrapper markup).
- `videoWithoutCaption` enables captionless wrapping for `<video>` blocks and for iframes (including those nested in `<div>` wrappers) whose `src` host is a known YouTube/Vimeo provider. `iframeWithoutCaption` also enables captionless wrapping for iframe candidates generally. A known video iframe keeps the `f-video` classification through either option; a generic iframe requires `iframeWithoutCaption` and uses `f-iframe`.
- Blockquote-based social embeds (Twitter/X `twitter-tweet`, Mastodon `mastodon-embed`, Bluesky `bluesky-embed`, Instagram `instagram-media`, Threads `text-post-media`) are treated like iframe-type embeds when their class list contains one of those provider classes. Extra classes, `data-*` attributes, inline styles, SVG content, and the embed-script host do not block detection. By default they become `<figure class="f-img">` so the caption label behaves like an image label; quote labels are also accepted. You can override that figure class with `figureClassThatWrapsIframeTypeBlockquote` or the global `allIframeTypeFigureClassName`.
- `p7d-markdown-it-p-captions` ships with a `Slide.` label. When you use it (for example with Speaker Deck or SlideShare iframes), the `<figure>` wrapper automatically switches to `f-slide` (or whatever you set via `figureClassThatWrapsSlides`) so slides can get their own layout. If `allIframeTypeFigureClassName` is also configured, that class takes precedence even for slides, so you get a uniform embed wrapper without touching the slide option.
- Other eligible iframe blocks use `<figure class="f-iframe">` unless you override the class via `allIframeTypeFigureClassName`. Eligibility still requires a caption or the corresponding captionless-wrapping option.

### Label span class name

- The label inside the figcaption (the `span` element used for the label) is generated by `p7d-markdown-it-p-captions`, not by this plugin. By default the class name is formed by combining `classPrefix` with the mark name, producing names such as `f-img-label`, `f-video-label`, `f-blockquote-label`, and `f-slide-label`.
- With `markdown-it-attrs`, attributes attached to image-only paragraphs (for example `![...](...) {.foo #bar}`) are forwarded to the generated `<figure>`.
- `styleProcess` controls parsing of a trailing `{...}` block from the last text token of an image-only paragraph in this plugin's own scanner. It supports simple `.class`, `#id`, bare attributes, and quoted `key="value with spaces"` / `key='value with spaces'` pairs. It is still a narrow fallback parser, not full `markdown-it-attrs` parity, and attributes already attached to paragraph tokens by `markdown-it-attrs` are still forwarded.
- Attribute forwarding is not sanitization. If you render untrusted Markdown, keep using an HTML sanitizer or a trusted-host policy appropriate for your application; this plugin only decides which already-parsed or narrowly parsed attributes move onto `<figure>`.
- Attributes attached to caption paragraphs stay on the converted `<figcaption>` token after paragraph-to-figcaption conversion.

## Behavior Customization

### Styles

- Set `allIframeTypeFigureClassName: 'f-embed'` (recommended) to force a single CSS class across `<iframe>` and social-embed figures so they can share styles, ensuring every embed wrapper shares the same predictable class name.
- `figureClassThatWrapsIframeTypeBlockquote`: override the class used when recognized blockquote-based embeds (Twitter/X, Mastodon, Bluesky, Instagram, Threads) are wrapped.
- `figureClassThatWrapsSlides`: override the class assigned when a caption paragraph uses the `Slide.` label.
- `classPrefix` (default `f`) controls the CSS namespace for generated default classes (`f-img`, `f-table`, etc.) so you can align with existing styles. Explicit wrapper-class overrides remain independent.
- Wrapper/class-prefix options are trimmed during setup; whitespace-only values fall back to the default class for that option.

### Wrapping without captions

- `imageOnlyParagraphWithoutCaption`: turn valid image-only paragraphs into `<figure>` elements even when no caption paragraph/auto caption is present. This includes single-image paragraphs and, when `multipleImages` is enabled, multi-image paragraphs that receive classes such as `f-img-horizontal`, `f-img-vertical`, or `f-img-multiple`. This is independent of automatic detection.
- `oneImageWithoutCaption`: legacy alias for `imageOnlyParagraphWithoutCaption`. When both are provided, `imageOnlyParagraphWithoutCaption` wins.
- `videoWithoutCaption`, `audioWithoutCaption`, `iframeWithoutCaption`, `iframeTypeBlockquoteWithoutCaption`: wrap the respective media blocks without caption.

### Caption text helpers (integrated with `p7d-markdown-it-p-captions`)

`p7d-markdown-it-p-captions` owns caption parsing and figcaption rendering for
the options below. This plugin normalizes the values that also affect figure
selection, numbering, or final wrapper-class integration before passing the
shared option state to p-captions:

- `strongFilename` / `dquoteFilename`: pull out filenames from captions using `**filename**` or `"filename"` syntax and wrap them in `<strong class="f-*-filename">`.
- `jointSpaceUseHalfWidth`: replace full-width space between Japanese labels and caption body with half-width space.
- `bLabel` / `strongLabel`: emphasize the label span itself.
- `removeUnnumberedLabel`: drop the leading label entirely when no label number is present. Use `removeUnnumberedLabelExceptMarks` to keep specific labels (e.g., `['blockquote']` keeps `Quote. `).
- `removeMarkNameInCaptionClass`: replace `.f-img-label` / `.f-table-label` with the generic `.f-label`.
- `wrapCaptionBody`: wrap the non-label caption text in a span element.
- `hasNumClass`: add a class attribute to a label span when the source caption has a label number. For compatibility with the pre-shared-engine pipeline, numbers generated by this figure plugin do not retroactively add `label-has-num`.
- `labelClassFollowsFigure`: mirror the final resolved `<figure>` class onto the `figcaption` spans (`f-embed-label`, `f-embed-label-joint`, `f-embed-body`, etc.) when you want captions styled alongside the wrapper. Caption-driven slide classes are resolved before span construction, including custom `figureClassThatWrapsSlides` values.
- `figureToLabelClassMap`: extend `labelClassFollowsFigure` by mapping specific final figure classes (e.g., `f-embed` or `f-slide`) to custom caption label classes such as `caption-embed caption-social` for fine-grained control. When this map is provided and `labelClassFollowsFigure` is not set explicitly, figure-following mode is enabled automatically.
- `labelPrefixMarker`: allow a leading marker before labels (string or array, e.g., `*Figure. ...`). Arrays are limited to two markers; extras are ignored.
- `allowLabelPrefixMarkerWithoutLabel`: accept marker-only caption paragraphs when set to `true`. With a marker array, the first marker applies before a figure and the second after it.
- `languages`: optional available caption-recognition catalogs delegated to `p7d-markdown-it-p-captions` (default: `['en', 'ja']`). Most users can leave this unset. Set it only when you want to restrict or extend which labels can be recognized (for example English `Figure.` and Japanese `図　`) and which catalogs are available for generated fallback labels. It is separate from the active locale used to choose among those available catalogs.
- Automatic image-label fallback text and punctuation (`Figure. `, `図　`, etc.) are generated from `p7d-markdown-it-p-captions` locale metadata, not from a local hardcoded map in this plugin.
- Generated fallback label tie-break is resolved lazily, at most once per render, when an image actually needs an unlabeled fallback. Prefer passing the active locale through `env.locale` or `env.preferredLocales`. Compatibility fallbacks are `preferredLanguages`, `env.preferredLanguages`, `env.lang`, and `env.language`. If none of those selects an available catalog, this plugin finally uses a cheap document-script heuristic that skips a leading hyphen-fenced frontmatter block (`---` or longer, spaces allowed before newline), then falls back to the raw `languages` order. This tie-break only affects generated fallback labels; it does not change the caption-recognition dictionaries selected by `languages`. Compatibility note: for generated fallback labels, `env.locale` / `env.preferredLocales` intentionally take precedence over the legacy `preferredLanguages` option so a shared `md` instance can render different documents with different active locales. Laziness is based on the final image token stream rather than raw `![` source text, so image tokens inserted by an earlier core rule receive the same locale behavior.

## Basic Usage

```js
import mdit from 'markdown-it'
import mditFigureWithPCaption from '@peaceroad/markdown-it-figure-with-p-caption'
import mditRendererFence from '@peaceroad/markdown-it-renderer-fence' // optional but keeps fences aligned with samples

const md = mdit({ html: true, langPrefix: 'language-', })
  .use(mditFigureWithPCaption)
  .use(mditRendererFence)

console.log(md.render('Figure. A Cat.\n\n![A cat](cat.jpg)'))
// <figure class="f-img">
// <figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Cat.</figcaption>
// <img src="cat.jpg" alt="A cat">
// </figure>
```

### Recommended options

The canonical practical baseline is kept in the project README under
[Recommended options](../README.md#recommended-options), where it remains
visible to new users and is less likely to drift from the quick-start example.

That configuration enables captionless media wrapping, gives iframe-like
embeds one predictable class, and enables document-wide image/table numbering.
`removeUnnumberedLabel` is shown separately because it removes labels for every
caption that still lacks a number. Use `removeUnnumberedLabelExceptMarks` when
specific unnumbered labels, such as `Quote.` / `Source.`, must remain visible.

For automatic numbering, chapter/appendix scopes, and the public integration
API, see [Automatic numbering and integration API](numbering.md). For the
complete input/output samples, see
[Complete conversion and option examples](examples.md).
