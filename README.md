# p7d-markdown-it-figure-with-p-caption

This markdown-it plugin converts paragraphs representing captions before or after image/table/code/video/audio/iframe into `figcaption` element, and wraps them in `figure` element. Caption parsing (labels, filenames, spacing rules) is delegated to [`p7d-markdown-it-p-captions`](https://www.npmjs.com/package/p7d-markdown-it-p-captions), so this plugin focuses on detecting the surrounding structure. Optionally, you have the option to wrap it in a `figure` element, even if there is no caption paragraph.

For images, even if they don't have a caption paragraph, they can be treated as captions if they have a caption string in the image's `alt`/`title` text (there is also an option to promote them to captions even if they don't have that string).

Optionally, you can auto-number image and table caption paragraphs starting from the beginning of the document if they only have label names.

**Note.** If you want to adjust the image `width`/`height`, please also use [`@peaceroad/markdown-it-renderer-image`](https://www.npmjs.com/package/@peaceroad/markdown-it-renderer-image). Also, if you want to use the `samp` element when displaying terminal output, please also use [`@peaceroad/markdown-it-renderer-fence`](https://www.npmjs.com/package/@peaceroad/markdown-it-renderer-fence). This document shows output using the latter option.

## Behavior

### Images

- Pure image paragraphs (`![...](...)`) become `<figure class="f-img">` blocks as soon as a caption paragraph (previous or next) or an auto-detected caption exists.
- Auto detection runs per image paragraph when `autoCaptionDetection` is `true` (default). The priority is:
    1. Caption paragraphs immediately before or after the image (standard syntax).
    2. Image `alt` text that already matches p7d-markdown-it-p-captions label formats (`Figure. `, `Figure 1. `, `図　`,`図1　`, etc.).
    3. Image `title` attribute that matches the same labels.
    4. Optional fallbacks (`autoAltCaption`, `autoTitleCaption`) that inject the label when the alt/title lacks one.
        - `autoAltCaption`: `false` (default), `true`, or a string label. `true` inspects the first sentence of the caption text and picks `Figure` / `図` based on detected language; a string uses that label verbatim.
        - `autoTitleCaption`: same behavior but sourced from the image `title`. It stays off by default so other plugins can keep using the `title` attribute for metadata.
- Set `autoCaptionDetection: false` to disable the auto-caption workflow entirely.
- Multi-image paragraphs are still wrapped as one figure when `multipleImages: true` (default). Layout-specific classes help with styling:
  - `f-img-horizontal` when images sit on the same line (space-delimited).
  - `f-img-vertical` when separated only by soft breaks.
  - `f-img-multiple` for mixed layouts.
- Automatic detection inspects only the first image in the paragraph. If it yields a caption, the entire figure reuses that caption while later images keep their own `alt`/`title`.
- Paragraphs that contain only images also convert when they appear inside loose lists (leave blank lines between items), blockquotes, or description lists.

### Tables

- Markdown tables (including those produced by `markdown-it-multimd-table` or similar) convert into `<figure class="f-table">` blocks.
- Caption paragraphs immediately before/after the table become `<figcaption>` element ahead of the `<table>`.

### Code blocks

- Captions labeled `Code. `, `Terminal. `, etc. wrap the fence in `<figure class="f-pre-code">` / `<figure class="f-pre-samp">`.
- If `roleDocExample: true`, these figures add `role="doc-example"`.

### Blockquotes

- Captioned blockquotes (e.g., “Source. A paragraph. Ewritten immediately before or after `> ...`) become `<figure class="f-blockquote">` while keeping the original blockquote intact.

### Video & Audio

- Inline HTML `<video>` and `<audio>` tags are detected as media figures (`<figure class="f-video">` and `<figure class="f-audio">`).
- A caption paragraph labeled `Video. ` / `Audio. ` (or any registered label) is promoted to `<figcaption>` before/after the media so controls remain unobstructed.

### Embed by iframe

- Inline HTML `<iframe>` elements become `<figure class="f-video">` when they point to known video hosts (YouTube `youtube.com` / `youtube-nocookie.com`, Vimeo `player.vimeo.com`); all other iframes fall back to `<figure class="f-iframe">` unless you override the class via `allIframeTypeFigureClassName`.
- Blockquote-based social embeds (Twitter/X `twitter-tweet`, Mastodon `mastodon-embed`, Bluesky `bluesky-embed`, Instagram `instagram-media`, Tumblr `text-post-media`) are treated like iframe-type embeds when their `class` matches those providers. By default they become `<figure class="f-img">` so the caption label behaves like an image label (or whichever label you use, e.g., “Quote. E; override the wrapper class with `figureClassThatWrapsIframeTypeBlockquote` or the global `allIframeTypeFigureClassName`.
- `p7d-markdown-it-p-captions` ships with a `Slide.` label. When you use it (for example with Speaker Deck or SlideShare iframes), the `<figure>` wrapper stays `f-iframe` (or `f-embed` if you override it), while the figcaption includes `<span class="f-slide-label">Slide<span class="f-slide-label-joint">.</span></span>` so the caption itself can be styled distinctly via CSS.

## Behavior Customization

### Styles

- Set `allIframeTypeFigureClassName: 'f-embed'` (recommended) to force a single CSS class across `<iframe>` and social-embed figures so they can share styles, ensuring every embed wrapper shares the same predictable class name.
- `figureClassThatWrapsIframeTypeBlockquote`: override the class used when blockquote-based embeds (Twitter, Mastodon, Bluesky) are wrapped. Defaults to `f-img` so the label styles match image captions.
- With `markdown-it-attrs`, any attribute block (`{ .foo #bar }`) attached to the caption paragraph is moved to the generated `<figure>` by default (`styleProcess: true`). This keeps per-figure classes/IDs on the wrapper instead of the original paragraph; disable the option only if you explicitly want the attributes to stay on the paragraph.
- `classPrefix` (default `f`) controls the CSS namespace for every figure (`f-img`, `f-table`, etc.) so you can align with existing styles.

### Wrapping without captions

- `oneImageWithoutCaption`: turn single-image paragraphs into `<figure>` elements even when no caption paragraph/auto caption is present. This is independent of automatic detection.
- `videoWithoutCaption`, `audioWithoutCaption`, `iframeWithoutCaption`, `iframeTypeBlockquoteWithoutCaption`: wrap the respective media blocks without caption.

### Caption text helpers (delegated to `p7d-markdown-it-p-captions`)

Every option below is forwarded verbatim to `p7d-markdown-it-p-captions`, which owns the actual figcaption rendering:

- `strongFilename` / `dquoteFilename`: pull out filenames from captions using `**filename**` or `"filename"` syntax and wrap them in `<strong class="f-*-filename">`.
- `jointSpaceUseHalfWidth`: replace full-width space between Japanese labels and caption body with half-width space.
- `bLabel` / `strongLabel`: emphasize the label span itself.
- `removeUnnumberedLabel`: drop the leading “Figure. Etext entirely when no label number is present. Use `removeUnnumberedLabelExceptMarks` to keep specific labels (e.g., `['blockquote']` keeps `Quote. `).
- `removeMarkNameInCaptionClass`: replace `.f-img-label` / `.f-table-label` with the generic `.f-label`.
- `wrapCaptionBody`: wrap the non-label caption text in a span element.
- `hasNumClass`: add a class attribute to label span element if it has a label number.

### Automatic numbering

- `setLabelNumbers`: enable numbering per media type. Pass an array such as `['img']`, `['table']`, or `['img', 'table']`.
- `autoLabelNumber`: shorthand for turning numbering on for both images and tables without passing the array yourself. Provide `setLabelNumbers` explicitly (e.g., `['img']`) when you need finer control—the explicit array always wins.
- Counters start at `1` near the top of the document and increment sequentially per media type. Figures and tables keep independent counters even when mixed together.
- The counter only advances when a real caption exists (paragraph, auto-detected alt/title, or fallback text). Figures emitted solely because of `oneImageWithoutCaption` stay unnumbered.
- Manual numbers inside the caption text (e.g., `Figure 5.`) always win. The plugin updates its internal counter so the next automatic number becomes `6`. This applies to captions sourced from paragraphs, auto detection, and fallback captions.

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

### Basic Recommended Options

Auto label numbering for images and tables.

```js
const figureOption = {
  // Opinionated defaults
  oneImageWithoutCaption: true,
  videoWithoutCaption: true,
  audioWithoutCaption: true,
  iframeWithoutCaption: true,
  iframeTypeBlockquoteWithoutCaption: true,
  removeUnnumberedLabelExceptMarks: ['blockquote'], // keep “Quote. Elabels even when unnumbered
  allIframeTypeFigureClassName: 'f-embed', // apply a uniform class to every iframe-style embed
  autoLabelNumber: true,

  // If you want to enable auto alt/title captioning fallbacks without caption label.
  //autoAltCaption: true,
  //autoTitleCaption: true,
}
```

If there is no label number, the label will also be deleted.

```js
const figureOption = {
  oneImageWithoutCaption: true,
  videoWithoutCaption: true,
  audioWithoutCaption: true,
  iframeWithoutCaption: true,
  iframeTypeBlockquoteWithoutCaption: true,
  removeUnnumberedLabelExceptMarks: ['blockquote'],
  allIframeTypeFigureClassName: 'f-embed',
  removeUnnumberedLabel: true,
}
```

These options can be used as follows:

```
const md = mdit({ html: true }).use(mditFigureWithPCaption, figureOption)
```

## Conversion Examples

### Default before/after caption paragraph detection

~~~
[Markdown]
![A single cat](figure.jpg)

[HTML]
<p><img src="figure.jpg" alt="A single cat"></p>

<!-- Above: If oneImageWithoutCaption is true, this img element has wrapped into figure element without caption. -->


[Markdown]
Figure. A Caption.

![A single cat](figure.jpg)
[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Caption.</figcaption>
<img src="figure.jpg" alt="A single cat">
</figure>


[Markdown]
![A single cat](figure.jpg)

Figure. A Caption.
[HTML]
<figure class="f-img">
<img src="figure.jpg" alt="A single cat">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Caption.</figcaption>
</figure>


[Markdown]
Table. A Caption.

| Tokyo | Osaka |
| ----- | ----- |
| Sushi | Takoyaki |

[HTML]
<p>A paragraph.</p>
<figure class="f-table">
<figcaption><span class="f-table-label">Table<span class="f-table-label-joint">.</span></span> A Caption.</figcaption>
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


[Markdown]
Code. A Caption.

```js
console.log('Hello World!');
```

[HTML]
<figure class="f-pre-code">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> A Caption.</figcaption>
<pre><code class="language-js">console.log('Hello World!');
</code></pre>
</figure>

<!-- Above: class attribute of code element is generated by markdown-it option. -->


[Markdown]
Source. A Caption.

> A quoted paragraph.

[HTML]
<figure class="f-blockquote">
<figcaption><span class="f-blockquote-label">Source<span class="f-blockquote-label-joint">.</span></span> A Caption.</figcaption>
<blockquote>
<p>A quoted paragraph.</p>
</blockquote>
</figure>


[Markdown]
Terminal. A Caption.

```samp
$ pwd
/home/user
```

[HTML]
<figure class="f-pre-samp">
<figcaption><span class="f-pre-samp-label">Terminal<span class="f-pre-samp-label-joint">.</span></span> A Caption.</figcaption>
<pre><samp>$ pwd
/home/user
</samp></pre>
</figure>

<!-- Above: When @peaceroad/markdown-it-renderer-fence is used, samp element are generated automatically for `samp` fences. -->

[Markdown]
Video. A mp4.

<video controls width="400" height="300">
<source src="example.mp4" type="video/mp4">
</video>

[HTML]
<figure class="f-video">
<figcaption><span class="f-video-label">Video<span class="f-video-label-joint">.</span></span> A mp4.</figcaption>
<video controls width="400" height="300">
<source src="example.mp4" type="video/mp4">
</video>
</figure>


[Markdown]
Audio. A narration.

<audio controls>
<source src="example.mp3" type="audio/mpeg">
</audio>

[HTML]
<figure class="f-audio">
<figcaption><span class="f-audio-label">Audio<span class="f-audio-label-joint">.</span></span> A narration.</figcaption>
<audio controls>
<source src="example.mp3" type="audio/mpeg">
</audio>
</figure>


[Markdown]
Video. A YouTube video.

<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" ...></iframe>

[HTML]
<figure class="f-video">
<figcaption><span class="f-video-label">Video<span class="f-video-label-joint">.</span></span> A YouTube video.</figcaption>
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" ...></iframe>
</figure>


[Markdown]
Figure. Mastodon post.

<blockquote class="mastodon-embed" ...> ...... </blockquote><script async src="https://mastodon.social/embed.js"></script>

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> X post.</figcaption>
<blockquote class="mastodon-embed" ...> ...... </blockquote><script async src="https://mastodon.social/embed.js"></script>
</figure>


[Markdown]
Quote. Mastodon post.

<blockquote class="mastodon-embed" ...> ...... </blockquote><script async src="https://mastodon.social/embed.js"></script>

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Quote<span class="f-img-label-joint">.</span></span> X post.</figcaption>
<blockquote class="mastodon-embed" ...> ...... </blockquote><script async src="https://mastodon.social/embed.js"></script>
</figure>


[Markdown]
Slide. A Speaker Deck.

<iframe src="https://speakerdeck.com/player/XXXXXXXXXXX" width="640" height="360" frameborder="0" allowfullscreen></iframe>

[HTML]
<figure class="f-iframe">
<figcaption><span class="f-slide-label">Slide<span class="f-slide-label-joint">.</span></span> A Speaker Deck.</figcaption>
<iframe src="https://speakerdeck.com/player/XXXXXXXXXXX" width="640" height="360" frameborder="0" allowfullscreen></iframe>
</figure>
~~~

### Auto alt/title detection

```
[Markdown]
![Figure. A cat.](cat.jpg)

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A cat.</figcaption>
<img src="cat.jpg" alt="">
</figure>


[Markdown]
![A white cat eats fishs.](cat.jpg "Figure. A cat.")

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A cat.</figcaption>
<img src="cat.jpg" alt="A white cat eats fishs.">
</figure>
```

### Multiple images

~~~
[Markdown]
A paragraph. multipleImages: true. horizontal images only.

![Sitting cat](cat1.jpg) ![Standing cat](cat2.jpg)

Figure. Cats.

A paragraph.
[HTML]
<p>A paragraph. multipleImages: true.  horizontal images only</p>
<figure class="f-img-horizontal">
<img src="cat1.jpg" alt="Sitting cat"><img src="cat2.jpg" alt="Standing cat">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Cats.</figcaption>
</figure>
<p>A paragraph.</p>

[Markdown]
A paragraph. multipleImages: true. vertical images only.

Figure. Cats.

![Sitting cat](cat1.jpg) 
     ![Standing cat](cat2.jpg)

A paragraph.
[HTML]
<p>A paragraph. multipleImages: true. vertical images only.</p>
<figure class="f-img-vertical">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Cats.</figcaption>
<img src="cat1.jpg" alt="Sitting cat">
<img src="cat2.jpg" alt="Standing cat">
</figure>
<p>A paragraph.</p>

[Markdown]
A paragraph. multipleImages: true.

Figure. Cats.

![Sitting cat](cat1.jpg) ![Standing cat](cat2.jpg)
![Sleeping cat](cat3.jpg)

A paragraph.
[HTML]
<p>A paragraph. multipleImages: true.</p>
<figure class="f-img-multiple">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Cats.</figcaption>
<img src="cat1.jpg" alt="Sitting cat"><img src="cat2.jpg" alt="Standing cat">
<img src="cat3.jpg" alt="Sleeping cat">
</figure>
<p>A paragraph.</p>
~~~

### Styles

This example uses `classPrefix: 'custom'` and leaves `styleProcess: true` so a trailing `{.notice}` block moves onto the `<figure>` wrapper.

```
[Markdown]
Figure. Highlighted cat. {.notice}

![Highlighted cat](cat.jpg)
[HTML]
<figure class="custom-img notice">
<figcaption><span class="custom-img-label">Figure<span class="custom-img-label-joint">.</span></span> Highlighted cat.</figcaption>
<img src="cat.jpg" alt="Highlighted cat">
</figure>
```

## Option Examples

### Automatic detection fallbacks

`autoCaptionDetection` combined with `autoAltCaption` / `autoTitleCaption` can still generate caption text even when the original alt/title lacks labels. The corresponding attributes are cleared after conversion so the figcaption becomes the canonical source.

```
[Markdown]
![Alt fallback example](bird.jpg)

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Alt fallback example</figcaption>
<img src="bird.jpg" alt="">
</figure>


[Markdown]
![No caption](fish.jpg "Plain title text")

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Plain title text</figcaption>
<img src="fish.jpg" alt="No caption">
</figure>
```

### Role helpers

Set `roleDocExample: true` to add `role="doc-example"` to code/samp figures.

~~~
[Markdown]
```samp
$ pwd
/home/user
```

[HTML]
<figure class="f-pre-samp" role="doc-example">
...
</figure>
~~~

### Captionless conversion toggles

If `oneImageWithoutCaption` is enabled, a single image paragraph will be wrapped with `<figure class="f-img">` even without a caption.

```
[Markdown]
![A single cat](cat.jpg)

[HTML]
<figure class="f-img">
<img src="cat.jpg" alt="A single cat">
</figure>
```

If `videoWithoutCaption` is enabled, an `iframe` pointing to a known video host (such as YouTube or video elements) will be wrapped with `<figure class="f-video">`.

```
[Markdown]
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" ...></iframe>

[HTML]
<figure class="f-video">
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" ...></iframe>
</figure>


[Markdown]
<video controls width="400" height="300">
<source src="example.mp4" type="video/mp4">
</video>
[HTML]
<figure class="f-video">
<video controls width="400" height="300">
<source src="example.mp4" type="video/mp4">
</video>
</figure>
```

If when `iframeWithoutCaption` is enabled, iframe elements will be wrapped with `<figure class="f-iframe">`. And if `iframeTypeBlockquoteWithoutCaption` is enabled, blockquote-based embeds (for example, X) will be wrapped with `<figure class="f-mg">` (or another configured class).

```
[Markdown]
<iframe>
...
</iframe>

[HTML]
<figure class="f-iframe">
<iframe>
...
</iframe>
</figure>
```

### Iframe-type blockquote class override

If `figureClassThatWrapsIframeTypeBlockquote` is enabled, blockquote-based embeds (for example, X, Mastodon, Bluesky) will be wrapped with the specified class.

### All iframe/embed class override

Enable `allIframeTypeFigureClassName` (recommended. `'f-embed'`) to consolidate iframe-like embeds under one class.
