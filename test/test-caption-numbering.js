import assert from 'assert'
import mdit from 'markdown-it'
import mditFrontMatter from 'markdown-it-front-matter'

import mdFigureWithPCaption from '../index.js'

let pass = true

const runTest = (name, test) => {
  console.log(`Test: ${name}`)
  try {
    test()
  } catch (error) {
    pass = false
    console.error(`Failed: ${name}`)
    console.error(error)
  }
}
console.log('=== Caption numbering tests ===')

const getNumberedLabels = (html, label) => Array.from(
  html.matchAll(new RegExp('>' + label + ' ?([A-Z0-9.-]+)<span', 'g')),
  match => match[1],
)

const installSyntheticPreBlocks = (md) => {
  md.core.ruler.before('replacements', 'synthetic_pre_blocks', (state) => {
    for (let index = 0; index + 2 < state.tokens.length; index++) {
      const open = state.tokens[index]
      const inline = state.tokens[index + 1]
      const close = state.tokens[index + 2]
      if (
        open.type !== 'paragraph_open' || inline.type !== 'inline' || close.type !== 'paragraph_close' ||
        (inline.content !== '[[pre-code]]' && inline.content !== '[[pre-samp]]')
      ) continue
      const childTag = inline.content === '[[pre-samp]]' ? 'samp' : 'code'
      const baseLevel = open.level
      const preOpen = new state.Token('pre_open', 'pre', 1)
      const childOpen = new state.Token(childTag + '_open', childTag, 1)
      const content = new state.Token('text', '', 0)
      const childClose = new state.Token(childTag + '_close', childTag, -1)
      const preClose = new state.Token('pre_close', 'pre', -1)
      preOpen.block = true
      preClose.block = true
      preOpen.level = baseLevel
      childOpen.level = baseLevel + 1
      content.level = baseLevel + 2
      childClose.level = baseLevel + 1
      preClose.level = baseLevel
      content.content = 'synthetic\n'
      preOpen.map = open.map
      preClose.map = open.map
      state.tokens.splice(index, 3, preOpen, childOpen, content, childClose, preClose)
      index += 4
    }
  })
}

runTest('code/samp semantic counter series', () => {
  const figureAndSampSource = [
    '![A](a.jpg)',
    '図　Image one',
    '図　Samp figure',
    '```console\nx\n```',
    '![B](b.jpg)',
    '図　Image two',
  ].join('\n\n')
  const bothHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img', 'samp'],
  }).render(figureAndSampSource)
  assert.deepStrictEqual(getNumberedLabels(bothHtml, '図'), ['1', '2', '3'])
  assert.ok(bothHtml.includes('<figure class="f-pre-samp">'))

  const sampOnlyHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['samp'],
  }).render(figureAndSampSource)
  assert.deepStrictEqual(getNumberedLabels(sampOnlyHtml, '図'), ['1'])

  const imgOnlyHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img'],
  }).render(figureAndSampSource)
  assert.deepStrictEqual(getNumberedLabels(imgOnlyHtml, '図'), ['1', '2'])

  const listingSource = [
    'Code. Code one.',
    '```js\nx\n```',
    'リスト　Samp listing',
    '```console\ny\n```',
    'Code. Code three.',
    '```js\nz\n```',
  ].join('\n\n')
  const listingHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['code', 'pre-code', 'samp', 'pre-samp'],
  }).render(listingSource)
  assert.deepStrictEqual(getNumberedLabels(listingHtml, 'Code'), ['1', '3'])
  assert.deepStrictEqual(getNumberedLabels(listingHtml, 'リスト'), ['2'])

  const separateSampHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img', 'code', 'samp'],
  }).render([
    '![A](a.jpg)',
    '図　Figure one',
    '端末　Samp one',
    '```console\nx\n```',
    'Code. Listing one.',
    '```js\ny\n```',
  ].join('\n\n'))
  assert.deepStrictEqual(getNumberedLabels(separateSampHtml, '図'), ['1'])
  assert.deepStrictEqual(getNumberedLabels(separateSampHtml, '端末'), ['1'])
  assert.deepStrictEqual(getNumberedLabels(separateSampHtml, 'Code'), ['1'])

  const manualHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['code'],
  }).render([
    'Code 5. Manual.',
    '```js\nx\n```',
    'Code 2. Lower.',
    '```js\ny\n```',
    'Code. Next.',
    '```js\nz\n```',
  ].join('\n\n'))
  assert.deepStrictEqual(getNumberedLabels(manualHtml, 'Code'), ['5', '2', '6'])

  const syntheticPreMd = mdit({ html: true })
    .use(installSyntheticPreBlocks)
    .use(mdFigureWithPCaption, { autoLabelNumberSets: ['code', 'samp'] })
  const syntheticPreHtml = syntheticPreMd.render([
    'Code. Synthetic code.',
    '[[pre-code]]',
    'Terminal. Synthetic samp.',
    '[[pre-samp]]',
  ].join('\n\n'))
  assert.deepStrictEqual(getNumberedLabels(syntheticPreHtml, 'Code'), ['1'])
  assert.deepStrictEqual(getNumberedLabels(syntheticPreHtml, 'Terminal'), ['1'])
  assert.strictEqual((syntheticPreHtml.match(/<figure class="f-pre">/g) || []).length, 2)
})

