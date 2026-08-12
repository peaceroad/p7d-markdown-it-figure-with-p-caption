import { matchAnnotationLabel, matchLocalNoteLabel } from './catalog.js'

const isParagraphTriplet = (tokens, index) => (
  tokens[index]?.type === 'paragraph_open'
  && tokens[index + 1]?.type === 'inline'
  && tokens[index + 2]?.type === 'paragraph_close'
)

const getMap = (token) => {
  const map = token?.map
  return Array.isArray(map)
    && map.length === 2
    && Number.isSafeInteger(map[0])
    && Number.isSafeInteger(map[1])
    && map[0] >= 0
    && map[1] >= map[0]
    ? map
    : null
}

const getRangeMap = (tokens, start, end) => {
  let first = null
  let greatestEnd = -1
  for (let i = start; i <= end; i++) {
    const map = getMap(tokens[i])
    if (!map) continue
    if (!first) first = map
    if (map[1] > greatestEnd) greatestEnd = map[1]
  }
  return first ? [first[0], Math.max(first[1], greatestEnd)] : null
}

const createToken = (Token, type, tag, nesting, level, map = null) => {
  const token = new Token(type, tag, nesting)
  token.block = nesting !== 0
  token.level = level
  if (map) token.map = [map[0], map[1]]
  return token
}

const splitInlineLabel = (inline, match, Token, labelClass) => {
  const children = inline?.children
  if (!Array.isArray(children) || children.length === 0) return false
  const first = children[0]
  if (first?.type !== 'text' || typeof first.content !== 'string') return false
  const sourcePrefix = inline.content.slice(0, match.bodyStart)
  if (!first.content.startsWith(sourcePrefix)) return false

  const baseLevel = typeof first.level === 'number' ? first.level : (inline.level + 1)
  const open = new Token('span_open', 'span', 1)
  open.attrSet('class', labelClass)
  open.level = baseLevel
  const label = new Token('text', '', 0)
  label.content = sourcePrefix
  label.level = baseLevel + 1
  const close = new Token('span_close', 'span', -1)
  close.level = baseLevel
  first.content = first.content.slice(sourcePrefix.length)
  children.splice(0, 0, open, label, close)
  inline.content = inline.content.slice(match.bodyStart)
  return true
}

const canSplitInlineLabel = (inline, match) => {
  const children = inline?.children
  if (!Array.isArray(children) || children.length === 0) return false
  const first = children[0]
  if (first?.type !== 'text' || typeof first.content !== 'string') return false
  return first.content.startsWith(inline.content.slice(0, match.bodyStart))
}

const analyzeAnnotationParagraph = (tokens, index, catalog) => {
  if (!isParagraphTriplet(tokens, index)) return null
  const inline = tokens[index + 1]
  const match = matchAnnotationLabel(inline.content, catalog)
  if (!match) return null
  if (!canSplitInlineLabel(inline, match)) return null
  return {
    kind: 'annotation',
    start: index,
    end: index + 2,
    match,
    open: tokens[index],
    inline,
    close: tokens[index + 2],
  }
}

const analyzeLocalNoteParagraph = (tokens, index, targetType, catalog) => {
  if (!isParagraphTriplet(tokens, index)) return null
  const inline = tokens[index + 1]
  const match = matchLocalNoteLabel(inline.content, targetType, catalog)
  if (!match) return null
  if (!canSplitInlineLabel(inline, match)) return null
  return {
    start: index,
    end: index + 2,
    open: tokens[index],
    inline,
    close: tokens[index + 2],
    match,
  }
}

const findListEnd = (tokens, start) => {
  const open = tokens[start]
  if (open?.type !== 'bullet_list_open') return -1
  let depth = 0
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].type === 'bullet_list_open') depth++
    if (tokens[i].type === 'bullet_list_close') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

