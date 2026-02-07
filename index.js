import {
  setCaptionParagraph,
  getMarkRegForLanguages,
  getMarkRegStateForLanguages,
} from 'p7d-markdown-it-p-captions'

const htmlRegCache = new Map()
const cleanCaptionRegCache = new Map()
const blueskyEmbedReg = /^<blockquote class="bluesky-embed"[^]*?>[\s\S]*?$/
const videoIframeReg = /^<[^>]*? src="https:\/\/(?:www.youtube-nocookie.com|player.vimeo.com)\//i
const classNameReg = /^<[^>]*? class="(twitter-tweet|instagram-media|text-post-media|bluesky-embed|mastodon-embed)"/
const imageAttrsReg = /^ *\{(.*?)\} *$/
const classAttrReg = /^\./
const idAttrReg = /^#/
const attrParseReg = /^(.*?)="?(.*)"?$/
const sampLangReg = /^ *(?:samp|shell|console)(?:(?= )|$)/
const endBlockquoteScriptReg = /<\/blockquote> *<script[^>]*?><\/script>$/
const asciiLabelReg = /^[A-Za-z]/
const trailingDigitsReg = /(\d+)\s*$/
const CHECK_TYPE_TOKEN_MAP = {
  table_open: 'table',
  pre_open: 'pre',
  blockquote_open: 'blockquote',
}
const HTML_TAG_CANDIDATES = ['video', 'audio', 'iframe', 'blockquote', 'div']
const fallbackLabelDefaults = {
  img: { en: 'Figure', ja: '図' },
  table: { en: 'Table', ja: '表' },
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const buildClassPrefix = (value) => (value ? value + '-' : '')
const normalizeLanguages = (value) => {
  if (!Array.isArray(value)) return ['en', 'ja']
  const normalized = []
  const seen = new Set()
  for (let i = 0; i < value.length; i++) {
    const lang = value[i]
    if (typeof lang !== 'string') continue
    const trimmed = lang.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  if (normalized.length === 0) return ['en', 'ja']
  return normalized
}
const normalizeLabelPrefixMarkers = (value) => {
  if (typeof value === 'string') {
    return value ? [value] : []
  }
  if (Array.isArray(value)) {
    const normalized = value.map(entry => String(entry)).filter(Boolean)
    return normalized.length > 2 ? normalized.slice(0, 2) : normalized
  }
  return []
}
const buildLabelPrefixMarkerRegFromList = (markers) => {
  if (!markers || markers.length === 0) return null
  const pattern = markers.map(escapeRegExp).join('|')
  return new RegExp('^(?:' + pattern + ')(?:[ \\t　]+)?')
}
const resolveLabelPrefixMarkerPair = (markers) => {
  if (!markers || markers.length === 0) return { prev: [], next: [] }
  if (markers.length === 1) {
    return { prev: [markers[0]], next: [markers[0]] }
  }
  return { prev: [markers[0]], next: [markers[1]] }
}
const stripLeadingPrefix = (text, prefix) => {
  if (typeof text !== 'string' || !text || !prefix) return text
  if (text.startsWith(prefix)) return text.slice(prefix.length)
  return text
}
const stripLabelPrefixMarkerFromInline = (inlineToken, markerText) => {
  if (!inlineToken || !markerText) return
  if (typeof inlineToken.content === 'string') {
    inlineToken.content = stripLeadingPrefix(inlineToken.content, markerText)
  }
  if (inlineToken.children && inlineToken.children.length) {
    for (let i = 0; i < inlineToken.children.length; i++) {
      const child = inlineToken.children[i]
      if (child && child.type === 'text' && typeof child.content === 'string') {
        child.content = stripLeadingPrefix(child.content, markerText)
        break
      }
    }
  }
}
const getLabelPrefixMarkerMatch = (inlineToken, markerReg) => {
  if (!markerReg || !inlineToken || inlineToken.type !== 'inline') return null
  const content = typeof inlineToken.content === 'string' ? inlineToken.content : ''
  if (!content) return null
  const match = content.match(markerReg)
  if (!match) return null
  const remaining = content.slice(match[0].length)
  if (!remaining || !remaining.trim()) return null
  return match[0]
}

const parseImageAttrs = (raw) => {
  if (raw === null || raw === undefined) return null
  const attrs = []
  const parts = raw.split(/ +/)
  for (let i = 0; i < parts.length; i++) {
    let entry = parts[i]
    if (!entry) continue
    if (classAttrReg.test(entry)) {
      entry = entry.replace(classAttrReg, 'class=')
    } else if (idAttrReg.test(entry)) {
      entry = entry.replace(idAttrReg, 'id=')
    }
    const imageAttr = entry.match(attrParseReg)
    if (!imageAttr || !imageAttr[1]) continue
    attrs.push([imageAttr[1], imageAttr[2]])
  }
  return attrs
}

const normalizeAutoLabelNumberSets = (value) => {
  const normalized = { img: false, table: false }
  if (!value) return normalized
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (normalized.hasOwnProperty(entry)) normalized[entry] = true
    }
    return normalized
  }
  return normalized
}

