import { setCaptionParagraph, markReg } from 'p7d-markdown-it-p-captions'
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
const imgCaptionMarkReg = markReg && markReg.img ? markReg.img : null
const asciiLabelReg = /^[A-Za-z]/
const trailingDigitsReg = /(\d+)\s*$/

const shouldApplyLabelNumbering = (captionType, opt) => {
  const setting = opt.setLabelWithNumbers
  if (!setting) return false
  if (setting === true) return true
  if (typeof setting === 'string') return setting === captionType
  if (Array.isArray(setting)) return setting.includes(captionType)
  if (typeof setting === 'object') return !!setting[captionType]
  return false
}

const isOnlySpacesText = (token) => {
  if (!token || token.type !== 'text') return false
  const content = token.content
  if (typeof content !== 'string') return false
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) !== 0x20) return false
  }
  return true
}

const getTokenAttr = (token, attrName) => {
  if (!token || !token.attrs) return ''
  for (let i = 0; i < token.attrs.length; i++) {
    if (token.attrs[i][0] === attrName) return token.attrs[i][1] || ''
  }
  return ''
}

const setTokenAttr = (token, attrName, value) => {
  if (!token) return
  if (!token.attrs) token.attrs = []
  for (let i = 0; i < token.attrs.length; i++) {
    if (token.attrs[i][0] === attrName) {
      token.attrs[i][1] = value
      return
    }
  }
  token.attrs.push([attrName, value])
}

const removeTokenAttr = (token, attrName) => {
  if (!token || !token.attrs) return
  for (let i = token.attrs.length - 1; i >= 0; i--) {
    if (token.attrs[i][0] === attrName) {
      token.attrs.splice(i, 1)
    }
  }
}

const getImageAltText = (token) => {
  let alt = getTokenAttr(token, 'alt')
  if (alt) return alt
  if (typeof token.content === 'string' && token.content !== '') return token.content
  if (token.children && token.children.length > 0) {
    return token.children.map(child => child.content || '').join('')
  }
  return ''
}

const getImageTitleText = (token) => getTokenAttr(token, 'title')

const buildCaptionWithFallback = (text, fallbackOption) => {
  const trimmedText = (text || '').trim()
  if (!fallbackOption) return ''
  let label = ''
  if (typeof fallbackOption === 'string') {
    label = fallbackOption.trim()
  } else if (fallbackOption === true) {
    label = 'Figure'
  }
  if (!label) return trimmedText
  if (/[a-zA-Z]/.test(label)) {
    return label + (trimmedText ? '. ' + trimmedText : '.')
  }
  return label + (trimmedText ? '　' + trimmedText : '')
}

const createAutoCaptionParagraph = (captionText, TokenConstructor) => {
  const paragraphOpen = new TokenConstructor('paragraph_open', 'p', 1)
  paragraphOpen.block = true
  const inlineToken = new TokenConstructor('inline', '', 0)
  inlineToken.block = true
  inlineToken.content = captionText
  const textToken = new TokenConstructor('text', '', 0)
  textToken.content = captionText
  inlineToken.children = [textToken]
  const paragraphClose = new TokenConstructor('paragraph_close', 'p', -1)
  paragraphClose.block = true
  return [paragraphOpen, inlineToken, paragraphClose]
}

const getCaptionInlineToken = (tokens, range, caption) => {
  if (caption.isPrev) {
    const inlineIndex = range.start - 2
    if (inlineIndex >= 0) return tokens[inlineIndex]
  } else if (caption.isNext) {
    return tokens[range.end + 2]
  }
  return null
}

const getInlineLabelTextToken = (inlineToken, type, opt) => {
  if (!inlineToken || !inlineToken.children) return null
  const children = inlineToken.children
  const classPrefix = opt.classPrefix ? opt.classPrefix + '-' : ''
  const classNames = []
  if (!opt.removeMarkNameInCaptionClass) {
    classNames.push(classPrefix + type + '-label')
  }
  classNames.push(classPrefix + 'label')
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!child || !child.attrs) continue
    const classAttr = getTokenAttr(child, 'class')
    if (!classAttr) continue
    const classes = classAttr.split(/\s+/)
    const matched = classNames.some(className => classes.includes(className))
    if (!matched) continue
    const textToken = children[i + 1]
    if (textToken && textToken.type === 'text') {
      return textToken
    }
  }
  return null
}

