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
    videoWithoutCaption: false,
    removeUnnumberedLabel: false,
    removeUnnumberedLabelExceptMarks: [],
    multipleImages: true,
    styleProcess: true,
    imgAltCaption: false,
    autoFigNum: false
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
      if (sp.isYoutube) {
        figureStartToken.attrSet('class', 'f-video');
      }
      if (sp.isTwitter) {
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
    if (sp) {
      if (sp.attrs) {
        for (let attr of sp.attrs) {
          figureStartToken.attrJoin(attr[0], attr[1]);
        }
      }
    }
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
        nameSuffix: '',
        hasPrev: false,
        hasNext: false,
      };
      let sp = {attrs: []};

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
              sp.isYoutube = true;
            }
          }
          if (tagName === 'blockquote') {
            if(/^<[^>]*? class="twitter-tweet"/.test(token.content)) {
              sp.isTwitter = true;
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
          if (caption.hasPrev || caption.hasNext ||
            (opt.iframeWithoutCaption && (tagName === 'iframe' || sp.isTwitter)) ||
            (opt.videoWithoutCaption && tagName === 'video')) {
            range = wrapWithFigure(state, range, tagName, false, sp);
            if ((opt.videoWithoutCaption || opt.iframeWithoutCaption) && (!caption.hasPrev || !caption.hasNext)) {
              n = en + 2;
            }
            break;
          }
          ctj++
        }
      }


      if (token.type === 'paragraph_open' && nextToken.type === 'inline' && nextToken.children[0].type === 'image') {
        let ntChildTokenIndex = 1
        let imageNum = 1
        let isMultipleImagesHorizontal = true
        let isMultipleImagesVertical = true
        checkToken = true
        while (ntChildTokenIndex < nextToken.children.length) {
          const ntChildToken = nextToken.children[ntChildTokenIndex]
          if (ntChildTokenIndex === nextToken.children.length - 1) {
             let imageAttrs = ntChildToken.content.match(/^ *\{(.*?)\} *$/)
            if(ntChildToken.type === 'text' && imageAttrs) {
              imageAttrs = imageAttrs[1].split(/ +/)
              let iai = 0
              while (iai < imageAttrs.length) {
                if (/^\./.test(imageAttrs[iai])) {
                  imageAttrs[iai] = imageAttrs[iai].replace(/^\./, "class=")
                }
                if (/^#/.test(imageAttrs[iai])) {
                  imageAttrs[iai] = imageAttrs[iai].replace(/^\#/, "id=")
                }
                let imageAttr = imageAttrs[iai].match(/^(.*?)="?(.*)"?$/)
                if (!imageAttr || !imageAttr[1]) {
                  iai++
                  continue
                }
                sp.attrs.push([imageAttr[1], imageAttr[2]])
                iai++
              }
              break
            }
          }

          if (!opt.multipleImages) {
            checkToken = false
            break
          }
          if (ntChildToken.type === 'image') {
            imageNum += 1
          } else if (ntChildToken.type === 'text' && /^ *$/.test(ntChildToken.content)) {
            isMultipleImagesVertical = false
            if (isMultipleImagesVertical) {
              isMultipleImagesHorizontal = false
            }
          } else if (ntChildToken.type === 'softbreak') {
            isMultipleImagesHorizontal = false
            if (isMultipleImagesHorizontal) {
              isMultipleImagesVertical = false
            }
          } else {
            checkToken = false
            break
          }
          ntChildTokenIndex++
        }
        if (checkToken && imageNum > 1 && opt.multipleImages) {
          if (isMultipleImagesHorizontal) {
            caption.nameSuffix = '-horizontal'
          } else if (isMultipleImagesVertical) {
            caption.nameSuffix = '-vertical'
          } else {
            caption.nameSuffix = '-multiple'
          }
          ntChildTokenIndex = 0
          while (ntChildTokenIndex < nextToken.children.length) {
            const ccToken = nextToken.children[ntChildTokenIndex]
            if (ccToken.type === 'text' && /^ *$/.test(ccToken.content)) {
              ccToken.content = ''
            }
            ntChildTokenIndex++
          }
        }
        en = n + 2;
        range.end = en;
        tagName = 'img';
        nextToken.children[0].type = 'image';

        if (opt.imgAltCaption) {
          setAltToLable(state, n, en, tagName, caption, opt)
          /*
          const hasAltLabel = changeImageAltToCaption(state, n, en, tagName, caption, opt)
          n += 3
          en += 3
          range.start = n
          range.end = en
          */
        }
        //console.log(state.tokens)
        //console.log(state.tokens[4].children)
        caption = checkCaption(state, n, en, tagName, caption, opt);

        if (opt.oneImageWithoutCaption && state.tokens[n-1]) {
          if (state.tokens[n-1].type === 'list_item_open') {checkToken = false;}
        }
        if (checkToken && (opt.oneImageWithoutCaption || caption.hasPrev || caption.hasNext)) {
          if (caption.nameSuffix) tagName += caption.nameSuffix
          if (caption.hasNext && opt.styleProcess) {
            range = wrapWithFigure(state, range, tagName, true, sp);
          } else {
            range = wrapWithFigure(state, range, tagName, true);
          }
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

  const setAltToLable = (state, n, en, tagName, caption, opt) => {
    if (n < 2) return false
    if (state.tokens[n+1].children[0].type === 'image') {
      if (state.tokens[n-2].children[2]) {

        state.tokens[n+1].content = state.tokens[n+1].content.replace(/^!\[.*?\]/, '![' + state.tokens[n-2].children[2].content + ']')
        //console.log(state.tokens[n+1].children[0].children)
        if (!state.tokens[n+1].children[0].children[0]) {
          const textToken  = new state.Token('text', '', 0)
          state.tokens[n+1].children[0].children.push(textToken)
        }
        //console.log(state.tokens[n+1].children[0])
        state.tokens[n+1].children[0].content = state.tokens[n-2].children[2].content
        state.tokens[n+1].children[0].children[0].content = state.tokens[n-2].children[2].content
      }
    }
    return true
  }

  const changeImageAltToCaption = (state, n, en, tagName, caption, opt) => {
  //  console.log(state.tokens[1].children)
  const cToken = {
    pOpen: new state.Token('paragraph_open', 'p', 1),
    pInline: new state.Token('inline', '', 0),
    pClose: new state.Token('paragraph_close', 'p', -1),
  };
  const ciToken = {
      labelOpen: new state.Token('span_open', 'span', 1),
      labelContent: new state.Token('text', '', 0),
      labelJointOpen: new state.Token('span_open', 'span', 1),
      labelJointContent: new state.Token('text', '', 0),
      labelJointClose: new state.Token('span_close', 'span', -1),
      labelClose: new state.Token('span_close', 'span', -1),
      labelAfterContent: new state.Token('text', '', 0),
    }
    cToken.pOpen.attrSet('class', 'f-img')
    cToken.pOpen.block = true
    cToken.pInline.block = true
    cToken.pInline.level++
    cToken.pClose.block = true
    ciToken.labelOpen.attrSet('class', 'f-img-label')
    if (opt.imgAltCaption) {
      ciToken.labelContent.content = opt.imgAltCaption
    }
    ciToken.labelJointOpen.attrSet('class', 'f-img-label-joint')
    ciToken.labelJointContent.content = '.'

    const hasAltLabel = state.tokens[1].content.match(new RegExp ('^' + opt.imgAltCaption + '([.:] *|．：　] *)'))
    if (hasAltLabel) {
      if (/a-zA-Z/.test(opt.imgAltCaption)) {
        ciToken.labelAfterContent.content = ' '
      }
      ciToken.labelAfterContent.content += state.tokens[1].content.replace(new RegExp('^' + opt.imgAltCaption + '([.:] *|．：　] *)'), '')
    } else {
      ciToken.labelAfterContent.content += state.tokens[1].children[0].content
      state.tokens[1].children[0].content = ''
      state.tokens[1].children[0].children[0] = ''
      state.tokens[1].content = state.tokens[1].content.replace(/^!\[[^]*?\]/, '![]')
    }

    cToken.pInline.children = []
    if (hasAltLabel) {
      cToken.pInline.children.push(ciToken.labelOpen, ciToken.labelContent, ciToken.labelJointOpen, ciToken.labelJointContent, ciToken.labelJointClose, ciToken.labelClose, ciToken.labelAfterContent)
    } else {
      cToken.pInline.children.push(ciToken.labelAfterContent)
    }
    state.tokens.splice(0, 0, cToken.pOpen, cToken.pInline, cToken.pClose)
    return hasAltLabel
  }

  const imgAltCaption = (state, startLine) => {
    let pos = state.bMarks[startLine] + state.tShift[startLine]
    let max = state.eMarks[startLine]
    let inline = state.src.slice(pos, max)
    
    const img = inline.match(/^( *!\[)(.*?)\]\( *?((.*?)(?: +?\"(.*?)\")?) *?\)( *?\{.*?\})? *$/)
    if (!img) return

    const hasLabel = img[2].match(new RegExp('^' + opt.imgAltCaption))

    let token
    token = state.push('paragraph_open', 'p', 1)
    token.map = [startLine, startLine + 1]
    token = state.push('inline', '', 0)
    if (hasLabel) {
      token.content = img[2]
    } else {
      if (img[2] === '') {
        console.log(opt.imgAltCaption)
        if (/a-zA-Z/.test(opt.imgAltCaption)) {
          token.content = opt.imgAltCaption + '.'
        } else {
          token.content = opt.imgAltCaption + '　'
        }
      } else {
        if (/a-zA-Z/.test(opt.imgAltCaption)) {
          token.content = opt.imgAltCaption + '. ' + img[2]
        } else {
          token.content = opt.imgAltCaption + '　' + img[2]
        }
      }
    }
    token.map = [startLine, startLine + 1]
    token.children = []
    token = state.push('paragraph_close', 'p', -1)
  }


  if (opt.imgAltCaption) {
    md.block.ruler.before('paragraph', 'img_alt_caption', imgAltCaption)
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
    removeUnnumberedLabelExceptMarks: opt.removeUnnumberedLabelExceptMarks,
  })
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
