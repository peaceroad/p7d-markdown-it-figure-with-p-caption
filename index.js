import {
  analyzeCaptionParagraph,
  analyzeCaptionStart,
  applyCaptionParagraph,
  buildLabelPrefixMarkerRegFromMarkers,
  canonicalizeCaptionNumberingMark,
  createCaptionNumberingPolicy,
  createCaptionNumberingRuntime,
  getGeneratedLabelDefaults,
  normalizeAutoLabelNumberSets,
  normalizeLabelPrefixMarkers,
  setCaptionParagraph,
  getMarkRegStateForLanguages,
  stripLabelPrefixMarker,
} from 'p7d-markdown-it-p-captions'
import { applyHtmlFigureTransform, detectHtmlFigureCandidate } from './embeds/detect.js'
import {
  createFigureCaptionCounterKeyResolverFromMarkRegState,
} from './caption-numbering/counter-series.js'
import {
  createUnscopedNumberingContext,
  formatFigureCaptionGeneratedNumberUnchecked,
  getCaptionNumberingContext,
  parseFigureCaptionExplicitNumberUnchecked,
} from './caption-numbering/number-codec.js'
import {
  getFigureCaptionNumberingPolicyState,
  normalizeFigureCaptionNumberingPolicy,
} from './caption-numbering/options.js'
import {
  createFigureCaptionScopeRuntime,
  getFigureCaptionScopeNestedContainerType,
  updateFigureCaptionScopeFromHeading,
} from './caption-numbering/scope.js'

