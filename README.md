# p7d-markdown-it-figure-with-p-caption

This is a markdown-it plugin.

For paragraphs containing only images, tables, code blocks, blockquotes, or iframes, this plugin converts them into figure elements with figcaption elements when a caption paragraph is written immediately before or after.

The conversion process:
1. Detect supported elements: image paragraphs, tables, code/samp blocks, blockquotes, videos, and iframes
2. Check for caption paragraphs immediately before or after the element
3. Convert both elements into a figure with figcaption structure

The figcaption behavior of this plugin depends on [p7d-markdown-it-p-captions](https://www.npmjs.com/package/p7d-markdown-it-p-captions).

**Notice.** Starting with version 0.7, the process changing from code to samp tag has been migrated to [@peaceroad/markdown-it-renderer-fence](https://www.npmjs.com/package/@peaceroad/markdown-it-renderer-fence). If you want to continue processing as before, please use this plugin at the same time.
(The tests for this plugin and this Readme output used the plugins together.)

**Notice.** You can also use `markdown-it-attrs` at the same time. However, if there is `{.style}` at the end of a paragraph with only an image, and the next paragraph is a caption, `markdown-it-attrs` alone does not handle it well, so this plugin takes care of that. (This processing is optional `{styleProcess: true}` and can be turned off.) [0.5.0]

Use it as follows.

```js
import mdit from 'markdown-it'
import mditFigureWithPCaption from '@peaceroad/markdown-it-figure-with-p-caption'
import mditRendererFence from '@peaceroad/markdown-it-renderer-fence' /* to processing code -> smap tag etc. process.*/

const md = mdit()
md.use(mditFigureWithPCaption)

console.log(md.render('Figure. A Cat.\n\n![Figure](cat.jpg)'))
// <figure class="f-img">
// <figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Cat.</figcaption>
// <img src="cat.jpg" alt="Figure">
// </figure>
```

Also, It is recommended to set the width and height attributes of the images at the same time. See: [@peaceroad/markdown-it-renderer-image](https://www.npmjs.com/package/@peaceroad/markdown-it-renderer-image).

It could be applied to table, codeblock(pre > code, pre > samp), video as well.

These elements are also supported within the following structure. [0.13.0+]

- Blockquote
- loose list (with blank lines between items), not tight list (no blank lines)
- Description list block (`<dl>` markup, markdown-it-deflist)

## Example

~~~
[Markdown]
![Figure](figure.jpg)

[HTML]
<p><img src="figure.jpg" alt="Figure"></p>


[Markdown]
Figure. A Caption.

![Figure](figure.jpg)
[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Caption.</figcaption>
<img src="figure.jpg" alt="Figure">
</figure>


[Markdown]
![Figure](figure.jpg)

Figure. A Caption.
[HTML]
<figure class="f-img">
<img src="figure.jpg" alt="Figure">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Caption.</figcaption>
</figure>


[Markdown]
A paragraph.

Table. A Caption.

| Tokyo | Osaka |
| ----- | ----- |
| Sushi | Takoyaki |

A paragraph.
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
<p>A paragraph.</p>


[Markdown]
A paragraph.

Code. A Caption.

```js
console.log('Hello World!');
```

A paragraph.

[HTML]
<p>A paragraph.</p>
<figure class="f-pre-code">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> A Caption.</figcaption>
<pre><code class="language-js">console.log('Hello World!');
</code></pre>
</figure>
<p>A paragraph.</p>


[Markdown]
A paragraph.

Source. A Caption.

> A quoted paragraph.

A paragraph.

[HTML]
<p>A paragraph.</p>
<figure class="f-blockquote">
<figcaption><span class="f-blockquote-label">Source<span class="f-blockquote-label-joint">.</span></span> A Caption.</figcaption>
<blockquote>
<p>A quoted paragraph.</p>
</blockquote>
</figure>
<p>A paragraph.</p>


[Markdown]
A paragraph.

Terminal. A Caption.

```samp
$ pwd
/home/user
```

A paragraph.

[HTML]
<p>A paragraph.</p>
<figure class="f-pre-samp">
<figcaption><span class="f-pre-samp-label">Terminal<span class="f-pre-samp-label-joint">.</span></span> A Caption.</figcaption>
<pre><samp>$ pwd
/home/user
</samp></pre>
</figure>
<p>A paragraph.</p>


[Markdown]
A paragraph.

Video. A mp4.

<video controls width="400" height="300">
<source src="example.mp4" type="video/mp4">
</video>

A paragraph.
[HTML]
<p>A paragraph.</p>
<figure class="f-video">
<figcaption><span class="f-video-label">Video<span class="f-video-label-joint">.</span></span> A mp4.</figcaption>
<video controls width="400" height="300">
<source src="example.mp4" type="video/mp4">
</video>
</figure>
<p>A paragraph.</p>


[Markdown]
A paragraph.

Video. A youtube.

<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

A paragraph.
[HTML]
<p>A paragraph.</p>
<figure class="f-video">
<figcaption><span class="f-video-label">Video<span class="f-video-label-joint">.</span></span> A youtube.</figcaption>
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</figure>
<p>A paragraph.</p>


[Markdown]
A paragraph.

Video. A youtube.

<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

A paragraph.
[HTML]
<p>A paragraph.</p>
<figure class="f-video">
<figcaption><span class="f-video-label">Video<span class="f-video-label-joint">.</span></span> A youtube.</figcaption>
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</figure>
<p>A paragraph.</p>


[Markdown]
A paragraph.

Figure. Twitter Post.

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">XXXXX <a href="https://t.co/XXXXX">https://t.co/XXXXX</a></p>&mdash; UserName (@account) <a href="https://twitter.com/account/status/XXXXX">August 4, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

A paragraph.
[HTML]
<p>A paragraph.</p>
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Twitter Post.</figcaption>
<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">XXXXX <a href="https://t.co/XXXXX">https://t.co/XXXXX</a></p>&mdash; User (@twitter) <a href="https://twitter.com/UserID/status/XXXXX">August 4, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</figure>
<p>A paragraph.</p>

~~~

Note: External embedding supports Youtube and Twitter. Twitter embedding uses blockquote instead of iframe. Therefore, the caption identifier should use "Quote", but "Figure" is also acceptable.


From version 0.5.0, it supports cases where a paragraph contains only multiple images. Instead of `f-img` as the figure class name, use the following class name. (This class name is unstable, but I probably won't change it.) 

- `f-img-horizontal` if the image is written in one line on Markdown
- `f-img-vertical` if images are written only vertically, one per line
- `f-img-multiple` in other cases

Notice. This process can be turned off by specifying `{multipleImages: false}`.

```
[Markdown]
A paragraph. multipleImages: true. horizontal images only.

![One cat](cat1.jpg) ![Two cat](cat2.jpg)

Figure. Cats.

A paragraph.
[HTML]
<p>A paragraph. multipleImages: true.  horizontal images only</p>
<figure class="f-img-horizontal">
<img src="cat1.jpg" alt="One cat"><img src="cat2.jpg" alt="Two cat">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Cats.</figcaption>
</figure>
<p>A paragraph.</p>

[Markdown]
A paragraph. multipleImages: true. vertical images only.

Figure. Cats.

![One cat](cat1.jpg) 
     ![Two cat](cat2.jpg)

A paragraph.
[HTML]
<p>A paragraph. multipleImages: true. vertical images only.</p>
<figure class="f-img-vertical">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Cats.</figcaption>
<img src="cat1.jpg" alt="One cat">
<img src="cat2.jpg" alt="Two cat">
</figure>
<p>A paragraph.</p>

[Markdown]
A paragraph. multipleImages: true.

Figure. Cats.

![One cat](cat1.jpg) ![Two cat](cat2.jpg)
![Three cat](cat3.jpg)

A paragraph.
[HTML]
<p>A paragraph. multipleImages: true.</p>
<figure class="f-img-multiple">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Cats.</figcaption>
<img src="cat1.jpg" alt="One cat"><img src="cat2.jpg" alt="Two cat">
<img src="cat3.jpg" alt="Three cat">
</figure>
<p>A paragraph.</p>
```

## Option: Specify file name

Specify the file name before writing the caption.
Note that a space is required between the file name and caption.

### Use double quote

```js

md.use(mditFigureWithPCaption, {dquoteFilename: true});
```

~~~
[Markdown]
A paragraph.

Code. "filename.js" Call a cat.

```js
console.log('Nyaan!');
```

A paragraph.

[HTML]
<p>A paragraph.</p>
<figure class="f-pre-code">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> <strong class="f-pre-code-filename">filename.js</strong> Call a cat.</figcaption>
<pre><code class="language-js">console.log('Nyaan!');
</code></pre>
</figure>
<p>A paragraph.</p>
~~~

### Use strong mark

```js
md.use(mditFigureWithPCaption, {strongFilename: true});
```

~~~

[Markdown]
A paragraph.

Code. **filename.js** Call a cat.

```js
console.log('Nyaan!');
```

A paragraph.

[HTML]
<p>A paragraph.</p>
<figure class="f-pre-code">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> <strong class="f-pre-code-filename">filename.js</strong> Call a cat.</figcaption>
<pre><code class="language-js">console.log('Nyaan!');
</code></pre>
</figure>
<p>A paragraph.</p>
~~~

## Option

### Convert one image paragraph without caption

Convert one image paragraph without a caption paragraph to figure element.

```js
md.use(mditFigureWithPCaption, {oneImageWithoutCaption: true});
```

~~~
[Markdown]
A paragraph.

![Figure](cat.jpg)

A paragraph.

[HTML]
<p>A paragraph.</p>
<figure class="f-img">
<img src="cat.jpg" alt="Figure">
</figure>
<p>A paragraph.</p>
~~~

### Convert one video element without caption

Convert one video element without a caption paragraph to figure element.

```js
md.use(mditFigureWithPCaption, {videoWithoutCaption: true});
```

#### Convert one iframe without caption

Convert one iframe without a caption paragraph to iframe element. (adn twitter blockquote embed eelment.)

```js
md.use(mditFigureWithPCaption, {iframeWithoutCaption: true});
```

~~~
[Markdown]
<iframe src="https://example.com/embed" class="mastodon-embed" style="max-width: 100%; border: 0" width="400" allowfullscreen="allowfullscreen"></iframe><script src="https://exapmle.com/embed.js" async="async"></script>
[HTML]
<figure class="f-iframe">
<iframe src="https://example.com/embed" class="mastodon-embed" style="max-width: 100%; border: 0" width="400" allowfullscreen="allowfullscreen"></iframe><script src="https://exapmle.com/embed.js" async="async"></script>
</figure>

[Markdown]
A paragraph.

<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

A paragraph.
[HTML]
<p>A paragraph.</p>
<figure class="f-video">
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</figure>
<p>A paragraph.</p>

[Markdown]
<iframe src="https://player.vimeo.com/video/xxxxxxxxxxxxxxx" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
[HTML]
<figure class="f-video">
<iframe src="https://player.vimeo.com/video/xxxxxxxxxxxxxxx" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
</figure>

[Markdown]
A paragraph. iframeWithoutCaption: true.

<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">XXXXX <a href="https://t.co/XXXXX">https://t.co/XXXXX</a></p>&mdash; User (@twitter) <a href="https://twitter.com/UserID/status/XXXXX">August 4, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

A paragraph.
[HTML]
<p>A paragraph. iframeWithoutCaption: true.</p>
<figure class="f-iframe">
<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">XXXXX <a href="https://t.co/XXXXX">https://t.co/XXXXX</a></p>&mdash; User (@twitter) <a href="https://twitter.com/UserID/status/XXXXX">August 4, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</figure>
<p>A paragraph.</p>

[Markdown]
<iframe src="https://example.com/embed" class="mastodon-embed" style="max-width: 100%; border: 0" width="400" allowfullscreen="allowfullscreen"></iframe><script src="https://exapmle.com/embed.js" async="async"></script>
[HTML]
<figure class="f-iframe">
<iframe src="https://example.com/embed" class="mastodon-embed" style="max-width: 100%; border: 0" width="400" allowfullscreen="allowfullscreen"></iframe><script src="https://exapmle.com/embed.js" async="async"></script>
</figure>

[Markdown]
<iframe class="speakerdeck-iframe" style="border: 0px none; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: 100%; height: auto; aspect-ratio: 560 / 314;" src="https://speakerdeck.com/player/xxxxxxxxxxxxxx" title="xxxxxxxxxxx" allowfullscreen="true" data-ratio="1.78343949044586" frameborder="0"></iframe>
[HTML]
<figure class="f-iframe">
<iframe class="speakerdeck-iframe" style="border: 0px none; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: 100%; height: auto; aspect-ratio: 560 / 314;" src="https://speakerdeck.com/player/xxxxxxxxxxxxxx" title="xxxxxxxxxxx" allowfullscreen="true" data-ratio="1.78343949044586" frameborder="0"></iframe>
</figure>
~~~

### Option: imgAltCaption

In Markdown documents, captions are often written in the alt attribute of images. If you follow the syntax of this plugin, the commit log will be cluttered. Therefore, as an option, the alt attribute is treated as a caption.
Note that you cannot use this plugin's syntax and this option's syntax at the same time.

The img alt attribute have an empty value.

```js
const mdImgAltCaption = mdit({html: true}).use(mditFigureWithPCaption, {imgAltCaption: 'Figure'})
```

```
[Markdown]
![Figure. A caption.](cat.jpg)

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A caption.</figcaption>
<img src="cat.jpg" alt="">
</figure>
```

### Option: imgTitleCaption

The title attribute of the Markdown img element is used as the caption.
Note that you cannot use this plugin's standard syntax and this option's syntax at the same time.

The img alt attribute is not specially modified during conversion; the Markdown alt attribute is used as is.

```js
const mdImgAltCaption = mdit({html: true}).use(mditFigureWithPCaption, {imgTitleCaption: 'Figure'})
```

```
[Markdown]
![A alt text.](cat.jpg "Figure. A caption.")

[HTML]
<figure class="f-img">
<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A caption.</figcaption>
<img src="cat.jpg" alt="A alt text.">
</figure>
```

### Option: roleDocExample

From version 0.8, role="doc-example" is not included as standard in figure.f-pre-code and figure.f-pre-samp. If necessary, set `roleDocExample: true.`

```js
const mdImgAltCaption = mdit({html: true}).use(mditFigureWithPCaption, {roleDocExample: true})
```

### Option: allIframeTypeFigureClassName

From version 0.16.0, unify the figure element that wraps the iframe or blockquote tag in the embed code to figure.f-embed (this may become the default in the future).

```js
const mdAllIframeTypeFigureClassName = mdit({html: true}).use(mdFigureWithPCaption, {
  allIframeTypeFigureClassName: 'f-embed',
  videoWithoutCaption = true,
  iframeWithoutCaption = true,
  iframeTypeBlockquoteWithoutCaption = true,
}).use(mditAttrs).use(mditRndererFence);
```

```
[Markdown]
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
[HTML]
<figure class="f-embed">
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</figure>


[Markdown]
Video. A youtube.

<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
[HTML]
<figure class="f-embed">
<figcaption><span class="f-video-label">Video<span class="f-video-label-joint">.</span></span> A youtube.</figcaption>
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/XXXXXXXXXXX" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</figure>


[Markdown]
<blockquote class="mastodon-embed" data-embed-url="https://mastodon.social/@xxxx/xxxx/embed" ...>xxxxxxxxxxxxxxxx</blockquote> <script data-allowed-prefixes="https://mastodon.social/" async src="https://mastodon.social/embed.js"></script>

[HTML]
<figure class="f-embed">
<blockquote class="mastodon-embed" data-embed-url="https://mastodon.social/@xxxx/xxxx/embed" ...>xxxxxxxxxxxxxxxx</blockquote> <script data-allowed-prefixes="https://mastodon.social/" async src="https://mastodon.social/embed.js"></script>
</figure>
```