import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import mditRndererFence from '@peaceroad/markdown-it-renderer-fence'

import mdFigureWithPCaption from '../index.js'
import highlightjs from 'highlight.js'

let opt = {
  dquoteFilename: true,
  strongFilename: true,
  oneImageWithoutCaption: false,
  iframeWithoutCaption: false,
  videoWithoutCaption: false,
  hasNumClass: false,
  iframeTypeBlockquoteWithoutCaption: false,
  setFigureNumber: false,
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

const mdAutoCaptionDetection = mdit({ html: true }).use(mdFigureWithPCaption, { automaticCaptionDetection: true }).use(mditAttrs).use(mditRndererFence);
const mdAltCaptionFallback = mdit({ html: true }).use(mdFigureWithPCaption, { automaticCaptionDetection: true, altCaptionFallback: true }).use(mditAttrs).use(mditRndererFence);
const mdTitleCaptionFallback = mdit({ html: true }).use(mdFigureWithPCaption, { automaticCaptionDetection: true, titleCaptionFallback: true }).use(mditAttrs).use(mditRndererFence);
const mdAltCaptionFallbackNumbered = mdit({ html: true }).use(mdFigureWithPCaption, {
  automaticCaptionDetection: true,
  altCaptionFallback: true,
  setLabelWithNumbers: ['img'],
}).use(mditAttrs).use(mditRndererFence);
const mdSetLabelWithNumbers = mdit({ html: true }).use(mdFigureWithPCaption, {
  automaticCaptionDetection: true,
  setLabelWithNumbers: ['img', 'table'],
}).use(mditAttrs).use(mditRndererFence);

let __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = (process.platform === 'win32')
if (isWindows) {
  __dirname = __dirname.replace(/^\/+/, '').replace(/\//g, '\\')
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
  mdAllOption: __dirname + path.sep + 'examples-all-option.txt',
  imgAltCaption: __dirname + path.sep + 'examples-img-alt-caption.txt',
  imgTitleCaption: __dirname + path.sep + 'examples-img-title-caption.txt',
  console: __dirname + path.sep + 'examples-console.txt',
  setFigureNumber: __dirname + path.sep + 'examples-set-figure-number.txt',
  imgAltCaptionNumber: __dirname + path.sep + 'examples-img-alt-caption-number.txt',
  imgTitleCaptionNumber: __dirname + path.sep + 'examples-img-title-caption-number.txt',
  allIframeTypeFigureClassName: __dirname + path.sep + 'examples-all-iframe-type-figure-class-name.txt',
  autoCaptionDetection: __dirname + path.sep + 'examples-automatic-caption-detection.txt',
  altCaptionFallback: __dirname + path.sep + 'examples-alt-caption-fallback.txt',
  titleCaptionFallback: __dirname + path.sep + 'examples-title-caption-fallback.txt',
  altCaptionFallbackNumbered: __dirname + path.sep + 'examples-alt-caption-fallback-numbered.txt',
  setLabelWithNumbers: __dirname + path.sep + 'examples-set-label-with-numbers.txt',
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
  const exampleCont = fs.readFileSync(pat, 'utf-8').trim();

  let ms0 = exampleCont.split(/\n*\[Markdown\]\n/);
  let n = 1;
  while(n < ms0.length) {
    let mhs = ms0[n].split(/\n+\[HTML[^\]]*?\]\n/);
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
pass = runTest(mdHasNumClass, testData.hasNumClass, pass)
pass = runTest(mdOneImage, testData.oneImageWithoutCaption, pass)
pass = runTest(mdIframeWithoutCaption, testData.iframeWithoutCaption, pass)
pass = runTest(mdIframeTypeBlockquoteWithoutCaption, testData.iframeTypeBlockquoteWithoutCaption, pass)
pass = runTest(mdIframeTypeBlockquoteWithCaption, testData.iframeTypeBlockquoteWithCaption, pass)
pass = runTest(mdMultipleImages, testData.multipleImages, pass)
pass = runTest(mdVideoWithoutCaption, testData.videoWithoutCaption, pass)
pass = runTest(mdConsole, testData.console, pass)
pass = runTest(mdAutoCaptionDetection, testData.autoCaptionDetection, pass, [1, 2])
pass = runTest(mdAltCaptionFallback, testData.altCaptionFallback, pass)
pass = runTest(mdAltCaptionFallbackNumbered, testData.altCaptionFallbackNumbered, pass)
pass = runTest(mdTitleCaptionFallback, testData.titleCaptionFallback, pass)
pass = runTest(mdSetLabelWithNumbers, testData.setLabelWithNumbers, pass)


opt.imgAltCaption = 'Figure'
const mdImgAltCaption = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdImgAltCaption, testData.imgAltCaption.replace(/\.txt$/, '.en.txt'), pass)
opt.imgAltCaption = '図'
const mdImgAltCaptionJa = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdImgAltCaptionJa, testData.imgAltCaption.replace(/\.txt$/, '.ja.txt'),  pass)

opt.imgAltCaption = false

opt.imgTitleCaption = 'Figure'
const mdImgTitleCaption = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdImgTitleCaption, testData.imgTitleCaption.replace(/\.txt$/, '.en.txt'), pass)
opt.imgTitleCaption = '図'
const mdImgTitleCaptionJa = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdImgTitleCaptionJa, testData.imgTitleCaption.replace(/.txt$/, '.ja.txt'), pass)

opt = {}
opt.setFigureNumber = true
const mdSetFigureNumber = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdSetFigureNumber, testData.setFigureNumber.replace(/\.txt$/, '.en.txt'), pass)

opt.imgAltCaption = true
const mdImgAltCaptionNumber = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdImgAltCaptionNumber, testData.imgAltCaptionNumber.replace(/\.txt$/, '.en.txt'), pass)

opt = {}
opt.imgTitleCaption = true
const mdImgTitleCaptionNumber = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
//pass = runTest(mdImgTitleCaptionNumber, testData.imgTitleCaptionNumber.replace(/\.txt$/, '.en.txt'), pass)

opt = {}
opt.videoWithoutCaption = true
opt.iframeWithoutCaption = true
opt.iframeTypeBlockquoteWithoutCaption = true
opt.allIframeTypeFigureClassName = 'f-embed'
const mdAllIframeTypeFigureClassName = mdit({html: true}).use(mdFigureWithPCaption, opt).use(mditAttrs).use(mditRndererFence);
pass = runTest(mdAllIframeTypeFigureClassName, testData.allIframeTypeFigureClassName, pass)

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