const imageAttrsReg = /^ *\{(.*?)\} *$/
const sampLangReg = /^ *(?:samp|shell|console)(?:(?= )|$)/
const asciiLabelReg = /^[A-Za-z]/
const attrNameReg = /^[^\s=]+$/
const labelTrailingJointReg = /[.\u3002\uff0e:：\u3000]\s*$/
const installedKey = Symbol.for('p7d-markdown-it-figure-with-p-caption.installed')
const CHECK_TYPE_TOKEN_MAP = {
  table_open: 'table',
  pre_open: 'pre',
  blockquote_open: 'blockquote',
}
const hasOwnOption = (option, name) => !!(
  option && Object.prototype.hasOwnProperty.call(option, name)
)
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalizeLanguageCode = (value) => {
  if (value === null || value === undefined) return ''
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return ''
  const separatorIndex = normalized.search(/[-_]/)
  return separatorIndex === -1 ? normalized : normalized.slice(0, separatorIndex)
}
const appendAvailableLanguage = (target, lang, availableLanguages) => {
  if (!lang) return
  if (availableLanguages.indexOf(lang) === -1) return
  if (target.indexOf(lang) !== -1) return
  target.push(lang)
}
const normalizePreferredLanguages = (value, availableLanguages) => {
  if (!Array.isArray(availableLanguages) || availableLanguages.length === 0) return []
  const languages = []
  if (typeof value === 'string') {
    appendAvailableLanguage(languages, normalizeLanguageCode(value), availableLanguages)
    return languages
  }
  const source = Array.isArray(value) ? value : []
  if (source.length === 0) return languages
  for (let i = 0; i < source.length; i++) {
    const lang = normalizeLanguageCode(source[i])
    appendAvailableLanguage(languages, lang, availableLanguages)
  }
  return languages
}
const prioritizeLanguages = (languages, preferredLanguages) => {
  if (!Array.isArray(languages) || languages.length === 0) return []
  if (typeof preferredLanguages === 'string') {
    if (!preferredLanguages || languages.indexOf(preferredLanguages) === -1) return languages
    if (languages[0] === preferredLanguages) return languages
    const prioritized = [preferredLanguages]
    for (let i = 0; i < languages.length; i++) {
      appendAvailableLanguage(prioritized, languages[i], languages)
    }
    return prioritized
  }
  if (!Array.isArray(preferredLanguages) || preferredLanguages.length === 0) return languages
  const prioritized = []
  for (let i = 0; i < preferredLanguages.length; i++) {
    appendAvailableLanguage(prioritized, preferredLanguages[i], languages)
  }
  if (prioritized.length === 0) return languages
  for (let i = 0; i < languages.length; i++) {
    appendAvailableLanguage(prioritized, languages[i], languages)
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
const getBodyStartAfterLeadingFrontmatter = (src) => {
  if (typeof src !== 'string' || isHyphenFenceLine(src, 0) === 0) return 0
  let lineStart = src.indexOf('\n')
  if (lineStart === -1) return 0
  lineStart++
  while (lineStart < src.length) {
    if (isHyphenFenceLine(src, lineStart) > 0) {
      const nextLineStart = src.indexOf('\n', lineStart)
      return nextLineStart === -1 ? src.length : nextLineStart + 1
    }
    const nextLineStart = src.indexOf('\n', lineStart)
    if (nextLineStart === -1) break
    lineStart = nextLineStart + 1
  }
  return 0
}
const detectDocumentPrimaryLanguage = (src, availableLanguages) => {
  if (!src || availableLanguages.indexOf('ja') === -1) return ''
  const bodyStart = getBodyStartAfterLeadingFrontmatter(src)
  const limit = Math.min(src.length, bodyStart + 8192)
  let japaneseCount = 0
  let asciiAlphaCount = 0
  for (let i = bodyStart; i < limit; i++) {
    const code = src.charCodeAt(i)
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
const resolvePreferredLanguagesForState = (state, opt) => {
  const availableLanguages = (
    opt &&
    opt.markRegState &&
    Array.isArray(opt.markRegState.languages)
  ) ? opt.markRegState.languages : []
  if (availableLanguages.length === 0) return []

  const baseLanguages = availableLanguages
  const env = state && state.env ? state.env : null

  const envLocale = normalizeLanguageCode(env && env.locale)
  if (envLocale && baseLanguages.indexOf(envLocale) !== -1) {
    return prioritizeLanguages(baseLanguages, envLocale)
  }

  const envPreferredLocales = normalizePreferredLanguages(env && env.preferredLocales, baseLanguages)
  if (envPreferredLocales.length > 0) {
    return prioritizeLanguages(baseLanguages, envPreferredLocales)
  }

  const explicitPreferred = opt && Array.isArray(opt.preferredLanguages)
    ? opt.preferredLanguages
    : []
  if (explicitPreferred.length > 0) {
    return prioritizeLanguages(baseLanguages, explicitPreferred)
  }

  const envPreferred = normalizePreferredLanguages(env && env.preferredLanguages, baseLanguages)
  if (envPreferred.length > 0) {
    return prioritizeLanguages(baseLanguages, envPreferred)
  }

  const envLanguage = normalizeLanguageCode(env && (env.preferredLanguage || env.lang || env.language))
  if (envLanguage && baseLanguages.indexOf(envLanguage) !== -1) {
    return prioritizeLanguages(baseLanguages, envLanguage)
  }

  const detectedLanguage = detectDocumentPrimaryLanguage(state && state.src ? state.src : '', baseLanguages)
  if (detectedLanguage) {
    return prioritizeLanguages(baseLanguages, detectedLanguage)
  }
  return baseLanguages
}
const needsPreferredLanguagesResolution = (opt) => {
  if (!opt || !opt.markRegState || !Array.isArray(opt.markRegState.languages)) return false
  if (!opt.autoCaptionDetection) return false
  if (opt.markRegState.languages.length <= 1) return false
  return opt.autoAltCaption === true || opt.autoTitleCaption === true
}
const normalizeOptionalClassName = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}
const buildClassPrefix = (normalized) => normalized ? normalized + '-' : ''
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
    const firstCode = entry.charCodeAt(0)
    if (firstCode === 0x2e) {
      entry = 'class=' + entry.slice(1)
    } else if (firstCode === 0x23) {
      entry = 'id=' + entry.slice(1)
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

const getEnabledCaptionNumberingMarks = (sets, opt) => {
  if (!Array.isArray(sets) || sets.length === 0) return []
  const exceptMarks = opt && Array.isArray(opt.removeUnnumberedLabelExceptMarks)
    ? opt.removeUnnumberedLabelExceptMarks
    : []
  if (!opt || !opt.removeUnnumberedLabel) return sets
  return sets.filter(mark => exceptMarks.indexOf(mark) !== -1)
}

const createFigureCaptionNumberingPolicy = (enabledMarks, advancedPolicy, markRegState) => {
  if (enabledMarks.length === 0) return null
  const resolveCounterKey = createFigureCaptionCounterKeyResolverFromMarkRegState(markRegState)
  const getCounterKey = ({ captionDecision }) => resolveCounterKey(captionDecision)
  if (!advancedPolicy) {
    return createCaptionNumberingPolicy({
      enabledMarks,
      explicitCounter: 'max',
      generatedNumberHasNumClass: false,
      getCounterKey,
    })
  }
  return createCaptionNumberingPolicy({
    enabledMarks,
    explicitCounter: 'max',
    generatedNumberHasNumClass: false,
    getCounterKey,
    getSequenceKey({ captionContext }) {
      return getCaptionNumberingContext(captionContext).sequenceKey
    },
    // p-captions resolves getSequenceKey first, so the following callbacks can
    // reuse that already-branded context without a second WeakSet lookup.
    parseExplicitNumber({ number, captionContext }) {
      return parseFigureCaptionExplicitNumberUnchecked(
        number,
        captionContext && captionContext.numbering,
      )
    },
    formatGeneratedNumber({ sequence, captionContext }) {
      return formatFigureCaptionGeneratedNumberUnchecked(
        sequence,
        captionContext && captionContext.numbering,
      )
    },
  })
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

const resolveCaptionPreferredLanguages = (captionState, opt) => {
  const renderState = captionState.preferredLanguageState
  if (!renderState) return captionState.preferredLanguages
  captionState.preferredLanguages = resolvePreferredLanguagesForState(renderState, opt)
  captionState.preferredLanguageState = null
  return captionState.preferredLanguages
}

const validateFallbackCaptionLabelOption = (optionName, fallbackOption, markRegState) => {
  if (
    fallbackOption !== undefined &&
    fallbackOption !== null &&
    fallbackOption !== false &&
    fallbackOption !== true &&
    typeof fallbackOption !== 'string'
  ) {
    throw new TypeError(`${optionName} must be false, true, a string label, or null.`)
  }
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

const getAutoCaptionFromImage = (imageToken, opt, captionState) => {
  if (!opt.autoAltCaption && !opt.autoTitleCaption && !(opt.markRegState && opt.markRegState.markReg && opt.markRegState.markReg.img)) return null

  const altText = getImageAltText(imageToken)
  let caption = matchAutoCaptionText(altText, opt)
  if (caption) {
    return { text: caption, source: 'alt' }
  }
  if (opt.autoAltCaption) {
    const preferredLanguages = opt.autoAltCaption === true
      ? resolveCaptionPreferredLanguages(captionState, opt)
      : captionState.preferredLanguages
    caption = buildCaptionWithFallback(altText, opt.autoAltCaption, 'img', opt.markRegState, preferredLanguages)
  }
  if (caption) return { text: caption, source: 'alt' }

  const titleText = getImageTitleText(imageToken)
  caption = matchAutoCaptionText(titleText, opt)
  if (caption) {
    return { text: caption, source: 'title' }
  }
  if (opt.autoTitleCaption) {
    const preferredLanguages = opt.autoTitleCaption === true
      ? resolveCaptionPreferredLanguages(captionState, opt)
      : captionState.preferredLanguages
    caption = buildCaptionWithFallback(titleText, opt.autoTitleCaption, 'img', opt.markRegState, preferredLanguages)
  }
  return caption ? { text: caption, source: 'title' } : null
}

const consumeAutoCaptionSource = (imageToken, autoCaption) => {
  if (!imageToken || !autoCaption) return
  if (autoCaption.source === 'alt') {
    clearImageAltAttr(imageToken)
  } else if (autoCaption.source === 'title') {
    clearImageTitleAttr(imageToken)
  }
}

const setFigureCaptionParagraph = (index, captionState, caption, sp, opt) => {
  const needsCaptionDrivenClassBeforeApply = !!(
    opt.labelClassFollowsFigure &&
    caption.name === 'iframe' &&
    !opt.allIframeTypeFigureClassName
  )
  if (!needsCaptionDrivenClassBeforeApply) {
    return setCaptionParagraph(index, captionState, caption, captionState.numberingRuntime, sp, opt)
  }
  const decision = analyzeCaptionParagraph(index, captionState, {
    captionName: caption.name,
    isIframeTypeBlockquote: sp.isIframeTypeBlockquote,
    isVideoIframe: sp.isVideoIframe,
  }, opt)
  if (!decision) return false
  // Figure-following label classes need the final caption-driven wrapper class
  // before p-captions constructs the label/body spans.
  applyCaptionDrivenFigureClass(caption, sp, opt, decision)
  return applyCaptionParagraph(
    decision,
    captionState,
    sp,
    captionState.numberingRuntime,
    opt,
  )
}

const checkPrevCaption = (tokens, n, caption, sp, opt, captionState) => {
  if (n < 3) return
  const captionStartToken = tokens[n - 3]
  const captionInlineToken = tokens[n - 2]
  const captionEndToken = tokens[n - 1]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setFigureCaptionParagraph(n - 3, captionState, caption, sp, opt)
  const captionName = sp && sp.captionDecision ? sp.captionDecision.mark : ''
  if (!captionName) {
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
}

const checkNextCaption = (tokens, en, caption, sp, opt, captionState) => {
  if (en + 3 >= tokens.length) return
  const captionStartToken = tokens[en + 1]
  const captionInlineToken = tokens[en + 2]
  const captionEndToken = tokens[en + 3]
  if (captionStartToken === undefined || captionEndToken === undefined) return
  if (captionStartToken.type !== 'paragraph_open' || captionEndToken.type !== 'paragraph_close') return
  setFigureCaptionParagraph(en + 1, captionState, caption, sp, opt)
  const captionName = sp && sp.captionDecision ? sp.captionDecision.mark : ''
  if (!captionName) {
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

const applyCaptionDrivenFigureClass = (caption, sp, opt, decision = sp && sp.captionDecision) => {
  if (!sp) return
  const figureClassForSlides = opt.figureClassThatWrapsSlides
  if (!figureClassForSlides) return
  const detectedMark = (decision && decision.mark) || (caption && caption.name) || ''
  if (detectedMark !== 'slide') return
  if (opt.allIframeTypeFigureClassName && sp.figureClassName === opt.allIframeTypeFigureClassName) return
  if (sp.figureClassName === figureClassForSlides) return
  sp.figureClassName = figureClassForSlides
}

const convertCaptionTokens = (
  captionStartToken,
  captionInlineToken,
  captionEndToken,
  figureBaseLevel,
  captionName,
  opt,
) => {
  cleanCaptionTokenAttrs(captionStartToken, captionName, opt)
  captionStartToken.type = 'figcaption_open'
  captionStartToken.tag = 'figcaption'
  captionStartToken.block = true
  captionStartToken.level = figureBaseLevel + 1
  captionInlineToken.level = figureBaseLevel + 2
  captionEndToken.type = 'figcaption_close'
  captionEndToken.tag = 'figcaption'
  captionEndToken.block = true
  captionEndToken.level = figureBaseLevel + 1
}

const changePrevCaptionPosition = (tokens, n, caption, opt) => {
  const captionStartToken = tokens[n-3]
  const captionInlineToken = tokens[n-2]
  const captionEndToken = tokens[n-1]
  const figureStartToken = tokens[n]
  const figureStartPaddingToken = tokens[n+1]
  convertCaptionTokens(
    captionStartToken,
    captionInlineToken,
    captionEndToken,
    getTokenLevel(tokens[n]),
    caption.name,
    opt,
  )
  tokens[n-3] = figureStartToken
  tokens[n-2] = figureStartPaddingToken
  tokens[n-1] = captionStartToken
  tokens[n] = captionInlineToken
  tokens[n+1] = captionEndToken
}

const changeNextCaptionPosition = (tokens, en, caption, opt) => {
  const figureEndToken = tokens[en]
  const captionStartToken = tokens[en+1]
  const captionInlineToken = tokens[en+2]
  const captionEndToken = tokens[en+3]
  convertCaptionTokens(
    captionStartToken,
    captionInlineToken,
    captionEndToken,
    getTokenLevel(tokens[en]),
    caption.name,
    opt,
  )
  tokens[en] = captionStartToken
  tokens[en+1] = captionInlineToken
  tokens[en+2] = captionEndToken
  tokens[en+3] = figureEndToken
}

const getTokenMap = (token) => {
  if (!token || !Array.isArray(token.map) || token.map.length !== 2) return null
  const startLine = token.map[0]
  const endLine = token.map[1]
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 0 ||
    endLine < startLine
  ) {
    return null
  }
  return token.map
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

const createTextToken = (TokenConstructor, content, level) => {
  const token = new TokenConstructor('text', '', 0)
  token.content = content
  token.level = level
  return token
}

const joinTokenAttrs = (token, attrs) => {
  if (!attrs || attrs.length === 0) return
  for (let i = 0; i < attrs.length; i++) {
    token.attrJoin(attrs[i][0], attrs[i][1])
  }
}

const wrapWithFigure = (tokens, range, checkTokenTagName, caption, replaceInsteadOfWrap, sp, opt, TokenConstructor) => {
  let n = range.start
  let en = range.end
  const baseLevel = getTokenLevel(tokens[n])
  const childLevel = baseLevel + 1
  const figureStartToken = new TokenConstructor('figure_open', 'figure', 1)
  figureStartToken.attrSet('class', sp.figureClassName)
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
  if (caption.name === 'img') {
    // `styleProcess` should keep working even when markdown-it-attrs is absent.
    if (opt.styleProcess) joinTokenAttrs(figureStartToken, sp.attrs)
    // Forward attrs already materialized by markdown-it-attrs on the image paragraph.
    joinTokenAttrs(figureStartToken, tokens[n].attrs)
  }
  if (replaceInsteadOfWrap) {
    const contentToken = tokens[n + 1]
    tokens.splice(
      n,
      en - n + 1,
      figureStartToken,
      createTextToken(TokenConstructor, '', childLevel),
      contentToken,
      createTextToken(TokenConstructor, '\n', childLevel),
      figureEndToken,
    )
    en = en + 2
  } else if (n === en) {
    const contentToken = tokens[n]
    adjustTokenLevels(tokens, n, en, 1)
    tokens.splice(
      n,
      1,
      figureStartToken,
      createTextToken(TokenConstructor, '', childLevel),
      contentToken,
      figureEndToken,
    )
    en = en + 3
  } else {
    adjustTokenLevels(tokens, n, en, 1)
    tokens.splice(en+1, 0, figureEndToken)
    tokens.splice(n, 0, figureStartToken, createTextToken(TokenConstructor, '', childLevel))
    en = en + 3
  }
  range.start = n
  range.end = en
}

const checkCaption = (tokens, n, en, caption, sp, opt, captionState) => {
  checkPrevCaption(tokens, n, caption, sp, opt, captionState)
  if (caption.isPrev) return
  checkNextCaption(tokens, en, caption, sp, opt, captionState)
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
  sp.numbering = null
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
  return -1
}

const detectCheckTypeOpen = (tokens, token, n, caption, baseType) => {
  if (!token || !baseType) return null
  if (n > 1 && tokens[n - 2] && tokens[n - 2].type === 'figure_open') return null
  const tagName = token.tag
  caption.name = baseType
  if (baseType === 'pre') {
    if (tokens[n + 1] && tokens[n + 1].tag === 'code') caption.name = 'pre-code'
    if (tokens[n + 1] && tokens[n + 1].tag === 'samp') caption.name = 'pre-samp'
  }
  const en = findClosingTokenIndex(tokens, n, tagName)
  if (en < 0) return null
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
  const useSampTag = sampLangReg.test(token.info)
  const tagName = useSampTag ? 'pre-samp' : 'pre-code'
  caption.name = tagName
  return {
    type: 'fence',
    tagName,
    en: n,
    replaceInsteadOfWrap: false,
    wrapWithoutCaption: false,
    canWrap: true,
    token,
    useSampTag,
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
  let trailingAttrToken = null
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
            trailingAttrToken = child
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
    inlineToken: nextToken,
    trailingAttrToken,
  }
}

const applyImageParagraphTransform = (detection) => {
  if (!detection || detection.type !== 'image') return
  if (detection.trailingAttrToken) {
    detection.trailingAttrToken.content = ''
  }
  if (!detection.inlineToken || detection.tagName === 'img') return
  const children = detection.inlineToken.children
  for (let i = 0; i < children.length; i++) {
    if (isOnlySpacesText(children[i])) {
      children[i].content = ''
    }
  }
}

const applyWrappedCandidateTransform = (detection) => {
  if (detection.type === 'image') {
    applyImageParagraphTransform(detection)
  } else if (detection.type === 'fence' && detection.useSampTag) {
    detection.token.tag = 'samp'
  }
}

const figureWithCaption = (state, opt) => {
  const numberingRuntime = opt.captionNumberingPolicy
    ? createCaptionNumberingRuntime(opt.captionNumberingPolicy, { env: state.env })
    : null
  const numberingScopeState = numberingRuntime
    ? createFigureCaptionScopeRuntime(
      state,
      opt.normalizedAutoLabelNumberPolicy,
      opt.unscopedNumberingContext,
    )
    : null
  const captionState = {
    tokens: state.tokens,
    Token: state.Token,
    preferredLanguages: opt.preferredLanguages,
    numberingRuntime,
    numberingScopeState,
  }
  if (opt.shouldResolvePreferredLanguages) captionState.preferredLanguageState = state
  figureWithCaptionCore(state.tokens, opt, state.Token, captionState, null, 0)
}

const figureWithCaptionCore = (tokens, opt, TokenConstructor, captionState, parentType = null, startIndex = 0) => {
  const rRange = { start: startIndex, end: startIndex }
  const rCaption = {
    name: '', nameSuffix: '', isPrev: false, isNext: false
  }
  const rSp = {
    attrs: [],
    isVideoIframe: false,
    isIframeTypeBlockquote: false,
    figureClassName: '',
    captionDecision: null,
    numbering: null,
  }
  const numberingScopeState = parentType ? null : captionState.numberingScopeState
  const headingScopeState = numberingScopeState &&
    !numberingScopeState.fixed &&
    numberingScopeState.scopeConfig.usesHeading
    ? numberingScopeState
    : null
  const parentCloseType = parentType ? parentType + '_close' : ''
  let n = startIndex
  while (n < tokens.length) {
    const token = tokens[n]
    if (headingScopeState && token.type === 'heading_open') {
      updateFigureCaptionScopeFromHeading(tokens, n, headingScopeState)
    }
    const containerType = getFigureCaptionScopeNestedContainerType(token)

    if (containerType && containerType !== 'blockquote') {
      const closeIndex = figureWithCaptionCore(tokens, opt, TokenConstructor, captionState, containerType, n + 1)
      n = closeIndex + 1
      continue
    }

    if (parentCloseType && token.type === parentCloseType) {
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
        const closeIndex = figureWithCaptionCore(tokens, opt, TokenConstructor, captionState, containerType, n + 1)
        n = closeIndex + 1
      } else {
        n++
      }
      continue
    }

    rRange.end = detection.en

    if (detection.canWrap === false || (detection.type === 'image' && token.hidden === true)) {
      let nextIndex = rRange.end + 1
      if (containerType === 'blockquote') {
        const closeIndex = figureWithCaptionCore(tokens, opt, TokenConstructor, captionState, containerType, rRange.start + 1)
        nextIndex = Math.max(nextIndex, closeIndex + 1)
      }
      n = nextIndex
      continue
    }

    if (detection.type === 'html') {
      rRange.end = applyHtmlFigureTransform(tokens, detection)
    }

    if (captionState.numberingRuntime) {
      rSp.numbering = captionState.numberingScopeState
        ? captionState.numberingScopeState.currentContext
        : opt.unscopedNumberingContext
    }
    rSp.figureClassName = resolveFigureClassName(detection.tagName, rSp, opt)
    checkCaption(tokens, rRange.start, rRange.end, rCaption, rSp, opt, captionState)

    let hasCaption = rCaption.isPrev || rCaption.isNext
    if (hasCaption) applyCaptionDrivenFigureClass(rCaption, rSp, opt)
    let pendingAutoCaption = null
    if (!hasCaption && detection.type === 'image' && opt.autoCaptionDetection) {
      pendingAutoCaption = getAutoCaptionFromImage(detection.imageToken, opt, captionState)
      if (pendingAutoCaption) {
        hasCaption = true
      }
    }

    let shouldWrap = hasCaption
    if (detection.type === 'html' || detection.type === 'image') {
      shouldWrap = shouldWrap || detection.wrapWithoutCaption
    }
    if (pendingAutoCaption) {
      const captionTokens = createAutoCaptionParagraph(pendingAutoCaption.text, TokenConstructor)
      const insertIndex = rRange.start
      const insertedLength = captionTokens.length
      tokens.splice(insertIndex, 0, ...captionTokens)
      rRange.start += insertedLength
      rRange.end += insertedLength
      n += insertedLength
      try {
        checkCaption(tokens, rRange.start, rRange.end, rCaption, rSp, opt, captionState)
      } catch (error) {
        tokens.splice(insertIndex, insertedLength)
        throw error
      }
      if (rCaption.isPrev || rCaption.isNext) {
        consumeAutoCaptionSource(detection.imageToken, pendingAutoCaption)
        applyCaptionDrivenFigureClass(rCaption, rSp, opt)
      } else {
        tokens.splice(insertIndex, insertedLength)
        rRange.start -= insertedLength
        rRange.end -= insertedLength
        n -= insertedLength
        shouldWrap = detection.wrapWithoutCaption
      }
    }
    if (shouldWrap) {
      if (detection.type !== 'html') {
        applyWrappedCandidateTransform(detection)
      }
      wrapWithFigure(tokens, rRange, detection.tagName, rCaption, detection.replaceInsteadOfWrap, rSp, opt, TokenConstructor)
    }

    let nextIndex
    if (!rCaption.isPrev && !rCaption.isNext) {
      nextIndex = shouldWrap ? rRange.end + 1 : n + 1
    } else {
      const en = rRange.end
      if (rCaption.isPrev) {
        changePrevCaptionPosition(tokens, rRange.start, rCaption, opt)
        nextIndex = en + 1
      } else if (rCaption.isNext) {
        changeNextCaptionPosition(tokens, en, rCaption, opt)
        nextIndex = en + 4
      }
    }

    if (containerType === 'blockquote') {
      const nestedContentStart = rRange.start + (shouldWrap ? 3 : 1)
      const closeIndex = figureWithCaptionCore(
        tokens,
        opt,
        TokenConstructor,
        captionState,
        containerType,
        nestedContentStart,
      )
      nextIndex = Math.max(nextIndex, closeIndex + 1)
    }

    n = nextIndex
  }
  return tokens.length
}

const mditFigureWithPCaption = (md, option) => {
  if (md[installedKey]) return
  if (hasOwnOption(option, 'setFigureNumber')) {
    throw new Error('setFigureNumber is not supported by figure-with-p-caption; use autoLabelNumber or autoLabelNumberSets')
  }
  const opt = {
    // Caption languages delegated to p-captions.
    languages: ['en', 'ja'],
    preferredLanguages: null, // compatibility tie-break for generated fallback labels; prefer env.locale / env.preferredLocales per render

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
    autoLabelNumberSets: [], // preferred; supports img/table/code/samp/video marks
    autoLabelNumberPolicy: undefined, // omitted: automatic Chapter/Appendix scope; explicit null: document-wide numbering

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
  const hasExplicitAutoLabelNumberSets = hasOwnOption(option, 'autoLabelNumberSets')
  const hasExplicitImageOnlyParagraphWithoutCaption = hasOwnOption(option, 'imageOnlyParagraphWithoutCaption')
  const hasExplicitFigureClassThatWrapsIframeTypeBlockquote = hasOwnOption(option, 'figureClassThatWrapsIframeTypeBlockquote')
  const hasExplicitFigureClassThatWrapsSlides = hasOwnOption(option, 'figureClassThatWrapsSlides')
  const hasExplicitLabelClassFollowsFigure = hasOwnOption(option, 'labelClassFollowsFigure')
  if (option) Object.assign(opt, option)
  if (Array.isArray(opt.removeUnnumberedLabelExceptMarks)) {
    opt.removeUnnumberedLabelExceptMarks = opt.removeUnnumberedLabelExceptMarks.map(
      canonicalizeCaptionNumberingMark,
    )
  }
  opt.imageOnlyParagraphWithoutCaption = hasExplicitImageOnlyParagraphWithoutCaption
    ? !!opt.imageOnlyParagraphWithoutCaption
    : !!opt.oneImageWithoutCaption
  if (!hasExplicitLabelClassFollowsFigure && opt.figureToLabelClassMap) {
    opt.labelClassFollowsFigure = true
  }
  opt.classPrefix = normalizeOptionalClassName(opt.classPrefix)
  opt.allIframeTypeFigureClassName = normalizeOptionalClassName(opt.allIframeTypeFigureClassName)
  opt.markRegState = getMarkRegStateForLanguages(opt.languages)
  opt.preferredLanguages = normalizePreferredLanguages(opt.preferredLanguages, opt.markRegState.languages)
  if (opt.preferredLanguages.length === 0) opt.preferredLanguages = null
  opt.shouldResolvePreferredLanguages = needsPreferredLanguagesResolution(opt)
  validateFallbackCaptionLabelOption('autoAltCaption', opt.autoAltCaption, opt.markRegState)
  validateFallbackCaptionLabelOption('autoTitleCaption', opt.autoTitleCaption, opt.markRegState)
  opt.htmlWrapWithoutCaption = {
    iframe: !!opt.iframeWithoutCaption,
    video: !!opt.videoWithoutCaption,
    audio: !!opt.audioWithoutCaption,
    iframeTypeBlockquote: !!opt.iframeTypeBlockquoteWithoutCaption,
  }
  const requestedAutoLabelNumberSets = hasExplicitAutoLabelNumberSets
    ? option.autoLabelNumberSets
    : opt.autoLabelNumber
      ? ['img', 'table']
      : []
  opt.autoLabelNumberSets = normalizeAutoLabelNumberSets(requestedAutoLabelNumberSets)
  const enabledNumberingMarks = getEnabledCaptionNumberingMarks(opt.autoLabelNumberSets, opt)
  opt.normalizedAutoLabelNumberPolicy = enabledNumberingMarks.length === 0 &&
    opt.autoLabelNumberPolicy === undefined
    ? null
    : normalizeFigureCaptionNumberingPolicy(opt.autoLabelNumberPolicy)
  opt.captionNumberingPolicy = createFigureCaptionNumberingPolicy(
    enabledNumberingMarks,
    opt.normalizedAutoLabelNumberPolicy,
    opt.markRegState,
  )
  opt.unscopedNumberingContext = opt.captionNumberingPolicy && opt.normalizedAutoLabelNumberPolicy
    ? createUnscopedNumberingContext(
      getFigureCaptionNumberingPolicyState(opt.normalizedAutoLabelNumberPolicy).separator,
    )
    : null
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

  // Run after markdown-it-attrs has attached paragraph attrs, but before text replacements.
  md.core.ruler.before('replacements', 'figure_with_caption', (state) => {
    figureWithCaption(state, opt)
  })
  Object.defineProperty(md, installedKey, {
    value: true,
    configurable: true,
  })
}

export default mditFigureWithPCaption
