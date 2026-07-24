import assert from 'node:assert/strict'
import mdit from 'markdown-it'

import {
  createFigureCaptionCounterKeyResolver,
  createFigureCaptionNumberCodec,
  createFigureCaptionScopeTimeline,
  normalizeFigureCaptionNumberingPolicy,
} from '../caption-numbering.js'

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

const collectTimeline = (
  source,
  policyValue,
  env = {},
  prepareState = null,
) => {
  const policy = normalizeFigureCaptionNumberingPolicy(policyValue)
  const md = mdit()
  let timeline = null
  md.core.ruler.push('prepare_caption_numbering_api_test', (state) => {
    if (prepareState) prepareState(state)
  })
  md.core.ruler.push('collect_caption_numbering_timeline', (state) => {
    const tokenSnapshot = JSON.stringify(state.tokens)
    const envSnapshot = JSON.stringify(state.env)
    timeline = createFigureCaptionScopeTimeline(state, policy)
    assert.equal(JSON.stringify(state.tokens), tokenSnapshot)
    assert.equal(JSON.stringify(state.env), envSnapshot)
  })
  md.parse(source, env)
  return { policy, timeline }
}

console.log('=== Caption numbering public API tests ===')

runTest('opaque policy normalization and validation', () => {
  assert.equal(normalizeFigureCaptionNumberingPolicy(null), null)
  assert.ok(Object.isFrozen(normalizeFigureCaptionNumberingPolicy(undefined)))
  const sourcePolicy = {
    separator: '-',
    scope: {
      sources: ['heading', 'heading'],
      headingLevels: [2, 2],
      repeatScope: 'reset',
    },
  }
  const policy = normalizeFigureCaptionNumberingPolicy(sourcePolicy)
  assert.ok(Object.isFrozen(policy))
  assert.deepStrictEqual(Object.keys(policy), [])
  sourcePolicy.separator = '.'
  sourcePolicy.scope.headingLevels[0] = 1
  assert.throws(
    () => normalizeFigureCaptionNumberingPolicy({ separator: ':' }),
    TypeError,
  )
  assert.throws(
    () => normalizeFigureCaptionNumberingPolicy({ scope: { headingLevels: [0] } }),
    RangeError,
  )
  assert.throws(
    () => createFigureCaptionScopeTimeline({ tokens: [] }, {}),
    /normalizeFigureCaptionNumberingPolicy/,
  )
})

runTest('top-level heading scope timeline', () => {
  const source = [
    'Before.',
    '',
    '# Chapter 1: One',
    '',
    '> # Chapter 9: Nested quote',
    '',
    '- # Chapter 8: Nested list',
    '',
    '# Appendix A. Appendix',
    '',
    '# 第2章　日本語',
  ].join('\n')
  const { timeline } = collectTimeline(source, {
    separator: '.',
    scope: {
      sources: ['heading'],
      headingLevels: [1],
    },
  })
  assert.ok(Object.isFrozen(timeline))
  assert.ok(Object.isFrozen(timeline.boundaries))
  assert.ok(Object.isFrozen(timeline.initialContext))
  assert.deepStrictEqual(timeline.initialContext, {
    scoped: false,
    scopeKey: null,
    sequenceKey: null,
    displayPrefix: '',
    separator: '.',
  })
  assert.deepStrictEqual(
    timeline.boundaries.map(boundary => ({
      start: boundary.sourceStartLine,
      end: boundary.sourceEndLine,
      scopeKey: boundary.context.scopeKey,
      sequenceKey: boundary.context.sequenceKey,
      displayPrefix: boundary.context.displayPrefix,
    })),
    [
      {
        start: 2,
        end: 3,
        scopeKey: 'chapter:1',
        sequenceKey: 'chapter:1',
        displayPrefix: '1',
      },
      {
        start: 8,
        end: 9,
        scopeKey: 'appendix:A',
        sequenceKey: 'appendix:A',
        displayPrefix: 'A',
      },
      {
        start: 10,
        end: 11,
        scopeKey: 'chapter:2',
        sequenceKey: 'chapter:2',
        displayPrefix: '2',
      },
    ],
  )
  for (const boundary of timeline.boundaries) {
    assert.ok(Object.isFrozen(boundary))
    assert.ok(Object.isFrozen(boundary.context))
  }
  assert.equal(timeline.hasUnmappableBoundaries, false)
})

