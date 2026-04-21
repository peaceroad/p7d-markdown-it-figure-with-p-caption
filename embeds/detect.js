import {
  BLOCKQUOTE_EMBED_CLASS_NAMES,
  HTML_EMBED_CANDIDATES,
  VIDEO_IFRAME_HOSTS,
} from './providers.js'

const htmlRegCache = new Map()
const openingClassAttrReg = /^<[^>]*?\bclass=(?:"([^"]*)"|'([^']*)')/i
const openingSrcAttrReg = /^<[^>]*?\bsrc=(?:"([^"]*)"|'([^']*)')/i
const endBlockquoteScriptReg = /<\/blockquote> *<script[^>]*?><\/script>$/
const iframeTagReg = /<iframe(?=[\s>])/i

const getHtmlReg = (tag) => {
  const cached = htmlRegCache.get(tag)
  if (cached) return cached
  const regexStr = `^<${tag} ?[^>]*?>[\\s\\S]*?<\\/${tag}>(\\n| *?)(<script [^>]*?>(?:<\\/script>)?)? *(\\n|$)`
  const reg = new RegExp(regexStr, 'i')
  htmlRegCache.set(tag, reg)
  return reg
}

const getHtmlDetectionHints = (content) => {
  const normalized = typeof content === 'string' ? content.toLowerCase() : ''
  const hasBlueskyHint = normalized.indexOf('bluesky-embed') !== -1
  const hasVideoHint = normalized.indexOf('<video') !== -1
  const hasAudioHint = normalized.indexOf('<audio') !== -1
  const hasIframeHint = normalized.indexOf('<iframe') !== -1
  const hasBlockquoteHint = normalized.indexOf('<blockquote') !== -1
  const hasDivHint = normalized.indexOf('<div') !== -1
  return {
    hasBlueskyHint,
    hasVideoHint,
    hasAudioHint,
    hasIframeHint,
    hasBlockquoteHint,
    hasDivHint,
    hasIframeTag: hasIframeHint || (hasDivHint && iframeTagReg.test(content)),
  }
}

const hasAnyHtmlDetectionHint = (hints) => {
  return !!(
    hints.hasBlueskyHint ||
    hints.hasVideoHint ||
    hints.hasAudioHint ||
    hints.hasIframeHint ||
    hints.hasBlockquoteHint ||
    hints.hasDivHint
  )
}

const appendHtmlBlockNewlineIfNeeded = (token, hasTag) => {
  if ((hasTag[2] && hasTag[3] !== '\n') || (hasTag[1] !== '\n' && hasTag[2] === undefined)) {
    token.content += '\n'
  }
}

const consumeBlockquoteEmbedScript = (tokens, token, startIndex) => {
  let addedContent = ''
  let i = startIndex + 1
  while (i < tokens.length) {
    const nextToken = tokens[i]
    if (nextToken.type === 'inline' && endBlockquoteScriptReg.test(nextToken.content)) {
      addedContent += nextToken.content + '\n'
      if (tokens[i + 1] && tokens[i + 1].type === 'paragraph_close') {
        tokens.splice(i + 1, 1)
      }
      nextToken.content = ''
      if (nextToken.children) {
        for (let j = 0; j < nextToken.children.length; j++) {
          nextToken.children[j].content = ''
        }
      }
      break
    }
    if (nextToken.type === 'paragraph_open') {
      addedContent += '\n'
      tokens.splice(i, 1)
      continue
    }
    i++
  }
  token.content += addedContent
}

const getOpeningAttrValue = (content, reg) => {
  if (typeof content !== 'string' || content.charCodeAt(0) !== 0x3c) return ''
  const match = content.match(reg)
  if (!match) return ''
  return match[1] || match[2] || ''
}

