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
  getMarkRegStateForLanguages,
  stripLabelPrefixMarker,
} from 'p7d-markdown-it-p-captions'
import { detectHtmlFigureCandidate, prepareHtmlFigureTransform } from './embeds/detect.js'
import { normalizeNotesOptions } from './notes/options.js'
import { createNotesCatalog } from './notes/catalog.js'
import { resetFigureNotesDiagnostics } from './notes/diagnostics.js'
import {
  analyzeAnnotationAt,
  analyzeUnreferencedLocalNotesAt,
  applyAnnotationDecision,
  prepareUnreferencedLocalNotesDecision,
} from './notes/sidecars.js'
import {
  analyzeReferencedLocalNotesAt,
  finalizeReferencedLocalNotes,
  prepareReferencedLocalNotes,
  registerReferencedLocalNotes,
  resolveReferencedLocalNotes,
} from './notes/referenced.js'
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
const PLANNED_CONTAINER_OPEN_TYPES = new Set([
  'blockquote_open',
  'list_item_open',
  'dd_open',
  'table_open',
  'pre_open',
])
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
  const alt = getTokenAttr(token, 'alt')
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

const applyCaptionDrivenFigureClass = (caption, sp, opt, decision) => {
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

const detectCheckTypeOpen = (tokens, token, n, caption, baseType, knownCloseIndex = -1) => {
  if (!token || !baseType) return null
  if (n > 1 && tokens[n - 2] && tokens[n - 2].type === 'figure_open') return null
  const tagName = token.tag
  caption.name = baseType
  if (baseType === 'pre') {
    if (tokens[n + 1] && tokens[n + 1].tag === 'code') caption.name = 'pre-code'
    if (tokens[n + 1] && tokens[n + 1].tag === 'samp') caption.name = 'pre-samp'
  }
  const en = knownCloseIndex
  if (en < 0) return null
  return {
    type: 'block',
    tagName,
    en,
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
  let nameSuffix = ''
  caption.name = 'img'
  if (childrenLength === 1) {
    return {
      type: 'image',
      tagName: 'img',
      en: n + 2,
      wrapWithoutCaption: allowImageParagraphWithoutCaption,
      imageToken,
    }
  }
  if (!multipleImagesEnabled && childrenLength > 2) {
    return {
      type: 'image',
      tagName: 'img',
      en: n + 2,
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
            sp.attrs = []
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
      nameSuffix = '-horizontal'
    } else if (isMultipleImagesVertical) {
      nameSuffix = '-vertical'
    } else {
      nameSuffix = '-multiple'
    }
  }
  const en = n + 2
  const tagName = 'img' + nameSuffix
  return {
    type: 'image',
    tagName,
    en,
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

const buildBalancedCloseIndex = (tokens) => {
  const closeByOpen = new Map()
  const stack = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (!token || typeof token.type !== 'string') continue
    if (token.nesting === 1 && token.type.endsWith('_open')) {
      stack.push(index)
      continue
    }
    if (token.nesting !== -1 || !token.type.endsWith('_close') || stack.length === 0) continue
    const expectedOpenType = token.type.slice(0, -6) + '_open'
    const openIndex = stack[stack.length - 1]
    const openType = tokens[openIndex].type
    if (openType !== expectedOpenType) continue
    stack.pop()
    if (PLANNED_CONTAINER_OPEN_TYPES.has(openType)) {
      closeByOpen.set(openIndex, index)
    }
  }
  return closeByOpen
}

const getBalancedCloseIndex = (tokens, state, openIndex) => {
  state.closeByOpen ||= buildBalancedCloseIndex(tokens)
  return state.closeByOpen.get(openIndex)
}

const analyzeCaptionAt = (
  tokens,
  index,
  position,
  caption,
  sp,
  opt,
  captionState,
  lowerBound,
  upperBound,
) => {
  if (index < lowerBound || index + 2 >= upperBound) return null
  const openToken = tokens[index]
  const inlineToken = tokens[index + 1]
  const closeToken = tokens[index + 2]
  if (
    openToken?.type !== 'paragraph_open'
    || inlineToken?.type !== 'inline'
    || closeToken?.type !== 'paragraph_close'
  ) return null
  const decision = analyzeCaptionParagraph(index, captionState, {
    captionName: caption.name,
    isIframeTypeBlockquote: sp.isIframeTypeBlockquote,
    isVideoIframe: sp.isVideoIframe,
  }, opt)
  if (decision) {
    return {
      position,
      start: index,
      end: index + 2,
      openToken,
      inlineToken,
      closeToken,
      decision,
      state: captionState,
    }
  }
  const markerReg = position === 'prev'
    ? opt.labelPrefixMarkerWithoutLabelPrevReg
    : opt.labelPrefixMarkerWithoutLabelNextReg
  if (!markerReg) return null
  const markerMatch = getLabelPrefixMarkerMatch(inlineToken, markerReg)
  if (!markerMatch) return null
  return {
    position,
    start: index,
    end: index + 2,
    openToken,
    inlineToken,
    closeToken,
    markerMatch,
  }
}

const getLastPlanEnd = (owner) => {
  const plans = owner.children
  return plans.length === 0 ? -1 : plans[plans.length - 1].sourceEnd
}

const analyzeAdjacentCaption = (
  tokens,
  targetStart,
  targetEnd,
  caption,
  sp,
  opt,
  captionState,
  lowerBound,
  upperBound,
  owner,
) => {
  const previousIndex = targetStart - 3
  if (previousIndex > getLastPlanEnd(owner)) {
    const previous = analyzeCaptionAt(
      tokens,
      previousIndex,
      'prev',
      caption,
      sp,
      opt,
      captionState,
      lowerBound,
      upperBound,
    )
    if (previous) return previous
  }
  return analyzeCaptionAt(
    tokens,
    targetEnd + 1,
    'next',
    caption,
    sp,
    opt,
    captionState,
    lowerBound,
    upperBound,
  )
}

const createAutoCaptionAnalysis = (
  detection,
  caption,
  sp,
  opt,
  captionState,
  TokenConstructor,
) => {
  if (detection.type !== 'image' || !opt.autoCaptionDetection) return null
  const pending = getAutoCaptionFromImage(detection.imageToken, opt, captionState)
  if (!pending) return null
  const tokens = createAutoCaptionParagraph(pending.text, TokenConstructor)
  const state = { ...captionState, tokens }
  const decision = analyzeCaptionParagraph(0, state, {
    captionName: caption.name,
    isIframeTypeBlockquote: sp.isIframeTypeBlockquote,
    isVideoIframe: sp.isVideoIframe,
  }, opt)
  if (!decision) return null
  return {
    position: 'prev',
    openToken: tokens[0],
    inlineToken: tokens[1],
    closeToken: tokens[2],
    decision,
    state,
    autoCaption: pending,
  }
}

const mergeRangeMaps = (left, right) => {
  if (!left) return right ? [right[0], right[1]] : null
  if (!right) return [left[0], left[1]]
  return [Math.min(left[0], right[0]), Math.max(left[1], right[1])]
}

const getPlanBaseMap = (tokens, plan) => {
  let map = getRangeMap(tokens, plan.targetStart, plan.targetOutputEnd)
  if (plan.localNotesDecision) {
    const localNotesMap = plan.preparedLocalNotes
      ? getTokenMap(plan.preparedLocalNotes.open)
      : getRangeMap(tokens, plan.localNotesDecision.start, plan.localNotesDecision.end)
    map = mergeRangeMaps(
      map,
      localNotesMap,
    )
  }
  return map
}

const getAnnotationMap = (tokens, decisions) => {
  let map = null
  for (let index = 0; index < decisions.length; index++) {
    map = mergeRangeMaps(
      map,
      getRangeMap(tokens, decisions[index].start, decisions[index].end),
    )
  }
  return map
}

const createFigurePlanTokens = (tokens, plan, annotationMap, opt, TokenConstructor) => {
  const baseLevel = getTokenLevel(tokens[plan.targetStart])
  const childLevel = baseLevel + 1
  const figureStartToken = new TokenConstructor('figure_open', 'figure', 1)
  figureStartToken.attrSet('class', plan.sp.figureClassName)
  figureStartToken.block = true
  figureStartToken.level = baseLevel
  if (
    opt.roleDocExample
    && (plan.detection.tagName === 'pre-code' || plan.detection.tagName === 'pre-samp')
  ) {
    figureStartToken.attrSet('role', 'doc-example')
  }
  const figureEndToken = new TokenConstructor('figure_close', 'figure', -1)
  figureEndToken.block = true
  figureEndToken.level = baseLevel
  const rangeMap = mergeRangeMaps(getPlanBaseMap(tokens, plan), annotationMap)
  if (rangeMap) {
    figureStartToken.map = [rangeMap[0], rangeMap[1]]
    figureEndToken.map = [rangeMap[0], rangeMap[1]]
  }
  if (plan.caption.name === 'img') {
    if (opt.styleProcess) joinTokenAttrs(figureStartToken, plan.sp.attrs)
    joinTokenAttrs(figureStartToken, tokens[plan.targetStart].attrs)
  }
  plan.figureStartToken = figureStartToken
  plan.figureEndToken = figureEndToken
  plan.paddingToken = createTextToken(TokenConstructor, '', childLevel)
  if (plan.detection.type === 'image') {
    plan.imageNewlineToken = createTextToken(TokenConstructor, '\n', childLevel)
  }
}

const adjustPreparedLocalNotesLevels = (tokens, prepared, delta) => {
  if (!prepared || !delta) return
  prepared.open.level += delta
  prepared.close.level += delta
  adjustTokenLevels(tokens, prepared.start, prepared.end, delta)
}

const setAnnotationLevels = (decision, parentLevel) => {
  decision.open.level = parentLevel + 1
  decision.inline.level = parentLevel + 2
  decision.close.level = parentLevel + 1
}

const prepareFigurePlan = (tokens, plan, opt, TokenConstructor, captionState) => {
  const captionAnalysis = plan.captionAnalysis
  if (captionAnalysis) {
    let applied = false
    if (captionAnalysis.decision) {
      applied = applyCaptionParagraph(
        captionAnalysis.decision,
        captionAnalysis.state,
        plan.sp,
        captionState.numberingRuntime,
        opt,
      )
    } else if (captionAnalysis.markerMatch) {
      stripLabelPrefixMarker(captionAnalysis.inlineToken, captionAnalysis.markerMatch)
      applied = true
    }
    if (!applied) {
      throw new Error('Caption decision became stale before token rebuild')
    }
    if (captionAnalysis.autoCaption) {
      consumeAutoCaptionSource(plan.detection.imageToken, captionAnalysis.autoCaption)
    }
  }

  if (plan.detection.type === 'html') {
    plan.targetOutputEnd = prepareHtmlFigureTransform(plan.detection)
  }

  if (plan.localNotesDecision?.kind === 'unreferenced-local-notes') {
    plan.preparedLocalNotes = prepareUnreferencedLocalNotesDecision(
      tokens,
      plan.localNotesDecision,
      TokenConstructor,
      opt.figureClassPrefix,
    )
    if (!plan.preparedLocalNotes) {
      throw new Error('Figure local-note decision became stale before token rebuild')
    }
  }

  if (plan.localNotesDecision?.kind === 'referenced-local-notes') {
    captionState.notesRuntime ||= { targetOrdinal: 0 }
    resolveReferencedLocalNotes(
      tokens,
      plan.targetStart,
      plan.targetOutputEnd,
      plan.localNotesDecision,
      captionAnalysis?.inlineToken || null,
      captionAnalysis?.position === 'prev',
      captionState.env,
      captionState.notesRuntime,
    )
  }

  for (let index = 0; index < plan.annotationDecisions.length; index++) {
    if (!applyAnnotationDecision(
      plan.annotationDecisions[index],
      TokenConstructor,
      opt.figureClassPrefix,
    )) {
      throw new Error('Figure annotation decision became stale before token rebuild')
    }
  }

  const annotationMap = getAnnotationMap(tokens, plan.annotationDecisions)
  applyWrappedCandidateTransform(plan.detection)
  createFigurePlanTokens(tokens, plan, annotationMap, opt, TokenConstructor)

  if (plan.detection.type !== 'image') {
    adjustTokenLevels(tokens, plan.targetStart, plan.targetOutputEnd, 1)
  }
  if (plan.preparedLocalNotes) {
    adjustPreparedLocalNotesLevels(tokens, plan.preparedLocalNotes, 1)
  } else if (plan.localNotesDecision) {
    adjustTokenLevels(
      tokens,
      plan.localNotesDecision.start,
      plan.localNotesDecision.end,
      1,
    )
  }

  const captionIsNext = captionAnalysis?.position === 'next'
  if (!captionIsNext) {
    for (let index = 0; index < plan.annotationDecisions.length; index++) {
      adjustTokenLevels(
        tokens,
        plan.annotationDecisions[index].start,
        plan.annotationDecisions[index].end,
        1,
      )
    }
  }

  if (captionAnalysis) {
    convertCaptionTokens(
      captionAnalysis.openToken,
      captionAnalysis.inlineToken,
      captionAnalysis.closeToken,
      getTokenLevel(tokens[plan.targetStart]),
      plan.caption.name,
      opt,
    )
    if (captionIsNext) {
      const captionLevel = captionAnalysis.openToken.level
      for (let index = 0; index < plan.annotationDecisions.length; index++) {
        setAnnotationLevels(plan.annotationDecisions[index], captionLevel)
      }
      if (annotationMap) {
        const captionMap = mergeRangeMaps(getTokenMap(captionAnalysis.openToken), annotationMap)
        if (captionMap) {
          captionAnalysis.openToken.map = [captionMap[0], captionMap[1]]
          captionAnalysis.closeToken.map = [captionMap[0], captionMap[1]]
        }
      }
    }
  }
}

const pushTokenRange = (tokens, start, end, output) => {
  for (let index = start; index <= end; index++) output.push(tokens[index])
}

const emitPlannedRange = (tokens, start, end, plans, output) => {
  let sourceIndex = start
  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index]
    if (sourceIndex < plan.sourceStart) {
      pushTokenRange(tokens, sourceIndex, plan.sourceStart - 1, output)
    }
    if (plan.kind === 'figure') {
      emitFigurePlan(tokens, plan, output)
    } else {
      pushTokenRange(tokens, plan.sourceStart, plan.outputEnd, output)
    }
    sourceIndex = plan.sourceEnd + 1
  }
  if (sourceIndex <= end) pushTokenRange(tokens, sourceIndex, end, output)
}

const emitAnnotations = (tokens, decisions, output) => {
  for (let index = 0; index < decisions.length; index++) {
    pushTokenRange(tokens, decisions[index].start, decisions[index].end, output)
  }
}

const emitFigurePlan = (tokens, plan, output) => {
  const captionAnalysis = plan.captionAnalysis
  output.push(plan.figureStartToken, plan.paddingToken)
  if (captionAnalysis?.position === 'prev') {
    output.push(captionAnalysis.openToken, captionAnalysis.inlineToken, captionAnalysis.closeToken)
  }

  if (plan.detection.type === 'image') {
    output.push(tokens[plan.targetStart + 1], plan.imageNewlineToken)
  } else {
    emitPlannedRange(
      tokens,
      plan.targetStart,
      plan.targetOutputEnd,
      plan.children,
      output,
    )
  }

  if (plan.preparedLocalNotes) {
    output.push(plan.preparedLocalNotes.open)
    pushTokenRange(
      tokens,
      plan.preparedLocalNotes.start,
      plan.preparedLocalNotes.end,
      output,
    )
    output.push(plan.preparedLocalNotes.close)
  } else if (plan.localNotesDecision) {
    pushTokenRange(
      tokens,
      plan.localNotesDecision.start,
      plan.localNotesDecision.end,
      output,
    )
  }

  if (captionAnalysis?.position === 'next') {
    output.push(captionAnalysis.openToken, captionAnalysis.inlineToken)
    emitAnnotations(tokens, plan.annotationDecisions, output)
    output.push(captionAnalysis.closeToken)
  } else {
    emitAnnotations(tokens, plan.annotationDecisions, output)
  }
  output.push(plan.figureEndToken)
}

const commitPlannedTokens = (tokens, rootPlans) => {
  if (rootPlans.length === 0) return
  const output = []
  emitPlannedRange(tokens, 0, tokens.length - 1, rootPlans, output)
  // Preserve StateCore's array identity for surrounding rules while replacing
  // the document in one linear copy instead of shifting its tail per figure.
  for (let index = 0; index < output.length; index++) tokens[index] = output[index]
  tokens.length = output.length
}

const collectFigurePlansInRange = (
  tokens,
  start,
  end,
  owner,
  closeIndexState,
  opt,
  TokenConstructor,
  captionState,
  applyOrder,
  isTopLevel,
) => {
  const headingScopeState = isTopLevel
    && captionState.numberingScopeState
    && !captionState.numberingScopeState.fixed
    && captionState.numberingScopeState.scopeConfig.usesHeading
    ? captionState.numberingScopeState
    : null
  let n = start
  while (n < end) {
    const token = tokens[n]
    if (headingScopeState && token?.type === 'heading_open') {
      updateFigureCaptionScopeFromHeading(tokens, n, headingScopeState)
    }
    const containerType = getFigureCaptionScopeNestedContainerType(token)
    if (containerType && containerType !== 'blockquote') {
      const closeIndex = getBalancedCloseIndex(tokens, closeIndexState, n)
      if (closeIndex === undefined || closeIndex >= end) {
        collectFigurePlansInRange(
          tokens,
          n + 1,
          end,
          owner,
          closeIndexState,
          opt,
          TokenConstructor,
          captionState,
          applyOrder,
          false,
        )
        return
      }
      collectFigurePlansInRange(
        tokens,
        n + 1,
        closeIndex,
        owner,
        closeIndexState,
        opt,
        TokenConstructor,
        captionState,
        applyOrder,
        false,
      )
      n = closeIndex + 1
      continue
    }

    const tokenType = token?.type
    const blockType = CHECK_TYPE_TOKEN_MAP[tokenType]
    const imageInlineToken = tokenType === 'paragraph_open' ? tokens[n + 1] : null
    const isCandidateToken = !!(
      (imageInlineToken && hasLeadingImageChild(imageInlineToken))
      || tokenType === 'html_block'
      || tokenType === 'fence'
      || blockType
    )
    if (!isCandidateToken) {
      n++
      continue
    }

    const caption = { name: '' }
    const sp = { figureClassName: '' }
    if (captionState.numberingRuntime) {
      sp.numbering = captionState.numberingScopeState
        ? captionState.numberingScopeState.currentContext
        : opt.unscopedNumberingContext
    }
    let detection = null
    if (tokenType === 'paragraph_open') {
      if (tokens[n + 2]?.type === 'paragraph_close') {
        detection = detectImageParagraph(imageInlineToken, n, caption, sp, opt)
      }
    } else if (tokenType === 'html_block') {
      detection = detectHtmlFigureCandidate(tokens, token, n, opt.htmlWrapWithoutCaption)
      if (detection) {
        caption.name = detection.tagName
        if (detection.isVideoIframe) sp.isVideoIframe = true
        if (detection.isIframeTypeBlockquote) sp.isIframeTypeBlockquote = true
      }
    } else if (tokenType === 'fence') {
      detection = detectFenceToken(token, n, caption)
    } else if (blockType) {
      const knownCloseIndex = getBalancedCloseIndex(tokens, closeIndexState, n)
      detection = detectCheckTypeOpen(
        tokens,
        token,
        n,
        caption,
        blockType,
        knownCloseIndex === undefined ? -1 : knownCloseIndex,
      )
    }

    if (!detection || detection.en >= end) {
      if (containerType === 'blockquote') {
        const closeIndex = getBalancedCloseIndex(tokens, closeIndexState, n)
        const nestedEnd = closeIndex === undefined || closeIndex >= end ? end : closeIndex
        collectFigurePlansInRange(
          tokens,
          n + 1,
          nestedEnd,
          owner,
          closeIndexState,
          opt,
          TokenConstructor,
          captionState,
          applyOrder,
          false,
        )
        if (closeIndex === undefined || closeIndex >= end) return
        n = closeIndex + 1
      } else {
        n++
      }
      continue
    }

    const targetStart = n
    const targetSourceEnd = detection.en
    if (detection.canWrap === false || (detection.type === 'image' && token.hidden === true)) {
      if (containerType === 'blockquote') {
        collectFigurePlansInRange(
          tokens,
          targetStart + 1,
          targetSourceEnd,
          owner,
          closeIndexState,
          opt,
          TokenConstructor,
          captionState,
          applyOrder,
          false,
        )
      }
      n = targetSourceEnd + 1
      continue
    }

    let notesTargetType = ''
    if (opt.notes.enabled) {
      notesTargetType = detection.type === 'image'
        ? 'img'
        : (detection.tagName === 'table' ? 'table' : '')
    }
    let localNotesDecision = null
    const sidecarIndex = targetSourceEnd + 1
    if (
      notesTargetType === 'table'
      && opt.notes.referencedLocalNotes
      && sidecarIndex < end
    ) {
      localNotesDecision = analyzeReferencedLocalNotesAt(tokens, sidecarIndex)
      if (localNotesDecision && localNotesDecision.end >= end) {
        localNotesDecision = null
      }
      if (
        localNotesDecision
        && !prepareReferencedLocalNotes(localNotesDecision, captionState.env)
      ) {
        localNotesDecision = null
      }
    }
    if (!localNotesDecision && notesTargetType && opt.notes.unreferencedLocalNotes) {
      localNotesDecision = analyzeUnreferencedLocalNotesAt(
        tokens,
        sidecarIndex,
        notesTargetType,
        opt.notesCatalog,
      )
    }
    if (localNotesDecision && localNotesDecision.end >= end) localNotesDecision = null
    const captionTargetEnd = localNotesDecision ? localNotesDecision.end : targetSourceEnd
    let captionAnalysis = analyzeAdjacentCaption(
      tokens,
      targetStart,
      captionTargetEnd,
      caption,
      sp,
      opt,
      captionState,
      start,
      end,
      owner,
    )
    if (captionAnalysis?.decision) caption.name = captionAnalysis.decision.mark

    let annotationStart = captionTargetEnd + 1
    if (captionAnalysis?.position === 'next') annotationStart = captionAnalysis.end + 1
    const annotationDecisions = []
    if (notesTargetType && opt.notes.annotations) {
      let annotationDecision = analyzeAnnotationAt(tokens, annotationStart, opt.notesCatalog)
      while (annotationDecision && annotationDecision.end < end) {
        annotationDecisions.push(annotationDecision)
        annotationStart = annotationDecision.end + 1
        annotationDecision = analyzeAnnotationAt(tokens, annotationStart, opt.notesCatalog)
      }
    }

    if (!captionAnalysis) {
      captionAnalysis = createAutoCaptionAnalysis(
        detection,
        caption,
        sp,
        opt,
        captionState,
        TokenConstructor,
      )
      if (captionAnalysis?.decision) caption.name = captionAnalysis.decision.mark
    }
    sp.figureClassName = resolveFigureClassName(detection.tagName, sp, opt)
    if (captionAnalysis) applyCaptionDrivenFigureClass(caption, sp, opt, captionAnalysis.decision)

    const hasCaption = !!captionAnalysis
    let shouldWrap = hasCaption || !!localNotesDecision || annotationDecisions.length > 0
    if (detection.type === 'html' || detection.type === 'image') {
      shouldWrap = shouldWrap || detection.wrapWithoutCaption
    }

    if (!shouldWrap) {
      if (detection.type === 'html' && detection.transform) {
        const htmlPlan = {
          kind: 'html-only',
          sourceStart: targetStart,
          sourceEnd: targetSourceEnd,
          outputEnd: targetSourceEnd,
          detection,
        }
        applyOrder.push(htmlPlan)
        if (detection.transform.type === 'merge-blockquote-script') {
          owner.children.push(htmlPlan)
        }
      }
      if (containerType === 'blockquote') {
        collectFigurePlansInRange(
          tokens,
          targetStart + 1,
          targetSourceEnd,
          owner,
          closeIndexState,
          opt,
          TokenConstructor,
          captionState,
          applyOrder,
          false,
        )
      }
      n = targetSourceEnd + 1
      continue
    }

    const sourceStart = captionAnalysis?.position === 'prev' && !captionAnalysis.autoCaption
      ? captionAnalysis.start
      : targetStart
    let sourceEnd = targetSourceEnd
    if (localNotesDecision) sourceEnd = localNotesDecision.end
    if (captionAnalysis?.position === 'next') sourceEnd = captionAnalysis.end
    if (annotationDecisions.length > 0) {
      sourceEnd = annotationDecisions[annotationDecisions.length - 1].end
    }
    const targetOutputEnd = detection.type === 'html'
      && detection.transform?.type === 'merge-blockquote-script'
      ? targetStart
      : targetSourceEnd
    const plan = {
      kind: 'figure',
      sourceStart,
      sourceEnd,
      targetStart,
      targetOutputEnd,
      detection,
      caption,
      sp,
      captionAnalysis,
      localNotesDecision,
      annotationDecisions,
      children: [],
    }
    owner.children.push(plan)
    applyOrder.push(plan)
    if (containerType === 'blockquote') {
      collectFigurePlansInRange(
        tokens,
        targetStart + 1,
        targetSourceEnd,
        plan,
        closeIndexState,
        opt,
        TokenConstructor,
        captionState,
        applyOrder,
        false,
      )
    }
    n = sourceEnd + 1
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
  if (opt.notes.referencedLocalNotes) captionState.env = state.env
  if (opt.shouldResolvePreferredLanguages) captionState.preferredLanguageState = state

  const closeIndexState = {}
  const root = { children: [] }
  const applyOrder = []
  // All decisions use the unchanged source index space. Structural output is
  // emitted only after every semantic mutation has been validated and applied.
  collectFigurePlansInRange(
    state.tokens,
    0,
    state.tokens.length,
    root,
    closeIndexState,
    opt,
    state.Token,
    captionState,
    applyOrder,
    true,
  )
  for (let index = 0; index < applyOrder.length; index++) {
    const plan = applyOrder[index]
    if (plan.kind === 'figure') {
      prepareFigurePlan(state.tokens, plan, opt, state.Token, captionState)
    } else {
      plan.outputEnd = prepareHtmlFigureTransform(plan.detection)
    }
  }
  commitPlannedTokens(state.tokens, root.children)
  if (opt.notes.referencedLocalNotes) finalizeReferencedLocalNotes(state.tokens, state.env)
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
    notes: undefined,
  }
  const hasExplicitAutoLabelNumberSets = hasOwnOption(option, 'autoLabelNumberSets')
  const hasExplicitImageOnlyParagraphWithoutCaption = hasOwnOption(option, 'imageOnlyParagraphWithoutCaption')
  const hasExplicitFigureClassThatWrapsIframeTypeBlockquote = hasOwnOption(option, 'figureClassThatWrapsIframeTypeBlockquote')
  const hasExplicitFigureClassThatWrapsSlides = hasOwnOption(option, 'figureClassThatWrapsSlides')
  const hasExplicitLabelClassFollowsFigure = hasOwnOption(option, 'labelClassFollowsFigure')
  if (option) Object.assign(opt, option)
  opt.notes = normalizeNotesOptions(opt.notes)
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
  opt.notesCatalog = opt.notes.enabled
    ? createNotesCatalog(opt.markRegState.languages)
    : null
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

  if (opt.notes.referencedLocalNotes) {
    registerReferencedLocalNotes(md, opt.notesCatalog, classPrefix)
  }

  // Run after markdown-it-attrs has attached paragraph attrs, but before text replacements.
  md.core.ruler.before('replacements', 'figure_with_caption', (state) => {
    if (opt.notes.enabled && !opt.notes.referencedLocalNotes) {
      const env = state.env || (state.env = {})
      resetFigureNotesDiagnostics(env)
    }
    figureWithCaption(state, opt)
  })
  Object.defineProperty(md, installedKey, {
    value: true,
    configurable: true,
  })
}

export default mditFigureWithPCaption
