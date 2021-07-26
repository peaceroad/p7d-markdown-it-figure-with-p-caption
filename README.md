# p7d-markdown-it-figure-with-p-caption

This is a markdown-it plugin. The behavior of this plugin depends on [markdown-it-p-captions](https://www.npmjs.com/package/p7d-markdown-it-p-captions).

By using this plugin, you can generate a figure element with a figcaption element.

1. A Paragraph with only one image are converted to figure element.
2. The caption paragraph immediately before or after this figure element is converted to be inside the figure element.

Use it as follows.

```js
const md = require('markdown-it')();
const mdPCaption = require('p7d-markdown-it-p-captions');
const mdFigureWithPCaption = require('@peaceroad/markdown-it-figure-with-p-caption');

md.use(mdPCaption, {'classPrefix': 'f'}).use(mdFigureWithPCaption);

console.log(md.render('Figure. A Cat.\n\n![Figure](cat.jpg)');
// <figure class="f-img">
// <figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Cat.</figcaption>
// <img src="cat.jpg" alt="Figure">
// </figure>
```

It could be applied to table, codeblock(pre > code), video, audio as well.

Example:


~~~
[Markdown]
![Figure](figure.jpg)

[HTML]
<figure class="f-img">
<img src="figure.jpg" alt="Figure">
</figure>


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
~~~