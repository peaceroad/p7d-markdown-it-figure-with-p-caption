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
  multipleImages: __dirname + path.sep + 'examples-multiple-images.txt',
  videoWithoutCaption: __dirname + path.sep + 'examples-video-without-caption.txt',
  mdAllOption: __dirname + path.sep + 'examples-all-option.txt',
  imgAltCaption: __dirname + path.sep + 'examples-img-alt-caption.txt',
  imgTitleCaption: __dirname + path.sep + 'examples-img-title-caption.txt',
  console: __dirname + path.sep + 'examples-console.txt',
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
        mhs[i] = mhs[i].replace(/$/,'\n');
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
      //|| n != 43
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
pass = runTest(mdMultipleImages, testData.multipleImages, pass)
pass = runTest(mdVideoWithoutCaption, testData.videoWithoutCaption, pass)
pass = runTest(mdConsole, testData.console, pass)


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

if (pass) console.log('Passed all test.')
