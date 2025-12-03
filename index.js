import { setCaptionParagraph } from 'p7d-markdown-it-p-captions'
import { imgAttrToPCaption, setAltToLabel, setTitleToLabel } from './imgAttrToPCaption.js'

const htmlRegCache = new Map()
const classReg = /^f-(.+)$/
const blueskyEmbedReg = /^<blockquote class="bluesky-embed"[^]*?>[\s\S]*?$/
const videoIframeReg = /^<[^>]*? src="https:\/\/(?:www.youtube-nocookie.com|player.vimeo.com)\//i
const classNameReg = /^<[^>]*? class="(twitter-tweet|instagram-media|text-post-media|bluesky-embed|mastodon-embed)"/
const imageAttrsReg = /^ *\{(.*?)\} *$/
const classAttrReg = /^\./
const idAttrReg = /^#/
const attrParseReg = /^(.*?)="?(.*)"?$/
const whitespaceReg = /^ *$/
const sampLangReg = /^ *(?:samp|shell|console)(?:(?= )|$)/
const endBlockquoteScriptReg = /<\/blockquote> *<script[^>]*?><\/script>$/

const getHtmlReg = (tag) => {
  if (htmlRegCache.has(tag)) return htmlRegCache.get(tag)
  const regexStr = `^<${tag} ?[^>]*?>[\\s\\S]*?<\\/${tag}>(\\n| *?)(<script [^>]*?>(?:<\\/script>)?)? *(\\n|$)`
  const reg = new RegExp(regexStr)
  htmlRegCache.set(tag, reg)
  return reg
}

const getCaptionName = (token) => {
  if (!token.attrs) return ''
  const attrs = token.attrs
  for (let i = 0, len = attrs.length; i < len; i++) {
    const attr = attrs[i]
    if (attr[0] === 'class') {
      const match = attr[1].match(classReg)
      if (match) return match[1]
    }
  }
  return ''
}

const checkPrevCaption = (tokens, n, caption, fNum, sp, opt, TokenConstructor) => {
  if(n < 3) return caption
  const captionStartToken = tokens[n-3]
  const captionEndToken = tokens[n-1]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setCaptionParagraph(n-3, { tokens, Token: TokenConstructor }, caption, fNum, sp, opt)
  const captionName = getCaptionName(captionStartToken)
  if(!captionName) return
  caption.name = captionName
  caption.isPrev = true
  return
}

const checkNextCaption = (tokens, en, caption, fNum, sp, opt, TokenConstructor) => {
  if (en + 2 > tokens.length) return
  const captionStartToken = tokens[en+1]
  const captionEndToken = tokens[en+3]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setCaptionParagraph(en+1, { tokens, Token: TokenConstructor }, caption, fNum, sp, opt)
  const captionName = getCaptionName(captionStartToken)
  if(!captionName) return
  caption.name = captionName
  caption.isNext = true
  return
}

const cleanCaptionRegCache = new Map()

const cleanCaptionTokenAttrs = (token, captionName) => {
  if (!token.attrs) return
  let reg = cleanCaptionRegCache.get(captionName)
  if (!reg) {
    reg = new RegExp(' *?f-' + captionName)
    cleanCaptionRegCache.set(captionName, reg)
  }
  for (let i = token.attrs.length - 1; i >= 0; i--) {
    if (token.attrs[i][0] === 'class') {
      token.attrs[i][1] = token.attrs[i][1].replace(reg, '').trim()
      if (token.attrs[i][1] === '') token.attrs.splice(i, 1)
    }
  }
}

