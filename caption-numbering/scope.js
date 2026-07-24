import { isCaptionLabelBoundary } from 'p7d-markdown-it-p-captions'
import {
  createScopedNumberingContext,
  createUnscopedNumberingContext,
} from './number-codec.js'
import {
  getFigureCaptionNumberingPolicyState,
  normalizeNumberingScopeMode,
  normalizeNumberingSeparator,
} from './options.js'

const captionNumberSegmentReg = /^[A-Z0-9]{1,6}$/
const maxScopeKeyLength = 256
const maxScopeVisiblePrefixLength = 128
const frontmatterNumberingKey = 'figure-caption-numbering'
const frontmatterNumberingScopeKey = frontmatterNumberingKey + '.scope'
const frontmatterNumberingSeparatorKey = frontmatterNumberingKey + '.separator'
const scopeTransparentInlineTokenTypes = new Set([
  'em_open', 'em_close',
  'strong_open', 'strong_close',
  's_open', 's_close',
  'link_open', 'link_close',
])
const emptyScopeBoundaries = Object.freeze([])

const hasOwnOption = (option, name) => !!(
  option && Object.prototype.hasOwnProperty.call(option, name)
)

export const getFigureCaptionScopeNestedContainerType = (token) => {
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

const startsWithAsciiCaseInsensitive = (text, expectedLowerCase) => {
  if (text.length < expectedLowerCase.length) return false
  for (let index = 0; index < expectedLowerCase.length; index++) {
    let code = text.charCodeAt(index)
    if (code >= 0x41 && code <= 0x5a) code += 0x20
    if (code !== expectedLowerCase.charCodeAt(index)) return false
  }
  return true
}

const readAsciiDigits = (text, start) => {
  let end = start
  while (end < text.length && end - start < 6) {
    const code = text.charCodeAt(end)
    if (code < 0x30 || code > 0x39) break
    end++
  }
  return end === start ? null : { id: text.slice(start, end), end }
}

const readAppendixIdentifier = (text, start) => {
  const digits = readAsciiDigits(text, start)
  if (digits) return digits
  const code = text.charCodeAt(start)
  if (code >= 0x41 && code <= 0x5a) {
    return { id: text.charAt(start), end: start + 1 }
  }
  return null
}

const matchScopeMarker = (text) => {
  if (typeof text !== 'string' || !text) return null
  const first = text.charAt(0)
  if (first === 'C' || first === 'c') {
    if (!startsWithAsciiCaseInsensitive(text, 'chapter ')) return null
    const identifier = readAsciiDigits(text, 8)
    return identifier && {
      kind: 'chapter',
      id: identifier.id,
      markerEnd: identifier.end,
      layout: 'spaced',
    }
  }
  if (first === 'A' || first === 'a') {
    if (!startsWithAsciiCaseInsensitive(text, 'appendix ')) return null
    const identifier = readAppendixIdentifier(text, 9)
    return identifier && {
      kind: 'appendix',
      id: identifier.id,
      markerEnd: identifier.end,
      layout: 'spaced',
    }
  }
  if (first === '第') {
    const identifier = readAsciiDigits(text, 1)
    if (!identifier || text.charAt(identifier.end) !== '章') return null
    return {
      kind: 'chapter',
      id: identifier.id,
      markerEnd: identifier.end + 1,
      layout: 'compact',
    }
  }
  const firstCode = text.charCodeAt(0)
  if (firstCode >= 0x30 && firstCode <= 0x39) {
    const identifier = readAsciiDigits(text, 0)
    if (!identifier || text.charAt(identifier.end) !== '章') return null
    return {
      kind: 'chapter',
      id: identifier.id,
      markerEnd: identifier.end + 1,
      layout: 'compact',
    }
  }
  let prefix = ''
  if (text.startsWith('付録')) prefix = '付録'
  else if (text.startsWith('付属')) prefix = '付属'
  else if (text.startsWith('附属')) prefix = '附属'
  if (!prefix) return null
  const identifier = readAppendixIdentifier(text, prefix.length)
  return identifier && {
    kind: 'appendix',
    id: identifier.id,
    markerEnd: identifier.end,
    layout: 'compact',
  }
}

const buildScopeSemanticResult = (candidate) => ({
  scopeKey: candidate.kind + ':' + candidate.id,
  displayPrefix: candidate.id,
})

const recognizeScopeText = (text, requireVisibleTail) => {
  const candidate = matchScopeMarker(text)
  if (!candidate) return null
  if (requireVisibleTail && candidate.markerEnd === text.length) return null
  if (!isCaptionLabelBoundary(text, candidate.markerEnd, {
    layout: candidate.layout,
    hasNumber: true,
  })) return null
  return buildScopeSemanticResult(candidate)
}

const recognizeScopeFromInline = (inlineToken) => {
  if (!inlineToken || inlineToken.type !== 'inline' || !Array.isArray(inlineToken.children)) return null
  const children = inlineToken.children
  if (children.length === 0 || !children[0] || children[0].type !== 'text') return null
  if (typeof children[0].content !== 'string' || children[0].content.length === 0) return null
  let visiblePrefix = ''
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (!child) return null
    if (child.type === 'text') {
      const content = typeof child.content === 'string' ? child.content : ''
      const remaining = maxScopeVisiblePrefixLength - visiblePrefix.length
      if (remaining <= 0) return null
      visiblePrefix += content.slice(0, remaining)
      const result = recognizeScopeText(visiblePrefix, true)
      // A half-width joint at this token boundary is not conclusive because
      // later visible text can turn `Chapter 1:` into `Chapter 1:st`.
      const lastCode = visiblePrefix.charCodeAt(visiblePrefix.length - 1)
      if (result && lastCode !== 0x2e && lastCode !== 0x3a) return result
      if (content.length > remaining) return null
      continue
    }
    if (scopeTransparentInlineTokenTypes.has(child.type)) continue
    return null
  }
  return recognizeScopeText(visiblePrefix, false)
}

