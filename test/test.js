import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import mditRndererFence from '@peaceroad/markdown-it-renderer-fence'
import mditStrongJa from '@peaceroad/markdown-it-strong-ja'
import mditBreaks from '@peaceroad/markdown-it-cjk-breaks-mod'
import mditPCaption from 'p7d-markdown-it-p-captions'

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
    'f-slide': 'caption-slide-label caption-slide-extra',
    'f-img': ['c-figure', 'alt-figure-body'],
  },
}).use(mditAttrs).use(mditRndererFence);

const mdLabelClassMapImplicit = mdit({ html: true }).use(mdFigureWithPCaption, {
  wrapCaptionBody: true,
  figureClassThatWrapsIframeTypeBlockquote: 'f-embed',
  figureToLabelClassMap: {
    'f-embed': 'caption-embed caption-social',
    'f-slide': 'caption-slide-label caption-slide-extra',
    'f-img': ['c-figure', 'alt-figure-body'],
  },
}).use(mditAttrs).use(mditRndererFence);

const mdLabelClassBoundaryNumbering = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoLabelNumber: true,
  labelClassFollowsFigure: true,
  figureToLabelClassMap: {
    'f-img': 'prefix-f-img-label',
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
const mdAltCaptionFallbackJaOnly = mdit({ html: true }).use(mdFigureWithPCaption, {
  languages: ['ja'],
  autoCaptionDetection: true,
  autoAltCaption: true,
}).use(mditAttrs).use(mditRndererFence);
const mdAltCaptionFallbackPreferredJa = mdit({ html: true }).use(mdFigureWithPCaption, {
  languages: ['ja', 'en'],
  autoCaptionDetection: true,
  autoAltCaption: true,
}).use(mditAttrs).use(mditRndererFence);
const mdAltCaptionFallbackEnOnly = mdit({ html: true }).use(mdFigureWithPCaption, {
  languages: ['en'],
  autoCaptionDetection: true,
  autoAltCaption: true,
}).use(mditAttrs).use(mditRndererFence);
const mdAltCaptionFallbackUnsupported = mdit({ html: true }).use(mdFigureWithPCaption, {
  languages: ['fr', 'de'],
  autoCaptionDetection: true,
  autoAltCaption: true,
}).use(mditAttrs).use(mditRndererFence);
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
  if (ms.length === 0) return pass
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

const mdStyleProcessNoAttrs = mdit({ html: true }).use(mdFigureWithPCaption, {
  styleProcess: true,
  oneImageWithoutCaption: true,
})
const mdStyleProcessNoWrap = mdit({ html: true }).use(mdFigureWithPCaption, {
  styleProcess: true,
})
try {
  assert.strictEqual(
    mdStyleProcessNoAttrs.render('Figure. A Caption.\n\n![Figure](cat.jpg) {.style #id}'),
    '<figure class="f-img style" id="id">\n<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> A Caption.</figcaption>\n<img src="cat.jpg" alt="Figure">\n</figure>\n',
  )
  assert.strictEqual(
    mdStyleProcessNoAttrs.render('![Figure](cat.jpg) {.solo}'),
    '<figure class="f-img solo">\n<img src="cat.jpg" alt="Figure">\n</figure>\n',
  )
  assert.strictEqual(
    mdStyleProcessNoAttrs.render('![Figure](cat.jpg) {.solo data-title="hello world" data-note=\'single quoted\'}'),
    '<figure class="f-img solo" data-title="hello world" data-note="single quoted">\n<img src="cat.jpg" alt="Figure">\n</figure>\n',
  )
  assert.ok(!mdStyleProcessNoAttrs.render('![Figure](cat.jpg) {data-title="unterminated value}').includes('<figure'))
  assert.strictEqual(
    mdStyleProcessNoWrap.render('![Figure](cat.jpg) {.style}'),
    '<p><img src="cat.jpg" alt="Figure"> {.style}</p>\n',
  )
  assert.strictEqual(
    mdStyleProcessNoWrap.render('![One](one.jpg) ![Two](two.jpg)'),
    '<p><img src="one.jpg" alt="One"> <img src="two.jpg" alt="Two"></p>\n',
  )
} catch (e) {
  pass = false
  console.log('styleProcess without markdown-it-attrs regression failed.')
  console.log(e)
}

const mdImageOnlyParagraphWithoutCaption = mdit({ html: true }).use(mdFigureWithPCaption, {
  imageOnlyParagraphWithoutCaption: true,
})
const mdImageOnlyParagraphWithoutCaptionPrecedence = mdit({ html: true }).use(mdFigureWithPCaption, {
  imageOnlyParagraphWithoutCaption: false,
  oneImageWithoutCaption: true,
})
const mdVideoWithoutCaptionOnly = mdit({ html: true }).use(mdFigureWithPCaption, {
  videoWithoutCaption: true,
})
const mdHtmlDisabled = mdit({ html: false }).use(mdFigureWithPCaption, {
  iframeWithoutCaption: true,
  videoWithoutCaption: true,
})
const mdAutoAltCaptionFigureDot = mdit({ html: true }).use(mdFigureWithPCaption, {
  autoCaptionDetection: true,
  autoAltCaption: 'Figure.',
})
const mdTokenMetadata = mdit({ html: true }).use(mdFigureWithPCaption)
const mdHtmlNoopBaseline = mdit({ html: true })
const mdHtmlNoopPlugin = mdit({ html: true }).use(mdFigureWithPCaption)
const mdRepeatedPluginUse = mdit({ html: true })
  .use(mdFigureWithPCaption)
  .use(mdFigureWithPCaption, { classPrefix: 'ignored' })
try {
  assert.strictEqual(
    mdRepeatedPluginUse.core.ruler.__rules__.filter((rule) => rule.name === 'figure_with_caption').length,
    1,
  )
  assert.ok(mdRepeatedPluginUse.render('![A](a.jpg)\n\nFigure. Caption.').includes('class="f-img"'))
  assert.ok(!mdRepeatedPluginUse.render('![A](a.jpg)\n\nFigure. Caption.').includes('ignored-img'))
  assert.doesNotThrow(
    () => mdRepeatedPluginUse.use(mdFigureWithPCaption, { setFigureNumber: true }),
  )
  assert.ok(
    mdit().use(mdFigureWithPCaption, { roleDocExample: true })
      .render('Code. Example.\n\n```js\nx\n```')
      .includes('<figure class="f-pre-code" role="doc-example">'),
  )
  assert.ok(
    mdit().use(mdFigureWithPCaption, { bLabel: true })
      .render('![A](a.jpg)\n\nFigure. Caption.')
      .includes('<b class="f-img-label">'),
  )
  assert.ok(
    mdit().use(mdFigureWithPCaption, { strongLabel: true })
      .render('![A](a.jpg)\n\nFigure. Caption.')
      .includes('<strong class="f-img-label">'),
  )
  assert.ok(
    mdit().use(mdFigureWithPCaption, { removeMarkNameInCaptionClass: true })
      .render('![A](a.jpg)\n\nFigure. Caption.')
      .includes('<span class="f-label">'),
  )
  const mirroredSlideHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    labelClassFollowsFigure: true,
    wrapCaptionBody: true,
    figureClassThatWrapsSlides: 'f-slide-custom',
    figureToLabelClassMap: { 'f-slide-custom': 'caption-slide' },
  }).render('Slide. Custom slide.\n\n<iframe src="https://example.com/x"></iframe>')
  assert.ok(mirroredSlideHtml.includes('<figure class="f-slide-custom">'))
  assert.ok(mirroredSlideHtml.includes('<span class="caption-slide-label f-slide-label">'))
  assert.ok(mirroredSlideHtml.includes('<span class="caption-slide-body f-slide-body">'))
  assert.ok(!mirroredSlideHtml.includes('f-iframe-label'))
  assert.strictEqual(
    mdit().use(mdFigureWithPCaption, { autoCaptionDetection: false })
      .render('![Figure. Keep alt](a.jpg)'),
    '<p><img src="a.jpg" alt="Figure. Keep alt"></p>\n',
  )
  assert.ok(
    !mdit().use(mdFigureWithPCaption, { multipleImages: false })
      .render('![A](a.jpg) ![B](b.jpg)\n\nFigure. Keep paragraph.')
      .includes('<figure'),
  )
  assert.ok(
    !mdit().use(mdFigureWithPCaption, { styleProcess: false })
      .render('![A](a.jpg){.wide}\n\nFigure. Keep paragraph.')
      .includes('<figure'),
  )
  const noClassPrefixHtml = mdit().use(mdFigureWithPCaption, { classPrefix: '' })
    .render('![A](a.jpg)\n\nFigure. Caption.')
  assert.ok(noClassPrefixHtml.includes('<figure class="img">'))
  assert.ok(noClassPrefixHtml.includes('<span class="img-label">'))
  const policyWithoutMarksHtml = mdit().use(mdFigureWithPCaption, {
    autoLabelNumberPolicy: { separator: '.', scope: { sources: ['heading'] } },
  }).render('# Chapter 2\n\n![A](a.jpg)\n\nFigure. Caption.')
  assert.ok(policyWithoutMarksHtml.includes('>Figure<span'))
  assert.ok(!policyWithoutMarksHtml.includes('>Figure 2.1<span'))
  const explicitNoClassMirroringHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    labelClassFollowsFigure: false,
    figureClassThatWrapsIframeTypeBlockquote: 'f-embed',
    figureToLabelClassMap: { 'f-embed': 'caption-embed' },
  }).render('Source. Embed.\n\n<blockquote class="twitter-tweet"></blockquote>')
  assert.ok(explicitNoClassMirroringHtml.includes('<figure class="f-embed">'))
  assert.ok(!explicitNoClassMirroringHtml.includes('caption-embed-label'))
  assert.strictEqual(
    mdImageOnlyParagraphWithoutCaption.render('![A](a.jpg) ![B](b.jpg)'),
    '<figure class="f-img-horizontal">\n<img src="a.jpg" alt="A"><img src="b.jpg" alt="B">\n</figure>\n',
  )
  assert.strictEqual(
    mdImageOnlyParagraphWithoutCaptionPrecedence.render('![A](a.jpg)'),
    '<p><img src="a.jpg" alt="A"></p>\n',
  )
  assert.strictEqual(
    mdVideoWithoutCaptionOnly.render('<IFRAME width="560" height="315" src="https://www.youtube.com/embed/56b9uHAcHYc?si=azphXJdsZGrojpgp" title="YouTube video player"></IFRAME>'),
    '<figure class="f-video">\n<IFRAME width="560" height="315" src="https://www.youtube.com/embed/56b9uHAcHYc?si=azphXJdsZGrojpgp" title="YouTube video player"></IFRAME>\n</figure>\n',
  )
  assert.strictEqual(
    mdVideoWithoutCaptionOnly.render('<div class="embed"><iframe src="https://example.com/embed"></iframe></div>'),
    '<div class="embed"><iframe src="https://example.com/embed"></iframe></div>\n',
  )
  for (const source of [
    '<blockquote class="ordinary">Not an embed.</blockquote>',
    '<div><iframe-widget></iframe-widget></div>',
    '<video-player></video-player>',
    '<audio-player></audio-player>',
    '<blockquote-widget></blockquote-widget>',
  ]) {
    assert.strictEqual(mdHtmlNoopPlugin.render(source), mdHtmlNoopBaseline.render(source))
  }
  assert.strictEqual(
    mdVideoWithoutCaptionOnly.render('<div class="embed"><iframe src="https://www.youtube.com/embed/x"></iframe></div>'),
    '<figure class="f-video">\n<div class="embed"><iframe src="https://www.youtube.com/embed/x"></iframe></div>\n</figure>\n',
  )
  assert.ok(!mdHtmlDisabled.render('<iframe src="https://www.youtube.com/embed/x"></iframe>').includes('<figure'))
  assert.strictEqual(
    mdAutoAltCaptionFigureDot.render('![Plain alt](plain.jpg)'),
    '<figure class="f-img">\n<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Plain alt</figcaption>\n<img src="plain.jpg" alt="">\n</figure>\n',
  )
  assert.strictEqual(
    mdit().use(mdFigureWithPCaption, { autoAltCaption: '図　' }).render('![Plain alt](plain.jpg)'),
    '<figure class="f-img">\n<figcaption><span class="f-img-label">図<span class="f-img-label-joint">　</span></span>Plain alt</figcaption>\n<img src="plain.jpg" alt="">\n</figure>\n',
  )
  const imageMetadataTokens = mdTokenMetadata.parse('Figure. Caption.\n\n![Figure](cat.jpg)', {})
  const imageFigureOpen = imageMetadataTokens.find((token) => token.type === 'figure_open')
  const imageFigureClose = imageMetadataTokens.find((token) => token.type === 'figure_close')
  const imageFigcaptionOpen = imageMetadataTokens.find((token) => token.type === 'figcaption_open')
  assert.deepStrictEqual(imageFigureOpen.map, [2, 3])
  assert.deepStrictEqual(imageFigureClose.map, [2, 3])
  assert.strictEqual(imageFigureOpen.block, true)
  assert.strictEqual(imageFigureClose.block, true)
  assert.strictEqual(imageFigureOpen.level, 0)
  assert.strictEqual(imageFigureClose.level, 0)
  assert.strictEqual(imageFigcaptionOpen.level, 1)
  const tableMetadataTokens = mdTokenMetadata.parse('Table. Caption.\n\n| A |\n| - |', {})
  const tableFigureOpen = tableMetadataTokens.find((token) => token.type === 'figure_open')
  const tableFigureClose = tableMetadataTokens.find((token) => token.type === 'figure_close')
  const tableOpen = tableMetadataTokens.find((token) => token.type === 'table_open')
  assert.deepStrictEqual(tableFigureOpen.map, [2, 4])
  assert.deepStrictEqual(tableFigureClose.map, [2, 4])
  assert.strictEqual(tableFigureOpen.block, true)
  assert.strictEqual(tableFigureClose.block, true)
  assert.strictEqual(tableFigureOpen.level, 0)
  assert.strictEqual(tableFigureClose.level, 0)
  assert.strictEqual(tableOpen.level, 1)
  assert.throws(
    () => mdit({ html: true }).use(mdFigureWithPCaption, { autoCaptionDetection: true, autoAltCaption: 'Foo' }),
    /autoAltCaption/,
  )
  assert.throws(
    () => mdit({ html: true }).use(mdFigureWithPCaption, { autoCaptionDetection: true, autoTitleCaption: 'Foo' }),
    /autoTitleCaption/,
  )
  assert.throws(
    () => mdit({ html: true }).use(mdFigureWithPCaption, { autoAltCaption: 1 }),
    /autoAltCaption/,
  )
  assert.throws(
    () => mdit({ html: true }).use(mdFigureWithPCaption, { autoTitleCaption: {} }),
    /autoTitleCaption/,
  )
  assert.throws(
    () => mdit({ html: true }).use(mdFigureWithPCaption, { setFigureNumber: true }),
    /autoLabelNumber or autoLabelNumberSets/,
  )
  assert.strictEqual(
    mdAutoCaptionDetection.render('- ![Figure. Tight-list alt](tight.jpg)'),
    '<ul>\n<li><img src="tight.jpg" alt="Figure. Tight-list alt"></li>\n</ul>\n',
  )
  assert.strictEqual(
    mdAutoCaptionDetection.render('![Figure. Invalid target](invalid.jpg) trailing text'),
    '<p><img src="invalid.jpg" alt="Figure. Invalid target"> trailing text</p>\n',
  )
  const mdCompoundManualNumber = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumber: true,
  })
  const compoundNumberHtml = mdCompoundManualNumber.render(
    'Figure A.5. Compound number.\n\n![A](a.jpg)\n\nFigure. Next number.\n\n![B](b.jpg)',
  )
  assert.ok(compoundNumberHtml.includes('>Figure A.5<span'))
  assert.ok(compoundNumberHtml.includes('>Figure 1<span'))
  assert.throws(
    () => mdCompoundManualNumber.render(
      'Figure 999999. Seed.\n\n![A](a.jpg)\n\nFigure. Overflow.\n\n![B](b.jpg)',
    ),
    RangeError,
  )
} catch (e) {
  pass = false
  console.log('new behavior regression failed.')
  console.log(e)
}