const changePrevCaptionPosition = (tokens, n, caption, opt) => {
  const captionStartToken = tokens[n-3]
  const captionInlineToken = tokens[n-2]
  const captionEndToken = tokens[n-1]

  if (opt.imgAltCaption || opt.imgTitleCaption) {
    let isNoCaption = false
    if (captionInlineToken.attrs) {
      const attrs = captionInlineToken.attrs, len = attrs.length
      for (let i = 0; i < len; i++) {
        const attr = attrs[i]
        if (attr[0] === 'class' && attr[1] === 'nocaption') {
          isNoCaption = true
          break
        }
      }
    }
    if (isNoCaption) {
      tokens.splice(n-3, 3)
      return false
    }
  }

  cleanCaptionTokenAttrs(captionStartToken, caption.name)
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  tokens.splice(n + 2, 0, captionStartToken, captionInlineToken, captionEndToken)
  tokens.splice(n-3, 3)
  return true
}

const changeNextCaptionPosition = (tokens, en, caption) => {
  const captionStartToken = tokens[en+2] // +1: text node for figure.
  const captionInlineToken = tokens[en+3]
  const captionEndToken = tokens[en+4]
  cleanCaptionTokenAttrs(captionStartToken, caption.name)
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  tokens.splice(en, 0, captionStartToken, captionInlineToken, captionEndToken)
  tokens.splice(en+5, 3)
  return true
}

const wrapWithFigure = (tokens, range, checkTokenTagName, caption, replaceInsteadOfWrap, sp, opt, TokenConstructor) => {
  let n = range.start
  let en = range.end
  const figureStartToken = new TokenConstructor('figure_open', 'figure', 1)
  figureStartToken.attrSet('class', 'f-' + checkTokenTagName)

  if (opt.allIframeTypeFigureClassName === '') {
    if (sp.isVideoIframe) {
      figureStartToken.attrSet('class', 'f-video')
    }
    if (sp.isIframeTypeBlockquote) {
      let figureClassThatWrapsIframeTypeBlockquote = opt.figureClassThatWrapsIframeTypeBlockquote
      if ((caption.isPrev || caption.isNext) &&
        figureClassThatWrapsIframeTypeBlockquote === 'f-img' &&
        (caption.name === 'blockquote' || caption.name === 'img')) {
        figureClassThatWrapsIframeTypeBlockquote = 'f-img'
      }
      figureStartToken.attrSet('class', figureClassThatWrapsIframeTypeBlockquote)
    }
  } else {
    if (checkTokenTagName === 'iframe' || sp.isIframeTypeBlockquote) {
      figureStartToken.attrSet('class', opt.allIframeTypeFigureClassName)
    }
  }

  if(/pre-(?:code|samp)/.test(checkTokenTagName) && opt.roleDocExample) {
    figureStartToken.attrSet('role', 'doc-example')
  }
  const figureEndToken = new TokenConstructor('figure_close', 'figure', -1)
  const breakToken = new TokenConstructor('text', '', 0)
  breakToken.content = '\n'
  if (opt.styleProcess && caption.isNext && sp.attrs.length > 0) {
    for (let attr of sp.attrs) {
      figureStartToken.attrJoin(attr[0], attr[1])
    }
  }
  // For vsce
  if(tokens[n].attrs && caption.name === 'img') {
    for (let attr of tokens[n].attrs) {
      figureStartToken.attrJoin(attr[0], attr[1])
    }
  }
  if (replaceInsteadOfWrap) {
    tokens.splice(en, 1, breakToken, figureEndToken, breakToken)
    tokens.splice(n, 1, figureStartToken, breakToken)
    en = en + 2
  } else {
    tokens.splice(en+1, 0, figureEndToken, breakToken)
    tokens.splice(n, 0, figureStartToken, breakToken)
    en = en + 3
  }
  range.start = n
  range.end = en
  return
}

const checkCaption = (tokens, n, en, caption, fNum, sp, opt, TokenConstructor) => {
  checkPrevCaption(tokens, n, caption, fNum, sp, opt, TokenConstructor)
  if (caption.isPrev) return
  checkNextCaption(tokens, en, caption, fNum, sp, opt, TokenConstructor)
  return
}