runTest('video caption numbering', () => {
  const videoSource = [
    'Video. Raw.',
    '<video src="raw.mp4">\n</video>',
    'Video. Unknown.',
    '<iframe src="https://example.com/embed"></iframe>',
    'Figure. Known as figure.',
    '<iframe src="https://www.youtube.com/embed/a"></iframe>',
    'Video. Known as video.',
    '<iframe src="https://www.youtube.com/embed/b"></iframe>',
  ].join('\n\n')
  const videoHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img', 'video'],
  }).render(videoSource)
  assert.deepStrictEqual(getNumberedLabels(videoHtml, 'Video'), ['1', '2', '3'])
  assert.deepStrictEqual(getNumberedLabels(videoHtml, 'Figure'), ['1'])
  assert.ok(videoHtml.includes('<figure class="f-iframe">\n<figcaption><span class="f-video-label">Video 2'))
  assert.strictEqual((videoHtml.match(/<figure class="f-video">/g) || []).length, 3)

  const videoOnlyHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['video'],
  }).render('Figure. Known figure label.\n\n<iframe src="https://www.youtube.com/embed/a"></iframe>')
  assert.deepStrictEqual(getNumberedLabels(videoOnlyHtml, 'Figure'), [])

  const captionlessThenNumbered = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['video'],
    videoWithoutCaption: true,
  }).render('<video src="a.mp4">\n</video>\n\nVideo. First.\n\n<video src="b.mp4">\n</video>')
  assert.deepStrictEqual(getNumberedLabels(captionlessThenNumbered, 'Video'), ['1'])

  const inlineVideoHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['video'],
  }).render('Video. Inline baseline.\n\n<video src="inline.mp4"></video>')
  assert.ok(!inlineVideoHtml.includes('<figure'))
})