const mdTrimmedClassOptions = mdit({ html: true }).use(mdFigureWithPCaption, {
  classPrefix: ' custom ',
  allIframeTypeFigureClassName: '  f-embed  ',
  iframeWithoutCaption: true,
}).use(mditAttrs).use(mditRndererFence)
const mdBlankOverrideFallbacks = mdit({ html: true }).use(mdFigureWithPCaption, {
  figureClassThatWrapsIframeTypeBlockquote: '   ',
  figureClassThatWrapsSlides: '   ',
}).use(mditAttrs).use(mditRndererFence)
try {
  assert.ok(mdTrimmedClassOptions.render('Figure. A Caption.\n\n![Figure](cat.jpg)').includes('<figure class="custom-img">'))
  assert.ok(mdTrimmedClassOptions.render('<iframe src="https://example.com/embed"></iframe>').includes('<figure class="f-embed">'))
  assert.ok(mdBlankOverrideFallbacks.render('Figure. Social.\n\n<blockquote class="twitter-tweet"></blockquote>').includes('<figure class="f-img">'))
  assert.ok(mdBlankOverrideFallbacks.render('Slide. Deck.\n\n<iframe src="https://speakerdeck.com/player/xxxx"></iframe>').includes('<figure class="f-slide">'))
  assert.ok(mdAltCaptionFallbackJaOnly.render('![A cat](cat.jpg)').includes('<span class="f-img-label">図'))
  assert.ok(mdAltCaptionFallbackPreferredJa.render('![A cat](cat.jpg)').includes('<span class="f-img-label">図'))
  assert.ok(mdAltCaptionFallbackEnOnly.render('![ねこ](cat.jpg)').includes('<span class="f-img-label">Figure'))
  assert.equal(mdAltCaptionFallbackUnsupported.render('![A cat](cat.jpg)'), '<p><img src="cat.jpg" alt="A cat"></p>\n')
  assert.ok(mdAltCaptionFallback.render('![A cat](cat.jpg)', { locale: 'ja-JP' }).includes('<span class="f-img-label">図'))
  assert.ok(mdAltCaptionFallback.render('![A cat](cat.jpg)', { preferredLocales: ['ja-JP', 'en-US'] }).includes('<span class="f-img-label">図'))
  assert.ok(mdAltCaptionFallback.render('![A cat](cat.jpg)', { lang: 'ja' }).includes('<span class="f-img-label">図'))
  let localeReads = 0
  const lazyLocaleEnv = {}
  Object.defineProperty(lazyLocaleEnv, 'locale', {
    get() {
      localeReads++
      return 'ja-JP'
    },
  })
  mdAltCaptionFallback.render('Figure. Manual.\n\n![A](manual.jpg)', lazyLocaleEnv)
  assert.strictEqual(localeReads, 0)
  mdAltCaptionFallback.render('![A cat](cat-1.jpg)\n\n![Another cat](cat-2.jpg)', lazyLocaleEnv)
  assert.strictEqual(localeReads, 1)
  const injectImageToken = (md) => {
    md.core.ruler.before('figure_with_caption', 'inject_test_image', (state) => {
      const inlineToken = state.tokens.find((token) => token.type === 'inline' && token.content === 'INJECT_IMAGE')
      if (!inlineToken) return
      const imageToken = new state.Token('image', 'img', 0)
      imageToken.attrs = [['src', 'injected.jpg'], ['alt', 'A cat']]
      imageToken.content = 'A cat'
      const altToken = new state.Token('text', '', 0)
      altToken.content = 'A cat'
      imageToken.children = [altToken]
      inlineToken.children = [imageToken]
    })
  }
  const injectedImageMd = mdit().use(mdFigureWithPCaption, {
    autoAltCaption: true,
  }).use(injectImageToken)
  assert.ok(
    injectedImageMd.render('INJECT_IMAGE', { locale: 'ja-JP' })
      .includes('<span class="f-img-label">図'),
  )
  const mdAltCaptionFallbackOptionPreferredEn = mdit({ html: true }).use(mdFigureWithPCaption, {
    languages: ['en', 'ja'],
    preferredLanguages: ['en'],
    autoCaptionDetection: true,
    autoAltCaption: true,
  })
  assert.ok(mdAltCaptionFallbackOptionPreferredEn.render('![A cat](cat.jpg)').includes('<span class="f-img-label">Figure'))
  assert.ok(mdAltCaptionFallbackOptionPreferredEn.render('![A cat](cat.jpg)', { locale: 'ja' }).includes('<span class="f-img-label">図'))
  assert.ok(mdAltCaptionFallback.render('日本語の本文です。\n\n![A cat](cat.jpg)').includes('<span class="f-img-label">図'))
  assert.ok(mdAltCaptionFallback.render('----\ntitle: Example\nlang: en\n---\n\n日本語の本文です。\n\n![A cat](cat.jpg)').includes('<span class="f-img-label">図'))
  assert.ok(!mdAutoAltCaptionCustom.render('![](empty.jpg)').includes('<figcaption>'))
  assert.ok(!mdAutoTitleCaptionCustom.render('![Alt stays](empty.jpg "")').includes('<figcaption>'))
  assert.ok(!mdRecommendedDefaultsNumbered.render('![](empty.jpg)').includes('f-img-label">Figure 1'))
  const mixedFallbackHtml = mdAltCaptionFallback.render('![A cat](cat-en.jpg)\n\n![ねこ](cat-ja.jpg)')
  assert.ok(mixedFallbackHtml.includes('<figcaption><span class="f-img-label">Figure'))
  assert.ok(mixedFallbackHtml.includes('<figcaption><span class="f-img-label">図'))
  const labelBoundaryHtml = mdLabelClassBoundaryNumbering.render('Figure. Boundary.\n\n![Figure](cat.jpg)')
  assert.ok(labelBoundaryHtml.includes('class="prefix-f-img-label f-img-label"'))
  assert.ok(labelBoundaryHtml.includes('Figure 1'))
  const generatedHasNumClassHtml = mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumber: true,
    hasNumClass: true,
  }).render('Figure. Generated.\n\n![Figure](generated.jpg)')
  assert.ok(generatedHasNumClassHtml.includes('Figure 1'))
  assert.ok(!generatedHasNumClassHtml.includes('label-has-num'))
} catch (e) {
  pass = false
  console.log('class option normalization regression failed.')
  console.log(e)
}