runTest('scope boundaries and repeat reset', () => {
  const source = [
    '# Chapter 1. First',
    '',
    '# Chapter 1. Second',
    '',
    '## Appendix A. Wrong level',
  ].join('\n')
  const continueTimeline = collectTimeline(source, {
    scope: {
      sources: ['heading'],
      headingLevels: [1],
      repeatScope: 'continue',
    },
  }).timeline
  assert.deepStrictEqual(
    continueTimeline.boundaries.map(boundary => boundary.context.sequenceKey),
    ['chapter:1', 'chapter:1'],
  )

  const resetTimeline = collectTimeline(source, {
    scope: {
      sources: ['heading'],
      headingLevels: [1],
      repeatScope: 'reset',
    },
  }).timeline
  assert.deepStrictEqual(
    resetTimeline.boundaries.map(boundary => boundary.context.sequenceKey),
    [1, 2],
  )
})

runTest('frontmatter and render overrides', () => {
  const source = '# Chapter 2: Heading'
  const policyValue = {
    separator: '.',
    scope: {
      sources: ['frontmatter', 'heading'],
      headingLevels: [1],
    },
  }
  const autoTimeline = collectTimeline(source, policyValue, {
    frontmatter: {
      title: 'Appendix A: Initial',
      'figure-caption-numbering': {
        separator: '-',
      },
    },
  }).timeline
  assert.equal(autoTimeline.initialContext.displayPrefix, 'A')
  assert.equal(autoTimeline.initialContext.separator, '-')
  assert.equal(autoTimeline.boundaries[0].context.displayPrefix, '2')
  assert.equal(autoTimeline.boundaries[0].context.separator, '-')

  const documentTimeline = collectTimeline(source, policyValue, {
    frontmatter: {
      title: 'Appendix A: Initial',
      'figure-caption-numbering.scope': 'document',
    },
  }).timeline
  assert.equal(documentTimeline.initialContext.scoped, false)
  assert.deepStrictEqual(documentTimeline.boundaries, [])

  const fixedTimeline = collectTimeline(source, policyValue, {
    figureCaptionNumbering: {
      separator: '-',
      scope: {
        scopeKey: 'chapter:7',
        sequenceKey: 'edition-2:chapter:7',
        displayPrefix: '7',
      },
    },
  }).timeline
  assert.deepStrictEqual(fixedTimeline.initialContext, {
    scoped: true,
    scopeKey: 'chapter:7',
    sequenceKey: 'edition-2:chapter:7',
    displayPrefix: '7',
    separator: '-',
  })
  assert.deepStrictEqual(fixedTimeline.boundaries, [])

  assert.throws(
    () => collectTimeline(source, policyValue, {
      frontmatter: {
        'figure-caption-numbering': { scope: 'auto' },
        'figure-caption-numbering.scope': 'document',
      },
    }),
    /defined more than once/,
  )
})

runTest('mapless recognized headings are reported', () => {
  const { timeline } = collectTimeline(
    '# Chapter 1: Mapless',
    {
      scope: {
        sources: ['heading'],
        headingLevels: [1],
      },
    },
    {},
    (state) => {
      const heading = state.tokens.find(token => token.type === 'heading_open')
      heading.map = null
    },
  )
  assert.equal(timeline.hasUnmappableBoundaries, true)
  assert.deepStrictEqual(timeline.boundaries, [])
})

runTest('mismatched nested-container closes fail closed', () => {
  const source = [
    '> # Chapter 9: First nested',
    '>',
    '> # Appendix A: Second nested',
    '',
    '# Chapter 1: Top level',
  ].join('\n')
  const { timeline } = collectTimeline(
    source,
    {
      scope: {
        sources: ['heading'],
        headingLevels: [1],
      },
    },
    {},
    (state) => {
      const secondNestedHeadingIndex = state.tokens.findIndex(
        (token, index) => (
          token.type === 'heading_open' &&
          state.tokens[index + 1] &&
          state.tokens[index + 1].content.startsWith('Appendix A')
        ),
      )
      assert.notEqual(secondNestedHeadingIndex, -1)
      state.tokens.splice(secondNestedHeadingIndex, 0, { type: 'list_item_close' })
    },
  )
  assert.deepStrictEqual(
    timeline.boundaries.map(boundary => boundary.context.scopeKey),
    ['chapter:1'],
  )
})

