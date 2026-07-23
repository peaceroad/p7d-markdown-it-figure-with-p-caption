import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import mditRndererFence from '@peaceroad/markdown-it-renderer-fence'
import mditStrongJa from '@peaceroad/markdown-it-strong-ja'
import mditBreaks from '@peaceroad/markdown-it-cjk-breaks-mod'
import mditFrontMatter from 'markdown-it-front-matter'
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

try {
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
} catch (e) {
  pass = false
  console.log('code/samp shared caption numbering failed.')
  console.log(e)
}

try {
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
} catch (e) {
  pass = false
  console.log('video caption numbering failed.')
  console.log(e)
}

try {
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
} catch (e) {
  pass = false
  console.log('expanded numbering option flow failed.')
  console.log(e)
}

const createScopedMd = (scope = { sources: ['heading'], headingLevels: [1], repeatScope: 'continue' }, separator = '-') => (
  mdit({ html: true }).use(mdFigureWithPCaption, {
    autoLabelNumber: true,
    autoLabelNumberPolicy: { separator, scope },
  })
)
const scopedFigureMarkdown = (heading, caption = 'Figure. Caption.') => (
  `${heading}\n\n![A](a.jpg)\n\n${caption}`
)
const getRenderedFigureNumbers = (html) => Array.from(html.matchAll(/>Figure ([A-Z0-9.-]+)<span/g), match => match[1])

try {
  const recognizedScopes = [
    ['# Chapter 1', '1-1'],
    ['# chapter 2: Title', '2-1'],
    ['# 第3章　題', '3-1'],
    ['# 4章 題', '4-1'],
    ['# Appendix 5', '5-1'],
    ['# Appendix A: Data', 'A-1'],
    ['# 付録B　資料', 'B-1'],
    ['# 付属6：資料', '6-1'],
    ['# 附属C：資料', 'C-1'],
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
    ['1-1'],
  )
  assert.deepStrictEqual(
    getRenderedFigureNumbers(createScopedMd().render(scopedFigureMarkdown('# Chapter 1 *Introduction*'))),
    ['1-1'],
  )

  const repeated = '# Chapter 1\n\n![A](a.jpg)\n\nFigure. First.\n\n# Chapter 1\n\n![B](b.jpg)\n\nFigure. Second.'
  assert.deepStrictEqual(getRenderedFigureNumbers(createScopedMd().render(repeated)), ['1-1', '1-2'])
  assert.deepStrictEqual(
    getRenderedFigureNumbers(createScopedMd({ sources: ['heading'], headingLevels: [1], repeatScope: 'reset' }).render(repeated)),
    ['1-1', '1-1'],
  )

  const beforeAndAfter = '![A](a.jpg)\n\nFigure. Before.\n\n# Chapter 2\n\n![B](b.jpg)\n\nFigure 2-5. Manual.\n\n![C](c.jpg)\n\nFigure. After.'
  assert.deepStrictEqual(getRenderedFigureNumbers(createScopedMd().render(beforeAndAfter)), ['1', '2-5', '2-6'])
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
      ['2-1'],
    )
  }
} catch (e) {
  pass = false
  console.log('advanced heading scope numbering regression failed.')
  console.log(e)
}

try {
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
} catch (e) {
  pass = false
  console.log('mixed scoped caption numbering failed.')
  console.log(e)
}

try {
  const frontmatterMd = createScopedMd({
    sources: ['frontmatter', 'heading'],
    headingLevels: [1],
    repeatScope: 'continue',
  }, '.')
  const source = '![A](a.jpg)\n\nFigure. Caption.'
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
        scope: { scopeKey: 'appendix:C', sequenceKey: 3, displayPrefix: 'C' },
      },
    })),
    ['C-1'],
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
  const reusedEnv = { frontmatter: { title: 'Chapter 4' } }
  assert.deepStrictEqual(getRenderedFigureNumbers(frontmatterMd.render(source, reusedEnv)), ['4.1'])
  reusedEnv.frontmatter.title = 'Chapter 5'
  assert.deepStrictEqual(getRenderedFigureNumbers(frontmatterMd.render(source, reusedEnv)), ['5.1'])
  assert.deepStrictEqual(getRenderedFigureNumbers(frontmatterMd.render(source, reusedEnv)), ['5.1'])

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
} catch (e) {
  pass = false
  console.log('frontmatter/env scope numbering regression failed.')
  console.log(e)
}

try {
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
} catch (e) {
  pass = false
  console.log('advanced numbering option validation failed.')
  console.log(e)
}

if (pass) {
  console.log('Passed all test.')
} else {
  process.exitCode = 1
}