opt = {}
opt.videoWithoutCaption = true
opt.iframeWithoutCaption = true
opt.iframeTypeBlockquoteWithoutCaption = true
opt.allIframeTypeFigureClassName = 'f-embed'
const mdAllIframeTypeFigureClassName = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdAllIframeTypeFigureClassName, testData.allIframeTypeFigureClassName, pass)
pass = runTest(mdLabelClassFollowsFigure, testData.optionLabelClassFollowsFigure, pass)
pass = runTest(mdLabelClassMap, testData.optionFigureToLabelClassMap, pass)
pass = runTest(mdLabelClassMapImplicit, testData.optionFigureToLabelClassMap, pass)
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

// Regression guard: p-captions language selection in another md instance
// must not change figure-with-p-caption detection behavior.
const languageIsolationMarkdown = '図. 日本語キャプション\n\n![alt](a.jpg)'
const mdFigureIsolationBaseline = mdit({ html: true }).use(mdFigureWithPCaption)
const languageIsolationExpected = mdFigureIsolationBaseline.render(languageIsolationMarkdown)

const mdPCaptionEnglishOnly = mdit({ html: true }).use(mditPCaption, { languages: ['en'] })
mdPCaptionEnglishOnly.render('Figure. English caption')

const mdFigureIsolationAfter = mdit({ html: true }).use(mdFigureWithPCaption)
const languageIsolationActual = mdFigureIsolationAfter.render(languageIsolationMarkdown)
try {
  assert.strictEqual(languageIsolationActual, languageIsolationExpected)
} catch (e) {
  pass = false
  console.log('Language isolation regression failed.')
  console.log('Expected:', languageIsolationExpected)
  console.log('Result:', languageIsolationActual)
}