runTest('numbering option precedence and setup', () => {
  const shorthandHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumber: true,
  }).render('Code. Not enabled.\n\n```js\nx\n```\n\n![A](a.jpg)\n\nFigure. Enabled.')
  assert.deepStrictEqual(getNumberedLabels(shorthandHtml, 'Code'), [])
  assert.deepStrictEqual(getNumberedLabels(shorthandHtml, 'Figure'), ['1'])

  const explicitWinsHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumber: true,
    autoLabelNumberSets: ['code'],
  }).render('Code. Enabled.\n\n```js\nx\n```\n\n![A](a.jpg)\n\nFigure. Disabled.')
  assert.deepStrictEqual(getNumberedLabels(explicitWinsHtml, 'Code'), ['1'])
  assert.deepStrictEqual(getNumberedLabels(explicitWinsHtml, 'Figure'), [])

  const explicitEmptyHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumber: true,
    autoLabelNumberSets: [],
  }).render('![A](a.jpg)\n\nFigure. Disabled.')
  assert.deepStrictEqual(getNumberedLabels(explicitEmptyHtml, 'Figure'), [])

  const copiedSets = ['code']
  const copiedMd = mdit({ html: true }).use(mdFigureWithPCaption, { autoLabelNumberSets: copiedSets })
  copiedSets[0] = 'video'
  assert.deepStrictEqual(getNumberedLabels(copiedMd.render('Code. Copied.\n\n```js\nx\n```'), 'Code'), ['1'])

  const removeSource = [
    '![A](a.jpg)',
    '図　Image',
    '図　Samp',
    '```console\nx\n```',
  ].join('\n\n')
  const exceptImgHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img', 'samp'],
    removeUnnumberedLabel: true,
    removeUnnumberedLabelExceptMarks: ['img'],
  }).render(removeSource)
  assert.deepStrictEqual(getNumberedLabels(exceptImgHtml, '図'), ['1'])
  assert.ok(!exceptImgHtml.includes('f-pre-samp-label'))
  const exceptSampHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img', 'samp'],
    removeUnnumberedLabel: true,
    removeUnnumberedLabelExceptMarks: ['samp'],
  }).render(removeSource)
  assert.deepStrictEqual(getNumberedLabels(exceptSampHtml, '図'), ['1'])
  assert.ok(!exceptSampHtml.includes('f-img-label'))

  const formattedHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['code'],
    strongLabel: true,
    wrapCaptionBody: true,
    removeMarkNameInCaptionClass: true,
  }).render('Code. Formatted.\n\n```js\nx\n```')
  assert.ok(formattedHtml.includes('<strong class="f-label">Code 1'))
  assert.ok(formattedHtml.includes('<span class="f-body">Formatted.</span>'))

  for (const invalidOptions of [
    { autoLabelNumberSets: undefined },
    { autoLabelNumberSets: null },
    { autoLabelNumberSets: 'code' },
    { autoLabelNumberSets: ['unknown'] },
    { autoLabelNumberSets: [null] },
    { autoLabelNumberSets: [''] },
  ]) {
    assert.throws(() => mdit().use(mdFigureWithPCaption, invalidOptions), TypeError)
  }

  const retryMd = mdit({ html: true })
  assert.throws(() => retryMd.use(mdFigureWithPCaption, { autoLabelNumberSets: null }), TypeError)
  assert.strictEqual(retryMd.core.ruler.__rules__.filter(rule => rule.name === 'figure_with_caption').length, 0)
  assert.doesNotThrow(() => retryMd.use(mdFigureWithPCaption, { autoLabelNumberSets: ['code'] }))
  assert.strictEqual(retryMd.core.ruler.__rules__.filter(rule => rule.name === 'figure_with_caption').length, 1)
  assert.doesNotThrow(() => retryMd.use(mdFigureWithPCaption, { autoLabelNumberSets: null }))
  assert.doesNotThrow(() => retryMd.use(mdFigureWithPCaption, { setFigureNumber: true }))
  assert.deepStrictEqual(getNumberedLabels(retryMd.render('Code. Retry.\n\n```js\nx\n```'), 'Code'), ['1'])

  const unsupportedLegacyMd = mdit()
  assert.throws(
    () => unsupportedLegacyMd.use(mdFigureWithPCaption, { setFigureNumber: true }),
    /autoLabelNumber or autoLabelNumberSets/,
  )
  assert.strictEqual(unsupportedLegacyMd.core.ruler.__rules__.filter(rule => rule.name === 'figure_with_caption').length, 0)
})

const createScopedMd = (
  scope = { sources: ['heading'], headingLevels: [1], repeatScope: 'continue' },
  separator,
) => {
  const autoLabelNumberPolicy = { scope }
  if (separator !== undefined) autoLabelNumberPolicy.separator = separator
  return mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumber: true,
    autoLabelNumberPolicy,
  })
}
const scopedFigureMarkdown = (heading, caption = 'Figure. Caption.') => (
  `${heading}\n\n![A](a.jpg)\n\n${caption}`
)
const getRenderedFigureNumbers = (html) => Array.from(html.matchAll(/>Figure ([A-Z0-9.-]+)<span/g), match => match[1])