const normalizeFigureSequenceKey = (value, optionName) => {
  if (typeof value === 'string') {
    if (!value || value.length > maxScopeKeyLength) {
      throw new RangeError(`${optionName} must be a non-empty string of at most ${maxScopeKeyLength} UTF-16 code units.`)
    }
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  throw new TypeError(`${optionName} must be a non-empty string or a finite number.`)
}

const getFrontmatterNumberingOverride = (env) => {
  const frontmatter = env && env.frontmatter
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) return null
  const hasNested = hasOwnOption(frontmatter, frontmatterNumberingKey)
  const hasDottedScope = hasOwnOption(frontmatter, frontmatterNumberingScopeKey)
  const hasDottedSeparator = hasOwnOption(frontmatter, frontmatterNumberingSeparatorKey)
  if (!hasNested && !hasDottedScope && !hasDottedSeparator) return null
  const value = hasNested ? frontmatter[frontmatterNumberingKey] : null
  const optionName = `env.frontmatter["${frontmatterNumberingKey}"]`
  if (hasNested && (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw new TypeError(`${optionName} must be an object.`)
  }
  if (hasNested) {
    const keys = Object.keys(value)
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]
      if (key !== 'scope' && key !== 'separator') {
        throw new TypeError(`${optionName}.${key} is not supported.`)
      }
    }
  }
  const normalized = {}
  if (hasNested && hasOwnOption(value, 'scope')) {
    if (hasDottedScope) {
      throw new TypeError(`${optionName}.scope is defined more than once.`)
    }
    normalized.scope = normalizeNumberingScopeMode(value.scope, `${optionName}.scope`)
  } else if (hasDottedScope) {
    normalized.scope = normalizeNumberingScopeMode(
      frontmatter[frontmatterNumberingScopeKey],
      `env.frontmatter["${frontmatterNumberingScopeKey}"]`,
    )
  }
  if (hasNested && hasOwnOption(value, 'separator')) {
    if (hasDottedSeparator) {
      throw new TypeError(`${optionName}.separator is defined more than once.`)
    }
    normalized.separator = normalizeNumberingSeparator(
      value.separator,
      `${optionName}.separator`,
    )
  } else if (hasDottedSeparator) {
    normalized.separator = normalizeNumberingSeparator(
      frontmatter[frontmatterNumberingSeparatorKey],
      `env.frontmatter["${frontmatterNumberingSeparatorKey}"]`,
    )
  }
  return normalized
}