const processTokensRecursively = (tokens, opt, fNum, TokenConstructor, parentType) => {
  const nestedContainers = ['blockquote', 'list_item', 'dd']

  figureWithCaptionCore(tokens, opt, fNum, TokenConstructor, parentType)

  const nestedRanges = []
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    let containerType = null
    for (const container of nestedContainers) {
      if (token.type === `${container}_open`) {
        containerType = container
        break
      }
    }
    if (containerType) {
      let depth = 1
      let endIndex = i + 1
      while (endIndex < tokens.length && depth > 0) {
        if (tokens[endIndex].type === `${containerType}_open`) depth++
        if (tokens[endIndex].type === `${containerType}_close`) depth--
        endIndex++
      }
      if (depth === 0 && endIndex - i > 2) {
        nestedRanges.push({
          start: i + 1,
          end: endIndex - 1,
          type: containerType
        })
      }
      i = endIndex
    } else {
      i++
    }
  }

  for (let j = nestedRanges.length - 1; j >= 0; j--) {
    const range = nestedRanges[j]
    const innerTokens = tokens.slice(range.start, range.end)
    if (innerTokens.length > 0) {
      processTokensRecursively(innerTokens, opt, fNum, TokenConstructor, range.type)
      tokens.splice(range.start, range.end - range.start, ...innerTokens)
    }
  }
}

const figureWithCaption = (state, opt) => {
  let fNum = {
    img: 0,
    table: 0,
  }

  processTokensRecursively(state.tokens, opt, fNum, state.Token, null)
}