const updateInlineTokenContent = (inlineToken, originalText, newText) => {
  if (!inlineToken || typeof inlineToken.content !== 'string') return
  if (!originalText) return
  const index = inlineToken.content.indexOf(originalText)
  if (index === -1) return
  inlineToken.content =
    inlineToken.content.slice(0, index) +
    newText +
    inlineToken.content.slice(index + originalText.length)
}

const ensureAutoFigureNumbering = (tokens, range, caption, figureNumberState, opt) => {
  if (opt.setFigureNumber) return
  const captionType = caption.name === 'img' ? 'img' : (caption.name === 'table' ? 'table' : '')
  if (!captionType) return
  if (!shouldApplyLabelNumbering(captionType, opt)) return
  const inlineToken = getCaptionInlineToken(tokens, range, caption)
  if (!inlineToken) return
  const labelTextToken = getInlineLabelTextToken(inlineToken, captionType, opt)
  if (!labelTextToken || typeof labelTextToken.content !== 'string') return
  const existingMatch = labelTextToken.content.match(trailingDigitsReg)
  if (existingMatch && existingMatch[1]) {
    const explicitValue = parseInt(existingMatch[1], 10)
    if (!Number.isNaN(explicitValue) && explicitValue > (figureNumberState[captionType] || 0)) {
      figureNumberState[captionType] = explicitValue
    }
    return
  }
  figureNumberState[captionType] = (figureNumberState[captionType] || 0) + 1
  const baseLabel = labelTextToken.content.replace(/\s*\d+$/, '').trim() || labelTextToken.content.trim()
  if (!baseLabel) return
  const joint = asciiLabelReg.test(baseLabel) ? ' ' : ''
  const newLabelText = baseLabel + joint + figureNumberState[captionType]
  const originalText = labelTextToken.content
  labelTextToken.content = newLabelText
  updateInlineTokenContent(inlineToken, originalText, newLabelText)
}

const getAutoCaptionFromImage = (imageToken, opt) => {
  if (!opt.automaticCaptionDetection) return ''
  const tryMatch = (text) => {
    if (!text) return ''
    const trimmed = text.trim()
    if (trimmed && imgCaptionMarkReg && trimmed.match(imgCaptionMarkReg)) {
      return trimmed
    }
    return ''
  }

  const altText = getImageAltText(imageToken)
  let caption = tryMatch(altText)
  if (!caption && opt.altCaptionFallback) {
    const normalizedAlt = (altText || '').trim()
    caption = buildCaptionWithFallback(normalizedAlt, opt.altCaptionFallback)
    if (imageToken) {
      imageToken.content = ''
      setTokenAttr(imageToken, 'alt', '')
      if (imageToken.children) {
        for (let i = 0; i < imageToken.children.length; i++) {
          imageToken.children[i].content = ''
        }
      }
    }
  }
  if (caption) return caption

  const titleText = getImageTitleText(imageToken)
  caption = tryMatch(titleText)
  if (!caption && opt.titleCaptionFallback) {
    const normalizedTitle = (titleText || '').trim()
    caption = buildCaptionWithFallback(normalizedTitle, opt.titleCaptionFallback)
    if (imageToken) {
      removeTokenAttr(imageToken, 'title')
    }
  }
  return caption
}

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

const nestedContainers = ['blockquote', 'list_item', 'dd']

const getNestedContainerType = (token) => {
  if (!token || token.type.indexOf('_open') === -1) return null
  const typeName = token.type.replace('_open', '')
  if (nestedContainers.includes(typeName)) {
    return typeName
  }
  return null
}

const resetRangeState = (range, start) => {
  range.start = start
  range.end = start
}

const resetCaptionState = (caption) => {
  caption.mark = ''
  caption.name = ''
  caption.nameSuffix = ''
  caption.isPrev = false
  caption.isNext = false
}

