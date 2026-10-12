import {
  BLOCKQUOTE_EMBED_CLASS_NAMES,
  HTML_EMBED_CANDIDATES,
  VIDEO_IFRAME_HOSTS,
} from './providers.js'

const htmlRegCache = new Map()
const openingClassAttrReg = /^<[^>]*?\bclass=(?:"([^"]*)"|'([^']*)')/i
const iframeSrcAttrReg = /<iframe\b[^>]*?\bsrc=(?:"([^"]*)"|'([^']*)')/i
const endBlockquoteScriptReg = /<\/blockquote>[ \t\n]*(<script(?=[\s>])[^>]*><\/script>)?[ \t\n]*$/i
const standaloneScriptReg = /^<script(?=[\s>])[^>]*><\/script>[ \t\n]*$/i
const endBlockquoteReg = /<\/blockquote>[ \t\n]*$/i
const blockquoteBoundaryReg = /<\/?blockquote(?=[\s>])/i
const targetHtmlHintReg = /<(?:video|audio|iframe|blockquote|div)(?=[\s>])/i
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
  if (!hasTargetHtmlHint) {
    return null
  }
  const hasVideoHint = videoTagHintReg.test(source)
  const hasAudioHint = audioTagHintReg.test(source)
  const hasIframeHint = iframeTagHintReg.test(source)
  const hasBlockquoteHint = blockquoteTagHintReg.test(source)
  const hasDivHint = divTagHintReg.test(source)
  return {
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

const isBoundedSourceMap = (map, sourceLength) => !!(
  Array.isArray(map)
  && Number.isSafeInteger(map[0])
  && Number.isSafeInteger(map[1])
  && map[0] >= 0
  && map[1] >= map[0]
  && map[1] <= sourceLength
)

const getSourceBlankLineCount = (previous, next, sourceLength, fallback) => {
  // Source character length is also an upper bound on source line indexes.
  // Ignore malformed third-party maps instead of trusting an unbounded repeat.
  if (
    !Number.isSafeInteger(sourceLength)
    || !isBoundedSourceMap(previous.map, sourceLength)
    || !isBoundedSourceMap(next.map, sourceLength)
    || next.map[0] < previous.map[1]
  ) return fallback
  return next.map[0] - previous.map[1]
}

const findFollowingBlockquoteScriptTransform = (tokens, token, startIndex, sourceLength) => {
  const scriptToken = tokens[startIndex + 1]
  if (scriptToken?.type !== 'html_block' || !standaloneScriptReg.test(scriptToken.content)) return null
  const gap = getSourceBlankLineCount(token, scriptToken, sourceLength, 0)
  return {
    type: 'merge-blockquote-script',
    startIndex,
    endIndex: startIndex + 1,
    addedContent: (token.content.endsWith('\n') ? '' : '\n')
      + '\n'.repeat(gap) + scriptToken.content
      + (scriptToken.content.endsWith('\n') ? '' : '\n'),
  }
}

const findBlockquoteEmbedScriptTransform = (tokens, token, startIndex, sourceLength) => {
  // A blank line can split provider HTML into an html_block, paragraph
  // triples, and a separate script block. Recover only complete, known embeds.
  if (blockquoteBoundaryReg.test(token.content.slice(1))) return null
  let addedContent = ''
  let previousBlock = token
  let i = startIndex + 1
  while (tokens[i]?.type === 'paragraph_open' && !tokens[i].hidden) {
    const inlineToken = tokens[i + 1]
    if (inlineToken?.type !== 'inline' || tokens[i + 2]?.type !== 'paragraph_close') return null
    const boundary = inlineToken.content.match(blockquoteBoundaryReg)
    const ending = inlineToken.content.match(endBlockquoteScriptReg)
    if (boundary && (!ending || boundary.index !== ending.index)) return null
    const gap = getSourceBlankLineCount(previousBlock, tokens[i], sourceLength, 1)
    addedContent += '\n'.repeat(gap) + inlineToken.content + '\n'
    previousBlock = tokens[i]
    i += 3
    if (!ending) continue
    let endIndex = i - 1
    if (!ending[1]) {
      const scriptToken = tokens[i]
      if (scriptToken?.type !== 'html_block' || !standaloneScriptReg.test(scriptToken.content)) return null
      const scriptGap = getSourceBlankLineCount(previousBlock, scriptToken, sourceLength, 0)
      addedContent += '\n'.repeat(scriptGap) + scriptToken.content
      if (!scriptToken.content.endsWith('\n')) addedContent += '\n'
      endIndex = i
    }
    return {
      type: 'merge-blockquote-script',
      startIndex,
      endIndex,
      addedContent,
    }
  }
  return null
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

const detectHtmlTagCandidate = (tokens, token, startIndex, detector, hints, sourceLength) => {
  if (detector.requiresIframeTag && !hints.hasIframeHint) return null
  const hasTagHint = !!(detector.hintKey && hints[detector.hintKey])
  if (!hasTagHint) return null
  if (detector.candidate === 'blockquote' && !hasKnownBlockquoteEmbedClass(token.content)) return null
  const hasTag = token.content.match(getHtmlReg(detector.lookupTag))
  if (hasTag) {
    if (
      detector.candidate === 'blockquote'
      && !hasTag[2]
      && tokens[startIndex + 1]?.type === 'html_block'
      && endBlockquoteReg.test(token.content)
    ) {
      const transform = findFollowingBlockquoteScriptTransform(tokens, token, startIndex, sourceLength)
      if (transform) return { matchedTag: 'blockquote', endIndex: transform.endIndex, transform }
    }
    return {
      matchedTag: detector.matchedTag || detector.candidate,
      endIndex: startIndex,
      transform: needsHtmlBlockNewline(hasTag)
        ? { type: 'append-newline' }
        : null,
    }
  }
  if (detector.candidate !== 'blockquote') return null
  const transform = findBlockquoteEmbedScriptTransform(tokens, token, startIndex, sourceLength)
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

export const detectHtmlFigureCandidate = (tokens, token, startIndex, htmlWrapWithoutCaption, sourceLength) => {
  if (!token || token.type !== 'html_block') return null
  const hints = getHtmlDetectionHints(token.content)
  if (!hints) return null

  let candidate = null
  for (let i = 0; i < HTML_EMBED_CANDIDATES.length; i++) {
    candidate = detectHtmlTagCandidate(tokens, token, startIndex, HTML_EMBED_CANDIDATES[i], hints, sourceLength)
    if (candidate) break
  }
  if (!candidate) return null
  const matchedTag = candidate.matchedTag
  const isIframeTypeBlockquote = matchedTag === 'blockquote'
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

export const prepareHtmlFigureTransform = (detection, token) => {
  const transform = detection && detection.transform
  if (!detection) return 0
  detection.transform = null
  if (detection.scriptCollection) {
    token.content = detection.scriptCollection.content
  } else if (transform?.type === 'append-newline') {
    token.content += '\n'
  } else if (transform?.type === 'merge-blockquote-script') {
    token.content += transform.addedContent
  }
  // The batch emitter skips the absorbed source range after this token.
  return transform?.type === 'merge-blockquote-script' ? transform.startIndex : detection.en
}
