# p7d-markdown-it-figure-with-p-caption

A markdown-it plugin that converts adjacent caption paragraphs and supported
media blocks into semantic `<figure>` / `<figcaption>` structures.

Caption-label parsing, numbering grammar, and language catalogs are delegated
to [`p7d-markdown-it-p-captions`](https://www.npmjs.com/package/p7d-markdown-it-p-captions).
This plugin owns figure-candidate detection, wrapping, figure classes, and
optional document/chapter-aware numbering. Its opt-in notes feature also keeps
figure annotations and target-local figure/table notes distinct from captions
and document-scoped footnotes.

Supported targets include images, tables, code fences, terminal/samp fences,
blockquotes, video/audio blocks, iframes, social embeds, and slide iframes.

## Installation

```console
npm install markdown-it @peaceroad/markdown-it-figure-with-p-caption
```

Optional companion plugins:

- [`@peaceroad/markdown-it-renderer-image`](https://www.npmjs.com/package/@peaceroad/markdown-it-renderer-image)
  for image width/height rendering.
- [`@peaceroad/markdown-it-renderer-fence`](https://www.npmjs.com/package/@peaceroad/markdown-it-renderer-fence)
  when terminal fences should render as `<pre><samp>`.
- [`markdown-it-attrs`](https://www.npmjs.com/package/markdown-it-attrs)
  for broader attribute syntax.

## Quick start

```js
import markdownIt from 'markdown-it'
import figureWithCaption from '@peaceroad/markdown-it-figure-with-p-caption'

const md = markdownIt({ html: true })
  .use(figureWithCaption)

console.log(md.render('Figure. A cat.\n\n![A cat](cat.jpg)'))
```

Output:

```html
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A cat.</figcaption>
<img src="cat.jpg" alt="A cat">
</figure>
```

Caption paragraphs may appear immediately before or after a supported block.
Image `alt` / `title` text can also provide a caption when
`autoCaptionDetection` recognizes a configured label.

## What gets converted

| Markdown target | Typical caption | Default figure class |
| --- | --- | --- |
| Image-only paragraph | `Figure.` / `図` | `f-img` |
| Table | `Table.` / `表` | `f-table` |
| Code fence | `Code.` / `Listing.` | `f-pre-code` |
| Terminal/samp fence | `Terminal.` / `端末` | `f-pre-samp` |
| Blockquote | `Quote.` / `Source.` | `f-blockquote` |
| Video block or known video iframe | `Video.` / `動画` | `f-video` |
| Audio block | `Audio.` / `音声` | `f-audio` |
| Generic iframe | Any compatible caption label | `f-iframe` |
| Slide iframe | `Slide.` | `f-slide` |

Exact labels come from the active `p7d-markdown-it-p-captions` language
catalogs. The default available catalogs are English and Japanese.

## Representative conversions

These examples show the default figure classes. Caption span markup is included
where it helps explain the output; long media contents are abbreviated.

### Image

Markdown:

```md {test id="readme-image"}
Figure. A cat.

![A cat](cat.jpg)
```

HTML:

```html {test id="readme-image"}
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A cat.</figcaption>
<img src="cat.jpg" alt="A cat">
</figure>
```

### Table

Markdown:

```md {test id="readme-table"}
Table. Regional food.

| Tokyo | Osaka |
| --- | --- |
| Sushi | Takoyaki |
```

HTML:

```html {test id="readme-table"}
<figure class="f-table">
<figcaption><span class="f-table-label">Table<span class="f-table-label-joint">.</span></span> Regional food.</figcaption>
<table>
<thead>
<tr>
<th>Tokyo</th>
<th>Osaka</th>
</tr>
</thead>
<tbody>
<tr>
<td>Sushi</td>
<td>Takoyaki</td>
</tr>
</tbody>
</table>
</figure>
```

### Code block

Markdown:

~~~md {test id="readme-code"}
Code. Logging example.

```js
console.log('Hello')
```
~~~

HTML:

```html {test id="readme-code"}
<figure class="f-pre-code">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> Logging example.</figcaption>
<pre><code class="language-js">console.log('Hello')
</code></pre>
</figure>
```

### Terminal/samp block

Markdown:

~~~md {test id="readme-samp" setup="renderer-fence"}
Terminal. Current directory.

```samp
$ pwd
/home/user
```
~~~

With `@peaceroad/markdown-it-renderer-fence`, the representative output is:

```html {test id="readme-samp"}
<figure class="f-pre-samp">
<figcaption><span class="f-pre-samp-label">Terminal<span class="f-pre-samp-label-joint">.</span></span> Current directory.</figcaption>
<pre><samp>$ pwd
/home/user
</samp></pre>
</figure>
```

The figure wrapper and caption classification do not depend on that optional
renderer; it is used here to show the semantic `<samp>` element.

### Video

Markdown:

```md {test id="readme-video"}
Video. Product demonstration.

<video controls>
<source src="demo.mp4" type="video/mp4">
</video>
```

HTML:

```html {test id="readme-video"}
<figure class="f-video">
<figcaption><span class="f-video-label">Video<span class="f-video-label-joint">.</span></span> Product demonstration.</figcaption>
<video controls>
<source src="demo.mp4" type="video/mp4">
</video>
</figure>
```

Known YouTube/Vimeo iframe hosts can also use the `f-video` wrapper.
An unknown iframe with an explicit `Video.` caption uses video numbering but
keeps the `f-iframe` wrapper.

### Slide iframe

Markdown:

```md {test id="readme-slide"}
Slide. A Speaker Deck.

<iframe src="https://speakerdeck.com/player/XXXXXXXXXXX" width="640" height="360" allowfullscreen></iframe>
```

HTML:

```html {test id="readme-slide"}
<figure class="f-slide">
<figcaption><span class="f-slide-label">Slide<span class="f-slide-label-joint">.</span></span> A Speaker Deck.</figcaption>
<iframe src="https://speakerdeck.com/player/XXXXXXXXXXX" width="640" height="360" allowfullscreen></iframe>
</figure>
```

`figureClassThatWrapsSlides` changes the slide wrapper class.
`allIframeTypeFigureClassName` takes precedence when all iframe-like embeds
should share one class.

See the [complete conversion examples](docs/examples.md#conversion-examples)
for before/after captions, multiple images, blockquotes, audio, social embeds,
and option-specific output.

## Recommended options

The plugin defaults are conservative. The following is a practical,
opinionated configuration when valid captionless media should also receive
figure wrappers, iframe-like embeds should share one class, and images/tables
should be numbered:

```js
const recommendedFigureOptions = {
  imageOnlyParagraphWithoutCaption: true,
  videoWithoutCaption: true,
  audioWithoutCaption: true,
  iframeWithoutCaption: true,
  iframeTypeBlockquoteWithoutCaption: true,

  // Keep Quote./Source. labels when removeUnnumberedLabel is enabled later.
  removeUnnumberedLabelExceptMarks: ['blockquote'],

  // Use one predictable wrapper class for iframe/social-embed figures.
  allIframeTypeFigureClassName: 'f-embed',

  // Number image and table captions. Recognized Chapter/Appendix scopes
  // in parsed frontmatter titles or H1 headings are applied automatically.
  autoLabelNumber: true,
}

const md = markdownIt({ html: true })
  .use(figureWithCaption, recommendedFigureOptions)
```

Optional additions:

```js
const recommendedFigureOptionsWithFallbacks = {
  ...recommendedFigureOptions,
  // Remove labels such as Figure./Table. when they remain unnumbered.
  removeUnnumberedLabel: true,

  // Generate an image label when non-empty alt/title text has no label.
  autoAltCaption: true,
  // autoTitleCaption: true,
}
```

`autoAltCaption` and `autoTitleCaption` are disabled by default. When set to
`true`, generated labels follow p-captions locale metadata. They may also be a
recognized string label.

See the [complete option reference](docs/reference.md#behavior-customization)
and [option examples](docs/examples.md#option-examples) for class mapping,
caption markers, role helpers, captionless conversion, and formatting options.

## Figure annotations and local notes

Figure annotations and figure/table-local notes are opt-in. They are separate
from explanatory captions and from document-scoped footnotes:

```js
const md = markdownIt().use(figureWithCaption, {
  notes: { enabled: true },
})
```

```md
![A chart](chart.png)

図注：値は四捨五入しています。

データ：Example Dataset
```

The image, local note, and source annotation are wrapped in one figure. Built-in
English and Japanese labels follow the existing `languages` recognition option.
The initial annotation roles are `source`, `credit`, and `rights`; source text
such as `出典：` / `Data source:`, provider credits, and `©` remain visibly as
written. Use one `図注：...` / `表注：...` paragraph for one note that applies
to the whole target, or a list of labeled items for several such notes.

When table cells contain note references, end the table with a blank line and
then place consecutive one-line definitions. Referenced table notes use
target-local `tn-` or `table-` labels and do not share counters, IDs, or
backlinks with ordinary footnotes:

```md
| Item | Value |
| --- | ---: |
| A[^tn-1] | 10 |

[^tn-1]: 暫定値。
```

The package reuses only the browser-safe marker grammar from
`@peaceroad/markdown-it-footnote-here`; it does not activate that plugin or
reuse its document-scoped runtime. See the
[notes option and grammar reference](docs/reference.md#figure-annotations-and-local-notes).

## Automatic numbering

Automatic numbering is **disabled by default**.

Number image and table captions:

```js
const md = markdownIt().use(figureWithCaption, {
  autoLabelNumber: true,
})
```

Without a recognized chapter or appendix, this generates `Figure 1`,
`Figure 2`, and so on. Under `# Chapter 1: Introduction`, the same setup
automatically generates `Figure 1.1`, `Figure 1.2`, and so on. Parsed
`env.frontmatter.title` values use the same recognition.

The default scoped separator is `.`. Customize the automatic scope only when
the document structure differs from the defaults:

```js
const md = markdownIt().use(figureWithCaption, {
  autoLabelNumber: true,
  autoLabelNumberPolicy: {
    separator: '-',
    scope: { headingLevels: [2] },
  },
})
```

This recognizes H2 chapter headings and generates `Figure 1-1`. Use
`scope: 'document'` when headings and frontmatter titles must not affect
numbering:

```js
const md = markdownIt().use(figureWithCaption, {
  autoLabelNumber: true,
  autoLabelNumberPolicy: { scope: 'document' },
})
```

Use `autoLabelNumberSets` for additional marks:

```js
const md = markdownIt().use(figureWithCaption, {
  autoLabelNumberSets: ['img', 'table', 'code', 'samp', 'video'],
})
```

`autoLabelNumber` is only the image/table shorthand. An explicitly supplied
`autoLabelNumberSets` always wins, and `autoLabelNumberPolicy` changes
formatting/scope without enabling marks by itself. Automatic scope defaults to
parsed frontmatter titles plus top-level H1 headings; customize `sources`,
`headingLevels`, and `repeatScope` only when needed.

See the [complete automatic-numbering reference](docs/numbering.md#automatic-numbering)
for semantic counter series, shared samp labels, manual-number synchronization,
chapter/appendix recognition, repeat scopes, frontmatter configuration, and
render-level overrides.

## Integration API

Source editors and other markdown-it plugins can reuse the same figure-specific
scope, counter-series, and number-codec semantics without importing the
renderer walker:

```js
import {
  createFigureCaptionCounterKeyResolver,
  createFigureCaptionNumberCodec,
  createFigureCaptionScopeTimeline,
  normalizeFigureCaptionNumberingPolicy,
} from '@peaceroad/markdown-it-figure-with-p-caption/caption-numbering.js'
```

See the [caption-numbering integration API reference](docs/numbering.md#caption-numbering-integration-api).
The public API intentionally does not expose figure-candidate detection,
wrapping, token mutation, or source editing.

## Important behavior

- Repeated `.use(figureWithCaption, ...)` calls on one markdown-it instance use
  first-install-wins behavior. Create separate instances for different
  successful option sets.
- Tight-list image paragraphs are not wrapped. Loose lists, blockquotes, and
  description lists are supported with documented container guards.
- `styleProcess` and forwarded markdown-it-attrs attributes are not
  sanitization. Sanitize final rendered HTML when the Markdown input is
  untrusted.
- Source HTML requires `markdownIt({ html: true })`.
- The plugin does not parse YAML or install a frontmatter rule. Supply parsed
  metadata through `env.frontmatter`, or configure the documented raw-token
  adapter.

## Documentation

The detailed documentation is divided into three files:

- [Behavior and options reference](docs/reference.md) — detection, wrapping,
  caption helpers, basic usage, and option contracts.
- [Automatic numbering and integration API](docs/numbering.md) — numbering
  series, [chapter and appendix scopes](docs/numbering.md#chapter-and-appendix-scopes),
  frontmatter/render overrides, and the
  [public integration API](docs/numbering.md#caption-numbering-integration-api).
- [Complete conversion and option examples](docs/examples.md) — full
  [conversion examples](docs/examples.md#conversion-examples) and
  [option examples](docs/examples.md#option-examples).

## License

MIT