const resetSpecialState = (sp) => {
  sp.attrs.length = 0
  sp.isVideoIframe = false
  sp.isIframeTypeBlockquote = false
  sp.hasImgCaption = false
}

const findClosingTokenIndex = (tokens, startIndex, tag) => {
  let depth = 1
  let i = startIndex + 1
  while (i < tokens.length) {
    const token = tokens[i]
    if (token.type === `${tag}_open`) depth++
    if (token.type === `${tag}_close`) {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return startIndex
}

const detectCheckTypeOpen = (tokens, token, n, checkTypes, caption) => {
  if (!token) return null
  for (let i = 0; i < checkTypes.length; i++) {
    const type = checkTypes[i]
    if (token.type !== `${type}_open`) continue
    if (n > 1 && tokens[n-2] && tokens[n-2].type === 'figure_open') return null
    let tagName = token.tag
    caption.name = type
    if (type === 'pre') {
      if (tokens[n+1] && tokens[n+1].tag === 'code') caption.mark = 'pre-code'
      if (tokens[n+1] && tokens[n+1].tag === 'samp') caption.mark = 'pre-samp'
      caption.name = caption.mark
    }
    const en = findClosingTokenIndex(tokens, n, tagName)
    return {
      type: 'block',
      tagName,
      en,
      replaceInsteadOfWrap: false,
      wrapWithoutCaption: false,
      canWrap: true,
    }
  }
  return null
}

const detectFenceToken = (token, n, caption) => {
  if (!token || token.type !== 'fence' || token.tag !== 'code' || !token.block) return null
  let tagName = 'pre-code'
  if (sampLangReg.test(token.info)) {
    token.tag = 'samp'
    tagName = 'pre-samp'
  }
  caption.name = tagName
  return {
    type: 'fence',
    tagName,
    en: n,
    replaceInsteadOfWrap: false,
    wrapWithoutCaption: false,
    canWrap: true,
  }
}

const detectHtmlBlockToken = (tokens, token, n, caption, sp, opt, htmlTagCandidates) => {
  if (!token || token.type !== 'html_block') return null
  const htmlTags = htmlTagCandidates.slice()
  let ctj = 0
  let matchedTag = ''
  while (ctj < htmlTags.length) {
    let hasTag
    if (htmlTags[ctj] === 'div') {
      hasTag = token.content.match(getHtmlReg('div'))
      htmlTags[ctj] = 'iframe'
      sp.isVideoIframe = true
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
      const tokensLength = tokens.length
      let j = n + 1
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
    }
    matchedTag = htmlTags[ctj]
    break
  }
  if (!matchedTag) return null
  if (matchedTag === 'blockquote') {
    const isIframeTypeBlockquote = token.content.match(classNameReg)
    if (isIframeTypeBlockquote) {
      sp.isIframeTypeBlockquote = true
    } else {
      return null
    }
  }
  if (matchedTag === 'iframe' && videoIframeReg.test(token.content)) {
    sp.isVideoIframe = true
  }
  caption.name = matchedTag
  let wrapWithoutCaption = false
  if (matchedTag === 'iframe' && opt.iframeWithoutCaption) {
    wrapWithoutCaption = true
  } else if (matchedTag === 'video' && opt.videoWithoutCaption) {
    wrapWithoutCaption = true
  } else if (matchedTag === 'blockquote' && sp.isIframeTypeBlockquote && opt.iframeTypeBlockquoteWithoutCaption) {
    wrapWithoutCaption = true
  }
  return {
    type: 'html',
    tagName: matchedTag,
    en: n,
    replaceInsteadOfWrap: false,
    wrapWithoutCaption,
    canWrap: true,
  }
}

const detectImageParagraph = (tokens, token, nextToken, n, caption, sp, opt) => {
  if (!token || token.type !== 'paragraph_open') return null
  if (!nextToken || nextToken.type !== 'inline' || !nextToken.children || nextToken.children.length === 0) return null
  if (nextToken.children[0].type !== 'image') return null

  let imageNum = 1
  let isMultipleImagesHorizontal = true
  let isMultipleImagesVertical = true
  let isValid = true
  caption.name = 'img'
  const children = nextToken.children
  const childrenLength = children.length
  for (let childIndex = 1; childIndex < childrenLength; childIndex++) {
    const child = children[childIndex]
    if (childIndex === childrenLength - 1 && child.type === 'text') {
      let imageAttrs = child.content && child.content.match(imageAttrsReg)
      if (imageAttrs) {
        imageAttrs = imageAttrs[1].split(/ +/)
        for (let i = 0; i < imageAttrs.length; i++) {
          if (classAttrReg.test(imageAttrs[i])) {
            imageAttrs[i] = imageAttrs[i].replace(classAttrReg, 'class=')
          }
          if (idAttrReg.test(imageAttrs[i])) {
            imageAttrs[i] = imageAttrs[i].replace(idAttrReg, 'id=')
          }
          const imageAttr = imageAttrs[i].match(attrParseReg)
          if (!imageAttr || !imageAttr[1]) continue
          sp.attrs.push([imageAttr[1], imageAttr[2]])
        }
        break
      }
    }

    if (!opt.multipleImages) {
      isValid = false
      break
    }
    if (child.type === 'image') {
      imageNum++
      continue
    }
    if (isOnlySpacesText(child)) {
      isMultipleImagesVertical = false
      continue
    }
    if (child.type === 'softbreak') {
      isMultipleImagesHorizontal = false
      continue
    }
    isValid = false
    break
  }
  if (isValid && imageNum > 1 && opt.multipleImages) {
    if (isMultipleImagesHorizontal) {
      caption.nameSuffix = '-horizontal'
    } else if (isMultipleImagesVertical) {
      caption.nameSuffix = '-vertical'
    } else {
      caption.nameSuffix = '-multiple'
    }
    for (let i = 0; i < childrenLength; i++) {
      const child = children[i]
      if (isOnlySpacesText(child)) {
        child.content = ''
      }
    }
  }
  nextToken.children[0].type = 'image'
  const en = n + 2
  let tagName = 'img'
  if (caption.nameSuffix) tagName += caption.nameSuffix
  return {
    type: 'image',
    tagName,
    en,
    replaceInsteadOfWrap: true,
    wrapWithoutCaption: isValid && !!opt.oneImageWithoutCaption,
    canWrap: isValid,
    imageToken: children[0]
  }
}

const figureWithCaption = (state, opt) => {
  let fNum = {
    img: 0,
    table: 0,
  }

  const figureNumberState = {
    img: 0,
    table: 0,
  }

  figureWithCaptionCore(state.tokens, opt, fNum, figureNumberState, state.Token, null, 0)
}

const figureWithCaptionCore = (tokens, opt, fNum, figureNumberState, TokenConstructor, parentType = null, startIndex = 0) => {
  const checkTypes = ['table', 'pre', 'blockquote']
  const htmlTagCandidates = ['video', 'audio', 'iframe', 'blockquote', 'div']

  const rRange = { start: startIndex, end: startIndex }
  const rCaption = {
    mark: '', name: '', nameSuffix: '', isPrev: false, isNext: false
  }
  const rSp = {
    attrs: [], isVideoIframe: false, isIframeTypeBlockquote: false, hasImgCaption: false
  }

  let n = startIndex
  while (n < tokens.length) {
    const token = tokens[n]
    const containerType = getNestedContainerType(token)

    if (containerType && containerType !== 'blockquote') {
      const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, TokenConstructor, containerType, n + 1)
      n = (typeof closeIndex === 'number' ? closeIndex : n) + 1
      continue
    }


    if (parentType && token.type === `${parentType}_close`) {
      return n
    }

    const nextToken = tokens[n + 1]
    resetRangeState(rRange, n)
    resetCaptionState(rCaption)
    resetSpecialState(rSp)

    const detection =
      detectCheckTypeOpen(tokens, token, n, checkTypes, rCaption) ||
      detectFenceToken(token, n, rCaption) ||
      detectHtmlBlockToken(tokens, token, n, rCaption, rSp, opt, htmlTagCandidates) ||
      detectImageParagraph(tokens, token, nextToken, n, rCaption, rSp, opt)

    if (!detection) {
      if (containerType === 'blockquote') {
      const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, TokenConstructor, containerType, n + 1)
        n = (typeof closeIndex === 'number' ? closeIndex : n) + 1
      } else {
        n++
      }
      continue
    }

    rRange.end = detection.en

    if (detection.type === 'image') {
      if (opt.imgAltCaption) setAltToLabel({ tokens, Token: TokenConstructor }, n)
      if (opt.imgTitleCaption) setTitleToLabel({ tokens, Token: TokenConstructor }, n)
    }

    checkCaption(tokens, rRange.start, rRange.end, rCaption, fNum, rSp, opt, TokenConstructor)

    let hasCaption = rCaption.isPrev || rCaption.isNext
    let pendingAutoCaption = ''
    if (!hasCaption && detection.type === 'image' && opt.automaticCaptionDetection) {
      pendingAutoCaption = getAutoCaptionFromImage(detection.imageToken, opt)
      if (pendingAutoCaption) {
        hasCaption = true
      }
    }

    if (detection.canWrap === false) {
      let nextIndex = rRange.end + 1
      if (containerType === 'blockquote') {
        const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, TokenConstructor, containerType, rRange.start + 1)
        nextIndex = Math.max(nextIndex, (typeof closeIndex === 'number' ? closeIndex : rRange.end) + 1)
      }
      n = nextIndex
      continue
    }

    let shouldWrap = false
    if (detection.type === 'html') {
      shouldWrap = detection.canWrap !== false && (hasCaption || detection.wrapWithoutCaption)
    } else if (detection.type === 'image') {
      shouldWrap = detection.canWrap !== false && (hasCaption || detection.wrapWithoutCaption)
      if (parentType === 'list_item' || isInListItem(tokens, n)) {
        const isInTightList = token.hidden === true
        if (isInTightList) {
          shouldWrap = false
        } else if (!hasCaption && !opt.oneImageWithoutCaption) {
          shouldWrap = false
        }
      }
    } else {
      shouldWrap = detection.canWrap !== false && hasCaption
    }

    if (shouldWrap) {
      if (pendingAutoCaption) {
        const captionTokens = createAutoCaptionParagraph(pendingAutoCaption, TokenConstructor)
        tokens.splice(rRange.start, 0, ...captionTokens)
        const insertedLength = captionTokens.length
        rRange.start += insertedLength
        rRange.end += insertedLength
        n += insertedLength
        checkCaption(tokens, rRange.start, rRange.end, rCaption, fNum, rSp, opt, TokenConstructor)
      }
      ensureAutoFigureNumbering(tokens, rRange, rCaption, figureNumberState, opt)
      wrapWithFigure(tokens, rRange, detection.tagName, rCaption, detection.replaceInsteadOfWrap, rSp, opt, TokenConstructor)
    }

    let nextIndex
    if (!rCaption.name) {
      nextIndex = n + 1
    } else {
      const en = rRange.end
      if (rCaption.isPrev) {
        changePrevCaptionPosition(tokens, rRange.start, rCaption, opt)
        nextIndex = en + 1
      } else if (rCaption.isNext) {
        changeNextCaptionPosition(tokens, en, rCaption)
        nextIndex = en + 4
      } else {
        nextIndex = en + 1
      }
    }

    if (containerType === 'blockquote') {
      const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, TokenConstructor, containerType, rRange.start + 1)
      const fallbackIndex = rCaption.name ? rRange.end : n
      nextIndex = Math.max(nextIndex, (typeof closeIndex === 'number' ? closeIndex : fallbackIndex) + 1)
    }

    n = nextIndex
  }
  return tokens.length
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
    setLabelWithNumbers: { img: false, table: false },
    roleDocExample: false,
    allIframeTypeFigureClassName: '',
    automaticCaptionDetection: true,
    altCaptionFallback: false,
    titleCaptionFallback: false,
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
