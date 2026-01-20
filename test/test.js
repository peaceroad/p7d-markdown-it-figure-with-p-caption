import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import mditRndererFence from '@peaceroad/markdown-it-renderer-fence'
import mditStrongJa from '@peaceroad/markdown-it-strong-ja'
import mditBreaks from '@peaceroad/markdown-it-cjk-breaks-mod'

import mdFigureWithPCaption from '../index.js'
import highlightjs from 'highlight.js'

let opt = {
  dquoteFilename: true,
  strongFilename: true,
  oneImageWithoutCaption: false,
  iframeWithoutCaption: false,
  videoWithoutCaption: false,
  audioWithoutCaption: false,
  hasNumClass: false,
  iframeTypeBlockquoteWithoutCaption: false,
}

const md = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

opt.hasNumClass = true
const mdHasNumClass = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

opt.hasNumClass = false
opt.oneImageWithoutCaption = true
const mdOneImage = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

opt.iframeWithoutCaption = true
opt.hasNumClass = false
const mdIframeWithoutCaption = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

opt.iframeTypeBlockquoteWithoutCaption = true
const mdIframeTypeBlockquoteWithoutCaption = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

const optIframeTypeBlockquoteWithCaption = {
  figureClassThatWrapsIframeTypeBlockquote: 'f-embed',
}
const mdIframeTypeBlockquoteWithCaption = mdit({ html: true }).use(mdFigureWithPCaption, optIframeTypeBlockquoteWithCaption).use(mditAttrs).use(mditRndererFence);

opt.multipleImages =  true
const mdMultipleImages = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

opt.videoWithoutCaption = true
const mdVideoWithoutCaption = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

opt.audioWithoutCaption = true
const mdAudioWithoutCaption = mdit({ html: true }).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
opt.audioWithoutCaption = false

const mdLabelClassFollowsFigure = mdit({ html: true }).use(mdFigureWithPCaption, {
  labelClassFollowsFigure: true,
  wrapCaptionBody: true,
  figureClassThatWrapsIframeTypeBlockquote: 'f-embed',
}).use(mditAttrs).use(mditRndererFence);

const mdLabelClassMap = mdit({ html: true }).use(mdFigureWithPCaption, {
  labelClassFollowsFigure: true,
  wrapCaptionBody: true,
  figureClassThatWrapsIframeTypeBlockquote: 'f-embed',
  figureToLabelClassMap: {
    'f-embed': 'caption-embed caption-social',
    'f-iframe': 'caption-slide-label caption-slide-extra',
    'f-img': ['c-figure', 'alt-figure-body'],
  },
}).use(mditAttrs).use(mditRndererFence);

const mdCustomSlideFigureClass = mdit({ html: true }).use(mdFigureWithPCaption, {
  figureClassThatWrapsSlides: 'f-slide-custom',
}).use(mditAttrs).use(mditRndererFence);


const mdConsole = mdit({
  html: true,
  langPrefix: 'language-',
  typographer: false,
  highlight: (str, lang) => {
    if (lang && highlightjs.getLanguage(lang)) {
      try {
        return highlightjs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return str
  }
}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);

const mdAutoCaptionDetection = mdit({ html: true }).use(mdFigureWithPCaption, { autoCaptionDetection: true }).use(mditAttrs).use(mditRndererFence);
const mdAltCaptionFallback = mdit({ html: true }).use(mdFigureWithPCaption, { autoCaptionDetection: true, autoAltCaption: true }).use(mditAttrs).use(mditRndererFence);
const mdTitleCaptionFallback = mdit({ html: true }).use(mdFigureWithPCaption, { autoCaptionDetection: true, autoTitleCaption: true }).use(mditAttrs).use(mditRndererFence);
const mdAltCaptionFallbackNumbered = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoCaptionDetection: true,
  autoAltCaption: true,
  autoLabelNumberSets: ['img'],
}).use(mditAttrs).use(mditRndererFence);
const mdAutoLabelNumberSets = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoCaptionDetection: true,
  autoLabelNumberSets: ['img', 'table'],
}).use(mditAttrs).use(mditRndererFence);
const mdAutoLabelNumber = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoCaptionDetection: true,
  autoLabelNumber: true,
}).use(mditAttrs).use(mditRndererFence);
const mdLabelPrefixMarkerWithLabel = mdit({ html: true }).use(mdFigureWithPCaption, {
  labelPrefixMarker: ['▼', '▲'],
}).use(mditAttrs).use(mditRndererFence);
const mdLabelPrefixMarkerWithoutLabel = mdit({ html: true }).use(mdFigureWithPCaption, {
  labelPrefixMarker: ['▼', '▲'],
  allowLabelPrefixMarkerWithoutLabel: true,
}).use(mditAttrs).use(mditRndererFence);
const mdRecommendedDefaults = mdit({ html: true }).use(mdFigureWithPCaption, {
  strongFilename: true,
  dquoteFilename: true,
  jointSpaceUseHalfWidth: true,
  oneImageWithoutCaption: true,
  iframeWithoutCaption: true,
  iframeTypeBlockquoteWithoutCaption: true,
  videoWithoutCaption: true,
  audioWithoutCaption: true,
  removeUnnumberedLabel: true,
  removeUnnumberedLabelExceptMarks: ['blockquote'],
  allIframeTypeFigureClassName: 'f-embed',
  autoCaptionDetection: true,
  autoAltCaption: true,
  autoTitleCaption: true,
  autoLabelNumberSets: ['img', 'table'],
}).use(mditAttrs).use(mditRndererFence);
const mdRecommendedDefaultsNumbered = mdit({ html: true }).use(mdFigureWithPCaption, {
  strongFilename: true,
  dquoteFilename: true,
  jointSpaceUseHalfWidth: true,
  oneImageWithoutCaption: true,
  iframeWithoutCaption: true,
  iframeTypeBlockquoteWithoutCaption: true,
  videoWithoutCaption: true,
  audioWithoutCaption: true,
  removeUnnumberedLabel: false,
  removeUnnumberedLabelExceptMarks: ['blockquote'],
  allIframeTypeFigureClassName: 'f-embed',
  autoCaptionDetection: true,
  autoAltCaption: true,
  autoTitleCaption: true,
  autoLabelNumberSets: ['img', 'table'],
}).use(mditAttrs).use(mditRndererFence);

