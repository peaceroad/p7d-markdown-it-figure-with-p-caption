import { setCaptionParagraph } from 'p7d-markdown-it-p-captions'
import { imgAttrToPCaption, setAltToLabel, setTitleToLabel } from './imgAttrToPCaption.js'

const checkPrevCaption = (state, n, caption, fNum, sp, opt) => {
  if(n < 3) return caption
  const captionStartToken = state.tokens[n-3]
  const captionEndToken = state.tokens[n-1]
  if (captionStartToken === undefined || captionEndToken === undefined) return

  if (captionStartToken.type !== 'paragraph_open' && captionEndToken.type !== 'paragraph_close') return

  setCaptionParagraph(n-3, state, caption, fNum, sp, opt)

  let captionName = ''
  if (captionStartToken.attrs) {
    captionStartToken.attrs.forEach(attr => {
      let hasCaptionName = attr[1].match(/^f-(.+)$/)
      if (attr[0] === 'class' && hasCaptionName) captionName = hasCaptionName[1]
    })
  }
  if(!captionName) return
  caption.name = captionName
  caption.isPrev = true
  return
}

const changePrevCaptionPosition = (state, n, caption, opt) => {
  const captionStartToken = state.tokens[n-3]
  const captionInlineToken = state.tokens[n-2]
  const captionEndToken = state.tokens[n-1]

  if (opt.imgAltCaption || opt.imgTitleCaption) {
    let isNoCaption = false
    if (captionInlineToken.attrs) {
      for (let attr of captionInlineToken.attrs) {
        if (attr[0] === 'class' && attr[1] === 'nocaption') isNoCaption = true
      }
    }
    if (isNoCaption) {
      state.tokens.splice(n-3, 3)
      return false
    }
  }

  const attrReplaceReg = new RegExp(' *?f-' + caption.name)
  captionStartToken.attrs.forEach(attr => {
    if (attr[0] === 'class') {
      attr[1] = attr[1].replace(attrReplaceReg, '').trim()
      if(attr[1] === '') {
        captionStartToken.attrs.splice(captionStartToken.attrIndex('class'), 1)
      }
    }
  })
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  state.tokens.splice(n + 2, 0, captionStartToken, captionInlineToken, captionEndToken)
  state.tokens.splice(n-3, 3)
  return true
}

const checkNextCaption = (state, en, caption, fNum, sp, opt) => {
  if (en + 2 > state.tokens.length) return
  const captionStartToken = state.tokens[en+1]
  const captionEndToken = state.tokens[en+3]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' && captionEndToken.type !== 'paragraph_close') return

  setCaptionParagraph(en+1, state, caption, fNum, sp, opt)

  let captionName = ''
  if (captionStartToken.attrs) {
    captionStartToken.attrs.forEach(attr => {
      let hasCaptionName = attr[1].match(/^f-(.+)$/)
      if (attr[0] === 'class' && hasCaptionName) captionName = hasCaptionName[1]
    })
  }
  if(!captionName) return
  caption.name = captionName
  caption.isNext = true
  return
}

const changeNextCaptionPosition = (state, en, caption) => {
  const captionStartToken = state.tokens[en+2] // +1: text node for figure.
  const captionInlineToken = state.tokens[en+3]
  const captionEndToken = state.tokens[en+4]
  captionStartToken.attrs.forEach(attr => {
    if (attr[0] === 'class') {
      attr[1] = attr[1].replace(new RegExp(' *?f-' + caption.name), '').trim()
      if(attr[1] === '') {
        captionStartToken.attrs.splice(captionStartToken.attrIndex('class'), 1)
      }
    }
  })
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  state.tokens.splice(en, 0, captionStartToken, captionInlineToken, captionEndToken)
  state.tokens.splice(en+5, 3)
  return true
}

