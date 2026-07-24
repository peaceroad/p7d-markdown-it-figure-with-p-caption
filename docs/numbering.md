# Automatic numbering and integration API

This document describes automatic numbering, chapter and appendix scopes,
frontmatter and render overrides, and the public numbering integration API.
For general behavior and options, see the [behavior reference](reference.md).
For installation and the minimum setup, start with the
[project README](../README.md).

## Contents

- [Automatic numbering](#automatic-numbering)
- [Chapter and appendix scopes](#chapter-and-appendix-scopes)
- [Caption-numbering integration API](#caption-numbering-integration-api)

## Automatic numbering

Automatic numbering is disabled by default.

- `autoLabelNumberSets`: strict caption-mark allowlist. Supported entries are `img`, `table`, `code` / `pre-code`, `samp` / `pre-samp`, and `video`; aliases are deduplicated to their canonical marks.
- `autoLabelNumber`: shorthand for turning numbering on for both images and tables without passing the array yourself. Provide `autoLabelNumberSets` explicitly (e.g., `['img']`) when you need finer control—the explicit array always wins.
- Recognized chapter/appendix scopes are applied automatically whenever at least one mark is numbered. By default, parsed `env.frontmatter.title` values and top-level H1 headings are sources, repeated semantic scopes continue their prior counters, and `.` joins the scope prefix to the local number.
- `autoLabelNumberPolicy`: customize the automatic scope, separator, and repeated-scope behavior without enabling any media type by itself. Use `scope: 'document'` for document-wide decimal counters regardless of recognized headings/frontmatter.
- Do not pass p-captions' lower-level `setFigureNumber` option to this plugin. Figure numbering is owned by `autoLabelNumber` / `autoLabelNumberSets`; `setFigureNumber` is rejected during the initial setup to prevent two numbering systems from mutating the same caption.
- An explicit `[]` disables numbering even when `autoLabelNumber` is true. Explicit `undefined`, `null`, non-arrays, unsupported marks, and invalid entries throw during initial setup instead of being silently ignored.
- Numbering enablement follows `captionDecision.mark`, not the wrapper class. A known video iframe with a `Figure.` caption requires `img`; the same iframe with `Video.` requires `video`. An unknown iframe with an explicit `Video.` caption also uses the video counter, while its wrapper remains `f-iframe`.
- Counters start at `1` and use semantic series independent of wrapper/label classes: `img` uses `figure`, `pre-code` uses `listing`, `video` uses `video`, and `table` uses `table`. A `pre-samp` caption uses the figure series when its source label is also an image label (`図`), the listing series when it is also a code label (`リスト`), and otherwise its own samp series (`端末`, `Terminal`, etc.). The overlap check reuses p-captions' active language catalog rather than hardcoded label text.
- A disabled mark never advances a shared series. Therefore image/`図` samp captions or code/`リスト` samp captions share source-order numbering only when both canonical marks are enabled.
- The counter only advances when a real caption exists (paragraph, auto-detected alt/title, or fallback text). Figures emitted solely because of `imageOnlyParagraphWithoutCaption` / `oneImageWithoutCaption` stay unnumbered.
- Manual numbers inside the caption text (e.g., `Figure 5.`) always win. The plugin reads the exact `captionDecision.number` supplied by `p7d-markdown-it-p-captions` and updates the selected semantic series so the next automatic number becomes `6`, even when the next caption has a different mark sharing that series. Explicit compound/alphanumeric numbers (e.g., `Figure A.` or `Figure A.5.`) are preserved without appending an automatic number and do not seed an unscoped decimal counter. This applies to captions sourced from paragraphs, auto detection, and fallback captions.
- With `removeUnnumberedLabel: true`, the enabled-set filter uses the canonical decision mark, not its semantic counter key. For example a samp block labeled `図` still needs `samp` / `pre-samp` in `removeUnnumberedLabelExceptMarks`, not `img`.
- Number generation and label-token construction now share p-captions' policy/runtime engine. The source-only `captionDecision` remains unchanged when a number is generated, and callback/configuration failures occur before this plugin commits caption-token or counter changes.
- Generated numbers must remain inside p-captions' caption-number grammar. In particular, advancing `999999` to a seven-digit segment throws a `RangeError` before the affected caption is mutated.

### Chapter and appendix scopes

The default policy derives a display prefix and an independent counter sequence
from top-level H1 headings and parsed per-render frontmatter metadata:

```js
const md = mdit({ html: true }).use(mditFigureWithPCaption, {
  autoLabelNumber: true,
})
```

```md {test id="numbering-default-scope" setup="numbered"}
# Chapter 1: Introduction

Figure. Architecture

![Architecture](architecture.png)
```

```html {test id="numbering-default-scope"}
<h1>Chapter 1: Introduction</h1>
<figure class="f-img">
<figcaption><span class="f-img-label">Figure 1.1<span class="f-img-label-joint">.</span></span> Architecture</figcaption>
<img src="architecture.png" alt="Architecture">
</figure>
```

Customize the policy when the document uses another heading level, needs one
source only, resets repeated scope occurrences, or uses `-`:

```js
const md = mdit({ html: true }).use(mditFigureWithPCaption, {
  autoLabelNumber: true,
  autoLabelNumberPolicy: {
    separator: '-',
    scope: {
      sources: ['heading'],
      headingLevels: [2],
      repeatScope: 'reset',
    },
  },
})
```

Within a scope object, `sources` defaults to `['frontmatter', 'heading']`,
`headingLevels` to `[1]`, and `repeatScope` to `'continue'`. `scope: 'auto'`
selects those defaults. An explicit `sources: []` disables inferred sources
while still allowing a fixed render-level scope.

Recognized leading scope forms are `Chapter N`, `第N章`, `N章`, `Appendix N`, `Appendix A`, and `付録` / `付属` / `附属` followed by a digit or one uppercase ASCII letter. English keywords are case-insensitive. The marker must end at the same spaced/compact caption boundary used by p-captions, so prose such as `Chapter 1st`, `Appendix API`, or `第1章立て` is not mistaken for a scope. Formatting after a valid boundary is allowed (`# Chapter 1: *Introduction*`), but formatting the marker itself (`# **Chapter 1**`) and ambiguous inline-token continuations fail closed.

- Only configured top-level heading levels update scope. Headings inside blockquotes/lists do not become scope sources in this release, although figures inside those containers inherit the current top-level scope.
- Captions before the first recognized scope use the ordinary unscoped decimal sequence.
- With `repeatScope: 'continue'`, a repeated semantic scope resumes its prior per-mark counter. With `repeatScope: 'reset'`, every scope occurrence gets a new render-local counter partition even when its displayed prefix is identical.
- In scoped mode, an explicit number seeds the counter only when it uses the active prefix and separator (for example, `Figure 2.5.` under `Chapter 2` with the default separator). Other explicit numbers are preserved as source text but do not seed that sequence.
- To retain document-wide numbering for every render, set `autoLabelNumberPolicy: { scope: 'document' }`. Explicit `autoLabelNumberPolicy: null` remains an equivalent compatibility opt-out. Per-render frontmatter/env overrides described below can still select `document` when automatic scope is configured.

The canonical frontmatter input is parsed metadata supplied per render as `env.frontmatter.title`:

```js
md.render(source, { frontmatter: { title: 'Appendix A: Data' } })
```

This plugin does not register a frontmatter block rule and does not parse YAML. If the host already produces a `front_matter` token, provide `resolveFrontmatterTitle(raw, state)` to adapt its raw string. Resolver errors and non-string results fail closed to the unscoped sequence. `markdown-it-front-matter` is used only as a development/integration-test adapter here; adding that detector alone does not parse a YAML `title`.

```js
autoLabelNumberPolicy: {
  scope: {
    resolveFrontmatterTitle(raw, state) {
      const match = raw.match(/^title:\s*(.+)$/m)
      return match ? match[1] : null
    },
  },
}
```

Parsed frontmatter may override the configured scope mode and separator for one document through the nested `figure-caption-numbering` object:

```yaml
---
title: Chapter 1. A title
figure-caption-numbering:
  scope: auto
  separator: "."
---
```

The equivalent render input is:

```js
md.render(source, {
  frontmatter: {
    title: 'Chapter 1. A title',
    'figure-caption-numbering': {
      scope: 'auto',
      separator: '.',
    },
  },
})
```

The equivalent flattened form is also accepted when a frontmatter pipeline exposes dotted keys:

```yaml
---
title: Chapter 1. A title
figure-caption-numbering.scope: auto
figure-caption-numbering.separator: "."
---
```

Nested and dotted properties may be combined when they configure different fields, but defining the same logical field twice throws instead of choosing an ambiguous winner. Abbreviated aliases are intentionally not recognized.

`scope: 'auto'` uses the heading/frontmatter sources enabled by
`autoLabelNumberPolicy.scope`; its default sources are parsed frontmatter
titles and top-level H1 headings. It does not re-enable a source removed by an
explicit `sources` array. `scope: 'document'` fixes the render to the unscoped
per-series counters, so a recognized `Chapter 1` still produces `Figure 1`,
`Figure 2`, and so on. `separator` accepts only `.` or `-` and overrides the
setup-time separator for that render. The default is `.`, so `Chapter 1`
produces `Figure 1.1`; select `-` for `Figure 1-1`.

Unknown nested properties, invalid values, and duplicate nested/dotted definitions throw before caption mutation.

A host may override parsed frontmatter through `env.figureCaptionNumbering`. Its `scope` may be `'auto'`, `'document'`, or a validated fixed scope object. A render-level `separator` takes precedence over parsed frontmatter, which in turn takes precedence over `autoLabelNumberPolicy.separator`:

```js
md.render(source, {
  figureCaptionNumbering: {
    separator: '.',
    scope: {
      scopeKey: 'chapter:7',
      sequenceKey: 'edition-2:chapter:7',
      displayPrefix: '7',
    },
  },
})
```

When `sequenceKey` is omitted from a fixed scope it defaults to `scopeKey`; specify it when semantic identity and counter partition must differ. Invalid explicit overrides throw before caption mutation rather than silently falling back to the unscoped sequence.

### Caption-numbering integration API

Source editors and other markdown-it integrations can reuse the figure-specific numbering semantics without importing the renderer walker:

```js
import {
  createFigureCaptionCounterKeyResolver,
  createFigureCaptionNumberCodec,
  createFigureCaptionScopeTimeline,
  normalizeFigureCaptionNumberingPolicy,
} from '@peaceroad/markdown-it-figure-with-p-caption/caption-numbering.js'
```

- `normalizeFigureCaptionNumberingPolicy(value)` applies the same validation and defaults as `autoLabelNumberPolicy`. `undefined` or an object with no scope fields uses the automatic defaults; `scope: 'document'` creates an unscoped policy. Only explicit `null` returns `null`; otherwise the helper returns an opaque frozen policy that must be passed to the timeline API.
- `createFigureCaptionScopeTimeline(state, policy)` reads a markdown-it `StateCore` after inline parsing and returns the initial numbering context plus frozen, source-ordered top-level heading boundaries. It applies the same parsed-frontmatter, render override, heading level, marker boundary, separator, and repeat-scope rules as the renderer. It never mutates `state`, its tokens, or inline children. A recognized heading without a usable `token.map` sets `hasUnmappableBoundaries` so a source editor can fail closed rather than guess an edit range.
- `createFigureCaptionCounterKeyResolver({ languages })` returns a frozen resolver from a p-captions `captionDecision` to the same semantic `figure` / `listing` / `samp` / `video` / `table` series used by this plugin. The language catalog is normalized once when the resolver is created.
- `createFigureCaptionNumberCodec()` returns a frozen stateless codec. `parseExplicit(number, context)` returns the compatible positive decimal counter value or `null`; `format(sequence, context)` generates the scoped or unscoped number and enforces p-captions' number grammar. Contexts are branded frozen values returned by the timeline API, so arbitrary look-alike objects are rejected.

Create the timeline inside a core rule so the real `StateCore`, including `env` and inline children, stays available:

```js
const policy = normalizeFigureCaptionNumberingPolicy({
  separator: '.',
  scope: {
    sources: ['frontmatter', 'heading'],
    headingLevels: [1],
    repeatScope: 'continue',
  },
})

md.core.ruler.after('inline', 'collect_figure_caption_scopes', (state) => {
  const timeline = createFigureCaptionScopeTimeline(state, policy)
  // Collect source edits here or store the immutable timeline in render-local state.
  state.env.figureCaptionScopeTimeline = timeline
})
```

This subpath intentionally does not expose figure-candidate detection, wrapping, or token mutation. `p7d-markdown-it-p-captions` still owns caption grammar and `captionDecision`; consumers own source selection and editing.

For complete rendered samples and configuration variations, see
[Complete conversion and option examples](examples.md).