const mdWithStrongJa = mdit({ html: true }).use(mditStrongJa).use(mdFigureWithPCaption).use(mditBreaks)
//const mdWithStrongJa = mdit({ html: true }).use(mdFigureWithPCaption).use(mditStrongJa)

let __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = (process.platform === 'win32')
if (isWindows) {
  __dirname = __dirname.replace(/^\/+/, '').replace(/\//g, '\\')
}

const fixturePath = (name) => __dirname + path.sep + name
const resolveFixture = (...names) => {
  for (const name of names) {
    const candidate = fixturePath(name)
    if (fs.existsSync(candidate)) return candidate
  }
  return fixturePath(names[0])
}

const testData = {
  noOption: __dirname + path.sep +  'examples-no-option.txt',
  hasNumClass: __dirname + path.sep +  'examples-has-num-class.txt',
  oneImageWithoutCaption: __dirname + path.sep + 'examples-one-image-without-caption.txt',
  iframeWithoutCaption: __dirname + path.sep + 'examples-iframe-without-caption.txt',
  iframeTypeBlockquoteWithoutCaption: __dirname + path.sep + 'examples-iframe-type-blockquote-without-caption.txt',
  iframeTypeBlockquoteWithCaption: __dirname + path.sep + 'examples-iframe-type-blockquote-with-caption.txt',
  multipleImages: __dirname + path.sep + 'examples-multiple-images.txt',
  videoWithoutCaption: __dirname + path.sep + 'examples-video-without-caption.txt',
  audioWithoutCaption: __dirname + path.sep + 'examples-audio-without-caption.txt',
  autoAltCaptionCustom: __dirname + path.sep + 'examples-auto-alt-caption-custom.txt',
  autoTitleCaptionCustom: __dirname + path.sep + 'examples-auto-title-caption-custom.txt',
  console: __dirname + path.sep + 'examples-console.txt',
  allIframeTypeFigureClassName: __dirname + path.sep + 'examples-all-iframe-type-figure-class-name.txt',
  figureClassThatWrapsSlides: __dirname + path.sep + 'examples-figure-class-that-wraps-slides.txt',
  optionLabelClassFollowsFigure: resolveFixture('examples-option-label-class-follows-figure.txt', 'examples-label-class-follows-figure.txt'),
  optionFigureToLabelClassMap: resolveFixture('examples-option-figure-to-label-class-map.txt', 'examples-label-class-map.txt'),
  autoCaptionDetection: __dirname + path.sep + 'examples-automatic-caption-detection.txt',
  autoCaptionDetectionManualPriority: __dirname + path.sep + 'examples-automatic-caption-detection-manual-priority.txt',
  autoCaptionDetectionNumbered: __dirname + path.sep + 'examples-automatic-caption-detection-numbered.txt',
  labelPrefixMarkerWithLabel: __dirname + path.sep + 'examples-caption-marker-with-label.txt',
  allowLabelPrefixMarkerWithoutLabel: __dirname + path.sep + 'examples-caption-marker-without-label.txt',
  autoLabelNumber: __dirname + path.sep + 'examples-auto-label-number.txt',
  recommendedOptions: __dirname + path.sep + 'examples-recommended-options-unlabeled.txt',
  recommendedOptionsNumbered: __dirname + path.sep + 'examples-recommended-options-numbered.txt',
  autoCaptionDetectionMultiImages: __dirname + path.sep + 'examples-automatic-caption-detection-multi-images.txt',
  altCaptionFallback: __dirname + path.sep + 'examples-alt-caption-fallback.txt',
  altCaptionFallbackJa: __dirname + path.sep + 'examples-alt-caption-fallback-ja.txt',
  titleCaptionFallback: __dirname + path.sep + 'examples-title-caption-fallback.txt',
  titleCaptionFallbackJa: __dirname + path.sep + 'examples-title-caption-fallback-ja.txt',
  altCaptionFallbackNumbered: __dirname + path.sep + 'examples-alt-caption-fallback-numbered.txt',
  autoLabelNumberSets: __dirname + path.sep + 'examples-set-label-with-numbers.txt',
  autoLabelNumberSetsSkip: __dirname + path.sep + 'examples-set-label-numbers-skip.txt',
  withStrongJa: __dirname + path.sep + 'examples-with-strong-ja.txt',
}

const mutateCaptionClosePlugin = (md) => {
  md.core.ruler.before('figure_with_caption', 'test_mutate_caption_close', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length - 2; i++) {
      const openToken = tokens[i]
      const inlineToken = tokens[i + 1]
      const closeToken = tokens[i + 2]
      if (!openToken || !inlineToken || !closeToken) continue
      if (openToken.type !== 'paragraph_open') continue
      if (inlineToken.type !== 'inline') continue
      if (closeToken.type !== 'paragraph_close') continue
      if (!/^Figure\./.test(inlineToken.content.trim())) continue
      closeToken.meta = closeToken.meta || {}
      closeToken.meta.originalType = closeToken.type
      closeToken.type = 'test_custom_paragraph_close'
    }
  })
  md.core.ruler.after('figure_with_caption', 'test_restore_caption_close', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'test_custom_paragraph_close' && token.meta && token.meta.originalType) {
        token.type = token.meta.originalType
        delete token.meta.originalType
      }
    }
  })
}