runTest('heading scope recognition', () => {
  const recognizedScopes = [
    ['# Chapter 1', '1.1'],
    ['# chapter 2: Title', '2.1'],
    ['# 第3章　題', '3.1'],
    ['# 4章 題', '4.1'],
    ['# Appendix 5', '5.1'],
    ['# Appendix A: Data', 'A.1'],
    ['# 付録B　資料', 'B.1'],
    ['# 付属6：資料', '6.1'],
    ['# 附属C：資料', 'C.1'],
  ]
  for (const [heading, expected] of recognizedScopes) {
    assert.deepStrictEqual(getRenderedFigureNumbers(createScopedMd().render(scopedFigureMarkdown(heading))), [expected])
  }

  const rejectedScopes = [
    '# Chapter 1st',
    '# Chapter One',
    '# Appendix API',
    '# 第1章立てで説明する',
    '# 1章分を読む',
    '# 付録について',
    '# 附属資料',
    '# Chapter 1**st**',
    '# Chapter 1:**st**',
    '# Chapter 1.**st**',
    '# Appendix A**PI**',
    '# 第1章*立て*',
    '# 1章*分*',
    '# Chapter 1[st](https://example.com)',
    '# **Chapter 1**',
  ]
  for (const heading of rejectedScopes) {
    assert.deepStrictEqual(getRenderedFigureNumbers(createScopedMd().render(scopedFigureMarkdown(heading))), ['1'])
  }
  assert.deepStrictEqual(
    getRenderedFigureNumbers(createScopedMd().render(scopedFigureMarkdown('# Chapter 1: *Introduction*'))),
    ['1.1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(createScopedMd().render(scopedFigureMarkdown('# Chapter 1 *Introduction*'))),
    ['1.1'],
  )

  const repeated = '# Chapter 1\n\n![A](a.jpg)\n\nFigure. First.\n\n# Chapter 1\n\n![B](b.jpg)\n\nFigure. Second.'
  assert.deepStrictEqual(getRenderedFigureNumbers(createScopedMd().render(repeated)), ['1.1', '1.2'])
  assert.deepStrictEqual(
    getRenderedFigureNumbers(createScopedMd({ sources: ['heading'], headingLevels: [1], repeatScope: 'reset' }).render(repeated)),
    ['1.1', '1.1'],
  )

  const beforeAndAfter = '![A](a.jpg)\n\nFigure. Before.\n\n# Chapter 2\n\n![B](b.jpg)\n\nFigure 2.5. Manual.\n\n![C](c.jpg)\n\nFigure. After.'
  assert.deepStrictEqual(getRenderedFigureNumbers(createScopedMd().render(beforeAndAfter)), ['1', '2.5', '2.6'])
  assert.deepStrictEqual(
    getRenderedFigureNumbers(createScopedMd({ sources: ['heading'], headingLevels: [2] }).render(scopedFigureMarkdown('# Chapter 1'))),
    ['1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(createScopedMd().render('> # Chapter 9\n\n![A](a.jpg)\n\nFigure. Outside.')),
    ['1'],
  )
  for (const captionedBlockquoteThenHeading of [
    '# Chapter 1\n\nSource. Quote.\n\n> quoted\n\n# Chapter 2\n\n![A](a.jpg)\n\nFigure. After.',
    '# Chapter 1\n\n> quoted\n\nSource. Quote.\n\n# Chapter 2\n\n![A](a.jpg)\n\nFigure. After.',
  ]) {
    assert.deepStrictEqual(
      getRenderedFigureNumbers(createScopedMd().render(captionedBlockquoteThenHeading)),
      ['2.1'],
    )
  }
})

runTest('mixed scoped counter series', () => {
  const scopedMixedMd = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img', 'code', 'samp', 'video', 'table'],
    autoLabelNumberPolicy: {
      separator: '-',
      scope: { sources: ['heading'], headingLevels: [1], repeatScope: 'continue' },
    },
  })
  const sharedFigureSource = [
    '# Chapter 2',
    '![A](a.jpg)',
    'Figure. First.',
    '図2-5　Samp manual',
    '```console\nx\n```',
    '![B](b.jpg)',
    'Figure. Next.',
  ].join('\n\n')
  const sharedFigureHtml = scopedMixedMd.render(sharedFigureSource)
  assert.deepStrictEqual(getNumberedLabels(sharedFigureHtml, 'Figure'), ['2-1', '2-6'])
  assert.deepStrictEqual(getNumberedLabels(sharedFigureHtml, '図'), ['2-5'])

  const sharedListingHtml = scopedMixedMd.render([
    '# Appendix A',
    'Code. First.',
    '```js\nx\n```',
    'リストA-5　Samp manual',
    '```console\ny\n```',
    'Code. Next.',
    '```js\nz\n```',
  ].join('\n\n'))
  assert.deepStrictEqual(getNumberedLabels(sharedListingHtml, 'Code'), ['A-1', 'A-6'])
  assert.deepStrictEqual(getNumberedLabels(sharedListingHtml, 'リスト'), ['A-5'])

  const resetMd = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumberSets: ['img', 'samp'],
    autoLabelNumberPolicy: {
      separator: '-',
      scope: { sources: ['heading'], headingLevels: [1], repeatScope: 'reset' },
    },
  })
  const resetHtml = resetMd.render([
    '# Chapter 1',
    '![A](a.jpg)',
    '図　First image',
    '図　First samp',
    '```console\nx\n```',
    '# Chapter 1',
    '![B](b.jpg)',
    '図　Second image',
    '図　Second samp',
    '```console\ny\n```',
  ].join('\n\n'))
  assert.deepStrictEqual(getNumberedLabels(resetHtml, '図'), ['1-1', '1-2', '1-1', '1-2'])
})

