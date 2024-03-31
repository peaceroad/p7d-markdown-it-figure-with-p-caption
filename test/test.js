const assert = require('assert');
const fs = require('fs');
const md = require('markdown-it')({ html: true });
const mdOneImage = require('markdown-it')({ html: true });
const mdWithoutCaption = require('markdown-it')({ html: true });
const mdMultipleImages = require('markdown-it')({ html: true });

const mdFigureWithPCaption = require('../index.js');

const attrs = require('../node_modules/markdown-it-attrs');

md.use(mdFigureWithPCaption, {
  dquoteFilename: true,
  strongFilename: true,
  oneImageWithoutCaption: false,
  hasNumClass: true,
});

mdOneImage.use(mdFigureWithPCaption, {
  dquoteFilename: true,
  strongFilename: true,
  oneImageWithoutCaption: true,
  hasNumClass: true,
}).use(attrs);

mdWithoutCaption.use(mdFigureWithPCaption, {
  dquoteFilename: true,
  strongFilename: true,
  oneImageWithoutCaption: true,
  iframeWithoutCaption: true,
  hasNumClass: true,
}).use(attrs);

mdMultipleImages.use(attrs).use(mdFigureWithPCaption, {
  dquoteFilename: true,
  strongFilename: true,
  oneImageWithoutCaption: true,
  iframeWithoutCaption: true,
  hasNumClass: true,
  multipleImages: true,
})

const example = __dirname + '/examples.txt';
const mdPath = __dirname + '/examples.md';
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
while(n < ms.length) {
  //if (n !== 37) { n++; continue };
  console.log('Test: ' + n + ' >>>');
  //console.log(ms[n].markdown);

  const m = ms[n].markdown;
  let h = ''
  if (n > 44) {
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
    console.log('incorrect: ');
    console.log('H: ' + h +'C: ' + ms[n].html);
  };
  n++;
}