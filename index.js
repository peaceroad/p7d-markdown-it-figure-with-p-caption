import {
  analyzeCaptionStart,
  buildLabelClassLookup,
  buildLabelPrefixMarkerRegFromMarkers,
  getGeneratedLabelDefaults,
  normalizeLabelPrefixMarkers,
  setCaptionParagraph,
  getMarkRegStateForLanguages,
  stripLabelPrefixMarker,
} from 'p7d-markdown-it-p-captions'
import { detectHtmlFigureCandidate } from './embeds/detect.js'

const imageAttrsReg = /^ *\{(.*?)\} *$/
const classAttrReg = /^\./
const idAttrReg = /^#/
const sampLangReg = /^ *(?:samp|shell|console)(?:(?= )|$)/
const asciiLabelReg = /^[A-Za-z]/
const attrNameReg = /^[^\s=]+$/
const labelTrailingJointReg = /[.\u3002\uff0e:：]\s*$/
const CHECK_TYPE_TOKEN_MAP = {
  table_open: 'table',
  pre_open: 'pre',
  blockquote_open: 'blockquote',
}
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalizeLanguageCode = (value) => {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return ''
  const separatorIndex = normalized.search(/[-_]/)
  return separatorIndex === -1 ? normalized : normalized.slice(0, separatorIndex)
}
const normalizePreferredLanguages = (value, availableLanguages) => {
  if (!Array.isArray(availableLanguages) || availableLanguages.length === 0) return []
  const source = typeof value === 'string' ? [value] : (Array.isArray(value) ? value : [])
  if (source.length === 0) return []
  const allowed = new Set(availableLanguages)
  const languages = []
  const seen = new Set()
  for (let i = 0; i < source.length; i++) {
    const lang = normalizeLanguageCode(source[i])
    if (!lang || seen.has(lang) || !allowed.has(lang)) continue
    seen.add(lang)
    languages.push(lang)
  }
  return languages
}
const prioritizeLanguage = (languages, preferredLanguage) => {
  if (!preferredLanguage || languages.length === 0) return languages.slice()
  const prioritized = []
  prioritized.push(preferredLanguage)
  for (let i = 0; i < languages.length; i++) {
    if (languages[i] === preferredLanguage) continue
    prioritized.push(languages[i])
  }
  return prioritized
}
const isAsciiAlphaCode = (code) => {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)
}
const isJapaneseCharCode = (code) => {
  return (
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x31f0 && code <= 0x31ff) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xff66 && code <= 0xff9f)
  )
}
const isHyphenFenceLine = (src, lineStart) => {
  if (typeof src !== 'string' || lineStart < 0 || lineStart >= src.length) return 0
  let index = lineStart
  let hyphenCount = 0
  while (index < src.length && src.charCodeAt(index) === 0x2d) {
    hyphenCount++
    index++
  }
  if (hyphenCount < 3) return 0
  while (index < src.length && src.charCodeAt(index) === 0x20) {
    index++
  }
  if (index >= src.length || src.charCodeAt(index) !== 0x0a) return 0
  return hyphenCount
}
const skipLeadingFrontmatter = (src) => {
  if (typeof src !== 'string' || isHyphenFenceLine(src, 0) === 0) return src
  let lineStart = src.indexOf('\n')
  if (lineStart === -1) return src
  lineStart++
  while (lineStart < src.length) {
    if (isHyphenFenceLine(src, lineStart) > 0) {
      const nextLineStart = src.indexOf('\n', lineStart)
      if (nextLineStart === -1) return ''
      return src.slice(nextLineStart + 1)
    }
    const nextLineStart = src.indexOf('\n', lineStart)
    if (nextLineStart === -1) break
    lineStart = nextLineStart + 1
  }
  return src
}
const detectDocumentPrimaryLanguage = (src, availableLanguages) => {
  if (!src || availableLanguages.indexOf('ja') === -1) return ''
  const body = skipLeadingFrontmatter(src)
  const limit = Math.min(body.length, 8192)
  let japaneseCount = 0
  let asciiAlphaCount = 0
  for (let i = 0; i < limit; i++) {
    const code = body.charCodeAt(i)
    if (isJapaneseCharCode(code)) {
      japaneseCount++
      continue
    }
    if (isAsciiAlphaCode(code)) {
      asciiAlphaCount++
    }
  }
  if (japaneseCount === 0) return ''
  if (asciiAlphaCount === 0) return 'ja'
  return japaneseCount * 2 >= asciiAlphaCount ? 'ja' : ''
}
const sourceMayNeedPreferredLanguages = (state) => {
  const src = state && typeof state.src === 'string' ? state.src : ''
  return src.indexOf('![') !== -1
}
const resolvePreferredLanguagesForState = (state, opt) => {
  const availableLanguages = (
    opt &&
    opt.markRegState &&
    Array.isArray(opt.markRegState.languages)
  ) ? opt.markRegState.languages : []
  if (availableLanguages.length === 0) return []

  const explicitPreferred = opt && Array.isArray(opt.preferredLanguages)
    ? opt.preferredLanguages
    : []
  if (explicitPreferred.length > 0) return explicitPreferred

  const optionLanguages = opt && Array.isArray(opt.normalizedOptionLanguages)
    ? opt.normalizedOptionLanguages
    : []
  const baseLanguages = optionLanguages.length > 0 ? optionLanguages : availableLanguages
  const env = state && state.env ? state.env : null
  const envPreferred = normalizePreferredLanguages(env && env.preferredLanguages, availableLanguages)
  if (envPreferred.length > 0) return envPreferred

  const envLanguage = normalizeLanguageCode(env && (env.preferredLanguage || env.lang || env.language || env.locale))
  if (envLanguage && baseLanguages.indexOf(envLanguage) !== -1) {
    return prioritizeLanguage(baseLanguages, envLanguage)
  }

  const detectedLanguage = detectDocumentPrimaryLanguage(state && state.src ? state.src : '', baseLanguages)
  if (detectedLanguage) {
    return prioritizeLanguage(baseLanguages, detectedLanguage)
  }
  return baseLanguages
}
const needsPreferredLanguagesResolution = (opt) => {
  if (!opt || !opt.markRegState || !Array.isArray(opt.markRegState.languages)) return false
  if (opt.markRegState.languages.length <= 1) return false
  if (Array.isArray(opt.preferredLanguages) && opt.preferredLanguages.length > 0) return false
  return opt.autoAltCaption === true || opt.autoTitleCaption === true
}
const normalizeOptionalClassName = (value) => {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim()
  return normalized || ''
}
const buildClassPrefix = (value) => {
  const normalized = normalizeOptionalClassName(value)
  return normalized ? normalized + '-' : ''
}
const normalizeClassOptionWithFallback = (value, fallbackValue) => {
  const normalized = normalizeOptionalClassName(value)
  return normalized || fallbackValue
}
const resolveLabelPrefixMarkerPair = (markers) => {
  if (!markers || markers.length === 0) return { prev: [], next: [] }
  if (markers.length === 1) {
    return { prev: [markers[0]], next: [markers[0]] }
  }
  return { prev: [markers[0]], next: [markers[1]] }
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

const splitImageAttrParts = (raw) => {
  if (raw === null || raw === undefined) return null
  const parts = []
  let current = ''
  let quote = ''
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (quote) {
      current += ch
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === quote) {
        quote = ''
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === ' ') {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }
    current += ch
  }
  if (quote) return null
  if (current) parts.push(current)
  return parts
}