const getTestData = (pat) => {
  let ms = [];
  if(!fs.existsSync(pat)) {
    console.log('No exist: ' + pat)
    return ms
  }
  const exampleCont = fs.readFileSync(pat, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  let ms0 = exampleCont.split(/(?:\r?\n)*\[Markdown\]\r?\n/);
  let n = 1;
  while(n < ms0.length) {
    let mhs = ms0[n].split(/(?:\r?\n)+\[HTML[^\]]*?\]\r?\n/);
    let i = 1;
    while (i < 2) {
      if (mhs[i] === undefined) {
        mhs[i] = '';
      } else {
        // If the HTML block ends with a closing tag (like <dl>), do not add a newline at the end.
        // Also, markdown-it does not output a newline after closing tags like </dd> or </dt>, so this prevents false negatives in tests.
        if (/<\/[a-zA-Z]+>$/.test(mhs[0].trim()) && !/<\/(?:video|figure)>$/.test(mhs[1].trim())) {
          mhs[i] = mhs[i]
        } else {
          mhs[i] = mhs[i] + '\n';
        }
      }
      i++;
    }
    ms[n] = {
      "markdown": mhs[0],
      "html": mhs[1],
    };
    n++;
  }
  return ms
}

const runTest = (process, pat, pass, testId) => {
  console.log('===========================================================')
  console.log(pat)
  let ms = getTestData(pat)
  if (ms.length === 0) return
  let n = 1;
  let end = ms.length - 1
  if(testId) {
    if (testId[0]) n = testId[0]
    if (testId[1]) {
      if (ms.length >= testId[1]) {
        end = testId[1]
      }
    }
  }
  //console.log(n, end)

  while(n <= end) {

    if (!ms[n]
      //|| n != 11
    ) {
      n++
      continue
    }

    const m = ms[n].markdown;
    const h = process.render(m)
    console.log('Test: ' + n + ' >>>');
    //console.log(ms[n].markdown);
    try {
      assert.strictEqual(h, ms[n].html);
    } catch(e) {
      pass = false
      //console.log('Test: ' + n + ' >>>');
      //console.log(opt);
      console.log(ms[n].markdown);
      console.log('incorrect:');
      console.log('H: ' + h +'C: ' + ms[n].html);
      console.log('H length:', h.length, 'C length:', ms[n].html.length);
      //console.log('H last 10 chars:', JSON.stringify(h.slice(-10)));
      //console.log('C last 10 chars:', JSON.stringify(ms[n].html.slice(-10)));
    }
    n++;
  }
  return pass
}

