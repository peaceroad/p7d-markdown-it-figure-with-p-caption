import assert from 'node:assert/strict'
import mdit from 'markdown-it'
import Token from 'markdown-it/lib/token.mjs'

import mditPCaption, {
  setCaptionParagraph,
  getMarkRegForLanguages,
  getMarkRegStateForLanguages,
} from 'p7d-markdown-it-p-captions'

const normalize = (text) => text.replace(/\r\n/g, '\n')

const createOptionForSetCaption = (languages = ['en', 'ja']) => ({
  languages,
  classPrefix: 'caption',
  dquoteFilename: false,
  strongFilename: false,
  hasNumClass: false,
  bLabel: false,
  strongLabel: false,
  jointSpaceUseHalfWidth: false,
  removeUnnumberedLabel: false,
  removeUnnumberedLabelExceptMarks: [],
  removeUnnumberedLabelExceptMarksSet: null,
  setFigureNumber: false,
  removeMarkNameInCaptionClass: false,
  wrapCaptionBody: false,
  labelClassFollowsFigure: false,
  figureToLabelClassMap: null,
  labelPrefixMarker: null,
  labelPrefixMarkerReg: null,
  labelPrefixMarkerNeedsCheckOnLikelyStart: false,
  markRegState: getMarkRegStateForLanguages(languages),
  paragraphClassByMark: Object.create(null),
  captionClassByMark: Object.create(null),
})

const parser = mdit()
const applySetCaption = (markdown, caption, sp, opt = createOptionForSetCaption()) => {
  const state = {
    tokens: parser.parse(markdown, {}),
    Token,
  }
  const paragraphIndex = state.tokens.findIndex((token) => token.type === 'paragraph_open')
  assert.notStrictEqual(paragraphIndex, -1, 'paragraph_open token should exist')
  const fNum = { img: 0, table: 0 }
  setCaptionParagraph(paragraphIndex, state, caption, fNum, sp, opt)
  return state.tokens[paragraphIndex].attrGet('class') || null
}

const testRenderBasics = () => {
  const md = mdit().use(mditPCaption)
  assert.equal(
    normalize(md.render('Figure. A cat.')),
    '<p class="caption-img"><span class="caption-img-label">Figure<span class="caption-img-label-joint">.</span></span> A cat.</p>\n',
  )
  assert.equal(
    normalize(md.render('図。 ねこ')),
    '<p class="caption-img"><span class="caption-img-label">図<span class="caption-img-label-joint">。</span></span> ねこ</p>\n',
  )
}

const testLanguageSpecificRegex = () => {
  const en = getMarkRegForLanguages(['en'])
  const ja = getMarkRegForLanguages(['ja'])
  assert.ok(en.img.exec('Figure. A cat.'))
  assert.equal(en.img.exec('図。 ねこ'), null)
  assert.ok(ja.img.exec('図。 ねこ'))
}

const testMarkerMode = () => {
  const mdSymbolMarker = mdit().use(mditPCaption, { labelPrefixMarker: '▼' })
  assert.equal(
    normalize(mdSymbolMarker.render('▼ Figure. Marker')),
    '<p class="caption-img"><span class="caption-img-label">Figure<span class="caption-img-label-joint">.</span></span> Marker</p>\n',
  )

  // Alphanumeric marker still works with the optimized marker-check path.
  const mdAlphaMarker = mdit().use(mditPCaption, { labelPrefixMarker: 'Note' })
  assert.equal(
    normalize(mdAlphaMarker.render('Note Figure. Marker')),
    '<p class="caption-img"><span class="caption-img-label">Figure<span class="caption-img-label-joint">.</span></span> Marker</p>\n',
  )
}

const testSetCaptionParagraphGuards = () => {
  assert.equal(
    applySetCaption('Video. Clip.\n', { name: 'iframe' }, { isVideoIframe: true }),
    'caption-video',
  )
  assert.equal(
    applySetCaption('Figure. A cat.\n', { name: 'img' }, { isVideoIframe: true }),
    null,
  )
  assert.equal(
    applySetCaption('Quote. Cite.\n', { name: 'blockquote' }, { isIframeTypeBlockquote: true }),
    'caption-blockquote',
  )
}

const testSetCaptionParagraphInputSafety = () => {
  const state = {
    tokens: parser.parse('Figure. A cat.\n', {}),
    Token,
  }
  const paragraphIndex = state.tokens.findIndex((token) => token.type === 'paragraph_open')
  assert.notStrictEqual(paragraphIndex, -1, 'paragraph_open token should exist')

  assert.doesNotThrow(() => {
    setCaptionParagraph(paragraphIndex, state, null, { img: 0, table: 0 }, null, undefined)
  })
  assert.equal(state.tokens[paragraphIndex].attrGet('class'), 'caption-img')

  assert.doesNotThrow(() => {
    setCaptionParagraph(0, null, null, null, null, undefined)
  })
}

testRenderBasics()
testLanguageSpecificRegex()
testMarkerMode()
testSetCaptionParagraphGuards()
testSetCaptionParagraphInputSafety()

console.log('p7d-markdown-it-p-captions tests passed')
