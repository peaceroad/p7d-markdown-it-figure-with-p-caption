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

const MAX_SINGLE_SPLICE_SIDECAR_TOKENS = 1024

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

export const applyUnreferencedLocalNotesDecision = (tokens, decision, Token, classPrefix) => {
  if (!decision || decision.kind !== 'unreferenced-local-notes') return null
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
  const sourceLength = decision.end - decision.start + 1
  for (let i = decision.start; i <= decision.end; i++) {
    if (typeof tokens[i]?.level === 'number') tokens[i].level++
  }
  if (sourceLength <= MAX_SINGLE_SPLICE_SIDECAR_TOKENS) {
    const sourceTokens = tokens.slice(decision.start, decision.end + 1)
    tokens.splice(
      decision.start,
      sourceTokens.length,
      open,
      ...sourceTokens,
      close,
    )
  } else {
    // Avoid engine argument-count limits for unusually large note lists.
    tokens.splice(decision.end + 1, 0, close)
    tokens.splice(decision.start, 0, open)
  }
  return {
    start: decision.start,
    end: decision.end + 2,
    open,
    close,
    map,
  }
}

export const moveAnnotationIntoFigure = (
  tokens,
  decision,
  figureOpen,
  figureClose,
  figcaptionOpen = null,
  figcaptionClose = null,
  expectedFigureCloseIndex = -1,
) => {
  if (!decision || !figureOpen || !figureClose) return -1
  let figureCloseIndex = tokens[expectedFigureCloseIndex] === figureClose
    ? expectedFigureCloseIndex
    : tokens.indexOf(figureClose)
  if (figureCloseIndex < 0) return -1
  let start = figureCloseIndex + 1
  if (tokens[start] !== decision.open || tokens[start + 2] !== decision.close) {
    start = tokens.indexOf(decision.open)
  }
  if (start < 0 || tokens[start + 2] !== decision.close) return -1
  let destination = figureCloseIndex
  if (figcaptionClose) {
    const expectedCaptionCloseIndex = figureCloseIndex - 1
    const captionCloseIndex = tokens[expectedCaptionCloseIndex] === figcaptionClose
      ? expectedCaptionCloseIndex
      : tokens.indexOf(figcaptionClose)
    if (captionCloseIndex >= 0) destination = captionCloseIndex
  }
  const moved = [tokens[start], tokens[start + 1], tokens[start + 2]]
  const parentLevel = figcaptionOpen
    ? (typeof figcaptionOpen.level === 'number' ? figcaptionOpen.level : 1)
    : (typeof figureOpen.level === 'number' ? figureOpen.level : 0)
  moved[0].level = parentLevel + 1
  moved[1].level = parentLevel + 2
  moved[2].level = parentLevel + 1
  if (
    figcaptionClose
    && destination === figureCloseIndex - 1
    && start === figureCloseIndex + 1
  ) {
    tokens[destination] = moved[0]
    tokens[destination + 1] = moved[1]
    tokens[destination + 2] = moved[2]
    tokens[destination + 3] = figcaptionClose
    tokens[destination + 4] = figureClose
    figureCloseIndex += 3
  } else {
    tokens.splice(start, 3)
    if (start < figureCloseIndex) figureCloseIndex -= 3
    if (start < destination) destination -= 3
    tokens.splice(destination, 0, ...moved)
    if (destination <= figureCloseIndex) figureCloseIndex += 3
  }

  const annotationMap = getRangeMap(moved, 0, moved.length - 1)
  if (annotationMap) {
    const currentFigureMap = getMap(figureOpen)
    const combinedFigureMap = currentFigureMap
      ? [Math.min(currentFigureMap[0], annotationMap[0]), Math.max(currentFigureMap[1], annotationMap[1])]
      : annotationMap
    figureOpen.map = [combinedFigureMap[0], combinedFigureMap[1]]
    figureClose.map = [combinedFigureMap[0], combinedFigureMap[1]]
    if (figcaptionOpen && figcaptionClose) {
      const currentCaptionMap = getMap(figcaptionOpen)
      const combinedCaptionMap = currentCaptionMap
        ? [Math.min(currentCaptionMap[0], annotationMap[0]), Math.max(currentCaptionMap[1], annotationMap[1])]
        : annotationMap
      figcaptionOpen.map = [combinedCaptionMap[0], combinedCaptionMap[1]]
      figcaptionClose.map = [combinedCaptionMap[0], combinedCaptionMap[1]]
    }
  }
  return figureCloseIndex
}