const buildLabelClassLookup = (opt) => {
  const classPrefix = opt.classPrefix ? opt.classPrefix + '-' : ''
  const defaultClasses = [classPrefix + 'label']
  const withType = (type) => {
    if (opt.removeMarkNameInCaptionClass) return defaultClasses
    return [classPrefix + type + '-label', ...defaultClasses]
  }
  return {
    img: withType('img'),
    table: withType('table'),
    default: defaultClasses,
  }
}

const shouldApplyLabelNumbering = (captionType, opt) => {
  const setting = opt.autoLabelNumberSets
  if (!setting) return false
  return !!setting[captionType]
}

const isOnlySpacesText = (token) => {
  if (!token || token.type !== 'text') return false
  const content = token.content
  if (typeof content !== 'string') return false
  if (content.length === 0) return true
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

const clearImageAltAttr = (token) => {
  if (!token) return
  setTokenAttr(token, 'alt', '')
  token.content = ''
  if (token.children) {
    for (let i = 0; i < token.children.length; i++) {
      token.children[i].content = ''
    }
  }
}

const clearImageTitleAttr = (token) => {
  removeTokenAttr(token, 'title')
}

const getImageAltText = (token) => {
  let alt = getTokenAttr(token, 'alt')
  if (alt) return alt
  if (typeof token.content === 'string' && token.content !== '') return token.content
  if (token.children && token.children.length > 0) {
    let combined = ''
    for (let i = 0; i < token.children.length; i++) {
      const child = token.children[i]
      if (child && child.content) combined += child.content
    }
    return combined
  }
  return ''
}

const getImageTitleText = (token) => getTokenAttr(token, 'title')

const detectCaptionLanguage = (text) => {
  const target = (text || '').trim()
  if (!target) return 'en'
  for (let i = 0; i < target.length; i++) {
    const char = target[i]
    const code = target.charCodeAt(i)
    if (isJapaneseCharCode(code)) return 'ja'
    if (isSentenceBoundaryChar(char) || char === '\n') break
  }
  return 'en'
}

const isJapaneseCharCode = (code) => {
  return (
    (code >= 0x3040 && code <= 0x30ff) || // Hiragana + Katakana
    (code >= 0x31f0 && code <= 0x31ff) || // Katakana extensions
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0xff66 && code <= 0xff9f)    // Half-width Katakana
  )
}

const isSentenceBoundaryChar = (char) => {
  return char === '.' || char === '!' || char === '?' || char === '。' || char === '！' || char === '？'
}

const getAutoFallbackLabel = (text, captionType) => {
  const type = captionType === 'table' ? 'table' : 'img'
  const lang = detectCaptionLanguage(text)
  const defaults = fallbackLabelDefaults[type] || fallbackLabelDefaults.img
  if (lang === 'ja') return defaults.ja || defaults.en || ''
  return defaults.en || defaults.ja || ''
}

const getPersistedFallbackLabel = (text, captionType, fallbackState) => {
  const type = captionType === 'table' ? 'table' : 'img'
  if (!fallbackState) return getAutoFallbackLabel(text, type)
  if (fallbackState[type]) return fallbackState[type]
  const resolved = getAutoFallbackLabel(text, type)
  fallbackState[type] = resolved
  return resolved
}