const analyzeLocalNoteList = (tokens, index, targetType, catalog) => {
  const end = findListEnd(tokens, index)
  if (end < 0) return null
  const paragraphs = []
  let itemDepth = 0
  let paragraphsInItem = 0
  let currentItemOpen = null
  for (let i = index + 1; i < end; i++) {
    const type = tokens[i]?.type
    if (type === 'bullet_list_open' || type === 'ordered_list_open') return null
    if (type === 'list_item_open') {
      if (itemDepth !== 0) return null
      itemDepth++
      paragraphsInItem = 0
      currentItemOpen = tokens[i]
      continue
    }
    if (type === 'list_item_close') {
      if (itemDepth !== 1 || paragraphsInItem !== 1) return null
      itemDepth--
      currentItemOpen = null
      continue
    }
    if (type === 'inline' || type === 'paragraph_close') continue
    if (type !== 'paragraph_open') return null
    if (itemDepth !== 1) return null
    paragraphsInItem++
    const paragraph = analyzeLocalNoteParagraph(tokens, i, targetType, catalog)
    if (!paragraph) return null
    paragraph.itemOpen = currentItemOpen
    paragraphs.push(paragraph)
    i += 2
  }
  if (itemDepth !== 0 || currentItemOpen || paragraphs.length === 0) return null
  return {
    kind: 'unreferenced-local-notes',
    targetType,
    start: index,
    end,
    paragraphs,
  }
}

export const analyzeAnnotationAt = analyzeAnnotationParagraph

export const analyzeUnreferencedLocalNotesAt = (tokens, index, targetType, catalog) => {
  const paragraph = analyzeLocalNoteParagraph(tokens, index, targetType, catalog)
  if (paragraph) {
    return {
      kind: 'unreferenced-local-notes',
      targetType,
      start: index,
      end: index + 2,
      paragraphs: [paragraph],
    }
  }
  return analyzeLocalNoteList(tokens, index, targetType, catalog)
}

const retagSidecarParagraph = (paragraph, Token, className, labelClass, typePrefix) => {
  if (!splitInlineLabel(paragraph.inline, paragraph.match, Token, labelClass)) return false
  paragraph.open.type = `${typePrefix}_open`
  paragraph.open.tag = 'p'
  paragraph.open.attrJoin('class', className)
  if (paragraph.itemOpen && paragraph.open.hidden) paragraph.itemOpen.attrJoin('class', className)
  paragraph.close.type = `${typePrefix}_close`
  paragraph.close.tag = 'p'
  return true
}

export const applyAnnotationDecision = (decision, Token, classPrefix) => {
  if (!decision || decision.kind !== 'annotation') return false
  return retagSidecarParagraph(
    decision,
    Token,
    `${classPrefix}annotation ${classPrefix}${decision.match.role}`,
    `${classPrefix}annotation-label`,
    'figure_annotation',
  )
}

export const prepareUnreferencedLocalNotesDecision = (tokens, decision, Token, classPrefix) => {
  if (!decision || decision.kind !== 'unreferenced-local-notes') return null
  // Validate the whole group again before mutating its first paragraph so a
  // stale later item cannot leave a partially retagged sidecar.
  for (let i = 0; i < decision.paragraphs.length; i++) {
    const paragraph = decision.paragraphs[i]
    if (!canSplitInlineLabel(paragraph.inline, paragraph.match)) return null
  }
  for (let i = 0; i < decision.paragraphs.length; i++) {
    if (!retagSidecarParagraph(
      decision.paragraphs[i],
      Token,
      `${classPrefix}local-note`,
      `${classPrefix}local-note-label`,
      'figure_local_note',
    )) return null
  }

  const map = getRangeMap(tokens, decision.start, decision.end)
  const baseLevel = typeof tokens[decision.start]?.level === 'number'
    ? tokens[decision.start].level
    : 0
  const open = createToken(Token, 'figure_local_notes_open', 'aside', 1, baseLevel, map)
  open.attrSet('class', `${classPrefix}local-notes ${classPrefix}${decision.targetType}-notes`)
  open.attrSet('aria-label', decision.paragraphs[0].match.baseLabel)
  const close = createToken(Token, 'figure_local_notes_close', 'aside', -1, baseLevel, map)
  for (let i = decision.start; i <= decision.end; i++) {
    if (typeof tokens[i]?.level === 'number') tokens[i].level++
  }
  return {
    start: decision.start,
    end: decision.end,
    open,
    close,
  }
}