runTest('frontmatter and env scopes', () => {
  const frontmatterNumberingKey = 'figure-caption-numbering'
  const defaultSeparatorFrontmatterMd = createScopedMd({
    sources: ['frontmatter', 'heading'],
    headingLevels: [1],
    repeatScope: 'continue',
  })
  const frontmatterMd = createScopedMd({
    sources: ['frontmatter', 'heading'],
    headingLevels: [1],
    repeatScope: 'continue',
  }, '.')
  const hyphenSeparatorFrontmatterMd = createScopedMd({
    sources: ['frontmatter', 'heading'],
    headingLevels: [1],
    repeatScope: 'continue',
  }, '-')
  const source = '![A](a.jpg)\n\nFigure. Caption.'
  const japaneseSource = '![A](a.jpg)\n\n図　Caption'
  assert.deepStrictEqual(
    getNumberedLabels(defaultSeparatorFrontmatterMd.render(japaneseSource, {
      frontmatter: { title: 'Chapter 1. A title' },
    }), '図'),
    ['1.1'],
  )
  assert.deepStrictEqual(
    getNumberedLabels(defaultSeparatorFrontmatterMd.render(japaneseSource, {
      frontmatter: {
        title: 'Chapter 1. A title',
        [frontmatterNumberingKey]: { scope: 'auto', separator: '-' },
      },
    }), '図'),
    ['1-1'],
  )
  assert.deepStrictEqual(
    getNumberedLabels(defaultSeparatorFrontmatterMd.render(japaneseSource, {
      frontmatter: {
        title: 'Chapter 1. A title',
        [frontmatterNumberingKey]: { scope: 'document' },
      },
    }), '図'),
    ['1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(source, { frontmatter: { title: 'Appendix A: Data' } })),
    ['A.1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(source, {
      figureCaptionNumbering: {
        scope: { scopeKey: 'chapter:7', displayPrefix: '7' },
      },
      frontmatter: { title: 'Appendix A: Data' },
    })),
    ['7.1'],
  )
  const overrideOnlyMd = createScopedMd({ sources: [] })
  assert.deepStrictEqual(
    getRenderedFigureNumbers(overrideOnlyMd.render(source, {
      figureCaptionNumbering: {
        separator: '.',
        scope: { scopeKey: 'appendix:C', sequenceKey: 3, displayPrefix: 'C' },
      },
    })),
    ['C.1'],
  )
  assert.deepStrictEqual(getRenderedFigureNumbers(frontmatterMd.render(source, {})), ['1'])
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(source, { frontmatter: { title: 2 } })),
    ['1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(source, { frontmatter: { title: 'Chapter 2' } })),
    ['2.1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(source, {
      frontmatter: {
        title: 'Chapter 1. A title',
        [frontmatterNumberingKey]: { scope: 'auto', separator: '-' },
      },
    })),
    ['1-1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(
      source + '\n\n# Chapter 2\n\n![B](b.jpg)\n\nFigure. Second.',
      {
        frontmatter: {
          title: 'Chapter 1. A title',
          [frontmatterNumberingKey]: { scope: 'document', separator: '-' },
        },
      },
    )),
    ['1', '2'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(source, {
      figureCaptionNumbering: { separator: '.', scope: 'auto' },
      frontmatter: {
        title: 'Chapter 3',
        [frontmatterNumberingKey]: { scope: 'document', separator: '-' },
      },
    })),
    ['3.1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(frontmatterMd.render(source, {
      figureCaptionNumbering: { scope: 'document' },
      frontmatter: {
        title: 'Chapter 3',
        [frontmatterNumberingKey]: { scope: 'auto', separator: '-' },
      },
    })),
    ['1'],
  )
  const reusedEnv = { frontmatter: { title: 'Chapter 4' } }
  assert.deepStrictEqual(getRenderedFigureNumbers(frontmatterMd.render(source, reusedEnv)), ['4.1'])
  reusedEnv.frontmatter.title = 'Chapter 5'
  assert.deepStrictEqual(getRenderedFigureNumbers(frontmatterMd.render(source, reusedEnv)), ['5.1'])
  assert.deepStrictEqual(getRenderedFigureNumbers(frontmatterMd.render(source, reusedEnv)), ['5.1'])
  assert.deepStrictEqual(
    getRenderedFigureNumbers(defaultSeparatorFrontmatterMd.render(source, {
      frontmatter: {
        title: 'Chapter 6',
        'figure-caption-numbering.scope': 'auto',
        'figure-caption-numbering.separator': '-',
      },
    })),
    ['6-1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(hyphenSeparatorFrontmatterMd.render(source, {
      frontmatter: {
        title: 'Chapter 6',
        'figure-caption-numbering.scope': 'auto',
        'figure-caption-numbering.separator': '.',
      },
    })),
    ['6.1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(defaultSeparatorFrontmatterMd.render(source, {
      frontmatter: {
        title: 'Chapter 7',
        [frontmatterNumberingKey]: { scope: 'auto' },
        'figure-caption-numbering.separator': '-',
      },
    })),
    ['7-1'],
  )

  let rawFrontmatterCallbackCalls = 0
  const rawFrontmatterMd = mdit({ html: true })
    .use(mditFrontMatter, () => { rawFrontmatterCallbackCalls++ })
    .use(mdFigureWithPCaption, {
      autoLabelNumber: true,
      autoLabelNumberPolicy: {
        separator: '-',
        scope: {
          sources: ['frontmatter'],
          resolveFrontmatterTitle(raw) {
            const match = raw.match(/^title:\s*(.+)$/m)
            return match ? match[1] : null
          },
        },
      },
    })
  assert.deepStrictEqual(
    getRenderedFigureNumbers(rawFrontmatterMd.render('---\ntitle: Appendix B\n---\n\n' + source)),
    ['B-1'],
  )
  assert.strictEqual(rawFrontmatterCallbackCalls, 1)
  assert.deepStrictEqual(
    getRenderedFigureNumbers(rawFrontmatterMd.render('---\nnot-title: Appendix B\n---\n\n' + source)),
    ['1'],
  )
  assert.strictEqual(rawFrontmatterCallbackCalls, 2)

  let reverseOrderCallbackCalls = 0
  const failingResolverMd = mdit({ html: true })
    .use(mdFigureWithPCaption, {
      autoLabelNumber: true,
      autoLabelNumberPolicy: {
        scope: {
          sources: ['frontmatter'],
          resolveFrontmatterTitle() {
            throw new Error('malformed frontmatter')
          },
        },
      },
    })
    .use(mditFrontMatter, () => { reverseOrderCallbackCalls++ })
  assert.deepStrictEqual(
    getRenderedFigureNumbers(failingResolverMd.render('---\ntitle: Chapter 8\n---\n\n' + source)),
    ['1'],
  )
  assert.strictEqual(reverseOrderCallbackCalls, 1)

  let capturedTokens = null
  const invalidOverrideMd = createScopedMd()
  invalidOverrideMd.core.ruler.before('figure_with_caption', 'capture_invalid_scope_tokens', (state) => {
    capturedTokens = { tokens: state.tokens, before: JSON.stringify(state.tokens) }
  })
  for (const invalidFrontmatterNumbering of [
    null,
    [],
    'document',
    { scope: 'none' },
    { scope: null },
    { separator: ':' },
    { unknown: true },
  ]) {
    assert.throws(
      () => invalidOverrideMd.render(source, {
        frontmatter: {
          title: 'Chapter 1',
          [frontmatterNumberingKey]: invalidFrontmatterNumbering,
        },
      }),
      /figure-caption-numbering/,
    )
    assert.strictEqual(JSON.stringify(capturedTokens.tokens), capturedTokens.before)
  }
  for (const invalidFlatFrontmatter of [
    { 'figure-caption-numbering.scope': 'none' },
    { 'figure-caption-numbering.separator': ':' },
    {
      [frontmatterNumberingKey]: { scope: 'auto' },
      'figure-caption-numbering.scope': 'auto',
    },
    {
      [frontmatterNumberingKey]: { separator: '.' },
      'figure-caption-numbering.separator': '.',
    },
  ]) {
    assert.throws(
      () => invalidOverrideMd.render(source, {
        frontmatter: {
          title: 'Chapter 1',
          ...invalidFlatFrontmatter,
        },
      }),
      /figure-caption-numbering/,
    )
    assert.strictEqual(JSON.stringify(capturedTokens.tokens), capturedTokens.before)
  }
  for (const invalidEnvNumbering of [
    { scope: 'none' },
    { separator: ':' },
  ]) {
    assert.throws(
      () => invalidOverrideMd.render(source, { figureCaptionNumbering: invalidEnvNumbering }),
      /figureCaptionNumbering/,
    )
    assert.strictEqual(JSON.stringify(capturedTokens.tokens), capturedTokens.before)
  }
  assert.throws(
    () => invalidOverrideMd.render(source, { figureCaptionNumbering: { scope: null } }),
    /figureCaptionNumbering\.scope/,
  )
  assert.strictEqual(JSON.stringify(capturedTokens.tokens), capturedTokens.before)
  assert.throws(
    () => overrideOnlyMd.render(source, { figureCaptionNumbering: { scope: null } }),
    /figureCaptionNumbering\.scope/,
  )
  assert.throws(
    () => overrideOnlyMd.render(
      '![A](a.jpg)\n\nFigure 999999. Seed.\n\n![B](b.jpg)\n\nFigure. Overflow.',
    ),
    RangeError,
  )
  let autoOverflowState = null
  let autoOverflowImage = null
  const autoOverflowMd = createScopedMd({ sources: [] })
  autoOverflowMd.core.ruler.before('figure_with_caption', 'capture_auto_overflow_tokens', (state) => {
    autoOverflowState = state
    const images = state.tokens
      .flatMap(token => Array.isArray(token.children) ? token.children : [])
      .filter(token => token.type === 'image')
    autoOverflowImage = images[images.length - 1]
  })
  assert.throws(
    () => autoOverflowMd.render(
      'Figure 999999. Seed.\n\n![Seed](a.jpg)\n\n![Figure. Overflow.](b.jpg)',
    ),
    RangeError,
  )
  assert.strictEqual(autoOverflowImage.content, 'Figure. Overflow.')
  assert.strictEqual(
    autoOverflowState.tokens.some(token => token.type === 'inline' && token.content === 'Figure. Overflow.'),
    false,
  )
})

