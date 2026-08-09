import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import mditFootnoteHere from '@peaceroad/markdown-it-footnote-here'
import mditSemanticContainer from '@peaceroad/markdown-it-hr-sandwiched-semantic-container'
import mditFigureWithPCaption from '../index.js'

const markdownTable = (content = 'value') => (
  `| Value |\n| --- |\n| ${content} |`
)

const malformedNoteListPlugin = (md) => {
  md.core.ruler.before('replacements', 'test_malformed_note_list', (state) => {
    const closeIndex = state.tokens.findIndex((token) => token.type === 'list_item_close')
    if (closeIndex >= 0) state.tokens.splice(closeIndex, 1)
  })
}

const createMd = (options = {}, before = [], after = []) => {
  const md = mdit()
  for (let i = 0; i < before.length; i++) md.use(before[i])
  md.use(mditFigureWithPCaption, {
    notes: { enabled: true },
    ...options,
  })
  for (let i = 0; i < after.length; i++) md.use(after[i])
  return md
}

const readRenderFixtures = (url) => {
  const source = readFileSync(url, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const chunks = source.split('[Markdown]\n').slice(1)
  return chunks.map((chunk, index) => {
    const separator = '\n[HTML]\n'
    const htmlStart = chunk.indexOf(separator)
    assert.notEqual(htmlStart, -1, `Notes fixture ${index + 1} has no [HTML] section.`)
    return {
      markdown: chunk.slice(0, htmlStart).replace(/\n+$/, ''),
      html: `${chunk.slice(htmlStart + separator.length).replace(/\n+$/, '')}\n`,
    }
  })
}

{
  const md = createMd()
  const fixtures = readRenderFixtures(
    new URL('./examples-figure-annotations-and-local-notes.txt', import.meta.url),
  )
  for (let i = 0; i < fixtures.length; i++) {
    assert.equal(
      md.render(fixtures[i].markdown),
      fixtures[i].html,
      `Notes render fixture ${i + 1} failed.`,
    )
  }
  console.log(`Passed ${fixtures.length} notes render fixtures.`)
}

{
  const baseline = mdit().use(mditFigureWithPCaption)
  assert.equal(
    baseline.render('![x](a.png)\n\n出典：Example\n'),
    '<p><img src="a.png" alt="x"></p>\n<p>出典：Example</p>\n',
  )
}

{
  const md = mdit().use(mditFigureWithPCaption, {
    notes: {
      enabled: true,
      annotations: false,
      unreferencedLocalNotes: false,
      referencedLocalNotes: false,
    },
  })
  assert.equal(
    md.render('![x](a.png)\n\n出典：Example\n'),
    '<p><img src="a.png" alt="x"></p>\n<p>出典：Example</p>\n',
  )
}

{
  const md = createMd()
  assert.match(md.render('![x](a.png)\n\n提供：Team\n'), /f-annotation f-credit/)
  assert.match(md.render('![x](a.png)\n\n© 2026 Team\n'), /f-annotation f-rights/)
  assert.match(md.render('![x](a.png)\n\nData source: Dataset\n'), /f-annotation f-source/)
  assert.match(md.render('![x](a.png)\n\nSOURCE: Dataset\n'), /f-annotation f-source/)
  assert.match(md.render('![x](a.png)\n\nデータ出典：Dataset\n'), /f-annotation f-source/)
  assert.match(md.render('![a](a.png) ![b](b.png)\n\n提供：Team\n'), /f-img-horizontal[\s\S]*f-annotation f-credit/)
}

{
  const md = createMd({ languages: ['ja'] })
  assert.match(md.render('![x](a.png)\n\n出典：Example\n'), /<figure/)
  assert.doesNotMatch(md.render('![x](a.png)\n\nSource: Example\n'), /<figure/)
}

{
  const md = createMd({
    notes: {
      enabled: true,
      annotations: false,
      unreferencedLocalNotes: true,
      referencedLocalNotes: false,
    },
  })
  const output = md.render('![x](a.png)\n\n図注：Note.\n\n出典：Dataset\n')
  assert.match(output, /f-local-notes/)
  assert.doesNotMatch(output, /f-annotation/)
  assert.match(output, /<p>出典：Dataset<\/p>/)
}

{
  const md = createMd()
  const paragraphTokens = md.parse('![x](a.png)\n\n図注：全体への注。\n', {})
  const paragraphFigureOpen = paragraphTokens.find((token) => token.type === 'figure_open')
  const paragraphAsideOpen = paragraphTokens.find((token) => token.type === 'figure_local_notes_open')
  const paragraphNoteOpen = paragraphTokens.find((token) => token.type === 'figure_local_note_open')
  assert.equal(paragraphAsideOpen.level, paragraphFigureOpen.level + 1)
  assert.equal(paragraphNoteOpen.level, paragraphAsideOpen.level + 1)

  const listTokens = md.parse('![x](a.png)\n\n- 図注1：一つ。\n- 図注2：二つ。\n', {})
  const listAsideOpen = listTokens.find((token) => token.type === 'figure_local_notes_open')
  const listOpen = listTokens.find((token) => token.type === 'bullet_list_open')
  assert.equal(listOpen.level, listAsideOpen.level + 1)

  assert.match(
    md.render('![x](a.png)\n\n図注1234567：Long decimal suffix.\n'),
    /f-local-notes/,
  )
  assert.doesNotMatch(
    md.render('![x](a.png)\n\n図注abc：Lowercase suffix.\n'),
    /f-local-notes/,
  )
}

{
  const md = createMd()
  const notes = Array.from({ length: 260 }, (_, index) => (
    `- 図注${index + 1}：Note ${index + 1}.`
  )).join('\n')
  const output = md.render(`![x](a.png)\n\n${notes}\n`)
  assert.match(output, /<figure class="f-img">/)
  assert.equal((output.match(/class="f-local-note"/g) || []).length, 260)
}

{
  const md = createMd({}, [malformedNoteListPlugin])
  const output = md.render('![x](a.png)\n\n- 図注：Malformed.\n')
  assert.doesNotMatch(output, /f-local-notes/)
}

{
  const md = createMd()
  const tokens = md.parse('![x](a.png)\n\nFigure. Caption\n\nSource: Dataset\n', {})
  const figureOpen = tokens.find((token) => token.type === 'figure_open')
  const captionOpen = tokens.find((token) => token.type === 'figcaption_open')
  const annotationOpen = tokens.find((token) => token.type === 'figure_annotation_open')
  assert.equal(captionOpen.level, figureOpen.level + 1)
  assert.equal(annotationOpen.level, captionOpen.level + 1)
  assert.deepEqual(figureOpen.map, [0, 5])
}

{
  const md = createMd({
    labelPrefixMarker: ['▼', '▲'],
    allowLabelPrefixMarkerWithoutLabel: true,
  })
  const output = md.render('![x](a.png)\n\n▲Caption\n\nSource: Dataset\n')
  assert.match(output, /<figcaption>Caption<p class="f-annotation f-source">/)
}

{
  const md = createMd()
  const output = md.render('![Figure. Automatic](a.png)\n\nSource: Dataset\n')
  assert.match(output, /<figcaption>[\s\S]*Figure/)
  assert.ok(output.indexOf('</figcaption>') < output.indexOf('f-annotation'))
}

{
  const env = {}
  const md = createMd()
  const output = md.render('![x](a.png)\n\n出典：A\n\n提供：B\n', env)
  assert.equal((output.match(/f-annotation /g) || []).length, 2)
  assert.match(output, /f-source/)
  assert.match(output, /f-credit/)
  assert.equal(env.figureNotesDiagnostics, undefined)
}

{
  const md = createMd()
  const env = { locale: 'ja' }
  const source = `${markdownTable('[^tn-1] and [^tn-1]')}\n\n[^tn-1]: 暫定値。\n\nデータ：Dataset\n`
  const output = md.render(source, env)
  assert.match(output, /<figure class="f-table">/)
  assert.match(output, /class="f-local-note-ref"/)
  assert.match(output, /<aside class="f-local-notes f-table-notes" aria-label="表注">/)
  assert.match(output, /class="f-local-note-backlink"/)
  assert.match(output, /f-annotation f-source/)
  assert.equal(env.figureNotesDiagnostics, undefined)
  assert.equal(md.render(source, env), output)
}

{
  for (const captionBefore of [false, true]) {
    const md = createMd()
    const env = {}
    const caption = 'Table. Caption [^tn-caption]'
    const tableAndNotes = `${markdownTable()}\n\n[^tn-caption]: Caption note.`
    const source = captionBefore
      ? `${caption}\n\n${tableAndNotes}\n`
      : `${tableAndNotes}\n\n${caption}\n`
    const output = md.render(source, env)
    assert.match(output, /<figcaption>[\s\S]*class="f-local-note-ref"/)
    assert.match(output, /<aside class="f-local-notes f-table-notes"/)
    assert.equal(env.figureNotesDiagnostics, undefined)
  }
}

{
  const md = createMd()
  const output = md.render(
    `Table. Caption [^tn-order]\n\n${markdownTable('[^tn-order]')}\n\n[^tn-order]: Ordered backlinks.\n`,
  )
  const occurrences = Array.from(
    output.matchAll(/id="table-local-1-ref-1-(\d+)"/g),
    match => Number(match[1]),
  )
  assert.deepEqual(occurrences, [1, 2])
}

{
  const md = createMd()
  const references = Array.from({ length: 28 }, () => '[^tn-many]').join(' ')
  const output = md.render(
    `${markdownTable(references)}\n\n[^tn-many]: Many backlinks.\n`,
  )
  assert.match(output, />↩z<\/a>/)
  assert.match(output, />↩aa<\/a>/)
  assert.match(output, />↩ab<\/a>/)
}

{
  const md = createMd({
    labelPrefixMarker: ['▼', '▲'],
    allowLabelPrefixMarkerWithoutLabel: true,
  })
  const env = {}
  const output = md.render(
    `${markdownTable()}\n\n[^tn-marker]: Marker caption note.\n\n▲Caption [^tn-marker]\n`,
    env,
  )
  assert.match(output, /<figcaption>Caption <a [^>]*class="f-local-note-ref"/)
  assert.equal(env.figureNotesDiagnostics, undefined)
}

{
  const md = createMd()
  const source = `${markdownTable('[^table-a]')}\n\n[^table-a]: Note.\n`
  const tokens = md.parse(source, {})
  const english = md.renderer.render(tokens, md.options, { locale: 'en' })
  const japanese = md.renderer.render(tokens, md.options, { locale: 'ja' })
  const preferredJapanese = md.renderer.render(
    tokens,
    md.options,
    { preferredLocales: ['unknown', 'ja-JP'] },
  )
  assert.match(english, /class="f-local-note-ref"/)
  assert.match(english, /aria-label="Table notes"/)
  assert.match(japanese, /aria-label="表注"/)
  assert.match(preferredJapanese, /aria-label="表注"/)

  const japaneseOnlyMd = createMd({ languages: ['ja'] })
  assert.match(
    japaneseOnlyMd.render(source),
    /aria-label="表注"/,
  )
}

{
  for (const footnoteBefore of [false, true]) {
    const md = mdit()
    if (footnoteBefore) md.use(mditFootnoteHere)
    md.use(mditFigureWithPCaption, { notes: { enabled: true } })
    if (!footnoteBefore) md.use(mditFootnoteHere)
    const output = md.render(
      `${markdownTable('[^tn-a] and ordinary[^1]')}\n\n[^tn-a]: Local.\n\n[^1]: Ordinary.\n`,
    )
    assert.match(output, /f-local-note-ref/)
    assert.match(output, /class="fn-noteref"/)
    assert.match(output, /class="fn"/)
  }
}

{
  const md = createMd()
  const source = [
    '> | Value |',
    '> | --- |',
    '> | A[^tn-nested] |',
    '>',
    '> [^tn-nested]: Nested note.',
    '',
  ].join('\n')
  const output = md.render(source)
  assert.match(output, /<blockquote>\n<figure class="f-table">/)
  assert.match(output, /class="f-local-note-ref"/)
  assert.match(output, /Nested note\./)
}

{
  const env = {}
  const md = createMd()
  const source = 'Plain paragraph.\n\n[^tn-1]: Orphan.\n'
  const output = md.render(source, env)
  assert.equal(output, mdit().render(source))
  assert.equal(env.figureNotesDiagnostics, undefined)
  md.render('Plain paragraph.\n', env)
  assert.equal(env.figureNotesDiagnostics, undefined)
}

{
  const env = {}
  const md = createMd()
  const output = md.render(
    `${markdownTable('[^tn-code]')}\n\n    [^tn-code]: Indented code, not a local definition.\n`,
    env,
  )
  assert.doesNotMatch(output, /f-local-note-ref/)
  assert.match(output, /<pre><code>\[\^tn-code\]: Indented code, not a local definition\./)
  assert.equal(env.figureNotesDiagnostics, undefined)
}

{
  const env = { docId: '文書😀' }
  const md = createMd()
  const output = md.render(`${markdownTable('[^tn-1]')}\n\n[^tn-1]: Note.\n`, env)
  assert.match(output, /%E6%96%87%E6%9B%B8%F0%9F%98%80-table-local-1-note-1/)
}

{
  const env = {}
  const md = createMd()
  const output = md.render(
    `${markdownTable('[^tn-a]')}\n\n[^tn-a]: First.\n\n${markdownTable('[^tn-a]')}\n\n[^tn-a]: Second.\n`,
    env,
  )
  assert.match(output, /table-local-1-note-1/)
  assert.match(output, /table-local-2-note-1/)
  assert.doesNotMatch(output, /table-local-1-note-2/)
  assert.equal(env.figureNotesDiagnostics, undefined)
}

{
  const env = {}
  const md = createMd()
  const output = md.render(
    `${markdownTable('[^tn-a]')}\n\n[^tn-a]: First.\n[^tn-a]: Duplicate.\n`,
    env,
  )
  assert.match(output, /\[\^tn-a\]: First\./)
  assert.equal(env.figureNotesDiagnostics[0].code, 'duplicate-definition')
  assert.doesNotMatch(output, /f-local-note-ref/)
  md.render('Plain paragraph.\n', env)
  assert.deepEqual(env.figureNotesDiagnostics, [])
}

{
  const env = {}
  const md = createMd()
  md.render(
    `${markdownTable('[^tn-b]')}\n\n[^tn-a]: First.\n\n${markdownTable('[^tn-b]')}\n\n[^tn-b]: Second.\n`,
    env,
  )
  assert.ok(env.figureNotesDiagnostics.some(({ code }) => code === 'undefined-reference'))
  assert.ok(env.figureNotesDiagnostics.some(({ code }) => code === 'unreferenced-definition'))
  assert.ok(!env.figureNotesDiagnostics.some(({ code }) => code === 'scope-outside-reference'))
}

{
  const env = {}
  const md = createMd()
  const output = md.render(
    `Outside [^tn-a].\n\n${markdownTable()}\n\n[^tn-a]: Local.\n`,
    env,
  )
  assert.match(output, /Outside \[\^tn-a\]\./)
  assert.ok(env.figureNotesDiagnostics.some(({ code }) => code === 'scope-outside-reference'))
}

{
  const md = mdit({ html: false })
    .use(mditFigureWithPCaption, { notes: { enabled: true } })
  const output = md.render(
    `${markdownTable('[^tn-a]')}\n\n[^tn-a]: <script>alert(1)</script>\n\n出典：<b>Dataset</b>\n`,
  )
  assert.doesNotMatch(output, /<script>|<b>/)
  assert.match(output, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(output, /&lt;b&gt;Dataset&lt;\/b&gt;/)
}

{
  const md = mdit()
    .use(mditFigureWithPCaption, { notes: { enabled: true } })
    .use(mditFootnoteHere)
  const output = md.render('Standalone[^tn-a].\n\n[^tn-a]: Ordinary footnote.\n')
  assert.match(output, /class="fn-noteref"/)
  assert.doesNotMatch(output, /f-local-note-ref/)
}

{
  for (const semanticBefore of [false, true]) {
    const md = mdit()
    if (semanticBefore) md.use(mditSemanticContainer)
    md.use(mditFigureWithPCaption, { notes: { enabled: true } })
    if (!semanticBefore) md.use(mditSemanticContainer)
    assert.match(md.render('![x](a.png)\n\nクレジット：Team\n'), /f-annotation f-credit/)
    assert.match(md.render('クレジット：Team\n'), /sc-credits/)
    const annotations = md.render('![x](a.png)\n\nクレジット：A\n\n提供：B\n')
    assert.equal((annotations.match(/f-annotation /g) || []).length, 2)
    assert.doesNotMatch(annotations, /sc-credits/)
  }
}

{
  for (const attrsBefore of [false, true]) {
    const md = mdit()
    if (attrsBefore) md.use(mditAttrs)
    md.use(mditFigureWithPCaption, { notes: { enabled: true } })
    if (!attrsBefore) md.use(mditAttrs)
    assert.match(
      md.render('![x](a.png)\n\n出典：Dataset {.custom}\n'),
      /<p class="custom f-annotation f-source">/,
    )
  }
}

assert.throws(
  () => mdit().use(mditFigureWithPCaption, { notes: true }),
  /notes must be an object/,
)

for (const preset of ['commonmark', 'zero']) {
  assert.doesNotThrow(() => mdit(preset).use(mditFigureWithPCaption, { notes: { enabled: true } }))
}
assert.throws(
  () => mdit().use(mditFigureWithPCaption, { notes: { enabled: 'true' } }),
  /notes.enabled must be a boolean/,
)
assert.throws(
  () => mdit().use(mditFigureWithPCaption, { notes: { enabled: undefined } }),
  /notes.enabled must be a boolean/,
)
assert.throws(
  () => mdit().use(mditFigureWithPCaption, {
    notes: { enabled: true, annotations: null },
  }),
  /notes.annotations must be a boolean/,
)
assert.throws(
  () => mdit().use(mditFigureWithPCaption, { notes: { enabled: true, unknown: true } }),
  /notes.unknown is not supported/,
)

console.log('Figure notes tests passed.')