const hasKnownBlockquoteEmbedClass = (content) => {
  const classAttr = getOpeningAttrValue(content, openingClassAttrReg)
  if (!classAttr) return false
  let start = 0
  while (start < classAttr.length) {
    while (start < classAttr.length && classAttr.charCodeAt(start) <= 0x20) start++
    if (start >= classAttr.length) break
    let end = start + 1
    while (end < classAttr.length && classAttr.charCodeAt(end) > 0x20) end++
    if (BLOCKQUOTE_EMBED_CLASS_NAMES.has(classAttr.slice(start, end))) return true
    start = end + 1
  }
  return false
}

const isKnownVideoIframe = (content) => {
  const src = getOpeningAttrValue(content, openingSrcAttrReg)
  if (!src || src.slice(0, 8).toLowerCase() !== 'https://') return false
  const slashIndex = src.indexOf('/', 8)
  const host = (slashIndex === -1 ? src.slice(8) : src.slice(8, slashIndex)).toLowerCase()
  return VIDEO_IFRAME_HOSTS.has(host)
}

const detectHtmlTagCandidate = (tokens, token, startIndex, detector, hints, result) => {
  if (detector.requiresIframeTag && !hints.hasIframeTag) return ''
  const hasTagHint = !!(detector.hintKey && hints[detector.hintKey])
  const allowBlueskyFallback = detector.candidate === 'blockquote' && hints.hasBlueskyHint
  if (!hasTagHint && !allowBlueskyFallback) return ''
  const hasTag = hasTagHint ? token.content.match(getHtmlReg(detector.lookupTag)) : null
  const isBlueskyFallback = detector.candidate === 'blockquote' && !hasTag && hints.hasBlueskyHint
  if (!hasTag && !isBlueskyFallback) return ''
  if (hasTag) {
    appendHtmlBlockNewlineIfNeeded(token, hasTag)
    if (detector.treatAsVideoIframe) {
      result.isVideoIframe = true
    }
    return detector.matchedTag || detector.candidate
  }
  consumeBlockquoteEmbedScript(tokens, token, startIndex)
  return 'blockquote'
}

const resolveHtmlWrapWithoutCaption = (matchedTag, result, htmlWrapWithoutCaption) => {
  if (!htmlWrapWithoutCaption) return false
  if (matchedTag === 'blockquote') {
    return !!(result.isIframeTypeBlockquote && htmlWrapWithoutCaption.iframeTypeBlockquote)
  }
  if (matchedTag === 'iframe' && result.isVideoIframe) {
    return !!(htmlWrapWithoutCaption.video || htmlWrapWithoutCaption.iframe)
  }
  return !!htmlWrapWithoutCaption[matchedTag]
}

export const detectHtmlFigureCandidate = (tokens, token, startIndex, htmlWrapWithoutCaption) => {
  if (!token || token.type !== 'html_block') return null
  const hints = getHtmlDetectionHints(token.content)
  if (!hasAnyHtmlDetectionHint(hints)) return null

  const result = {
    isVideoIframe: false,
    isIframeTypeBlockquote: false,
  }

  let matchedTag = ''
  for (let i = 0; i < HTML_EMBED_CANDIDATES.length; i++) {
    matchedTag = detectHtmlTagCandidate(tokens, token, startIndex, HTML_EMBED_CANDIDATES[i], hints, result)
    if (matchedTag) break
  }
  if (!matchedTag) return null

  if (matchedTag === 'blockquote') {
    if (!hasKnownBlockquoteEmbedClass(token.content)) return null
    result.isIframeTypeBlockquote = true
  }

  if (matchedTag === 'iframe' && isKnownVideoIframe(token.content)) {
    result.isVideoIframe = true
  }

  return {
    type: 'html',
    tagName: matchedTag,
    en: startIndex,
    replaceInsteadOfWrap: false,
    wrapWithoutCaption: resolveHtmlWrapWithoutCaption(matchedTag, result, htmlWrapWithoutCaption),
    canWrap: true,
    isVideoIframe: result.isVideoIframe,
    isIframeTypeBlockquote: result.isIframeTypeBlockquote,
  }
}