const buildCaptionWithFallback = (text, fallbackOption, captionType = 'img', fallbackState) => {
  const trimmedText = (text || '').trim()
  if (!fallbackOption) return ''
  let label = ''
  if (typeof fallbackOption === 'string') {
    label = fallbackOption.trim()
  } else if (fallbackOption === true) {
    label = getPersistedFallbackLabel(trimmedText, captionType, fallbackState)
  }
  if (!label) return trimmedText
  const isAsciiLabel = asciiLabelReg.test(label)
  if (!trimmedText) {
    return isAsciiLabel ? label + '.' : label
  }
  return label + (isAsciiLabel ? '. ' : '　') + trimmedText
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

const hasClassName = (classAttr, className) => {
  const index = classAttr.indexOf(className)
  if (index === -1) return false
  const end = index + className.length
  if (index > 0 && classAttr.charCodeAt(index - 1) > 0x20) return false
  if (end < classAttr.length && classAttr.charCodeAt(end) > 0x20) return false
  return true
}

const hasAnyClassName = (classAttr, classNames) => {
  for (let i = 0; i < classNames.length; i++) {
    if (hasClassName(classAttr, classNames[i])) return true
  }
  return false
}

const getInlineLabelTextToken = (inlineToken, type, opt) => {
  if (!inlineToken || !inlineToken.children) return null
  const children = inlineToken.children
  const classNames = opt.labelClassLookup[type] || opt.labelClassLookup.default
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!child || !child.attrs) continue
    const classAttr = getTokenAttr(child, 'class')
    if (!classAttr) continue
    if (!hasAnyClassName(classAttr, classNames)) continue
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
  const captionType = caption.name === 'img' ? 'img' : (caption.name === 'table' ? 'table' : '')
  if (!captionType) return
  if (!shouldApplyLabelNumbering(captionType, opt)) return
  const inlineToken = getCaptionInlineToken(tokens, range, caption)
  if (!inlineToken) return
  const labelTextToken = getInlineLabelTextToken(inlineToken, captionType, opt)
  if (!labelTextToken || typeof labelTextToken.content !== 'string') return
  const originalText = labelTextToken.content
  let end = originalText.length - 1
  while (end >= 0 && originalText.charCodeAt(end) === 0x20) end--
  if (end >= 0) {
    const code = originalText.charCodeAt(end)
    if (code >= 0x30 && code <= 0x39) {
      const existingMatch = originalText.match(trailingDigitsReg)
      if (existingMatch && existingMatch[1]) {
        const explicitValue = parseInt(existingMatch[1], 10)
        if (!Number.isNaN(explicitValue) && explicitValue > (figureNumberState[captionType] || 0)) {
          figureNumberState[captionType] = explicitValue
        }
        return
      }
    }
  }
  figureNumberState[captionType] = (figureNumberState[captionType] || 0) + 1
  const baseLabel = originalText.trim()
  if (!baseLabel) return
  const joint = asciiLabelReg.test(baseLabel) ? ' ' : ''
  const newLabelText = baseLabel + joint + figureNumberState[captionType]
  labelTextToken.content = newLabelText
  updateInlineTokenContent(inlineToken, originalText, newLabelText)
}

