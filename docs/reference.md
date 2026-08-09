# Behavior and options reference

This document contains the detailed behavior and option reference for
`@peaceroad/markdown-it-figure-with-p-caption`. For installation, quick-start
guidance, recommended options, and representative conversions, start with the
[project README](../README.md).

## Contents

- [Behavior](#behavior)
- [Behavior customization](#behavior-customization)
- [Figure annotations and local notes](#figure-annotations-and-local-notes)
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

## Figure annotations and local notes

The `notes` feature is disabled by default and accepts only this structured
option shape:

```js
{
  notes: {
    enabled: false,
    annotations: true,
    unreferencedLocalNotes: true,
    referencedLocalNotes: true,
  },
}
```

All supplied fields must be actual booleans. Unknown keys and values such as
`"false"` throw during the first plugin setup. `notes.enabled: false` prevents
the notes catalog and block/inline rules from being constructed; the three
subfeatures are considered only when the parent feature is enabled.

Recognition catalogs use the existing top-level `languages` option. The
built-in catalogs are English and Japanese. Input labels are normalized to
language-independent roles, while the exact source label and joint remain
visible in the output.

### Annotations

Annotations apply only to image and table figures and use independent paragraphs
directly after the target sidecar group. A joint such as `:` / `：` or `.` / `。`
is required, except for the `©` prefix. Consecutive recognized annotation
paragraphs belong to the same figure in source order, so a source, credit, and
rights statement can coexist. The first non-annotation block ends the group.

Built-in Japanese labels:

- `source`: `出典`, `引用元`, `データ`, `データ出典`, `データ引用`, `転載`, `転載元`
- `credit`: `クレジット`, `提供`, `提供元`
- `rights`: `著作権`, `ライセンス`, and the language-independent `©` prefix

Built-in English labels:

- `source`: `Source`, `Quoted from`, `Data source`, `Reprinted from`, `Reproduced from`
- `credit`: `Credit`, `Courtesy of`, `Provided by`
- `rights`: `Copyright`, `License`, and `©`

The compact Japanese `データ：` form is accepted as a source annotation;
`データ出典：` remains the clearer authoring form. General `参考` / `参照`
vocabulary is intentionally not recognized in this initial contract.

Output uses dedicated token types which render as paragraphs with stable
classes such as `f-annotation`, `f-source`, `f-credit`, `f-rights`, and
`f-annotation-label`. A following source annotation is not reinterpreted as a
document-level semantic container. When a caption follows the target, the
annotation is placed after its caption content inside the final `figcaption`;
otherwise it remains a direct figure child after the target and local notes.
If a label such as `クレジット：` is also enabled by a document-level semantic
container plugin, direct adjacency to an eligible figure gives ownership to
this plugin. Use that plugin's explicit HR-sandwiched form when a document-level
container must begin immediately after a figure.

### Unreferenced figure and table notes

An unreferenced local note describes the whole target and creates no automatic
number, ID, reference, or backlink:

```md
図注：値はすべて税込みです。
```

```md
- 表注1：空欄は未回答です。
- 表注2：値は四捨五入しています。
```

Use a paragraph when one note applies to the whole target and a bullet list when
there are several. A one-item bullet list is accepted, but the paragraph form is
the clearer authoring recommendation for one note. Nested or multi-block list
items are not note syntax. Neither form creates reference links.

Japanese openers are `図注` and `表注`. English openers are `Figure note`,
`Figure notes`, `Table note`, and `Table notes`. An optional manual suffix is
one or more decimal digits or uppercase ASCII letters; it remains source text
and is not interpreted as an automatic sequence. The suffix may directly follow
the opener, or follow one or more ASCII spaces. Thus, natural English list items
such as `- Table note 1: Provisional value.` are accepted.

The result is placed in `aside.f-local-notes` with `f-img-notes` or
`f-table-notes`. A post-target caption follows the local-note container.

### Referenced table notes

Referenced local notes are initially table-only. A marker inside the table or
its caption uses a source label beginning with `tn-` or `table-`. End the table
with a blank line; the consecutive one-line definitions that follow form the
table-local group, with no blank lines between definitions. No empty `表注：` /
`Table notes:` opener is written:

```md
| Item | Value |
| --- | ---: |
| A[^tn-a] | 10 |

[^tn-a]: Provisional value.
```

Source labels are local to the owning table. Visible numbers, document-unique
IDs, and backlinks are generated independently from normal footnotes. The
table and its adjacent caption share that local scope; repeated-reference IDs
follow their rendered source order, including a caption placed before the table.
Definitions precede a post-target caption so the sidecar order remains target,
local notes, caption, then annotation. The generated `aside` label follows
`env.locale` / `env.preferredLocales` when available and otherwise falls back to
the first configured recognition language. The plugin imports only
`@peaceroad/markdown-it-footnote-here/note-grammar.js` and does not register
footnote-here automatically. Both plugin installation orders are supported.

The blank line is required by Markdown's table grammar; without it, a definition
line can be parsed as another table row before this plugin sees it. The first
release accepts one definition per source line. A `tn-` / `table-` definition
that is not directly after an eligible table is not claimed merely because of
its prefix. Once an adjacent group is claimed, duplicate definitions or other
invalid ownership remain visible instead of falling through to a normal footnote
definition. Diagnostics are appended to
`env.figureNotesDiagnostics` with codes such as `duplicate-definition`,
`undefined-reference`, `unreferenced-definition`, and
`scope-outside-reference`. The library does not log them to the console.

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