runTest('default automatic and document-wide policy timelines', () => {
  const { timeline: automaticTimeline } = collectTimeline('# Chapter 1: Used', {})
  assert.equal(automaticTimeline.initialContext.scoped, false)
  assert.equal(automaticTimeline.initialContext.separator, '.')
  assert.deepStrictEqual(
    automaticTimeline.boundaries.map(boundary => boundary.context.scopeKey),
    ['chapter:1'],
  )
  assert.equal(automaticTimeline.hasUnmappableBoundaries, false)
  const { timeline: undefinedPolicyTimeline } = collectTimeline(
    '# Chapter 1: Used',
    undefined,
  )
  assert.deepStrictEqual(undefinedPolicyTimeline, automaticTimeline)
  const { timeline: explicitAutomaticTimeline } = collectTimeline(
    '# Chapter 1: Used',
    { scope: 'auto' },
  )
  assert.deepStrictEqual(explicitAutomaticTimeline, automaticTimeline)

  const { timeline } = collectTimeline('# Chapter 1: Ignored', { scope: 'document' })
  assert.equal(timeline.initialContext.scoped, false)
  assert.equal(timeline.initialContext.separator, '.')
  assert.deepStrictEqual(timeline.boundaries, [])
  assert.equal(timeline.hasUnmappableBoundaries, false)

  const { timeline: nullScopeTimeline } = collectTimeline('# Chapter 1: Ignored', {
    separator: '-',
    scope: null,
  })
  assert.equal(nullScopeTimeline.initialContext.scoped, false)
  assert.equal(nullScopeTimeline.initialContext.separator, '-')
  assert.deepStrictEqual(nullScopeTimeline.boundaries, [])
})

runTest('semantic counter-key resolver', () => {
  const languages = ['ja']
  const resolve = createFigureCaptionCounterKeyResolver({ languages })
  languages[0] = 'en'
  assert.equal(resolve({ mark: 'img', labelText: '図' }), 'figure')
  assert.equal(resolve({ mark: 'pre-code', labelText: 'リスト' }), 'listing')
  assert.equal(resolve({ mark: 'pre-samp', labelText: '図' }), 'figure')
  assert.equal(resolve({ mark: 'pre-samp', labelText: 'リスト' }), 'listing')
  assert.equal(resolve({ mark: 'pre-samp', labelText: '端末' }), 'samp')
  assert.equal(resolve({ mark: 'video', labelText: '動画' }), 'video')
  assert.equal(resolve({ mark: 'table', labelText: '表' }), 'table')
  assert.ok(Object.isFrozen(resolve))

  const defaultResolver = createFigureCaptionCounterKeyResolver()
  assert.equal(defaultResolver({ mark: 'pre-samp', labelText: '図' }), 'figure')
  const englishOnly = createFigureCaptionCounterKeyResolver({ languages: ['en'] })
  assert.equal(englishOnly({ mark: 'pre-samp', labelText: '図' }), 'samp')
  assert.throws(() => resolve(null), TypeError)
  assert.throws(() => resolve({ mark: 'code', labelText: 'Code' }), /canonical/)
  assert.throws(
    () => createFigureCaptionCounterKeyResolver({ languages: ['en'], typo: true }),
    /not supported/,
  )
})

runTest('scope-aware number codec', () => {
  const codec = createFigureCaptionNumberCodec()
  assert.ok(Object.isFrozen(codec))
  assert.strictEqual(createFigureCaptionNumberCodec(), codec)

  const unscoped = collectTimeline('', {}).timeline.initialContext
  assert.equal(codec.parseExplicit('5', unscoped), 5)
  assert.equal(codec.parseExplicit('000001', unscoped), 1)
  assert.equal(codec.parseExplicit('0', unscoped), null)
  assert.equal(codec.parseExplicit('A.5', unscoped), null)
  assert.equal(codec.format(6, unscoped), '6')

  const scoped = collectTimeline('# Appendix A: Scope', {
    separator: '.',
    scope: {
      sources: ['heading'],
      headingLevels: [1],
    },
  }).timeline.boundaries[0].context
  assert.equal(codec.parseExplicit('A.5', scoped), 5)
  assert.equal(codec.parseExplicit('A-5', scoped), null)
  assert.equal(codec.parseExplicit('B.5', scoped), null)
  assert.equal(codec.parseExplicit('A.5.1', scoped), null)
  assert.equal(codec.format(6, scoped), 'A.6')

  const dashScoped = collectTimeline('# Chapter 2: Scope', {
    separator: '-',
    scope: {
      sources: ['heading'],
      headingLevels: [1],
    },
  }).timeline.boundaries[0].context
  assert.equal(codec.parseExplicit('2-3', dashScoped), 3)
  assert.equal(codec.format(4, dashScoped), '2-4')

  assert.throws(() => codec.parseExplicit('1', {}), /caption-numbering API/)
  assert.throws(() => codec.parseExplicit(1, unscoped), TypeError)
  assert.throws(() => codec.format(0, unscoped), RangeError)
  assert.throws(() => codec.format(1000000, unscoped), /number grammar/)
})

if (!pass) {
  console.error('Caption numbering public API tests failed.')
  process.exitCode = 1
} else {
  console.log('Passed caption numbering public API tests.')
}
