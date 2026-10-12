import { BLOCKQUOTE_EMBED_CLASS_NAMES, SOCIAL_EMBED_SCRIPT_HOSTS } from './providers.js'

const attributeReg = /[\t\n\f\r ]+([^\t\n\f\r "'<>/=]+)(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\t\n\f\r "'`=<>]+)))?/y
const closingBlockquoteReg = /<\/blockquote[\t\n\f\r ]*>/gi
const closingScriptReg = /<\/script[\t\n\f\r ]*>/gi
const bodyTagStartReg = /<\/?[a-z][^\t\n\f\r />]*/gi
// Tag-like text in raw-text or inert elements must never become an active
// loader after extraction. Leave opaque contexts intact instead of parsing
// their contents with the sibling-blockquote recognizer.
const unsupportedBodyReg = /<\/?(?:blockquote|script|style|textarea|title|xmp|iframe|noembed|noframes|noscript|plaintext|template)(?=[\s/>])|<!|<\?/i
const entityReg = /&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi
const booleanAttributes = new Set(['async', 'defer', 'nomodule'])

const isHtmlWhitespace = code => code === 9 || code === 10 || code === 12 || code === 13 || code === 32

const skipWhitespace = (content, start) => {
  let index = start
  while (index < content.length && isHtmlWhitespace(content.charCodeAt(index))) index++
  return index
}

const trimHtmlWhitespace = content => {
  const start = skipWhitespace(content, 0)
  let end = content.length
  while (end > start && isHtmlWhitespace(content.charCodeAt(end - 1))) end--
  return content.slice(start, end)
}

const countNewlines = (content, start, end) => {
  let count = 0
  for (let index = start; index < end; index++) {
    if (content.charCodeAt(index) === 10) count++
  }
  return count
}

const hasUnclosedBodyTag = (content, start, end) => {
  bodyTagStartReg.lastIndex = start
  let match
  while ((match = bodyTagStartReg.exec(content)) && match.index < end) {
    let index = bodyTagStartReg.lastIndex
    let quote = 0
    for (; index < end; index++) {
      const code = content.charCodeAt(index)
      if (quote) {
        if (code === quote) quote = 0
      } else if (code === 34 || code === 39) {
        quote = code
      } else if (code === 60) {
        return true
      } else if (code === 62) {
        break
      }
    }
    // A closing-blockquote spelling inside a quoted attribute is not a
    // structural boundary. Reject that fragment without extracting its text.
    if (index >= end) return true
    bodyTagStartReg.lastIndex = index + 1
  }
  return false
}

const readOpeningTag = (content, start, tag, unescape) => {
  if (content.slice(start, start + tag.length + 1).toLowerCase() !== '<' + tag) return null
  let index = start + tag.length + 1
  if (content[index] !== '>' && !/[\t\n\f\r ]/.test(content[index] || '')) return null
  const attributes = new Map()
  while (index < content.length) {
    const end = skipWhitespace(content, index)
    if (content[end] === '>') return { end: end + 1, attributes }
    attributeReg.lastIndex = index
    const match = attributeReg.exec(content)
    if (!match) return null
    const name = match[1].toLowerCase()
    if (attributes.has(name)) return null
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    // Decode HTML entities without applying Markdown backslash unescaping to
    // attribute values. Keep the original tag as the emitted source.
    attributes.set(name, value.includes('&')
      ? value.replace(entityReg, entity => unescape(entity))
      : value)
    index = attributeReg.lastIndex
  }
  return null
}

const getEmbedClass = attributes => {
  for (const name of (attributes.get('class') || '').split(/[\t\n\f\r ]+/)) {
    if (BLOCKQUOTE_EMBED_CLASS_NAMES.has(name)) return name
  }
  return ''
}

const parseHttpUrl = value => {
  if (!value || !/^(?:https?:)?\/\//i.test(value)) return null
  try {
    const url = new URL(value.startsWith('//') ? 'https:' + value : value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url
      : null
  } catch {
    return null
  }
}

const isProviderScript = (embedClass, embedAttributes, scriptAttributes) => {
  const type = trimHtmlWhitespace(scriptAttributes.get('type') || '').toLowerCase()
  if (type && type !== 'text/javascript' && type !== 'application/javascript') return false
  // Event handlers and inline bodies may depend on each occurrence or its
  // original parent. Keep such scripts in place instead of guessing.
  for (const name of scriptAttributes.keys()) {
    if (name.startsWith('on')) return false
  }
  const url = parseHttpUrl(scriptAttributes.get('src'))
  if (!url) return false
  if (embedClass === 'mastodon-embed') {
    const embedUrl = parseHttpUrl(embedAttributes.get('data-embed-url'))
    return !!(embedUrl && embedUrl.origin === url.origin)
  }
  return !url.port && !!SOCIAL_EMBED_SCRIPT_HOSTS[embedClass]?.includes(url.hostname)
}

const getScriptKey = attributes => {
  const entries = [...attributes]
  for (const entry of entries) {
    if (booleanAttributes.has(entry[0])) entry[1] = ''
  }
  entries.sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0)
  return JSON.stringify(entries)
}

const getScriptMap = (sourceMap, lineOffset, scriptLines) => {
  const start = sourceMap[0] + lineOffset
  const end = start + scriptLines
  return Number.isSafeInteger(start) && Number.isSafeInteger(end)
    && start >= sourceMap[0] && end <= sourceMap[1]
    ? [start, end]
    : null
}

// Analyze a complete sequence of known social blockquotes. Never remove a
// script from incomplete HTML, nested quotes, unrelated siblings, or raw text
// that merely resembles a script tag. All token mutation stays with the plan.
export const analyzeEmbedScriptCollection = (content, sourceMap, unescape) => {
  if (typeof content !== 'string' || !/<script(?=[\s>])/i.test(content)) return null
  let index = skipWhitespace(content, 0)
  let keptStart = 0
  let body = ''
  const hasSourceMap = Array.isArray(sourceMap)
  let lineOffset = hasSourceMap ? countNewlines(content, 0, index) : 0
  const scripts = []
  while (index < content.length) {
    const opening = readOpeningTag(content, index, 'blockquote', unescape)
    if (!opening) return null
    const embedClass = getEmbedClass(opening.attributes)
    if (!embedClass) return null
    closingBlockquoteReg.lastIndex = opening.end
    const closing = closingBlockquoteReg.exec(content)
    if (
      !closing
      || unsupportedBodyReg.test(content.slice(opening.end, closing.index))
      || hasUnclosedBodyTag(content, opening.end, closing.index)
    ) return null
    const embedEnd = closingBlockquoteReg.lastIndex
    const scriptStart = skipWhitespace(content, embedEnd)
    const scriptOpening = readOpeningTag(content, scriptStart, 'script', unescape)
    let segmentEnd = embedEnd
    if (scriptOpening) {
      closingScriptReg.lastIndex = scriptOpening.end
      const scriptClosing = closingScriptReg.exec(content)
      if (!scriptClosing) return null
      segmentEnd = closingScriptReg.lastIndex
      if (
        scriptClosing.index === scriptOpening.end
        && isProviderScript(embedClass, opening.attributes, scriptOpening.attributes)
      ) {
        body += content.slice(keptStart, embedEnd)
        if (content.charCodeAt(segmentEnd) !== 10) body += '\n'
        keptStart = segmentEnd
        scripts.push({
          key: getScriptKey(scriptOpening.attributes),
          content: content.slice(scriptStart, segmentEnd) + '\n',
          map: hasSourceMap
            ? getScriptMap(
              sourceMap,
              lineOffset + countNewlines(content, index, scriptStart),
              countNewlines(content, scriptStart, segmentEnd) + 1,
            )
            : null,
        })
      }
    }
    const next = skipWhitespace(content, segmentEnd)
    if (hasSourceMap) lineOffset += countNewlines(content, index, next)
    index = next
  }
  if (scripts.length === 0) return null
  body += content.slice(keptStart)
  // Normalize only the fragment's terminal spacing, not blank lines inside
  // the post. Detector newline repair can otherwise leave an empty line here
  // when a multiline script attribute contains a quoted greater-than sign.
  let bodyEnd = body.length
  while (bodyEnd > 0 && isHtmlWhitespace(body.charCodeAt(bodyEnd - 1))) bodyEnd--
  body = body.slice(0, bodyEnd) + '\n'
  return { content: body, scripts }
}

export const createCollectedEmbedScriptTokens = (applyOrder, TokenConstructor) => {
  let scripts = null
  for (const plan of applyOrder) {
    const collection = plan.detection.scriptCollection
    if (!collection) continue
    scripts ||= new Map()
    for (const script of collection.scripts) {
      if (!scripts.has(script.key)) scripts.set(script.key, script)
    }
  }
  if (!scripts) return null
  const tokens = []
  for (const script of scripts.values()) {
    const token = new TokenConstructor('html_block', '', 0)
    token.content = script.content
    token.block = true
    token.map = script.map
    tokens.push(token)
  }
  return tokens
}