const wrapWithFigure = (state, range, checkTokenTagName, caption, replaceInsteadOfWrap, sp, opt) => {
  let n = range.start
  let en = range.end
  const figureStartToken = new state.Token('figure_open', 'figure', 1)
  figureStartToken.attrSet('class', 'f-' + checkTokenTagName)

  if (opt.allIframeTypeFigureClassName === '') {
    if (sp.isVideoIframe) {
      figureStartToken.attrSet('class', 'f-video')
    }
    if (sp.isIframeTypeBlockquote) {
      let figureClassThatWrapsIframeTypeBlockquote = 'i-frame'
      if (caption.isPrev || caption.isNext) {
        if (caption.name === 'blockquote' || caption.name === 'img') {
          figureClassThatWrapsIframeTypeBlockquote = 'f-img'
        }
        figureStartToken.attrSet('class', figureClassThatWrapsIframeTypeBlockquote)
      } else {
        figureClassThatWrapsIframeTypeBlockquote = opt.figureClassThatWrapsIframeTypeBlockquote
        figureStartToken.attrSet('class', figureClassThatWrapsIframeTypeBlockquote)
      }
    }
  } else {
    if (checkTokenTagName === 'iframe' || sp.isIframeTypeBlockquote) {
      figureStartToken.attrSet('class', opt.allIframeTypeFigureClassName)
    }
  }

  if(/pre-(?:code|samp)/.test(checkTokenTagName) && opt.roleDocExample) {
    figureStartToken.attrSet('role', 'doc-example')
  }
  const figureEndToken = new state.Token('figure_close', 'figure', -1)
  const breakToken = new state.Token('text', '', 0)
  breakToken.content = '\n'
  if (opt.styleProcess && caption.isNext && sp.attrs.length > 0) {
    for (let attr of sp.attrs) {
      figureStartToken.attrJoin(attr[0], attr[1])
    }
  }
  // For vsce
  //console.log(caption)
  if(state.tokens[n].attrs && caption.name === 'img') {
    for (let attr of state.tokens[n].attrs) {
      figureStartToken.attrJoin(attr[0], attr[1])
    }
  }
  if (replaceInsteadOfWrap) {
    state.tokens.splice(en, 1, breakToken, figureEndToken, breakToken)
    state.tokens.splice(n, 1, figureStartToken, breakToken)
    en = en + 2
    //console.log(state.tokens[n].type, state.tokens[en].type)
  } else {
    state.tokens.splice(en+1, 0, figureEndToken, breakToken)
    state.tokens.splice(n, 0, figureStartToken, breakToken)
    en = en + 3
    //console.log(state.tokens[n].type, state.tokens[en].type)
  }
  range.start = n
  range.end = en
  return
}

const checkCaption = (state, n, en, caption, fNum, sp, opt) => {
  checkPrevCaption(state, n, caption, fNum, sp, opt)
  if (caption.isPrev) return
  checkNextCaption(state, en, caption, fNum, sp, opt)
  return
}