// Regression guard: figure plugin must forward language-specific markRegState
// to setCaptionParagraph when calling p-captions helper directly.
const figureLanguageMarkdownEn = 'Figure. English caption.\n\n![alt](en.jpg)'
const figureLanguageMarkdownJa = '図. 日本語キャプション\n\n![alt](ja.jpg)'
const mdFigureEnOnly = mdit({ html: true }).use(mdFigureWithPCaption, { languages: ['en'] })
const mdFigureJaOnly = mdit({ html: true }).use(mdFigureWithPCaption, { languages: ['ja'] })
const figureLanguageEnHtml = mdFigureEnOnly.render(figureLanguageMarkdownEn)
const figureLanguageJaHtmlFromEn = mdFigureEnOnly.render(figureLanguageMarkdownJa)
const figureLanguageJaHtml = mdFigureJaOnly.render(figureLanguageMarkdownJa)
const figureLanguageEnHtmlFromJa = mdFigureJaOnly.render(figureLanguageMarkdownEn)
try {
  assert.ok(figureLanguageEnHtml.includes('<figure class="f-img">'))
  assert.ok(!figureLanguageJaHtmlFromEn.includes('<figure class="f-img">'))
  assert.ok(figureLanguageJaHtml.includes('<figure class="f-img">'))
  assert.ok(!figureLanguageEnHtmlFromJa.includes('<figure class="f-img">'))
} catch (e) {
  pass = false
  console.log('Figure language option regression failed.')
  console.log('en-only (en caption):', figureLanguageEnHtml)
  console.log('en-only (ja caption):', figureLanguageJaHtmlFromEn)
  console.log('ja-only (ja caption):', figureLanguageJaHtml)
  console.log('ja-only (en caption):', figureLanguageEnHtmlFromJa)
}

if (pass) {
  console.log('Passed all test.')
} else {
  process.exitCode = 1
}
