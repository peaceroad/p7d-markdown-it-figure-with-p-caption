import {
  BLOCKQUOTE_EMBED_CLASS_NAMES,
  HTML_EMBED_CANDIDATES,
  VIDEO_IFRAME_HOSTS,
} from './providers.js'

const htmlRegCache = new Map()
const openingClassAttrReg = /^<[^>]*?\bclass=(?:"([^"]*)"|'([^']*)')/i
const iframeSrcAttrReg = /<iframe\b[^>]*?\bsrc=(?:"([^"]*)"|'([^']*)')/i
const endBlockquoteScriptReg = /<\/blockquote> *<script[^>]*?><\/script>$/i
const targetHtmlHintReg = /<(?:video|audio|iframe|blockquote|div)(?=[\s>])/i
const blueskyEmbedHintReg = /bluesky-embed/i
const videoTagHintReg = /<video(?=[\s>])/i
const audioTagHintReg = /<audio(?=[\s>])/i
const iframeTagHintReg = /<iframe(?=[\s>])/i
const blockquoteTagHintReg = /<blockquote(?=[\s>])/i
const divTagHintReg = /<div(?=[\s>])/i

const getHtmlReg = (tag) => {
  const cached = htmlRegCache.get(tag)
  if (cached) return cached
  const regexStr = `^<${tag} ?[^>]*?>[\\s\\S]*?<\\/${tag}>(\\n| *?)(<script [^>]*?>(?:<\\/script>)?)? *(\\n|$)`
  const reg = new RegExp(regexStr, 'i')
  htmlRegCache.set(tag, reg)
  return reg
}

const getHtmlDetectionHints = (content) => {
  const source = typeof content === 'string' ? content : ''
  const hasTargetHtmlHint = targetHtmlHintReg.test(source)
  const hasBlueskyHint = blueskyEmbedHintReg.test(source)
  if (!hasTargetHtmlHint && !hasBlueskyHint) {
    return null
  }
  const hasVideoHint = videoTagHintReg.test(source)
  const hasAudioHint = audioTagHintReg.test(source)
  const hasIframeHint = iframeTagHintReg.test(source)
  const hasBlockquoteHint = blockquoteTagHintReg.test(source)
  const hasDivHint = divTagHintReg.test(source)
  return {
    hasBlueskyHint,
    hasVideoHint,
    hasAudioHint,
    hasIframeHint,
    hasBlockquoteHint,
    hasDivHint,
  }
}

const needsHtmlBlockNewline = (hasTag) => !!(
  (hasTag[2] && hasTag[3] !== '\n') ||
  (hasTag[1] !== '\n' && hasTag[2] === undefined)
)

const findBlockquoteEmbedScriptTransform = (tokens, token, startIndex) => {
  let addedContent = ''
  let i = startIndex + 1
  if (tokens[i] && tokens[i].type === 'paragraph_open') {
    addedContent = '\n'
    i++
  }
  const inlineToken = tokens[i]
  if (!inlineToken || inlineToken.type !== 'inline' || !endBlockquoteScriptReg.test(inlineToken.content)) {
    return null
  }
  addedContent += inlineToken.content + '\n'
  let endIndex = i
  if (tokens[i + 1] && tokens[i + 1].type === 'paragraph_close') endIndex++
  return {
    type: 'merge-blockquote-script',
    token,
    startIndex,
    endIndex,
    addedContent,
  }
}

const getOpeningAttrValue = (content, reg) => {
  if (typeof content !== 'string' || content.charCodeAt(0) !== 0x3c) return ''
  const match = content.match(reg)
  if (!match) return ''
  return match[1] || match[2] || ''
}

const getAttrValue = (content, reg) => {
  if (typeof content !== 'string') return ''
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
  const src = getAttrValue(content, iframeSrcAttrReg)
  if (!src || src.slice(0, 8).toLowerCase() !== 'https://') return false
  const slashIndex = src.indexOf('/', 8)
  const host = (slashIndex === -1 ? src.slice(8) : src.slice(8, slashIndex)).toLowerCase()
  return VIDEO_IFRAME_HOSTS.has(host)
}

