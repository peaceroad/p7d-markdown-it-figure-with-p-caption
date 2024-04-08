const assert = require('assert');
const fs = require('fs');
const md = require('markdown-it')({ html: true });
const mdOneImage = require('markdown-it')({ html: true });
const mdWithoutCaption = require('markdown-it')({ html: true });
const mdMultipleImages = require('markdown-it')({ html: true });
const mdAllOptionTrue = require('markdown-it')({ html: true });

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
mdWithoutCaption.use(mdFigureWithPCaption, opt).use(attrs);

opt.multipleImages =  true
mdMultipleImages.use(mdFigureWithPCaption, opt).use(attrs)

opt.videoWithoutCaption = true
mdAllOptionTrue.use(mdFigureWithPCaption, opt).use(attrs)


const example = __dirname + '/examples.txt';

const exampleCont = fs.readFileSync(example, 'utf-8').trim();
let ms = [];
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

n = 1;
let pass = true
while(n < ms.length) {
  //if (n !== 37) { n++; continue };
  //console.log(ms[n].markdown);

  const m = ms[n].markdown;
  let h = ''
  if (n >= 56) {
    h = mdAllOptionTrue.render(m);
  } else if (n > 44) {
    h = mdMultipleImages.render(m);
  } else if (n > 37) {
    h = mdWithoutCaption.render(m);
  } else if (n > 20) {
    h = mdOneImage.render(m);
  } else {
    h = md.render(m);
  }

  try {
    assert.strictEqual(h, ms[n].html);
  } catch(e) {
    pass =false
    console.log('Test: ' + n + ' >>>');
    console.log('incorrect:');
    console.log(opt);
    console.log('H: ' + h +'C: ' + ms[n].html);
  };
  n++;
}

if (pass) console.log('Passed all test.')