const unquoteAttrValue = (value) => {
  if (typeof value !== 'string' || value.length < 2) return value || ''
  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1).replace(/\\(["'\\])/g, '$1')
  }
  return value
}

const parseImageAttrs = (raw) => {
  const parts = splitImageAttrParts(raw)
  if (!parts || parts.length === 0) return null
  const attrs = []
  for (let i = 0; i < parts.length; i++) {
    let entry = parts[i]
    if (!entry) continue
    if (classAttrReg.test(entry)) {
      entry = entry.replace(classAttrReg, 'class=')
    } else if (idAttrReg.test(entry)) {
      entry = entry.replace(idAttrReg, 'id=')
    }
    const equalIndex = entry.indexOf('=')
    if (equalIndex === -1) {
      if (!attrNameReg.test(entry)) return null
      attrs.push([entry, ''])
      continue
    }
    const name = entry.slice(0, equalIndex)
    if (!name || !attrNameReg.test(name)) return null
    attrs.push([name, unquoteAttrValue(entry.slice(equalIndex + 1))])
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

const getFallbackStringLabelJoint = (label) => {
  if (!label) return ''
  if (labelTrailingJointReg.test(label)) {
    return asciiLabelReg.test(label) ? ' ' : ''
  }
  return asciiLabelReg.test(label) ? '. ' : '　'
}

const buildCaptionWithFallback = (text, fallbackOption, mark, markRegState, preferredLanguages) => {
  const trimmedText = (text || '').trim()
  if (!fallbackOption) return ''
  if (!trimmedText) return ''
  let label = ''
  let generatedDefaults = null
  if (typeof fallbackOption === 'string') {
    label = fallbackOption.trim()
  } else if (fallbackOption === true) {
    generatedDefaults = getGeneratedLabelDefaults(mark, trimmedText, markRegState, preferredLanguages)
    label = generatedDefaults && generatedDefaults.label ? generatedDefaults.label : ''
  }
  if (!label) return fallbackOption === true ? '' : trimmedText
  if (generatedDefaults) {
    return label + (generatedDefaults.joint || '') + (generatedDefaults.space || '') + trimmedText
  }
  return label + getFallbackStringLabelJoint(label) + trimmedText
}

const validateFallbackCaptionLabelOption = (optionName, fallbackOption, markRegState) => {
  if (typeof fallbackOption !== 'string') return
  const sampleCaption = buildCaptionWithFallback('caption', fallbackOption, 'img', markRegState, null)
  const analysis = analyzeCaptionStart(sampleCaption, {
    markRegState,
    preferredMark: 'img',
  })
  if (!analysis || analysis.mark !== 'img' || analysis.kind !== 'caption') {
    throw new Error(`${optionName} must be a string label recognized as an image caption by p7d-markdown-it-p-captions: ${fallbackOption}`)
  }
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

const parseTrailingPositiveInteger = (text) => {
  if (typeof text !== 'string' || text.length === 0) return null
  let end = text.length - 1
  while (end >= 0 && text.charCodeAt(end) === 0x20) end--
  if (end < 0) return null
  const lastCode = text.charCodeAt(end)
  if (lastCode < 0x30 || lastCode > 0x39) return null
  let start = end
  while (start >= 0) {
    const code = text.charCodeAt(start)
    if (code < 0x30 || code > 0x39) break
    start--
  }
  let value = 0
  let digitBase = 1
  for (let i = end; i > start; i--) {
    value += (text.charCodeAt(i) - 0x30) * digitBase
    digitBase *= 10
  }
  return value
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
      const explicitValue = parseTrailingPositiveInteger(originalText)
      if (explicitValue !== null) {
        if (explicitValue > (figureNumberState[captionType] || 0)) {
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

const matchAutoCaptionText = (text, opt, preferredMark = 'img') => {
  if (!text || !opt || !opt.markRegState) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  const analysis = analyzeCaptionStart(trimmed, {
    markRegState: opt.markRegState,
    preferredMark,
  })
  if (analysis) return trimmed
  return ''
}

const getAutoCaptionFromImage = (imageToken, opt) => {
  if (!opt.autoCaptionDetection) return ''
  if (!opt.autoAltCaption && !opt.autoTitleCaption && !(opt.markRegState && opt.markRegState.markReg && opt.markRegState.markReg.img)) return ''

  const altText = getImageAltText(imageToken)
  let caption = matchAutoCaptionText(altText, opt)
  if (caption) {
    clearImageAltAttr(imageToken)
    return caption
  }
  if (!caption && opt.autoAltCaption) {
    const altForFallback = altText || ''
    const fallbackCaption = buildCaptionWithFallback(altForFallback, opt.autoAltCaption, 'img', opt.markRegState, opt.preferredLanguages)
    if (fallbackCaption && imageToken) {
      clearImageAltAttr(imageToken)
    }
    caption = fallbackCaption
  }
  if (caption) return caption

  const titleText = getImageTitleText(imageToken)
  caption = matchAutoCaptionText(titleText, opt)
  if (caption) {
    clearImageTitleAttr(imageToken)
    return caption
  }
  if (!caption && opt.autoTitleCaption) {
    const titleForFallback = titleText || ''
    const fallbackCaption = buildCaptionWithFallback(titleForFallback, opt.autoTitleCaption, 'img', opt.markRegState, opt.preferredLanguages)
    if (fallbackCaption && imageToken) {
      clearImageTitleAttr(imageToken)
    }
    caption = fallbackCaption
  }
  return caption
}

const checkPrevCaption = (tokens, n, caption, sp, opt, captionState) => {
  if(n < 3) return caption
  const captionStartToken = tokens[n-3]
  const captionInlineToken = tokens[n-2]
  const captionEndToken = tokens[n-1]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setCaptionParagraph(n-3, captionState, caption, null, sp, opt)
  const captionName = sp && sp.captionDecision ? sp.captionDecision.mark : ''
  if(!captionName) {
    if (opt.labelPrefixMarkerWithoutLabelPrevReg) {
        const markerMatch = getLabelPrefixMarkerMatch(captionInlineToken, opt.labelPrefixMarkerWithoutLabelPrevReg)
        if (markerMatch) {
          stripLabelPrefixMarker(captionInlineToken, markerMatch)
          caption.isPrev = true
        }
    }
    return
  }
  caption.name = captionName
  caption.isPrev = true
  return
}

const checkNextCaption = (tokens, en, caption, sp, opt, captionState) => {
  if (en + 2 > tokens.length) return
  const captionStartToken = tokens[en+1]
  const captionInlineToken = tokens[en+2]
  const captionEndToken = tokens[en+3]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setCaptionParagraph(en+1, captionState, caption, null, sp, opt)
  const captionName = sp && sp.captionDecision ? sp.captionDecision.mark : ''
  if(!captionName) {
    if (opt.labelPrefixMarkerWithoutLabelNextReg) {
        const markerMatch = getLabelPrefixMarkerMatch(captionInlineToken, opt.labelPrefixMarkerWithoutLabelNextReg)
        if (markerMatch) {
          stripLabelPrefixMarker(captionInlineToken, markerMatch)
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
  const cleanCaptionRegCache = opt.cleanCaptionRegCache
  let reg = cleanCaptionRegCache && cleanCaptionRegCache.get(targetClass)
  if (!reg) {
    reg = new RegExp('(?:^|\\s)' + escapeRegExp(targetClass) + '(?=\\s|$)', 'g')
    if (cleanCaptionRegCache) {
      cleanCaptionRegCache.set(targetClass, reg)
    }
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
  const figureBaseLevel = getTokenLevel(tokens[n])

  cleanCaptionTokenAttrs(captionStartToken, caption.name, opt)
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionStartToken.block = true
  captionStartToken.level = figureBaseLevel + 1
  captionInlineToken.level = figureBaseLevel + 2
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  captionEndToken.block = true
  captionEndToken.level = figureBaseLevel + 1
  tokens.splice(n + 2, 0, captionStartToken, captionInlineToken, captionEndToken)
  tokens.splice(n-3, 3)
  return true
}

const changeNextCaptionPosition = (tokens, en, caption, opt) => {
  const captionStartToken = tokens[en+1]
  const captionInlineToken = tokens[en+2]
  const captionEndToken = tokens[en+3]
  const figureBaseLevel = getTokenLevel(tokens[en])
  cleanCaptionTokenAttrs(captionStartToken, caption.name, opt)
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionStartToken.block = true
  captionStartToken.level = figureBaseLevel + 1
  captionInlineToken.level = figureBaseLevel + 2
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  captionEndToken.block = true
  captionEndToken.level = figureBaseLevel + 1
  tokens.splice(en, 0, captionStartToken, captionInlineToken, captionEndToken)
  tokens.splice(en+4, 3)
  return true
}

const getTokenMap = (token) => {
  return token && Array.isArray(token.map) && token.map.length === 2 ? token.map : null
}

const findNearestMapInRange = (tokens, start, end, step) => {
  let i = start
  while (step > 0 ? i <= end : i >= end) {
    const map = getTokenMap(tokens[i])
    if (map) return map
    i += step
  }
  return null
}

const getRangeMap = (tokens, start, end) => {
  const startMap = getTokenMap(tokens[start]) || findNearestMapInRange(tokens, start, end, 1)
  if (!startMap) return null
  const endMap = getTokenMap(tokens[end]) || findNearestMapInRange(tokens, end, start, -1) || startMap
  const startLine = startMap[0]
  const endLine = Math.max(startMap[1], endMap[1])
  if (typeof startLine !== 'number' || typeof endLine !== 'number' || endLine < startLine) {
    return [startMap[0], startMap[1]]
  }
  return [startLine, endLine]
}

const getTokenLevel = (token, fallback = 0) => {
  return token && typeof token.level === 'number' ? token.level : fallback
}

const adjustTokenLevels = (tokens, start, end, delta) => {
  if (!delta) return
  for (let i = start; i <= end; i++) {
    const token = tokens[i]
    if (token && typeof token.level === 'number') {
      token.level += delta
    }
  }
}

const wrapWithFigure = (tokens, range, checkTokenTagName, caption, replaceInsteadOfWrap, sp, opt, TokenConstructor) => {
  let n = range.start
  let en = range.end
  const baseLevel = getTokenLevel(tokens[n])
  const childLevel = baseLevel + 1
  const figureStartToken = new TokenConstructor('figure_open', 'figure', 1)
  const figureClassName = sp.figureClassName || resolveFigureClassName(checkTokenTagName, sp, opt)
  figureStartToken.attrSet('class', figureClassName)
  figureStartToken.block = true
  figureStartToken.level = baseLevel

  if (opt.roleDocExample && (checkTokenTagName === 'pre-code' || checkTokenTagName === 'pre-samp')) {
    figureStartToken.attrSet('role', 'doc-example')
  }
  const figureEndToken = new TokenConstructor('figure_close', 'figure', -1)
  figureEndToken.block = true
  figureEndToken.level = baseLevel
  const rangeMap = getRangeMap(tokens, n, en)
  if (rangeMap) {
    figureStartToken.map = [rangeMap[0], rangeMap[1]]
    figureEndToken.map = [rangeMap[0], rangeMap[1]]
  }
  const createBreakToken = () => {
    const breakToken = new TokenConstructor('text', '', 0)
    breakToken.content = '\n'
    breakToken.level = childLevel
    return breakToken
  }
  const createEmptyTextToken = () => {
    const emptyToken = new TokenConstructor('text', '', 0)
    emptyToken.content = ''
    emptyToken.level = childLevel
    return emptyToken
  }
  if (caption.name === 'img') {
    const joinAttrs = (attrs) => {
      if (!attrs || attrs.length === 0) return
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]
        figureStartToken.attrJoin(attr[0], attr[1])
      }
    }
    // `styleProcess` should keep working even when markdown-it-attrs is absent.
    if (opt.styleProcess) joinAttrs(sp.attrs)
    // Forward attrs already materialized by markdown-it-attrs on the image paragraph.
    joinAttrs(tokens[n].attrs)
  }
  if (replaceInsteadOfWrap) {
    tokens.splice(en, 1, createBreakToken(), figureEndToken)
    tokens.splice(n, 1, figureStartToken, createEmptyTextToken())
    en = en + 2
  } else {
    adjustTokenLevels(tokens, n, en, 1)
    tokens.splice(en+1, 0, figureEndToken)
    tokens.splice(n, 0, figureStartToken, createEmptyTextToken())
    en = en + 3
  }
  range.start = n
  range.end = en
  return
}

const checkCaption = (tokens, n, en, caption, sp, opt, captionState) => {
  checkPrevCaption(tokens, n, caption, sp, opt, captionState)
  if (caption.isPrev) return
  checkNextCaption(tokens, en, caption, sp, opt, captionState)
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

const hasLeadingImageChild = (token) => {
  return !!(token &&
    token.type === 'inline' &&
    token.children &&
    token.children.length > 0 &&
    token.children[0] &&
    token.children[0].type === 'image')
}

const detectImageParagraph = (nextToken, n, caption, sp, opt) => {
  const multipleImagesEnabled = !!opt.multipleImages
  const styleProcessEnabled = !!opt.styleProcess
  const allowImageParagraphWithoutCaption = !!opt.imageOnlyParagraphWithoutCaption
  const children = nextToken.children
  const imageToken = children[0]
  const childrenLength = children.length
  let imageNum = 1
  let isMultipleImagesHorizontal = true
  let isMultipleImagesVertical = true
  let isValid = true
  caption.name = 'img'
  if (childrenLength === 1) {
    return {
      type: 'image',
      tagName: 'img',
      en: n + 2,
      replaceInsteadOfWrap: true,
      wrapWithoutCaption: allowImageParagraphWithoutCaption,
      canWrap: true,
      imageToken,
    }
  }
  if (!multipleImagesEnabled && childrenLength > 2) {
    return {
      type: 'image',
      tagName: 'img',
      en: n + 2,
      replaceInsteadOfWrap: true,
      wrapWithoutCaption: false,
      canWrap: false,
      imageToken,
    }
  }
  for (let childIndex = 1; childIndex < childrenLength; childIndex++) {
    const child = children[childIndex]
    if (childIndex === childrenLength - 1 && child.type === 'text') {
      const rawContent = child.content
      if (styleProcessEnabled && rawContent && rawContent.indexOf('{') !== -1 && rawContent.indexOf('}') !== -1) {
        const imageAttrs = rawContent.match(imageAttrsReg)
        if (imageAttrs) {
          const parsedAttrs = parseImageAttrs(imageAttrs[1])
          if (parsedAttrs) {
            for (let i = 0; i < parsedAttrs.length; i++) {
              sp.attrs.push(parsedAttrs[i])
            }
            child.content = ''
            break
          }
        }
      }
      if (typeof rawContent === 'string' && rawContent.trim()) {
        isValid = false
      }
      break
    }

    if (!multipleImagesEnabled) {
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
  if (isValid && imageNum > 1 && multipleImagesEnabled) {
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
    wrapWithoutCaption: isValid && allowImageParagraphWithoutCaption,
    canWrap: isValid,
    imageToken,
  }
}

const figureWithCaption = (state, opt) => {
  const figureNumberState = {
    img: 0,
    table: 0,
  }

  const captionState = { tokens: state.tokens, Token: state.Token }
  const shouldResolvePreferredLanguages = !!(
    opt.shouldResolvePreferredLanguages &&
    sourceMayNeedPreferredLanguages(state)
  )
  const renderOpt = shouldResolvePreferredLanguages ? Object.create(opt) : opt
  if (shouldResolvePreferredLanguages) {
    renderOpt.preferredLanguages = resolvePreferredLanguagesForState(state, opt)
  }
  figureWithCaptionCore(state.tokens, renderOpt, figureNumberState, state.Token, captionState, null, 0)
}

const figureWithCaptionCore = (tokens, opt, figureNumberState, TokenConstructor, captionState, parentType = null, startIndex = 0) => {
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
      const closeIndex = figureWithCaptionCore(tokens, opt, figureNumberState, TokenConstructor, captionState, containerType, n + 1)
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
      const nextToken = tokens[n + 1]
      if (hasLeadingImageChild(nextToken)) {
        resetRangeState(rRange, n)
        resetCaptionState(rCaption)
        resetSpecialState(rSp)
        detection = detectImageParagraph(nextToken, n, rCaption, rSp, opt)
      }
    } else if (tokenType === 'html_block') {
      resetRangeState(rRange, n)
      resetCaptionState(rCaption)
      resetSpecialState(rSp)
      detection = detectHtmlFigureCandidate(tokens, token, n, opt.htmlWrapWithoutCaption)
      if (detection) {
        rCaption.name = detection.tagName
        rSp.isVideoIframe = !!detection.isVideoIframe
        rSp.isIframeTypeBlockquote = !!detection.isIframeTypeBlockquote
      }
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
        const closeIndex = figureWithCaptionCore(tokens, opt, figureNumberState, TokenConstructor, captionState, containerType, n + 1)
        n = (typeof closeIndex === 'number' ? closeIndex : n) + 1
      } else {
        n++
      }
      continue
    }

    rRange.end = detection.en

    rSp.figureClassName = resolveFigureClassName(detection.tagName, rSp, opt)
    checkCaption(tokens, rRange.start, rRange.end, rCaption, rSp, opt, captionState)
    applyCaptionDrivenFigureClass(rCaption, rSp, opt)

    let hasCaption = rCaption.isPrev || rCaption.isNext
    let pendingAutoCaption = ''
    if (!hasCaption && detection.type === 'image' && opt.autoCaptionDetection) {
      pendingAutoCaption = getAutoCaptionFromImage(detection.imageToken, opt)
      if (pendingAutoCaption) {
        hasCaption = true
      }
    }

    if (detection.canWrap === false) {
      let nextIndex = rRange.end + 1
      if (containerType === 'blockquote') {
        const closeIndex = figureWithCaptionCore(tokens, opt, figureNumberState, TokenConstructor, captionState, containerType, rRange.start + 1)
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
        checkCaption(tokens, rRange.start, rRange.end, rCaption, rSp, opt, captionState)
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
      const closeIndex = figureWithCaptionCore(tokens, opt, figureNumberState, TokenConstructor, captionState, containerType, rRange.start + 1)
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
    preferredLanguages: null, // optional tie-break order for generated fallback labels; defaults to inferred document order / languages

    // --- figure-wrapper behavior ---
    classPrefix: 'f',
    figureClassThatWrapsIframeTypeBlockquote: null,
    figureClassThatWrapsSlides: null,
    styleProcess: true,
    imageOnlyParagraphWithoutCaption: false,
    oneImageWithoutCaption: false, // legacy alias for imageOnlyParagraphWithoutCaption
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
    labelClassFollowsFigure: false,
    figureToLabelClassMap: null,
  }
  const hasExplicitAutoLabelNumberSets = option && Object.prototype.hasOwnProperty.call(option, 'autoLabelNumberSets')
  const hasExplicitImageOnlyParagraphWithoutCaption = option && Object.prototype.hasOwnProperty.call(option, 'imageOnlyParagraphWithoutCaption')
  const hasExplicitFigureClassThatWrapsIframeTypeBlockquote = option && Object.prototype.hasOwnProperty.call(option, 'figureClassThatWrapsIframeTypeBlockquote')
  const hasExplicitFigureClassThatWrapsSlides = option && Object.prototype.hasOwnProperty.call(option, 'figureClassThatWrapsSlides')
  const hasExplicitLabelClassFollowsFigure = option && Object.prototype.hasOwnProperty.call(option, 'labelClassFollowsFigure')
  if (option) Object.assign(opt, option)
  opt.imageOnlyParagraphWithoutCaption = hasExplicitImageOnlyParagraphWithoutCaption
    ? !!opt.imageOnlyParagraphWithoutCaption
    : !!opt.oneImageWithoutCaption
  opt.oneImageWithoutCaption = !!opt.oneImageWithoutCaption
  if (!hasExplicitLabelClassFollowsFigure && opt.figureToLabelClassMap) {
    opt.labelClassFollowsFigure = true
  }
  opt.classPrefix = normalizeOptionalClassName(opt.classPrefix)
  opt.allIframeTypeFigureClassName = normalizeOptionalClassName(opt.allIframeTypeFigureClassName)
  opt.markRegState = getMarkRegStateForLanguages(opt.languages)
  opt.preferredLanguages = normalizePreferredLanguages(opt.preferredLanguages, opt.markRegState.languages)
  if (opt.preferredLanguages.length === 0) opt.preferredLanguages = null
  opt.normalizedOptionLanguages = normalizePreferredLanguages(opt.languages, opt.markRegState.languages)
  opt.shouldResolvePreferredLanguages = needsPreferredLanguagesResolution(opt)
  validateFallbackCaptionLabelOption('autoAltCaption', opt.autoAltCaption, opt.markRegState)
  validateFallbackCaptionLabelOption('autoTitleCaption', opt.autoTitleCaption, opt.markRegState)
  opt.htmlWrapWithoutCaption = {
    iframe: !!opt.iframeWithoutCaption,
    video: !!opt.videoWithoutCaption,
    audio: !!opt.audioWithoutCaption,
    iframeTypeBlockquote: !!opt.iframeTypeBlockquoteWithoutCaption,
  }
  // Normalize option shorthands now so downstream logic works with a consistent { img, table } shape.
  opt.autoLabelNumberSets = normalizeAutoLabelNumberSets(opt.autoLabelNumberSets)
  if (opt.autoLabelNumber && !hasExplicitAutoLabelNumberSets) {
    opt.autoLabelNumberSets.img = true
    opt.autoLabelNumberSets.table = true
  }
  const classPrefix = buildClassPrefix(opt.classPrefix)
  opt.figureClassPrefix = classPrefix
  opt.captionClassPrefix = classPrefix
  const defaultIframeTypeBlockquoteClass = classPrefix + 'img'
  const defaultSlideFigureClass = classPrefix + 'slide'
  if (!hasExplicitFigureClassThatWrapsIframeTypeBlockquote) {
    opt.figureClassThatWrapsIframeTypeBlockquote = defaultIframeTypeBlockquoteClass
  } else {
    opt.figureClassThatWrapsIframeTypeBlockquote = normalizeClassOptionWithFallback(
      opt.figureClassThatWrapsIframeTypeBlockquote,
      defaultIframeTypeBlockquoteClass,
    )
  }
  if (!hasExplicitFigureClassThatWrapsSlides) {
    opt.figureClassThatWrapsSlides = defaultSlideFigureClass
  } else {
    opt.figureClassThatWrapsSlides = normalizeClassOptionWithFallback(
      opt.figureClassThatWrapsSlides,
      defaultSlideFigureClass,
    )
  }
  // Precompute label-class permutations so numbering lookup doesn't rebuild arrays per caption.
  opt.labelClassLookup = buildLabelClassLookup(opt)
  const markerList = normalizeLabelPrefixMarkers(opt.labelPrefixMarker)
  opt.labelPrefixMarkerReg = buildLabelPrefixMarkerRegFromMarkers(markerList)
  opt.cleanCaptionRegCache = new Map()
  if (opt.allowLabelPrefixMarkerWithoutLabel === true) {
    const markerPair = resolveLabelPrefixMarkerPair(markerList)
    opt.labelPrefixMarkerWithoutLabelPrevReg = buildLabelPrefixMarkerRegFromMarkers(markerPair.prev)
    opt.labelPrefixMarkerWithoutLabelNextReg = buildLabelPrefixMarkerRegFromMarkers(markerPair.next)
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
