'use strict';


const fs = require('fs');
const path = require('path');
const mdPCaption = require('p7d-markdown-it-p-captions');
const sizeOf = require('image-size');

module.exports = function figure_with_caption_plugin(md, option) {

  let opt = {
    classPrefix: 'f',
    scaleSuffix: false,
  };
  if (option !== undefined) {
    for (let o in option) {
        opt[o] = option[o];
    }
  }

  function changePositionOfPrevCaption(state, n, en, tagName) {
    if(n < 3) {return false;}

    const captionStartToken = state.tokens[n-3];
    const captionInlineToken = state.tokens[n-2];
    const captionEndToken = state.tokens[n-1];

    if (captionStartToken.type !== 'paragraph_open'
      && captionEndToken.type !== 'paragraph_close') {
      return false;
    }
    let captionName = '';
    if (captionStartToken.attrs) {
      captionStartToken.attrs.forEach(attr => {
        let hasCaptionName = attr[1].match(/^f-(.+)$/);
        if (attr[0] === 'class' && hasCaptionName) {
          captionName = hasCaptionName[1];
        }
      });
    }
    if(!captionName) { return false; }
    captionStartToken.attrs.forEach(attr => {
      if (attr[0] === 'class') {
        attr[1] = attr[1].replace(new RegExp(' *?f-' + captionName), '').trim();
        if(attr[1] === '') {
          captionStartToken.attrs.splice(captionStartToken.attrIndex('class'), 1);
        }
      }
    });
    captionStartToken.type = 'figcaption_open';
    captionStartToken.tag = 'figcaption';

    captionEndToken.type = 'figcaption_close';
    captionEndToken.tag = 'figcaption';

    state.tokens.splice(n + 2, 0, captionStartToken, captionInlineToken, captionEndToken);
    state.tokens.splice(n-3, 3);
    return true;
  }

  function changePositionOfNextCaption(state, n, en, tagName) {
    if (en + 3 > state.tokens.length) { return false; }
    const captionStartToken = state.tokens[en+2];
    const captionInlineToken = state.tokens[en+3];
    const captionEndToken = state.tokens[en+4];
    if (captionStartToken.type !== 'paragraph_open'
      && captionEndToken.type !== 'paragraph_close') {
      return false;
    }
    //console.log(captionInlineToken);
    let captionName = '';
    if (captionStartToken.attrs) {
      captionStartToken.attrs.forEach(attr => {
        let hasCaptionName = attr[1].match(/^f-(.+)$/);
        if (attr[0] === 'class' && hasCaptionName) {
          captionName = hasCaptionName[1];
        }
      });
    }
    if(!captionName) { return false; }
    captionStartToken.attrs.forEach(attr => {
      if (attr[0] === 'class') {
        attr[1] = attr[1].replace(new RegExp(' *?f-' + captionName), '').trim();
        if(attr[1] === '') {
          captionStartToken.attrs.splice(captionStartToken.attrIndex('class'), 1);
        }
      }
    });
    captionStartToken.type = 'figcaption_open';
    captionStartToken.tag = 'figcaption';

    captionEndToken.type = 'figcaption_close';
    captionEndToken.tag = 'figcaption';

    state.tokens.splice(en, 0, captionStartToken, captionInlineToken, captionEndToken);
    state.tokens.splice(en+5, 3);
    return true;
  }

  function wrapWithFigure(state, range, tagName, replaceInsteadOfWrap) {
    let n = range.start;
    let en = range.end;
    const figureStartToken = new state.Token('figure_open', 'figure', 1);
    figureStartToken.attrSet('class', 'f-' + tagName);
    if(/pre-(?:code|samp)/.test(tagName)) {
      figureStartToken.attrSet('role', 'doc-example');
    }
    const figureEndToken = new state.Token('figure_close', 'figure', -1);
    const breakToken = new state.Token('text', '', 0);
    breakToken.content = '\n';

    if (replaceInsteadOfWrap) {
      state.tokens.splice(en, 1, breakToken, figureEndToken, breakToken);
      state.tokens.splice(n, 1, figureStartToken, breakToken);
      en = en + 2;
      //console.log(state.tokens[n].type, state.tokens[en].type);
    } else {
      state.tokens.splice(en+1, 0, figureEndToken, breakToken);
      state.tokens.splice(n, 0, figureStartToken, breakToken);
      en = en + 3;
      //console.log(state.tokens[n].type, state.tokens[en].type);
    }
    range.start = n;
    range.end = en;
    return range;
  }

  function setImgSize(imgToken, img) {
    if (imgToken.attrIndex('src') === undefined) return;
    const imgSize = sizeOf(img);
    let w = imgSize.width;
    let h = imgSize.height;
    if (imgSize === undefined) return;
    const imgName = path.basename(img, path.extname(img));
    if (opt.scaleSuffix) {
      const reg = /[._-@]([0-9]+)(x|dpi|ppi)$/;
      if (imgName.match(reg)) {
        if (rs[2] === 'x') {
          w = Math.round(w / rs[1]);
          h = Math.round(h / rs[1]);
        }
        if (rs[2] === ('dpi' || 'ppi')) {
          w = Math.round(w / rs[1] / 96);
          h = Math.round(h / rs[1] / 96);
        }
      }
    }
    imgToken.attrJoin('width', w);
    imgToken.attrJoin('height', h);
    return;
  }


  function figureWithCaption(state) {

    let n = 0;
    while (n < state.tokens.length) {
      const token = state.tokens[n];
      //console.log(token.type);
      const nextToken = state.tokens[n+1];
      let en = n + 1;
      let range = {
        start: n,
        end: en,
      }
      let checkToken = false;

      let hasCloseTag = false;
      let tagName = '';

      const checkTags = ['table', 'video', 'audio', 'pre'];
      let cti = 0;
      while (cti < checkTags.length) {
        if (token.type === checkTags[cti] + '_open') {
          if (n > 1) {
            if (state.tokens[n-2].type === 'figure_open') { // +linebreak
              cti++; continue;
            }
          }
          checkToken = true;
          tagName = token.tag;
          while (en < state.tokens.length) {
            if(state.tokens[en].type === tagName + '_close') {
              hasCloseTag = true;
              break;
            };
            en++;
          }
          range.end = en;
          range = wrapWithFigure(state, range, tagName, false);
          break;
        }
        if(token.type === 'fence') {
          if (token.tag === 'code' && token.block) {
            checkToken = true;
            en = n;
            range.end = en;
            if (token.info === 'samp') {
              token.type = 'fence_samp';
              token.tag = 'samp';
            }
            tagName = 'pre-' + token.tag;
            range = wrapWithFigure(state, range, tagName, false);
            break;
          }
        }
        cti++;
      }

      if (token.type === 'paragraph_open'
        && nextToken.type === 'inline'
        && nextToken.children[0].type === 'image'
        && nextToken.children.length === 1
        && state.tokens[n+2].type === 'paragraph_close') {
        checkToken = true;
        en = n + 2;
        range.end = en;
        tagName = 'img';
        nextToken.children[0].type = 'image';
        range = wrapWithFigure(state, range, tagName, true);
        //console.log(range);
      }

      if (!checkToken) {n++; continue;}
      n = range.start;
      en = range.end;
      if (changePositionOfPrevCaption(state, n, en, tagName)) {
        n = en + 1;
        continue;
      }
      if (changePositionOfNextCaption(state, n, en, tagName)) {
        n = en + 4;
        continue;
      }
      n++;
    }
    return;
  }

  md.use(mdPCaption, {'classPrefix': opt.classPrefix});
  md.core.ruler.before('linkify', 'figure_with_caption', figureWithCaption);
  md.renderer.rules['fence_samp'] = function (tokens, idx, options, env, slf) {
    const token = tokens[idx];
    return  '<pre><samp>' + token.content + '</samp></pre>\n';
  };
  md.renderer.rules['image'] = function (tokens, idx, options, env, slf) {
    const token = tokens[idx];
    let imgCont = '<img src="' + token.attrGet('src') + '" alt="' + token.content + '">';
    if (token.attrGet('title')) {
      imgCont = imgCont.replace(/>$/, ' title="' + token.attrGet('title') + '">');
    }
    let img = '';
    if (env === undefined) return imgCont;
    if (env.md === undefined) return imgCont;
    img = path.dirname(env.md) + path.sep + token.attrGet('src');
    if(!fs.existsSync(img)) return imgCont;
    setImgSize(token, img);
    if (!token.attrGet('width')) token.attrSet('width', '');
    if (!token.attrGet('height')) token.attrSet('height', '');
    imgCont = imgCont.replace(/>$/, ' width="' + token.attrGet('width') + '" height="' + token.attrGet('height') + '">');
    return imgCont;
  }
};