const figureWithCaptionCore = (tokens, opt, fNum, TokenConstructor, parentType) => {
  const checkTypes = ['table', 'pre', 'blockquote']
  const htmlTagCandidates = ['video', 'audio', 'iframe', 'blockquote', 'div']

  const rRange = { start: 0, end: 0 }
  const rCaption = {
    mark: '', name: '', nameSuffix: '', isPrev: false, isNext: false
  }
  const rSp = {
    attrs: [], isVideoIframe: false, isIframeTypeBlockquote: false, hasImgCaption: false
  }

  let n = 0
  while (n < tokens.length) {
    const token = tokens[n]
    const nextToken = tokens[n+1]
    let en = n

    rRange.start = n
    rRange.end = en
    let checkToken = false
    let checkTokenTagName = ''
    rCaption.mark = ''
    rCaption.name = ''
    rCaption.nameSuffix = ''
    rCaption.isPrev = false
    rCaption.isNext = false

    rSp.attrs.length = 0
    rSp.isVideoIframe = false
    rSp.isIframeTypeBlockquote = false
    rSp.hasImgCaption = false

    let cti = 0
    while (cti < checkTypes.length) {
      if (token.type === checkTypes[cti] + '_open') {
        // for n-1 token is line-break
        if (n > 1 && tokens[n-2].type === 'figure_open') {
          cti++; continue
        }
        checkToken = true
        checkTokenTagName = token.tag
        rCaption.name = checkTypes[cti]
        if (checkTypes[cti] === 'pre') {
          if (tokens[n+1].tag === 'code') rCaption.mark = 'pre-code'
          if (tokens[n+1].tag === 'samp') rCaption.mark = 'pre-samp'
          rCaption.name = rCaption.mark
        }
        while (en < tokens.length) {
          if(tokens[en].type === checkTokenTagName + '_close') {
            break
          }
          en++
        }
        rRange.end = en
        checkCaption(tokens, n, en, rCaption, fNum, rSp, opt, TokenConstructor)
        if (rCaption.isPrev || rCaption.isNext) {
          wrapWithFigure(tokens, rRange, checkTokenTagName, rCaption, false, rSp, opt, TokenConstructor)
        }
        break
      }

      if (token.type === 'fence') {
        if (token.tag === 'code' && token.block) {
          checkToken = true
          let isSamp = false
          if (sampLangReg.test(token.info)) {
            token.tag = 'samp'
            isSamp = true
          }
          if (isSamp) {
            checkTokenTagName = 'pre-samp'
            rCaption.name = 'pre-samp'
          } else {
            checkTokenTagName = 'pre-code'
            rCaption.name = 'pre-code'
          }
          checkCaption(tokens, n, en, rCaption, fNum, rSp, opt, TokenConstructor)
          if (rCaption.isPrev || rCaption.isNext) {
            wrapWithFigure(tokens, rRange, checkTokenTagName, rCaption, false, rSp, opt, TokenConstructor)
            break
          }
        }
        break
      }
      cti++
    }

    if (token.type === 'html_block') {
      const htmlTags = htmlTagCandidates.slice()
      let ctj = 0
      let hasTag
      while (ctj < htmlTags.length) {
        if (htmlTags[ctj] === 'div') {
          // for vimeo
          hasTag = token.content.match(getHtmlReg('div'))
          htmlTags[ctj] = 'iframe'
          rSp.isVideoIframe = true
        } else {
          hasTag = token.content.match(getHtmlReg(htmlTags[ctj]))
        }
        const blueskyContMatch = token.content.match(blueskyEmbedReg)
        if (!(hasTag || (blueskyContMatch && htmlTags[ctj] === 'blockquote'))) {
          ctj++
          continue
        }
        if (hasTag) {
          if ((hasTag[2] && hasTag[3] !== '\n') || (hasTag[1] !== '\n' && hasTag[2] === undefined)) {
            token.content += '\n'
          }
        } else if (blueskyContMatch) {
          let addedCont = ''
          const tokensChildren = tokens
          const tokensLength = tokensChildren.length
          let j = n + 1
          let hasEndBlockquote = true
          while (j < tokensLength) {
            const nextToken = tokens[j]
            if (nextToken.type === 'inline' && endBlockquoteScriptReg.test(nextToken.content)) {
              addedCont += nextToken.content + '\n'
              if (tokens[j + 1] && tokens[j + 1].type === 'paragraph_close') {
                tokens.splice(j + 1, 1)
              }
              nextToken.content = ''
              nextToken.children.forEach((child) => {
                child.content = ''
              })
              break
            }
            if (nextToken.type === 'paragraph_open') {
              addedCont += '\n'
              tokens.splice(j, 1)
              continue
            }
            j++
          }
          token.content += addedCont
          if (!hasEndBlockquote) {
            ctj++
            continue
          }
        }

        checkTokenTagName = htmlTags[ctj]
        rCaption.name = htmlTags[ctj]
        checkToken = true
        if (checkTokenTagName === 'blockquote') {
          const isIframeTypeBlockquote = token.content.match(classNameReg)
          if(isIframeTypeBlockquote) {
            rSp.isIframeTypeBlockquote = true
          } else {
            ctj++
            continue
          }
        }
        break
      }
      if (!checkToken) {n++; continue;}
      if (checkTokenTagName === 'iframe') {
        if(videoIframeReg.test(token.content)) {
          rSp.isVideoIframe = true
        }
      }

      checkCaption(tokens, n, en, rCaption, fNum, rSp, opt, TokenConstructor)
      if (rCaption.isPrev || rCaption.isNext) {
        wrapWithFigure(tokens, rRange, checkTokenTagName, rCaption, false, rSp, opt, TokenConstructor)
        n = en + 2
      } else if ((opt.iframeWithoutCaption && (checkTokenTagName === 'iframe')) ||
        (opt.videoWithoutCaption && (checkTokenTagName === 'video')) ||
        (opt.iframeTypeBlockquoteWithoutCaption && (checkTokenTagName === 'blockquote'))) {
        wrapWithFigure(tokens, rRange, checkTokenTagName, rCaption, false, rSp, opt, TokenConstructor)
        n = en + 2
      }
    }

    if (token.type === 'paragraph_open' && nextToken.type === 'inline' && nextToken.children[0].type === 'image') {
      let ntChildTokenIndex = 1
      let imageNum = 1
      let isMultipleImagesHorizontal = true
      let isMultipleImagesVertical = true
      checkToken = true
      rCaption.name = 'img'
      const children = nextToken.children
      const childrenLength = children.length
      while (ntChildTokenIndex < childrenLength) {
        const ntChildToken = children[ntChildTokenIndex]
        if (ntChildTokenIndex === childrenLength - 1) {
          let imageAttrs = ntChildToken.content.match(imageAttrsReg)
          if(ntChildToken.type === 'text' && imageAttrs) {
            imageAttrs = imageAttrs[1].split(/ +/)
            let iai = 0
            const attrsLength = imageAttrs.length
            while (iai < attrsLength) {
              if (classAttrReg.test(imageAttrs[iai])) {
                imageAttrs[iai] = imageAttrs[iai].replace(classAttrReg, "class=")
              }
              if (idAttrReg.test(imageAttrs[iai])) {
                imageAttrs[iai] = imageAttrs[iai].replace(idAttrReg, "id=")
              }
              let imageAttr = imageAttrs[iai].match(attrParseReg)
              if (!imageAttr || !imageAttr[1]) {
                iai++
                continue
              }
              rSp.attrs.push([imageAttr[1], imageAttr[2]])
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
        } else if (ntChildToken.type === 'text' && whitespaceReg.test(ntChildToken.content)) {
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
          rCaption.nameSuffix = '-horizontal'
        } else if (isMultipleImagesVertical) {
          rCaption.nameSuffix = '-vertical'
        } else {
          rCaption.nameSuffix = '-multiple'
        }
        ntChildTokenIndex = 0
        while (ntChildTokenIndex < childrenLength) {
          const ccToken = children[ntChildTokenIndex]
          if (ccToken.type === 'text' && whitespaceReg.test(ccToken.content)) {
            ccToken.content = ''
          }
          ntChildTokenIndex++
        }
      }
      en = n + 2
      rRange.end = en
      checkTokenTagName = 'img'
      nextToken.children[0].type = 'image'

      if (opt.imgAltCaption) setAltToLabel({ tokens, Token: TokenConstructor }, n)
      if (opt.imgTitleCaption) setTitleToLabel({ tokens, Token: TokenConstructor }, n)
      checkCaption(tokens, n, en, rCaption, fNum, rSp, opt, TokenConstructor)

      if (parentType === 'list_item' || isInListItem(tokens, n)) {
        const isInTightList = token.hidden === true
        if (isInTightList) {
          checkToken = false
        } else {
          if (!opt.oneImageWithoutCaption && !rCaption.isPrev && !rCaption.isNext) {
            checkToken = false
          }
        }
      }

      if (checkToken && (opt.oneImageWithoutCaption || rCaption.isPrev || rCaption.isNext)) {
        if (rCaption.nameSuffix) checkTokenTagName += rCaption.nameSuffix
        wrapWithFigure(tokens, rRange, checkTokenTagName, rCaption, true, rSp, opt, TokenConstructor)
      }
    }

    if (!checkToken || !rCaption.name) {n++; continue;}

    n = rRange.start
    en = rRange.end
    if (rCaption.isPrev) {
      changePrevCaptionPosition(tokens, n, rCaption, opt)
      n = en + 1
      continue
    }
    if (rCaption.isNext) {
      changeNextCaptionPosition(tokens, en, rCaption)
      n = en + 4
      continue
    }
    n = en + 1
  }
  return
}

const isInListItem = (() => {
  const cache = new WeakMap()
  return (tokens, idx) => {
    if (cache.has(tokens)) {
      const cachedResult = cache.get(tokens)
      if (cachedResult[idx] !== undefined) {
        return cachedResult[idx]
      }
    } else {
      cache.set(tokens, {})
    }

    const result = cache.get(tokens)

    for (let i = idx - 1; i >= 0; i--) {
      if (tokens[i].type === 'list_item_open') {
        result[idx] = true
        return true
      }
      if (tokens[i].type === 'list_item_close' || tokens[i].type === 'list_open') {
        result[idx] = false
        return false
      }
    }

    result[idx] = false
    return false
  }
})()

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
      opt.removeUnnumberedLabelExceptMarks = opt.removeUnnumberedLabelExceptMarks.filter(
        mark => mark !== 'img' && mark !== 'table'
      )
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
