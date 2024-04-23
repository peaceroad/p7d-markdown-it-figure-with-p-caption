const assert = require('assert');
const fs = require('fs');
const md = require('markdown-it')({ html: true });
const mdOneImage = require('markdown-it')({ html: true });
const mdWithoutCaption = require('markdown-it')({ html: true });
const mdMultipleImages = require('markdown-it')({ html: true });
const mdAllOptionTrue = require('markdown-it')({ html: true });

const mdAllOptionTrueWithAltCaption = require('markdown-it')({ html: true });
const mdAllOptionTrueWithAltCaptionJa = require('markdown-it')({ html: true });
const mdFigureWithPCaption = require('../index.js');

const attrs = require('../node_modules/markdown-it-attrs');
let opt = {
  dquoteFilename: true,
  strongFilename: true,
  oneImageWithoutCaption: false,
  hasNumClass: true,
}
md.use(mdFigureWithPCaption, opt);

opt.oneImageWithoutCaption = true
mdOneImage.use(mdFigureWithPCaption, opt).use(attrs);

opt.iframeWithoutCaption = true
opt.hasNumClass = false
mdWithoutCaption.use(mdFigureWithPCaption, opt).use(attrs);

opt.multipleImages =  true
mdMultipleImages.use(mdFigureWithPCaption, opt).use(attrs)

opt.videoWithoutCaption = true
mdAllOptionTrue.use(mdFigureWithPCaption, opt).use(attrs)

opt.imgAltCaption = 'Figure'
opt.hasNumClass = false
mdAllOptionTrueWithAltCaption.use(mdFigureWithPCaption, opt).use(attrs)

const example = __dirname + '/examples.txt';

const testData = {
  AllwithAltCaption: __dirname + '/examples-all-with-alt-caption.txt'
}

const getTestData = (pat) => {
  let ms = [];
  if(!fs.existsSync(pat)) return ms
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
  let n = 1;
  let end = ms.length
  if(testId) {
    n = testId[0]
    end = (ms, testId) => {
      if (ms.length >= testId[1] + 1) {
        return ms.length
      } else {
        return testId[1] + 1
      }
    }
  }
  while(n < end) {
    if (
      !ms[n]
       //|| n != 3
      ) {

      n++
      continue
    }

    
    const m = ms[n].markdown;
    const h = process.render(m);
    try {
      assert.strictEqual(h, ms[n].html);
    } catch(e) {
      pass = false
      console.log('Test: ' + n + ' >>>');
      //console.log(opt);
      console.log(ms[n].markdown);
      console.log('incorrect:');
      console.log('H: ' + h +'C: ' + ms[n].html);
    };
    n++;
  }
  return pass
}

let pass = true
pass = runTest(mdOneImage, example, pass, [0, 19])
pass = runTest(mdOneImage, example, pass, [20, 36])
psss = runTest(mdWithoutCaption, example, pass, [37, 43])
pass = runTest(mdMultipleImages, example, pass, [44, 56])
pass = runTest(mdAllOptionTrue, example, pass, [57, 99])

pass = runTest(mdAllOptionTrueWithAltCaption, testData.AllwithAltCaption, pass, [0 , 4])

opt.imgAltCaption = '図'
pass = runTest(mdAllOptionTrueWithAltCaptionJa, testData.AllwithAltCaption, pass, [5 , 99])


if (pass) console.log('Passed all test.')