const getAutoCaptionFromImage = (imageToken, opt, fallbackLabelState) => {
  const imgCaptionMarkReg = opt && opt.markReg && opt.markReg.img ? opt.markReg.img : null
  if (!opt.autoCaptionDetection) return ''
  if (!imgCaptionMarkReg && !opt.autoAltCaption && !opt.autoTitleCaption) return ''
  const tryMatch = (text) => {
    if (!text) return ''
    const trimmed = text.trim()
    if (trimmed && imgCaptionMarkReg && imgCaptionMarkReg.test(trimmed)) {
      return trimmed
    }
    return ''
  }

  const altText = getImageAltText(imageToken)
  let caption = tryMatch(altText)
  if (caption) {
    clearImageAltAttr(imageToken)
    return caption
  }
  if (!caption && opt.autoAltCaption) {
    const altForFallback = altText || ''
    caption = buildCaptionWithFallback(altForFallback, opt.autoAltCaption, 'img', fallbackLabelState)
    if (imageToken) {
      clearImageAltAttr(imageToken)
    }
  }
  if (caption) return caption

  const titleText = getImageTitleText(imageToken)
  caption = tryMatch(titleText)
  if (caption) {
    clearImageTitleAttr(imageToken)
    return caption
  }
  if (!caption && opt.autoTitleCaption) {
    const titleForFallback = titleText || ''
    caption = buildCaptionWithFallback(titleForFallback, opt.autoTitleCaption, 'img', fallbackLabelState)
    if (imageToken) {
      clearImageTitleAttr(imageToken)
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

const checkPrevCaption = (tokens, n, caption, fNum, sp, opt, captionState) => {
  if(n < 3) return caption
  const captionStartToken = tokens[n-3]
  const captionInlineToken = tokens[n-2]
  const captionEndToken = tokens[n-1]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setCaptionParagraph(n-3, captionState, caption, fNum, sp, opt)
  const captionName = sp && sp.captionDecision ? sp.captionDecision.mark : ''
  if(!captionName) {
    if (opt.labelPrefixMarkerWithoutLabelPrevReg) {
      const markerMatch = getLabelPrefixMarkerMatch(captionInlineToken, opt.labelPrefixMarkerWithoutLabelPrevReg)
      if (markerMatch) {
        stripLabelPrefixMarkerFromInline(captionInlineToken, markerMatch)
        caption.isPrev = true
      }
    }
    return
  }
  caption.name = captionName
  caption.isPrev = true
  return
}

const checkNextCaption = (tokens, en, caption, fNum, sp, opt, captionState) => {
  if (en + 2 > tokens.length) return
  const captionStartToken = tokens[en+1]
  const captionInlineToken = tokens[en+2]
  const captionEndToken = tokens[en+3]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setCaptionParagraph(en+1, captionState, caption, fNum, sp, opt)
  const captionName = sp && sp.captionDecision ? sp.captionDecision.mark : ''
  if(!captionName) {
    if (opt.labelPrefixMarkerWithoutLabelNextReg) {
      const markerMatch = getLabelPrefixMarkerMatch(captionInlineToken, opt.labelPrefixMarkerWithoutLabelNextReg)
      if (markerMatch) {
        stripLabelPrefixMarkerFromInline(captionInlineToken, markerMatch)
        caption.isNext = true
      }
    }
    return
  }
  caption.name = captionName
  caption.isNext = true
  return
}

const cleanCaptionTokenAttrs = (token, captionName, opt) => {
  if (!captionName || !token.attrs || !opt) return
  const prefix = opt.captionClassPrefix || ''
  const targetClass = prefix + captionName
  if (!targetClass) return
  let reg = cleanCaptionRegCache.get(targetClass)
  if (!reg) {
    reg = new RegExp('(?:^|\\s)' + escapeRegExp(targetClass) + '(?=\\s|$)', 'g')
    cleanCaptionRegCache.set(targetClass, reg)
  }
  for (let i = token.attrs.length - 1; i >= 0; i--) {
    if (token.attrs[i][0] === 'class') {
      const classValue = token.attrs[i][1] || ''
      if (!classValue || classValue.indexOf(targetClass) === -1) continue
      const cleaned = classValue.replace(reg, '').replace(/\s+/g, ' ').trim()
      if (cleaned) {
        token.attrs[i][1] = cleaned
      } else {
        token.attrs.splice(i, 1)
      }
    }
  }
}

const resolveFigureClassName = (checkTokenTagName, sp, opt) => {
  const prefix = opt.figureClassPrefix || ''
  let className = prefix + checkTokenTagName
  if (opt.allIframeTypeFigureClassName === '') {
    if (sp.isVideoIframe) {
      className = prefix + 'video'
    }
    if (sp.isIframeTypeBlockquote) {
      className = opt.figureClassThatWrapsIframeTypeBlockquote
    }
  } else {
    if (checkTokenTagName === 'iframe' || sp.isIframeTypeBlockquote) {
      className = opt.allIframeTypeFigureClassName
    }
  }
  return className
}

const applyCaptionDrivenFigureClass = (caption, sp, opt) => {
  if (!sp) return
  const figureClassForSlides = opt.figureClassThatWrapsSlides
  if (!figureClassForSlides) return
  const detectedMark = (sp.captionDecision && sp.captionDecision.mark) || (caption && caption.name) || ''
  if (detectedMark !== 'slide') return
  if (opt.allIframeTypeFigureClassName && sp.figureClassName === opt.allIframeTypeFigureClassName) return
  sp.figureClassName = figureClassForSlides
}


const changePrevCaptionPosition = (tokens, n, caption, opt) => {
  const captionStartToken = tokens[n-3]
  const captionInlineToken = tokens[n-2]
  const captionEndToken = tokens[n-1]

  cleanCaptionTokenAttrs(captionStartToken, caption.name, opt)
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  tokens.splice(n + 2, 0, captionStartToken, captionInlineToken, captionEndToken)
  tokens.splice(n-3, 3)
  return true
}

const changeNextCaptionPosition = (tokens, en, caption, opt) => {
  const captionStartToken = tokens[en+2] // +1: text node for figure.
  const captionInlineToken = tokens[en+3]
  const captionEndToken = tokens[en+4]
  cleanCaptionTokenAttrs(captionStartToken, caption.name, opt)
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
  const figureClassName = sp.figureClassName || resolveFigureClassName(checkTokenTagName, sp, opt)
  figureStartToken.attrSet('class', figureClassName)

  if (opt.roleDocExample && (checkTokenTagName === 'pre-code' || checkTokenTagName === 'pre-samp')) {
    figureStartToken.attrSet('role', 'doc-example')
  }
  const figureEndToken = new TokenConstructor('figure_close', 'figure', -1)
  const rangeStartMap = tokens[n] && Array.isArray(tokens[n].map) && tokens[n].map.length === 2
    ? tokens[n].map
    : null
  const rangeEndMap = tokens[en] && Array.isArray(tokens[en].map) && tokens[en].map.length === 2
    ? tokens[en].map
    : rangeStartMap
  if (rangeStartMap) {
    figureStartToken.map = [rangeStartMap[0], rangeStartMap[1]]
  }
  if (rangeEndMap) {
    figureEndToken.map = [rangeEndMap[0], rangeEndMap[1]]
  }
  const createBreakToken = () => {
    const breakToken = new TokenConstructor('text', '', 0)
    breakToken.content = '\n'
    return breakToken
  }
  if (opt.styleProcess && caption.isNext && sp.attrs.length > 0) {
    for (let i = 0; i < sp.attrs.length; i++) {
      const attr = sp.attrs[i]
      figureStartToken.attrJoin(attr[0], attr[1])
    }
  }
  // For vsce
  if (caption.name === 'img' && tokens[n].attrs) {
    for (let i = 0; i < tokens[n].attrs.length; i++) {
      const attr = tokens[n].attrs[i]
      figureStartToken.attrJoin(attr[0], attr[1])
    }
  }
  if (replaceInsteadOfWrap) {
    tokens.splice(en, 1, createBreakToken(), figureEndToken, createBreakToken())
    tokens.splice(n, 1, figureStartToken, createBreakToken())
    en = en + 2
  } else {
    tokens.splice(en+1, 0, figureEndToken, createBreakToken())
    tokens.splice(n, 0, figureStartToken, createBreakToken())
    en = en + 3
  }
  range.start = n
  range.end = en
  return
}

const checkCaption = (tokens, n, en, caption, fNum, sp, opt, captionState) => {
  checkPrevCaption(tokens, n, caption, fNum, sp, opt, captionState)
  if (caption.isPrev) return
  checkNextCaption(tokens, en, caption, fNum, sp, opt, captionState)
  return
}

const getNestedContainerType = (token) => {
  if (!token) return null
  switch (token.type) {
    case 'blockquote_open':
      return 'blockquote'
    case 'list_item_open':
      return 'list_item'
    case 'dd_open':
      return 'dd'
    default:
      return null
  }
}

const resetRangeState = (range, start) => {
  range.start = start
  range.end = start
}

const resetCaptionState = (caption) => {
  caption.name = ''
  caption.nameSuffix = ''
  caption.isPrev = false
  caption.isNext = false
}

const resetSpecialState = (sp) => {
  sp.attrs.length = 0
  sp.isVideoIframe = false
  sp.isIframeTypeBlockquote = false
  sp.figureClassName = ''
  sp.captionDecision = null
}

const findClosingTokenIndex = (tokens, startIndex, tag) => {
  const openType = tag + '_open'
  const closeType = tag + '_close'
  let depth = 1
  let i = startIndex + 1
  while (i < tokens.length) {
    const tokenType = tokens[i].type
    if (tokenType === openType) depth++
    if (tokenType === closeType) {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return startIndex
}

const detectCheckTypeOpen = (tokens, token, n, caption, baseType) => {
  if (!token || !baseType) return null
  if (n > 1 && tokens[n - 2] && tokens[n - 2].type === 'figure_open') return null
  let tagName = token.tag
  caption.name = baseType
  if (baseType === 'pre') {
    if (tokens[n + 1] && tokens[n + 1].tag === 'code') caption.name = 'pre-code'
    if (tokens[n + 1] && tokens[n + 1].tag === 'samp') caption.name = 'pre-samp'
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

const detectHtmlBlockToken = (tokens, token, n, caption, sp, opt) => {
  if (!token || token.type !== 'html_block') return null
  const content = token.content
  const hasBlueskyHint = content.indexOf('bluesky-embed') !== -1
  const hasBlueskyEmbed = hasBlueskyHint && blueskyEmbedReg.test(content)
  if (!hasBlueskyHint
      && content.indexOf('<video') === -1
      && content.indexOf('<audio') === -1
      && content.indexOf('<iframe') === -1
      && content.indexOf('<blockquote') === -1
      && content.indexOf('<div') === -1) {
    return null
  }
  let matchedTag = ''
  for (let i = 0; i < HTML_TAG_CANDIDATES.length; i++) {
    const candidate = HTML_TAG_CANDIDATES[i]
    const treatDivAsIframe = candidate === 'div'
    const lookupTag = treatDivAsIframe ? 'div' : candidate
    const hasTagHint = content.indexOf('<' + lookupTag) !== -1
    if (!hasTagHint && !(candidate === 'blockquote' && hasBlueskyEmbed)) continue
    const hasTag = hasTagHint ? content.match(getHtmlReg(lookupTag)) : null
    const isBlueskyBlockquote = !hasTag && hasBlueskyEmbed && candidate === 'blockquote'
    if (!(hasTag || isBlueskyBlockquote)) continue
    if (hasTag) {
      if ((hasTag[2] && hasTag[3] !== '\n') || (hasTag[1] !== '\n' && hasTag[2] === undefined)) {
        token.content += '\n'
      }
      matchedTag = treatDivAsIframe ? 'iframe' : candidate
      if (treatDivAsIframe) {
        sp.isVideoIframe = true
      }
    } else {
      let addedCont = ''
      let j = n + 1
      while (j < tokens.length) {
        const nextToken = tokens[j]
        if (nextToken.type === 'inline' && endBlockquoteScriptReg.test(nextToken.content)) {
          addedCont += nextToken.content + '\n'
          if (tokens[j + 1] && tokens[j + 1].type === 'paragraph_close') {
            tokens.splice(j + 1, 1)
          }
          nextToken.content = ''
          if (nextToken.children) {
            for (let k = 0; k < nextToken.children.length; k++) {
              nextToken.children[k].content = ''
            }
          }
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
      matchedTag = 'blockquote'
    }
    break
  }
  if (!matchedTag) return null
  if (matchedTag === 'blockquote') {
    if (classNameReg.test(token.content)) {
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
  } else if (matchedTag === 'audio' && opt.audioWithoutCaption) {
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
      const rawContent = child.content
      if (opt.styleProcess && rawContent && rawContent.indexOf('{') !== -1) {
        const imageAttrs = rawContent.match(imageAttrsReg)
        if (imageAttrs) {
          const parsedAttrs = parseImageAttrs(imageAttrs[1])
          if (parsedAttrs && parsedAttrs.length) {
            for (let i = 0; i < parsedAttrs.length; i++) {
              sp.attrs.push(parsedAttrs[i])
            }
          }
          break
        }
      }
      if (typeof rawContent === 'string' && rawContent.trim()) {
        isValid = false
      }
      break
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

  const fallbackLabelState = {
    img: null,
    table: null,
  }

  const captionState = { tokens: state.tokens, Token: state.Token }
  figureWithCaptionCore(state.tokens, opt, fNum, figureNumberState, fallbackLabelState, state.Token, captionState, null, 0)
}

const figureWithCaptionCore = (tokens, opt, fNum, figureNumberState, fallbackLabelState, TokenConstructor, captionState, parentType = null, startIndex = 0) => {
  const rRange = { start: startIndex, end: startIndex }
  const rCaption = {
    name: '', nameSuffix: '', isPrev: false, isNext: false
  }
  const rSp = {
    attrs: [],
    isVideoIframe: false,
    isIframeTypeBlockquote: false,
    figureClassName: '',
    captionDecision: null
  }
  let n = startIndex
  while (n < tokens.length) {
    const token = tokens[n]
    const containerType = getNestedContainerType(token)

    if (containerType && containerType !== 'blockquote') {
      const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, fallbackLabelState, TokenConstructor, captionState, containerType, n + 1)
      n = (typeof closeIndex === 'number' ? closeIndex : n) + 1
      continue
    }


    if (parentType && token.type === `${parentType}_close`) {
      return n
    }

    let detection = null
    const tokenType = token.type
    const blockType = CHECK_TYPE_TOKEN_MAP[tokenType]
    if (tokenType === 'paragraph_open') {
      resetRangeState(rRange, n)
      resetCaptionState(rCaption)
      resetSpecialState(rSp)
      const nextToken = tokens[n + 1]
      detection = detectImageParagraph(tokens, token, nextToken, n, rCaption, rSp, opt)
    } else if (tokenType === 'html_block') {
      resetRangeState(rRange, n)
      resetCaptionState(rCaption)
      resetSpecialState(rSp)
      detection = detectHtmlBlockToken(tokens, token, n, rCaption, rSp, opt)
    } else if (tokenType === 'fence') {
      resetRangeState(rRange, n)
      resetCaptionState(rCaption)
      resetSpecialState(rSp)
      detection = detectFenceToken(token, n, rCaption)
    } else if (blockType) {
      resetRangeState(rRange, n)
      resetCaptionState(rCaption)
      resetSpecialState(rSp)
      detection = detectCheckTypeOpen(tokens, token, n, rCaption, blockType)
    }

    if (!detection) {
      if (containerType === 'blockquote') {
        const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, fallbackLabelState, TokenConstructor, captionState, containerType, n + 1)
        n = (typeof closeIndex === 'number' ? closeIndex : n) + 1
      } else {
        n++
      }
      continue
    }

    rRange.end = detection.en

    rSp.figureClassName = resolveFigureClassName(detection.tagName, rSp, opt)
    checkCaption(tokens, rRange.start, rRange.end, rCaption, fNum, rSp, opt, captionState)
    applyCaptionDrivenFigureClass(rCaption, rSp, opt)

    let hasCaption = rCaption.isPrev || rCaption.isNext
    let pendingAutoCaption = ''
    if (!hasCaption && detection.type === 'image' && opt.autoCaptionDetection) {
      pendingAutoCaption = getAutoCaptionFromImage(detection.imageToken, opt, fallbackLabelState)
      if (pendingAutoCaption) {
        hasCaption = true
      }
    }

    if (detection.canWrap === false) {
      let nextIndex = rRange.end + 1
      if (containerType === 'blockquote') {
        const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, fallbackLabelState, TokenConstructor, captionState, containerType, rRange.start + 1)
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
      if (token.hidden === true) {
        shouldWrap = false
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
        checkCaption(tokens, rRange.start, rRange.end, rCaption, fNum, rSp, opt, captionState)
        applyCaptionDrivenFigureClass(rCaption, rSp, opt)
      }
      ensureAutoFigureNumbering(tokens, rRange, rCaption, figureNumberState, opt)
      wrapWithFigure(tokens, rRange, detection.tagName, rCaption, detection.replaceInsteadOfWrap, rSp, opt, TokenConstructor)
    }

    let nextIndex
    if (!rCaption.isPrev && !rCaption.isNext) {
      if (shouldWrap && detection.type === 'html') {
        nextIndex = rRange.end + 1
      } else {
        nextIndex = n + 1
      }
    } else {
      const en = rRange.end
      if (rCaption.isPrev) {
        changePrevCaptionPosition(tokens, rRange.start, rCaption, opt)
        nextIndex = en + 1
      } else if (rCaption.isNext) {
        changeNextCaptionPosition(tokens, en, rCaption, opt)
        nextIndex = en + 4
      } else {
        nextIndex = en + 1
      }
    }

    if (containerType === 'blockquote') {
      const closeIndex = figureWithCaptionCore(tokens, opt, fNum, figureNumberState, fallbackLabelState, TokenConstructor, captionState, containerType, rRange.start + 1)
      const fallbackIndex = rCaption.name ? rRange.end : n
      nextIndex = Math.max(nextIndex, (typeof closeIndex === 'number' ? closeIndex : fallbackIndex) + 1)
    }

    n = nextIndex
  }
  return tokens.length
}

const mditFigureWithPCaption = (md, option) => {
  let opt = {
    // Caption languages delegated to p-captions.
    languages: ['en', 'ja'],

    // --- figure-wrapper behavior ---
    classPrefix: 'f',
    figureClassThatWrapsIframeTypeBlockquote: null,
    figureClassThatWrapsSlides: null,
    styleProcess : true,
    oneImageWithoutCaption: false,
    iframeWithoutCaption: false,
    videoWithoutCaption: false,
    audioWithoutCaption: false,
    iframeTypeBlockquoteWithoutCaption: false,
    multipleImages: true,
    roleDocExample: false,
    allIframeTypeFigureClassName: '', // e.g. 'f-embed' to force a single class for iframe-like embeds (recommended)

    // --- automatic caption detection heuristics ---
    // Applies only to the first image within an image-only paragraph (even when multipleImages is true).
    // Priority: caption paragraphs (before/after) > alt text > title attribute; auto detection only runs when no paragraph caption exists.
    autoCaptionDetection: true,
    autoAltCaption: false, // allow alt text (when matching markReg.img) to build captions automatically
    autoTitleCaption: false, // same as above but reads from the title attribute when alt isn't usable

    // --- label prefix marker helpers ---
    labelPrefixMarker: null, // optional leading marker(s) before label, e.g. '*' or ['*', '>']
    allowLabelPrefixMarkerWithoutLabel: false, // when true, reuse labelPrefixMarker for marker-only captions (array uses [prev, next])

    // --- numbering controls ---
    autoLabelNumber: false, // shorthand for enabling numbering for both img/table unless autoLabelNumberSets is provided explicitly
    autoLabelNumberSets: [], // preferred; supports ['img'], ['table'], or both

    // --- caption text formatting (delegated to p7d-markdown-it-p-captions) ---
    hasNumClass: false,
    dquoteFilename: false,
    strongFilename: false,
    bLabel: false,
    strongLabel: false,
    jointSpaceUseHalfWidth: false,
    removeUnnumberedLabel: false,
    removeUnnumberedLabelExceptMarks: [],
    removeMarkNameInCaptionClass: false,
    wrapCaptionBody: false,
  }
  const hasExplicitAutoLabelNumberSets = option && Object.prototype.hasOwnProperty.call(option, 'autoLabelNumberSets')
  const hasExplicitFigureClassThatWrapsIframeTypeBlockquote = option && Object.prototype.hasOwnProperty.call(option, 'figureClassThatWrapsIframeTypeBlockquote')
  const hasExplicitFigureClassThatWrapsSlides = option && Object.prototype.hasOwnProperty.call(option, 'figureClassThatWrapsSlides')
  if (option) Object.assign(opt, option)
  opt.languages = normalizeLanguages(opt.languages)
  opt.markRegState = getMarkRegStateForLanguages(opt.languages)
  opt.markReg = getMarkRegForLanguages(opt.languages)
  // Normalize option shorthands now so downstream logic works with a consistent { img, table } shape.
  opt.autoLabelNumberSets = normalizeAutoLabelNumberSets(opt.autoLabelNumberSets)
  if (opt.autoLabelNumber && !hasExplicitAutoLabelNumberSets) {
    opt.autoLabelNumberSets.img = true
    opt.autoLabelNumberSets.table = true
  }
  const classPrefix = buildClassPrefix(opt.classPrefix)
  opt.figureClassPrefix = classPrefix
  opt.captionClassPrefix = classPrefix
  if (!hasExplicitFigureClassThatWrapsIframeTypeBlockquote) {
    opt.figureClassThatWrapsIframeTypeBlockquote = classPrefix + 'img'
  }
  if (!hasExplicitFigureClassThatWrapsSlides) {
    opt.figureClassThatWrapsSlides = classPrefix + 'slide'
  }
  // Precompute label-class permutations so numbering lookup doesn't rebuild arrays per caption.
  opt.labelClassLookup = buildLabelClassLookup(opt)
  const markerList = normalizeLabelPrefixMarkers(opt.labelPrefixMarker)
  opt.labelPrefixMarkerReg = buildLabelPrefixMarkerRegFromList(markerList)
  if (opt.allowLabelPrefixMarkerWithoutLabel === true) {
    const markerPair = resolveLabelPrefixMarkerPair(markerList)
    opt.labelPrefixMarkerWithoutLabelPrevReg = buildLabelPrefixMarkerRegFromList(markerPair.prev)
    opt.labelPrefixMarkerWithoutLabelNextReg = buildLabelPrefixMarkerRegFromList(markerPair.next)
  } else {
    opt.labelPrefixMarkerWithoutLabelPrevReg = null
    opt.labelPrefixMarkerWithoutLabelNextReg = null
  }

  //If nextCaption has `{}` style and `f-img-multipleImages`, when upgraded to markdown-it-attrs@4.2.0, the existing script will have `{}` style on nextCaption. Therefore, since markdown-it-attrs is md.core.ruler.before('linkify'), figure_with_caption will be processed after it.
  md.core.ruler.before('replacements', 'figure_with_caption', (state) => {
    figureWithCaption(state, opt)
  })
}

export default mditFigureWithPCaption
