const assert = require('assert');
const fs = require('fs');
const md = require('markdown-it')({
  html: true,
});
const mdFigureWithPCaption = require('../index.js');

md.use(mdFigureWithPCaption, {
  dquoteFilename: true,
  strongFilename: true,
});

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
  //if (n !== 21) { n++; continue };
  console.log('Test: ' + n + ' >>>');
  //console.log(ms[n].markdown);

  const m = ms[n].markdown;
  const h = md.render(m);
  try {
    assert.strictEqual(h, ms[n].html);
  } catch(e) {
    console.log('incorrect: ');
    console.log('H: ' + h +'C: ' + ms[n].html);
  };
  n++;
}