let pass = true
pass = runTest(md, testData.noOption, pass)
pass = runTest(mdWithStrongJa, testData.withStrongJa, pass)
pass = runTest(mdHasNumClass, testData.hasNumClass, pass)
pass = runTest(mdOneImage, testData.oneImageWithoutCaption, pass)
pass = runTest(mdIframeWithoutCaption, testData.iframeWithoutCaption, pass)
pass = runTest(mdIframeTypeBlockquoteWithoutCaption, testData.iframeTypeBlockquoteWithoutCaption, pass)
pass = runTest(mdIframeTypeBlockquoteWithCaption, testData.iframeTypeBlockquoteWithCaption, pass)
pass = runTest(mdMultipleImages, testData.multipleImages, pass)
pass = runTest(mdVideoWithoutCaption, testData.videoWithoutCaption, pass)
pass = runTest(mdAudioWithoutCaption, testData.audioWithoutCaption, pass)
pass = runTest(mdConsole, testData.console, pass)
pass = runTest(mdAutoCaptionDetection, testData.autoCaptionDetection, pass)
pass = runTest(mdAutoCaptionDetection, testData.autoCaptionDetectionManualPriority, pass)
pass = runTest(mdAutoCaptionDetection, testData.autoCaptionDetectionMultiImages, pass)
pass = runTest(mdLabelPrefixMarkerWithLabel, testData.labelPrefixMarkerWithLabel, pass)
pass = runTest(mdLabelPrefixMarkerWithoutLabel, testData.allowLabelPrefixMarkerWithoutLabel, pass)
pass = runTest(mdRecommendedDefaults, testData.recommendedOptions, pass)
pass = runTest(mdRecommendedDefaultsNumbered, testData.recommendedOptionsNumbered, pass)
pass = runTest(mdAltCaptionFallback, testData.altCaptionFallback, pass)
pass = runTest(mdAltCaptionFallback, testData.altCaptionFallbackJa, pass)
pass = runTest(mdAltCaptionFallbackNumbered, testData.altCaptionFallbackNumbered, pass)
pass = runTest(mdTitleCaptionFallback, testData.titleCaptionFallback, pass)
pass = runTest(mdTitleCaptionFallback, testData.titleCaptionFallbackJa, pass)
pass = runTest(mdAutoLabelNumberSets, testData.autoLabelNumberSets, pass)
pass = runTest(mdAutoLabelNumberSets, testData.autoCaptionDetectionNumbered, pass)
pass = runTest(mdAutoLabelNumber, testData.autoLabelNumber, pass)

const mdAutoLabelNumberSetsSkip = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoCaptionDetection: true,
  autoLabelNumberSets: ['img'],
  oneImageWithoutCaption: true,
}).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdAutoLabelNumberSetsSkip, testData.autoLabelNumberSetsSkip, pass)

const mdAutoAltCaptionCustom = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoCaptionDetection: true,
  autoAltCaption: '図',
}).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdAutoAltCaptionCustom, testData.autoAltCaptionCustom, pass)

const mdAutoTitleCaptionCustom = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoCaptionDetection: true,
  autoTitleCaption: '図',
}).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdAutoTitleCaptionCustom, testData.autoTitleCaptionCustom, pass)

opt = {}
opt.videoWithoutCaption = true
opt.iframeWithoutCaption = true
opt.iframeTypeBlockquoteWithoutCaption = true
opt.allIframeTypeFigureClassName = 'f-embed'
const mdAllIframeTypeFigureClassName = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdAllIframeTypeFigureClassName, testData.allIframeTypeFigureClassName, pass)
pass = runTest(mdLabelClassFollowsFigure, testData.optionLabelClassFollowsFigure, pass)
pass = runTest(mdLabelClassMap, testData.optionFigureToLabelClassMap, pass)
pass = runTest(mdCustomSlideFigureClass, testData.figureClassThatWrapsSlides, pass)

const mdCaptionGuard = mdit({ html: true }).use(mdFigureWithPCaption).use(mutateCaptionClosePlugin)
const captionGuardMarkdown = 'Figure. Guard caption.\n\n![Figure](guard.jpg)'
const captionGuardExpected = '<p>Figure. Guard caption.</p>\n<p><img src="guard.jpg" alt="Figure"></p>\n'
const captionGuardHtml = mdCaptionGuard.render(captionGuardMarkdown)
try {
  assert.strictEqual(captionGuardHtml, captionGuardExpected)
} catch (e) {
  pass = false
  console.log('Caption guard regression failed.')
  console.log('Expected:', captionGuardExpected)
  console.log('Result:', captionGuardHtml)
}

if (pass) console.log('Passed all test.')

