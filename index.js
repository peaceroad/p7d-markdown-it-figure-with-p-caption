'use strict';

module.exports = function figure_with_caption_plugin(md, option) {

  const mdPCaption = require('p7d-markdown-it-p-captions');

  let opt = {
    classPrefix: 'f',
    hasNumClass: false,
    scaleSuffix: false,
    dquoteFilename: false,
    strongFilename: false,
    bLabel: false,
    strongLabel: false,
    jointSpaceUseHalfWidth: false,
    oneImageWithoutCaption: false,
    iframeWithoutCaption: false,
    removeUnnumberedLabel: false,
  };
  if (option !== undefined) {
    for (let o in option) {
        opt[o] = option[o];
    }
  }

  function checkPrevCaption(state, n, en, tagName, caption) {
    if(n < 3) {return caption;}
    const captionStartToken = state.tokens[n-3];
    const captionEndToken = state.tokens[n-1];
    if (captionStartToken === undefined || captionEndToken === undefined) {
      return caption;
    }
    if (captionStartToken.type !== 'paragraph_open'
      && captionEndToken.type !== 'paragraph_close') {
      return caption;
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
    if(!captionName) {return caption;}
    caption.name = captionName;
    caption.hasPrev = true;
    return caption;
  }

  function changePrevCaptionPosition(state, n, en, tagName, caption) {
    const captionStartToken = state.tokens[n-3];
    const captionInlineToken = state.tokens[n-2];
    const captionEndToken = state.tokens[n-1];
    captionStartToken.attrs.forEach(attr => {
      if (attr[0] === 'class') {
        attr[1] = attr[1].replace(new RegExp(' *?f-' + caption.name), '').trim();
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

  function checkNextCaption(state, n, en, tagName, caption) {
    if (en + 2 > state.tokens.length) { return caption; }
    const captionStartToken = state.tokens[en+1];
    const captionEndToken = state.tokens[en+3];
    if (captionStartToken === undefined || captionEndToken === undefined) {
      return caption;
    }
    if (captionStartToken.type !== 'paragraph_open'
      && captionEndToken.type !== 'paragraph_close') {
      return caption;
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
    if(!captionName) { return caption; }
    caption.name = captionName;
    caption.hasNext = true;
    return caption;
  }

  function changeNextCaptionPosition(state, n, en, tagName, caption) {
    const captionStartToken = state.tokens[en+2]; // +1: text node for figure.
    const captionInlineToken = state.tokens[en+3];
    const captionEndToken = state.tokens[en+4];
    captionStartToken.attrs.forEach(attr => {
      if (attr[0] === 'class') {
        attr[1] = attr[1].replace(new RegExp(' *?f-' + caption.name), '').trim();
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

  function wrapWithFigure(state, range, tagName, replaceInsteadOfWrap, sp) {
    let n = range.start;
    let en = range.end;
    const figureStartToken = new state.Token('figure_open', 'figure', 1);
    figureStartToken.attrSet('class', 'f-' + tagName);
    if (sp) {
      if (sp.isTwitterBlock) {
        if (sp.hasImgCaption) {
          figureStartToken.attrSet('class', 'f-img');
        } else {
        figureStartToken.attrSet('class', 'f-iframe');
        }
      }
    }
    if(/pre-(?:code|samp)/.test(tagName)) {
      figureStartToken.attrSet('role', 'doc-example');
    }
    const figureEndToken = new state.Token('figure_close', 'figure', -1);
    const breakToken = new state.Token('text', '', 0);
    breakToken.content = '\n';
    ///Add for vsce
    if(state.tokens[n].attrs) {
      for (let attr of state.tokens[n].attrs) {
        figureStartToken.attrJoin(attr[0], attr[1]);
      }
    }
    ///
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

  function checkCaption(state, n, en, tagName, caption) {
    caption = checkPrevCaption(state, n, en, tagName, caption);
    if (caption.hasPrev) return caption;
    caption = checkNextCaption(state, n, en, tagName, caption);
    return caption;
  }

  function figureWithCaption(state) {
    let n = 0;
    while (n < state.tokens.length) {
      const token = state.tokens[n];
      const nextToken = state.tokens[n+1];
      let en = n;
      let range = {
        start: n,
        end: en,
      }
      let checkToken = false;
      let hasCloseTag = false;
      let tagName = '';
      let caption = {
        name: '',
        hasPrev: false,
        hasNext: false,
      };

      const checkTags = ['table', 'pre', 'blockquote'];
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
          caption = checkCaption(state, n, en, tagName, caption);
          if (caption.hasPrev || caption.hasNext) {
            range = wrapWithFigure(state, range, tagName, false);
            break;
          }
          break;
        }

        if(token.type === 'fence') {
          if (token.tag === 'code' && token.block) {
            checkToken = true;
            if (token.info === 'samp') {
              token.type = 'fence_samp';
              token.tag = 'samp';
            }
            tagName = 'pre-' + token.tag;
            caption = checkCaption(state, n, en, tagName, caption);
            if (caption.hasPrev || caption.hasNext) {
              range = wrapWithFigure(state, range, tagName, false);
              break;
            }
          }
          break;
        }
        cti++;
      }

      if (token.type === 'html_block') {
        const tags = ['video', 'audio', 'iframe', 'blockquote'];
        let ctj = 0;
        let sp = {};
        while (ctj < tags.length) {
          const hasTag = token.content.match(new RegExp('^<'+ tags[ctj] + ' ?[^>]*?>[\\s\\S]*?<\\/' + tags[ctj] + '> *?(?:<script [^>]*?>(?:</script>)?)?(\\n|$)'));
          if (!hasTag) {
            ctj++;
            continue;
          }
          if (hasTag[hasTag.length - 1] !== '\n') {
            token.content += '\n'
          }
          tagName = tags[ctj];
          if (tagName === 'iframe') {
            if(/^<[^>]*? src="https:\/\/(?:www.youtube-nocookie.com|player.vimeo.com)\//i.test(token.content)) {
              tagName = 'video'; // figure.f-video used.
            }
          }
          if (tagName === 'blockquote') {
            if(/^<[^>]*? class="twitter-tweet"/.test(token.content)) {
              sp.isTwitterBlock = true;
              if (n > 2) {
                if (state.tokens[n-2].children.length > 1) {
                  if (state.tokens[n-2].children[1].attrs.length > 0) {
                    if (state.tokens[n-2].children[1].attrs[0][0] === 'class') {
                      if (state.tokens[n-2].children[1].attrs[0][1] === 'f-img-label') {
                        sp.hasImgCaption = true;
                      /* under consideration. I think I should use figure instead of blockquoe for caption.
                      } else {
                        if (state.tokens[n-2].children[1].attrs[0][1] === 'f-blockquote-label') {
                          state.tokens[n-2].children[1].attrs[0][1] = 'f-iframe-label'
                          state.tokens[n-2].children[3].attrs[0][1] = 'f-iframe-label-joint'
                        } */
                      }
                    }
                  }
                }
              }
              if (n + 2 < state.tokens.length) {
                if (state.tokens[n+2].children.length > 1) {
                  if (state.tokens[n+2].children[1].attrs.length > 0) {
                    if (state.tokens[n+2].children[1].attrs[0][0] === 'class' &&
                      state.tokens[n+2].children[1].attrs[0][1] === 'f-img-label') {
                      sp.hasImgCaption = true;
                    }
                  }
                }
              }
            }
          }
          checkToken = true;
          caption = checkCaption(state, n, en, tagName, caption);
          if (opt.iframeWithoutCaption || caption.hasPrev || caption.hasNext) {
            range = wrapWithFigure(state, range, tagName, false, sp);
            if (opt.iframeWithoutCaption && (!caption.hasPrev || !caption.hasNext)) {
              n = en + 2;
            }
            break;
          }
          ctj++
        }
      }


      if (token.type === 'paragraph_open' && nextToken.type === 'inline' && nextToken.children[0].type === 'image' && state.tokens[n+2].type === 'paragraph_close' && nextToken.children.length < 3) {
        if (nextToken.children.length === 2) {
          if (!nextToken.children[nextToken.children.length - 1].type === 'text' || !/^ *?\{.*?\}$/.test(nextToken.children[nextToken.children.length - 1].content)) {
            n++; continue;
          }
        }
        checkToken = true;
        en = n + 2;
        range.end = en;
        tagName = 'img';
        nextToken.children[0].type = 'image';
        caption = checkCaption(state, n, en, tagName, caption);
        if (opt.oneImageWithoutCaption && state.tokens[n-1]) {
          if (state.tokens[n-1].type === 'list_item_open') {checkToken = false;}
        }
        if (checkToken && (opt.oneImageWithoutCaption || caption.hasPrev || caption.hasNext)) {
          range = wrapWithFigure(state, range, tagName, true);
        }
      }

      if (!checkToken || !caption.name) {n++; continue;}

      n = range.start;
      en = range.end;
      if (caption.hasPrev) {
        changePrevCaptionPosition(state, n, en, tagName, caption);
        n = en + 1;
        continue;
      }
      if (caption.hasNext) {
        changeNextCaptionPosition(state, n, en, tagName, caption);
        n = en + 4;
        continue;
      }
      n = en + 1;
    }
    return;
  }

  md.use(mdPCaption, {
    classPrefix: opt.classPrefix,
    dquoteFilename: opt.dquoteFilename,
    strongFilename: opt.strongFilename,
    hasNumClass: opt.hasNumClass,
    bLabel: opt.bLabel,
    strongLabel: opt.strongLabel,
    jointSpaceUseHalfWidth: opt.jointSpaceUseHalfWidth,
    removeUnnumberedLabel: opt.removeUnnumberedLabel,
  });
  md.core.ruler.before('linkify', 'figure_with_caption', figureWithCaption);
  md.renderer.rules['fence_samp'] = function (tokens, idx, options, env, slf) {
    const token = tokens[idx];
    let sampStartTag = '<samp>';
    if (token.attrs) {
      sampStartTag = sampStartTag.replace('>', '');
      for(let attr of token.attrs) {
        sampStartTag += ' ' + attr[0] + '="' + attr[1] + '"';
      }
      sampStartTag += '>';
    }
    return '<pre>' + sampStartTag + md.utils.escapeHtml(token.content) + '</samp></pre>\n';
  };
};