const figureWithCaption = (state, opt) => {
  let n = 0
  let fNum = {
    img: 0,
    table: 0,
  }
  while (n < state.tokens.length) {
    const token = state.tokens[n]
    const nextToken = state.tokens[n+1]
    let en = n
    let range = {
      start: n,
      end: en,
    }
    let checkToken = false
    let checkTokenTagName = ''
    let caption = {
      mark: '',
      name: '',
      nameSuffix: '',
      isPrev: false,
      isNext: false,
    };
    const sp = {
      attrs: [],
      isVideoIframe: false,
      isIframeTypeBlockquote: false,
      hasImgCaption: false,
    }

    const checkTypes = ['table', 'pre', 'blockquote']
    let cti = 0
    //console.log(state.tokens[n].type, state.tokens[n].tag)
    while (cti < checkTypes.length) {
      if (token.type === checkTypes[cti] + '_open') {
        // for n-1 token is line-break
        if (n > 1 && state.tokens[n-2].type === 'figure_open') {
          cti++; continue
        }
        checkToken = true
        checkTokenTagName = token.tag
        caption.name = checkTypes[cti]
        if (checkTypes[cti] === 'pre') {
          if (state.tokens[n+1].tag === 'code') caption.mark = 'pre-code'
          if (state.tokens[n+1].tag === 'samp') caption.mark = 'pre-samp'
          caption.name = caption.mark
        }
        while (en < state.tokens.length) {
          if(state.tokens[en].type === checkTokenTagName + '_close') {
            break
          }
          en++
        }
        range.end = en
        checkCaption(state, n, en, caption, fNum, sp, opt)
        if (caption.isPrev || caption.isNext) {
          wrapWithFigure(state, range, checkTokenTagName, caption, false, sp, opt)
        }
        break
      }

      if (token.type === 'fence') {
        if (token.tag === 'code' && token.block) {
          checkToken = true
          let isSamp = false
          if (/^ *(?:samp|shell|console)(?:(?= )|$)/.test(token.info)) {
            token.tag = 'samp'
            isSamp = true
          }
          if (isSamp) {
            checkTokenTagName = 'pre-samp'
            caption.name = 'pre-samp'
          } else {
            checkTokenTagName = 'pre-code'
            caption.name = 'pre-code'
          }
          checkCaption(state, n, en, caption, fNum, sp, opt)
          if (caption.isPrev || caption.isNext) {
            wrapWithFigure(state, range, checkTokenTagName, caption, false, sp, opt)
            break
          }
        }
        break
      }
      cti++
    }

    if (token.type === 'html_block') {
      const tags = ['video', 'audio', 'iframe', 'blockquote', 'div']
      let ctj = 0
      let hasTag
      while (ctj < tags.length) {
        if (tags[ctj] === 'div') {
          // for vimeo
          hasTag = token.content.match(new RegExp('^<'+ tags[ctj] + ' ?[^>]*?><iframe[^>]*?>[\\s\\S]*?<\\/iframe><\\/' + tags[ctj] + '>(\\n| *?)(<script [^>]*?>(?:<\\/script>)?)? *(\\n|$)'))
          tags[ctj] = 'iframe'
          sp.isVideoIframe = true
        } else {
          hasTag = token.content.match(new RegExp('^<'+ tags[ctj] + ' ?[^>]*?>[\\s\\S]*?<\\/' + tags[ctj] + '>(\\n| *?)(<script [^>]*?>(?:<\\/script>)?)? *(\\n|$)'))
        }
        const blueskyContMatch = token.content.match(new RegExp('^<blockquote class="bluesky-embed"[^]*?>[\\s\\S]*$'))
        if (!(hasTag || (blueskyContMatch && tags[ctj] === 'blockquote'))) {
          ctj++
          continue
        }
        if (hasTag) {
          if ((hasTag[2] && hasTag[3] !== '\n') || (hasTag[1] !== '\n' && hasTag[2] === undefined)) {
            token.content += '\n'
          }
        } else if (blueskyContMatch) {
          let addedCont = '';
          let j = n + 1
          let hasEndBlockquote = true
          while (j < state.tokens.length) {
            const nextToken = state.tokens[j]
            if (nextToken.type === 'inline' && /<\/blockquote> *<script[^>]*?><\/script>$/.test(nextToken.content)) {
              addedCont += nextToken.content + '\n'
              if (state.tokens[j + 1] && state.tokens[j + 1].type === 'paragraph_close') {
                state.tokens.splice(j + 1, 1)
              }
              state.tokens[j].content = ''
              state.tokens[j].children.forEach((child, i) => {
                child.content = ''
              })
              break
            }
            if (nextToken.type === 'paragraph_open') {
              addedCont += '\n'
              state.tokens.splice(j, 1)
              continue
            }
            j++;
          }
          token.content += addedCont;
          if (!hasEndBlockquote) {
            ctj++
            continue
          }
        }

        checkTokenTagName = tags[ctj]
        caption.name = tags[ctj]
        checkToken = true
        if (checkTokenTagName === 'blockquote') {
          const classNameReg = /^<[^>]*? class="(twitter-tweet|instagram-media|text-post-media|bluesky-embed|mastodon-embed)"/
          const isIframeTypeBlockquote = token.content.match(classNameReg)
          //console.log(isIframeTypeBlockquote)
          if(isIframeTypeBlockquote) {
            sp.isIframeTypeBlockquote = true
          } else {
            ctj++
            continue
          }
        }
        break
      }
      if (!checkToken) {n++; continue;}
      if (checkTokenTagName === 'iframe') {
        if(/^<[^>]*? src="https:\/\/(?:www.youtube-nocookie.com|player.vimeo.com)\//i.test(token.content)) {
          sp.isVideoIframe = true
        }
      }

      checkCaption(state, n, en, caption, fNum, sp, opt)
      if (caption.isPrev || caption.isNext) {
        wrapWithFigure(state, range, checkTokenTagName, caption, false, sp, opt)
        n = en + 2
      } else if ((opt.iframeWithoutCaption && (checkTokenTagName === 'iframe')) ||
        (opt.videoWithoutCaption && (checkTokenTagName === 'video')) ||
        (opt.iframeTypeBlockquoteWithoutCaption && (checkTokenTagName === 'blockquote'))) {
        wrapWithFigure(state, range, checkTokenTagName, caption, false, sp, opt)
        n = en + 2
      }
    }

    if (token.type === 'paragraph_open' && nextToken.type === 'inline' && nextToken.children[0].type === 'image') {
      let ntChildTokenIndex = 1
      let imageNum = 1
      let isMultipleImagesHorizontal = true
      let isMultipleImagesVertical = true
      checkToken = true
      caption.name = 'img'
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
      en = n + 2
      range.end = en
      checkTokenTagName = 'img'
      nextToken.children[0].type = 'image'

      if (opt.imgAltCaption) setAltToLabel(state, n)
      if (opt.imgTitleCaption) setTitleToLabel(state, n)
      checkCaption(state, n, en, caption, fNum, sp, opt)

      if (opt.oneImageWithoutCaption && state.tokens[n-1]) {
        if (state.tokens[n-1].type === 'list_item_open') checkToken = false
      }
      if (checkToken && (opt.oneImageWithoutCaption || caption.isPrev || caption.isNext)) {
        if (caption.nameSuffix) checkTokenTagName += caption.nameSuffix
        wrapWithFigure(state, range, checkTokenTagName, caption, true, sp, opt)
      }
    }

    if (!checkToken || !caption.name) {n++; continue;}

    n = range.start
    en = range.end
    if (caption.isPrev) {
      changePrevCaptionPosition(state, n, caption, opt)
      n = en + 1
      continue
    }
    if (caption.isNext) {
      changeNextCaptionPosition(state, en, caption)
      n = en + 4
      continue
    }
    n = en + 1
  }
  return
}

