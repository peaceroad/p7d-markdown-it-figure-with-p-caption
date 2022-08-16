# p7d-markdown-it-figure-with-p-caption

This is a markdown-it plugin.

For a paragraph with only one image, a table or code block or a blockquote, and by writing a caption paragraph immediately before or after, they are converted into the figure element with the figcaption element.

1. Check that the element: one image only paragraph, table, code block, samp block, blockquote, and video.
2. Check if this element has a caption paragraph immediately before or after it
3. If there is the caption paragraph, convert them to figure and figcaption element.

The figcaption behavior of this plugin depends on [p7d-markdown-it-p-captions](https://www.npmjs.com/package/p7d-markdown-it-p-captions).

Note. If code block language setting is "samp", change it to use samp element instead of code element.

Use it as follows.

```js
const md = require('markdown-it')();
const mdFigureWithPCaption = require('@peaceroad/markdown-it-figure-with-p-caption');

md.use(mdFigureWithPCaption);

console.log(md.render('Figure. A Cat.\n\n![Figure](cat.jpg)');
// <figure class="f-img">
// <figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Cat.</figcaption>
// <img src="cat.jpg" alt="Figure">
// </figure>
```

Also, It is recommended to set the width and height attributes of the images at the same time. See: [@peaceroad/markdown-it-renderer-image](https://www.npmjs.com/package/@peaceroad/markdown-it-renderer-image).

It could be applied to table, codeblock(pre > code, pre > samp), video as well.


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
<figure class="f-pre-code" role="doc-example">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> A Caption.</figcaption>
<pre><code class="language-js">console.log('Hello World!');
</code></pre>
</figure>
<p>A paragraph.</p>


[Markdown]
A paragraph.

Quote. A Caption.

> A quoted paragraph.

A paragraph.

[HTML]
<p>A paragraph.</p>
<figure class="f-blockquote">
<figcaption><span class="f-blockquote-label">Code<span class="f-blockquote-label-joint">.</span></span> A Caption.</figcaption>
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
<figure class="f-pre-samp" role="doc-example">
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
~~~


## Option: Specify file name

Specify the file name before writing the caption.
Note that a space is required between the file name and caption.

### Use double quote

```js

md.use(mdFigureWithPCaption, {dquoteFilename: true});
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
<figure class="f-pre-code" role="doc-example">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> <strong class="f-pre-code-filename">filename.js</strong> Call a cat.</figcaption>
<pre><code class="language-js">console.log('Nyaan!');
</code></pre>
</figure>
<p>A paragraph.</p>
~~~

### Use strong mark

```js
md.use(mdFigureWithPCaption, {strongFilename: true});
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
<figure class="f-pre-code" role="doc-example">
<figcaption><span class="f-pre-code-label">Code<span class="f-pre-code-label-joint">.</span></span> <strong class="f-pre-code-filename">filename.js</strong> Call a cat.</figcaption>
<pre><code class="language-js">console.log('Nyaan!');
</code></pre>
</figure>
<p>A paragraph.</p>
~~~

## Option: Convert one image paragraph without caption

Convert one image paragraph without a caption paragraph to figure element.

```js
md.use(mdFigureWithPCaption, {oneImageWithoutCaption: true});
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