const normalizeExplicitScopeOverride = (value, separator) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('env.figureCaptionNumbering.scope must be an object.')
  }
  const scopeKey = normalizeFigureSequenceKey(value.scopeKey, 'env.figureCaptionNumbering.scope.scopeKey')
  if (typeof scopeKey !== 'string') {
    throw new TypeError('env.figureCaptionNumbering.scope.scopeKey must be a non-empty string.')
  }
  if (typeof value.displayPrefix !== 'string' || !captionNumberSegmentReg.test(value.displayPrefix)) {
    throw new TypeError('env.figureCaptionNumbering.scope.displayPrefix must match the caption number segment grammar.')
  }
  const sequenceKey = value.sequenceKey === undefined
    ? scopeKey
    : normalizeFigureSequenceKey(value.sequenceKey, 'env.figureCaptionNumbering.scope.sequenceKey')
  return createScopedNumberingContext(
    scopeKey,
    sequenceKey,
    value.displayPrefix,
    separator,
  )
}

const applySemanticScope = (scopeState, semanticScope) => {
  const sequenceKey = scopeState.repeatScope === 'reset'
    ? scopeState.nextResetSequenceKey++
    : semanticScope.scopeKey
  scopeState.currentContext = createScopedNumberingContext(
    semanticScope.scopeKey,
    sequenceKey,
    semanticScope.displayPrefix,
    scopeState.separator,
  )
}

const findRawFrontmatterToken = (tokens) => {
  const firstToken = tokens && tokens[0]
  return firstToken && firstToken.type === 'front_matter' ? firstToken : null
}

const resolveInitialFrontmatterScope = (state, scopeConfig) => {
  const env = state.env && typeof state.env === 'object' ? state.env : null
  const parsedTitle = env && env.frontmatter && typeof env.frontmatter === 'object'
    ? env.frontmatter.title
    : null
  if (typeof parsedTitle === 'string') {
    const prefix = parsedTitle.slice(0, maxScopeVisiblePrefixLength)
    const recognized = recognizeScopeText(prefix, parsedTitle.length > prefix.length)
    if (recognized) return recognized
  }
  if (!scopeConfig.resolveFrontmatterTitle) return null
  const token = findRawFrontmatterToken(state.tokens)
  if (!token) return null
  let title
  try {
    const raw = typeof token.meta === 'string'
      ? token.meta
      : (typeof token.content === 'string' ? token.content : '')
    title = scopeConfig.resolveFrontmatterTitle(raw, state)
  } catch (_err) {
    return null
  }
  if (typeof title !== 'string') return null
  const prefix = title.slice(0, maxScopeVisiblePrefixLength)
  return recognizeScopeText(prefix, title.length > prefix.length)
}

const createFigureCaptionScopeRuntimeFromPolicyState = (
  state,
  advancedPolicy,
  unscopedContext,
) => {
  const scopeConfig = advancedPolicy.scope
  if (!scopeConfig) return null
  const env = state.env && typeof state.env === 'object' ? state.env : null
  const frontmatterOverride = getFrontmatterNumberingOverride(env)
  let separator = hasOwnOption(frontmatterOverride, 'separator')
    ? frontmatterOverride.separator
    : advancedPolicy.separator
  let scopeMode = hasOwnOption(frontmatterOverride, 'scope')
    ? frontmatterOverride.scope
    : 'auto'
  let explicitScope = null
  let hasExplicitScope = false
  if (env && hasOwnOption(env, 'figureCaptionNumbering')) {
    const namespace = env.figureCaptionNumbering
    if (!namespace || typeof namespace !== 'object' || Array.isArray(namespace)) {
      throw new TypeError('env.figureCaptionNumbering must be an object.')
    }
    if (hasOwnOption(namespace, 'separator')) {
      separator = normalizeNumberingSeparator(
        namespace.separator,
        'env.figureCaptionNumbering.separator',
      )
    }
    if (hasOwnOption(namespace, 'scope')) {
      if (typeof namespace.scope === 'string') {
        scopeMode = normalizeNumberingScopeMode(
          namespace.scope,
          'env.figureCaptionNumbering.scope',
        )
      } else {
        explicitScope = namespace.scope
        hasExplicitScope = true
      }
    }
  }
  const currentUnscopedContext = separator === advancedPolicy.separator && unscopedContext
    ? unscopedContext
    : createUnscopedNumberingContext(separator)
  const scopeState = {
    separator,
    repeatScope: scopeConfig.repeatScope,
    nextResetSequenceKey: 1,
    currentContext: currentUnscopedContext,
    fixed: false,
    scopeConfig,
  }
  if (hasExplicitScope) {
    scopeState.currentContext = normalizeExplicitScopeOverride(explicitScope, separator)
    scopeState.fixed = true
    return scopeState
  }
  if (scopeMode === 'document') {
    scopeState.fixed = true
    return scopeState
  }
  if (scopeConfig.usesFrontmatter) {
    const initialScope = resolveInitialFrontmatterScope(state, scopeConfig)
    if (initialScope) applySemanticScope(scopeState, initialScope)
  }
  return scopeState
}