runTest('advanced numbering option validation', () => {
  assert.throws(
    () => mdit().use(mdFigureWithPCaption, { autoLabelNumberPolicy: [] }),
    /autoLabelNumberPolicy/,
  )
  assert.throws(
    () => mdit().use(mdFigureWithPCaption, { autoLabelNumberPolicy: { scope: true } }),
    /autoLabelNumberPolicy\.scope/,
  )
  assert.throws(
    () => createScopedMd({ sources: ['heading'], headingLevels: [0] }),
    /headingLevels/,
  )
  assert.throws(
    () => createScopedMd({ sources: ['heading'], headingLevels: 1 }),
    /headingLevels/,
  )
  assert.throws(
    () => createScopedMd({ sources: ['unknown'] }),
    /sources/,
  )
  assert.throws(
    () => createScopedMd({ sources: ['heading'], repeatScope: 'unknown' }),
    /repeatScope/,
  )
  assert.throws(
    () => createScopedMd({ sources: ['frontmatter'], resolveFrontmatterTitle: true }),
    /resolveFrontmatterTitle/,
  )
  assert.throws(
    () => createScopedMd({ sources: [] }, ':'),
    /separator/,
  )
})

if (pass) {
  console.log('Passed caption numbering tests.')
} else {
  process.exitCode = 1
}