const detectHtmlTagCandidate = (tokens, token, startIndex, detector, hints) => {
  if (detector.requiresIframeTag && !hints.hasIframeHint) return null
  const hasTagHint = !!(detector.hintKey && hints[detector.hintKey])
  const allowBlueskyFallback = detector.candidate === 'blockquote' && hints.hasBlueskyHint
  if (!hasTagHint && !allowBlueskyFallback) return null
  const hasTag = hasTagHint ? token.content.match(getHtmlReg(detector.lookupTag)) : null
  const isBlueskyFallback = detector.candidate === 'blockquote' && !hasTag && hints.hasBlueskyHint
  if (!hasTag && !isBlueskyFallback) return null
  if (hasTag) {
    return {
      matchedTag: detector.matchedTag || detector.candidate,
      endIndex: startIndex,
      transform: needsHtmlBlockNewline(hasTag)
        ? { type: 'append-newline', token }
        : null,
    }
  }
  const transform = findBlockquoteEmbedScriptTransform(tokens, token, startIndex)
  return transform
    ? { matchedTag: 'blockquote', endIndex: transform.endIndex, transform }
    : null
}

const resolveHtmlWrapWithoutCaption = (
  matchedTag,
  isVideoIframe,
  isIframeTypeBlockquote,
  htmlWrapWithoutCaption,
) => {
  if (!htmlWrapWithoutCaption) return false
  if (matchedTag === 'blockquote') {
    return !!(isIframeTypeBlockquote && htmlWrapWithoutCaption.iframeTypeBlockquote)
  }
  if (matchedTag === 'iframe' && isVideoIframe) {
    return !!(htmlWrapWithoutCaption.video || htmlWrapWithoutCaption.iframe)
  }
  return !!htmlWrapWithoutCaption[matchedTag]
}

export const detectHtmlFigureCandidate = (tokens, token, startIndex, htmlWrapWithoutCaption) => {
  if (!token || token.type !== 'html_block') return null
  const hints = getHtmlDetectionHints(token.content)
  if (!hints) return null

  let candidate = null
  for (let i = 0; i < HTML_EMBED_CANDIDATES.length; i++) {
    candidate = detectHtmlTagCandidate(tokens, token, startIndex, HTML_EMBED_CANDIDATES[i], hints)
    if (candidate) break
  }
  if (!candidate) return null
  const matchedTag = candidate.matchedTag
  let isIframeTypeBlockquote = false

  if (matchedTag === 'blockquote') {
    if (!hasKnownBlockquoteEmbedClass(token.content)) return null
    isIframeTypeBlockquote = true
  }
  const isVideoIframe = matchedTag === 'iframe' && isKnownVideoIframe(token.content)

  return {
    type: 'html',
    tagName: matchedTag,
    en: candidate.endIndex,
    wrapWithoutCaption: resolveHtmlWrapWithoutCaption(
      matchedTag,
      isVideoIframe,
      isIframeTypeBlockquote,
      htmlWrapWithoutCaption,
    ),
    isVideoIframe,
    isIframeTypeBlockquote,
    transform: candidate.transform,
  }
}

export const prepareHtmlFigureTransform = (detection) => {
  const transform = detection && detection.transform
  if (!detection) return 0
  if (!transform) return detection.en
  detection.transform = null
  if (transform.type === 'append-newline') {
    transform.token.content += '\n'
    return detection.en
  }
  if (transform.type === 'merge-blockquote-script') {
    transform.token.content += transform.addedContent
    // The caller's batch emitter skips the remaining source range after
    // emitting outputEnd; do not splice the document token array here.
    return transform.startIndex
  }
  return detection.en
}