const mditFigureWithPCaption = (md, option) => {
  let opt = {
    classPrefix: 'f',
    figureClassThatWrapsIframeTypeBlockquote: 'f-img',
    styleProcess : true,
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
    iframeTypeBlockquoteWithoutCaption: false,
    removeUnnumberedLabel: false,
    removeUnnumberedLabelExceptMarks: [],
    removeMarkNameInCaptionClass: false,
    multipleImages: true,
    imgAltCaption: false,
    setFigureNumber: false,
    imgTitleCaption: false,
    roleDocExample: false,
    allIframeTypeFigureClassName: '',
  }
  if (option) Object.assign(opt, option)

  if (opt.imgAltCaption || opt.imgTitleCaption) {
    opt.oneImageWithoutCaption = true
    opt.multipleImages = false
    if (opt.setFigureNumber) {
      for (let mark of opt.removeUnnumberedLabelExceptMarks) {
        if (mark === 'img') opt.removeUnnumberedLabelExceptMarks.splice(opt.removeUnnumberedLabelExceptMarks.indexOf(mark), 1)
        if (mark === 'table') opt.removeUnnumberedLabelExceptMarks.splice(opt.removeUnnumberedLabelExceptMarks.indexOf(mark), 1)
      }
    }
    md.block.ruler.before('paragraph', 'img_attr_caption', (state) => {
      imgAttrToPCaption(state, state.line, opt)
    })
  }

  //If nextCaption has `{}` style and `f-img-multipleImages`, when upgraded to markdown-it-attrs@4.2.0, the existing script will have `{}` style on nextCaption. Therefore, since markdown-it-attrs is md.core.ruler.before('linkify'), figure_with_caption will be processed after it.
  md.core.ruler.before('replacements', 'figure_with_caption', (state) => {
    figureWithCaption(state, opt)
  })
}

export default mditFigureWithPCaption