export const createFigureCaptionScopeRuntime = (
  state,
  numberingPolicy,
  unscopedContext,
) => {
  if (!numberingPolicy) return null
  return createFigureCaptionScopeRuntimeFromPolicyState(
    state,
    getFigureCaptionNumberingPolicyState(numberingPolicy),
    unscopedContext,
  )
}

export const updateFigureCaptionScopeFromHeading = (tokens, index, scopeState) => {
  const token = tokens[index]
  if (!token || typeof token.tag !== 'string') return false
  const level = token.tag.length === 2 && token.tag.charCodeAt(0) === 0x68
    ? token.tag.charCodeAt(1) - 0x30
    : 0
  if (!scopeState.scopeConfig.headingLevelLookup[level]) return false
  const semanticScope = recognizeScopeFromInline(tokens[index + 1])
  if (!semanticScope) return false
  applySemanticScope(scopeState, semanticScope)
  return true
}

const isValidSourceMap = (map) => (
  Array.isArray(map) &&
  Number.isSafeInteger(map[0]) &&
  Number.isSafeInteger(map[1]) &&
  map[0] >= 0 &&
  map[1] > map[0]
)

export const createFigureCaptionScopeTimeline = (state, numberingPolicy) => {
  if (!state || typeof state !== 'object' || !Array.isArray(state.tokens)) {
    throw new TypeError('state must be a markdown-it StateCore with a tokens array.')
  }
  if (!numberingPolicy) return null
  const advancedPolicy = getFigureCaptionNumberingPolicyState(numberingPolicy)
  if (!advancedPolicy.scope) {
    return Object.freeze({
      initialContext: createUnscopedNumberingContext(advancedPolicy.separator),
      boundaries: emptyScopeBoundaries,
      hasUnmappableBoundaries: false,
    })
  }
  const scopeState = createFigureCaptionScopeRuntimeFromPolicyState(
    state,
    advancedPolicy,
    null,
  )
  const initialContext = scopeState.currentContext
  let boundaries = null
  let hasUnmappableBoundaries = false
  if (!scopeState.fixed && scopeState.scopeConfig.usesHeading) {
    const nestedContainerStack = []
    for (let index = 0; index < state.tokens.length; index++) {
      const token = state.tokens[index]
      const containerType = getFigureCaptionScopeNestedContainerType(token)
      if (containerType) {
        nestedContainerStack.push(containerType + '_close')
        continue
      }
      if (nestedContainerStack.length > 0) {
        const parentCloseType = nestedContainerStack[nestedContainerStack.length - 1]
        if (token && token.type === parentCloseType) {
          nestedContainerStack.pop()
        }
        continue
      }
      if (
        !token ||
        token.type !== 'heading_open' ||
        !updateFigureCaptionScopeFromHeading(state.tokens, index, scopeState)
      ) {
        continue
      }
      if (!isValidSourceMap(token.map)) {
        hasUnmappableBoundaries = true
        continue
      }
      if (!boundaries) boundaries = []
      boundaries.push(Object.freeze({
        tokenIndex: index,
        sourceStartLine: token.map[0],
        sourceEndLine: token.map[1],
        context: scopeState.currentContext,
      }))
    }
  }
  return Object.freeze({
    initialContext,
    boundaries: boundaries ? Object.freeze(boundaries) : emptyScopeBoundaries,
    hasUnmappableBoundaries,
  })
}
