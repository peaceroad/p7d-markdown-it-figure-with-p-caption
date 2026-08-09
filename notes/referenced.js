import {
  scanNoteDefinitionMarker,
  scanNoteReferenceMarker,
} from '@peaceroad/markdown-it-footnote-here/note-grammar.js'
import { resolveReferencedTableNotesLabel } from './catalog.js'
import {
  pushFigureNotesDiagnostic,
  resetFigureNotesDiagnostics,
} from './diagnostics.js'

const ENV_STATE_KEY = Symbol('figureNotesReferencedState')
const hasLocalLabelPrefix = (label) => (
  typeof label === 'string'
  && (
    (label.length > 3 && label.startsWith('tn-'))
    || (label.length > 6 && label.startsWith('table-'))
  )
)

const getEnvState = (env, create = false) => {
  if (!env) return null
  let runtime = env[ENV_STATE_KEY]
  if (!runtime && create) {
    runtime = {
      groups: [],
      definitionLabels: new Set(),
    }
    env[ENV_STATE_KEY] = runtime
  }
  return runtime || null
}

const isDefinitionIndent = (state, line) => {
  const relativeIndent = state.sCount[line] - state.blkIndent
  return relativeIndent >= 0 && relativeIndent < 4
}

const hasImmediateTableTarget = (state) => (
  state.tokens[state.tokens.length - 1]?.type === 'table_close'
)

const createDefinition = (src, lineStart, lineEnd, line, marker) => ({
  label: marker.label,
  marker: src.slice(lineStart, marker.contentStart),
  content: src.slice(marker.contentStart, lineEnd),
  map: [line, line + 1],
  refs: [],
})

const referencedGroupBlock = (state, startLine, endLine, silent) => {
  if (!isDefinitionIndent(state, startLine)) return false
  const firstStart = state.bMarks[startLine] + state.tShift[startLine]
  if (
    state.src.charCodeAt(firstStart) !== 0x5B
    || state.src.charCodeAt(firstStart + 1) !== 0x5E
  ) return false
  const firstEnd = state.eMarks[startLine]
  const firstMarker = scanNoteDefinitionMarker(state.src, firstStart, firstEnd)
  if (!firstMarker || !hasLocalLabelPrefix(firstMarker.label)) return false
  if (!hasImmediateTableTarget(state)) return false
  if (silent) return true

  const definitions = [
    createDefinition(state.src, firstStart, firstEnd, startLine, firstMarker),
  ]
  let nextLine = startLine + 1
  while (nextLine < endLine) {
    if (!isDefinitionIndent(state, nextLine)) break
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
    if (
      state.src.charCodeAt(lineStart) !== 0x5B
      || state.src.charCodeAt(lineStart + 1) !== 0x5E
    ) break
    const lineEnd = state.eMarks[nextLine]
    const marker = scanNoteDefinitionMarker(state.src, lineStart, lineEnd)
    if (!marker || !hasLocalLabelPrefix(marker.label)) break
    definitions.push(createDefinition(state.src, lineStart, lineEnd, nextLine, marker))
    nextLine++
  }

  const group = {
    definitions,
    map: [startLine, nextLine],
    resolved: false,
    invalid: false,
  }
  const envState = getEnvState(state.env || (state.env = {}), true)
  envState.groups.push(group)
  for (let i = 0; i < definitions.length; i++) {
    envState.definitionLabels.add(definitions[i].label)
  }

  const open = state.push('figure_referenced_notes_open', 'aside', 1)
  open.block = true
  open.map = [startLine, nextLine]
  open.meta = { group }

  for (let i = 0; i < definitions.length; i++) {
    const definition = definitions[i]
    const defOpen = state.push('figure_referenced_note_open', 'li', 1)
    defOpen.block = true
    defOpen.map = [definition.map[0], definition.map[1]]
    defOpen.meta = { group, definition }
    const inline = state.push('inline', '', 0)
    inline.content = definition.content
    inline.map = [definition.map[0], definition.map[1]]
    inline.children = []
    const defClose = state.push('figure_referenced_note_close', 'li', -1)
    defClose.block = true
    defClose.meta = { group, definition }
  }

  const close = state.push('figure_referenced_notes_close', 'aside', -1)
  close.block = true
  close.meta = { group }
  group.closeToken = close
  state.line = nextLine
  return true
}

const referencedNoteInline = (state, silent) => {
  const runtime = getEnvState(state.env)
  if (!runtime || runtime.definitionLabels.size === 0) return false
  if (state.src.charCodeAt(state.pos) !== 0x5B) return false
  const marker = scanNoteReferenceMarker(state.src, state.pos, state.posMax)
  if (!marker || !runtime.definitionLabels.has(marker.label)) return false
  if (silent) return true

  const token = state.push('figure_local_note_ref', '', 0)
  token.content = state.src.slice(marker.start, marker.end)
  token.meta = {
    label: marker.label,
    resolved: false,
    scopeSeen: false,
  }
  state.pos = marker.end
  return true
}

const toWellFormed = (value) => {
  const source = String(value ?? '')
  if (typeof source.toWellFormed === 'function') return source.toWellFormed()
  let result = ''
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i)
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = source.charCodeAt(i + 1)
      if (next >= 0xDC00 && next <= 0xDFFF) {
        result += source[i] + source[i + 1]
        i++
      } else {
        result += '\uFFFD'
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      result += '\uFFFD'
    } else {
      result += source[i]
    }
  }
  return result
}

const escapeIdPart = (value) => encodeURIComponent(toWellFormed(value))

const formatAlphaSuffix = (index) => {
  let value = index + 1
  let result = ''
  while (value > 0) {
    value--
    result = String.fromCharCode(97 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

const registerBeforeWithFallback = (ruler, preferred, fallback, name, handler, options) => {
  const rules = Array.isArray(ruler?.__rules__) ? ruler.__rules__ : []
  if (rules.some((rule) => rule?.name === preferred)) {
    ruler.before(preferred, name, handler, options)
    return
  }
  if (fallback && rules.some((rule) => rule?.name === fallback)) {
    ruler.before(fallback, name, handler, options)
    return
  }
  ruler.push(name, handler, options)
}

const renderReferencedNotesClose = (tokens, idx) => (
  tokens[idx].meta.group.resolved ? '</ol>\n</aside>\n' : ''
)

const renderReferencedNoteOpen = (tokens, idx, escapeHtml, labelClass) => {
  const { group, definition } = tokens[idx].meta
  if (!group.resolved) return `<p>${escapeHtml(definition.marker)}`
  return `<li id="${escapeHtml(definition.id)}"><p><span class="${labelClass}">[${definition.number}]</span> `
}

const renderReferencedNoteClose = (tokens, idx, escapeHtml, backlinkClass) => {
  const { group, definition } = tokens[idx].meta
  if (!group.resolved) return '</p>\n'
  let result = ''
  for (let i = 0; i < definition.refs.length; i++) {
    const ref = definition.refs[i]
    result += ` <a href="#${escapeHtml(ref.id)}" class="${backlinkClass}" role="doc-backlink">↩${definition.refs.length > 1 ? formatAlphaSuffix(i) : ''}</a>`
  }
  return `${result}</p></li>\n`
}

const renderLocalNoteRef = (tokens, idx, escapeHtml, refClass) => {
  const meta = tokens[idx].meta
  if (!meta?.resolved) return escapeHtml(tokens[idx].content)
  return `<a href="#${escapeHtml(meta.targetId)}" id="${escapeHtml(meta.id)}" class="${refClass}" role="doc-noteref">[${meta.number}]</a>`
}

export const registerReferencedLocalNotes = (md, catalog, classPrefix) => {
  const escapeHtml = md.utils.escapeHtml
  const tableNotesClass = escapeHtml(`${classPrefix}local-notes ${classPrefix}table-notes`)
  const labelClass = escapeHtml(`${classPrefix}local-note-label`)
  const backlinkClass = escapeHtml(`${classPrefix}local-note-backlink`)
  const refClass = escapeHtml(`${classPrefix}local-note-ref`)
  md.core.ruler.before('block', 'figure_notes_reset', (state) => {
    const env = state.env || (state.env = {})
    env[ENV_STATE_KEY] = null
    resetFigureNotesDiagnostics(env)
  })
  registerBeforeWithFallback(
    md.block.ruler,
    'table',
    'code',
    'figure_referenced_notes',
    referencedGroupBlock,
    { alt: ['paragraph', 'reference'] },
  )
  registerBeforeWithFallback(
    md.inline.ruler,
    'link',
    'emphasis',
    'figure_local_note_ref',
    referencedNoteInline,
  )

  md.renderer.rules.figure_referenced_notes_open = (tokens, idx, options, env) => {
    if (!tokens[idx].meta.group.resolved) return ''
    const ariaLabel = resolveReferencedTableNotesLabel(catalog, env)
    return `<aside class="${tableNotesClass}" aria-label="${escapeHtml(ariaLabel)}">\n<ol>\n`
  }
  md.renderer.rules.figure_referenced_notes_close = renderReferencedNotesClose
  md.renderer.rules.figure_referenced_note_open = (tokens, idx) => (
    renderReferencedNoteOpen(tokens, idx, escapeHtml, labelClass)
  )
  md.renderer.rules.figure_referenced_note_close = (tokens, idx) => (
    renderReferencedNoteClose(tokens, idx, escapeHtml, backlinkClass)
  )
  md.renderer.rules.figure_local_note_ref = (tokens, idx) => (
    renderLocalNoteRef(tokens, idx, escapeHtml, refClass)
  )
}

const collectDefinitionMap = (group, env) => {
  const definitions = new Map()
  for (let i = 0; i < group.definitions.length; i++) {
    const definition = group.definitions[i]
    if (definitions.has(definition.label)) {
      group.invalid = true
      pushFigureNotesDiagnostic(env, 'duplicate-definition', group.map, { label: definition.label })
      continue
    }
    definitions.set(definition.label, definition)
  }
  return definitions
}

const resolveReferencesFromChildren = (
  children,
  definitions,
  env,
  group,
  docId,
  targetOrdinal,
) => {
  if (!Array.isArray(children)) return
  for (let ci = 0; ci < children.length; ci++) {
    const child = children[ci]
    if (child?.type !== 'figure_local_note_ref') continue
    child.meta.scopeSeen = true
    const definition = definitions.get(child.meta?.label)
    if (!definition) {
      pushFigureNotesDiagnostic(env, 'undefined-reference', group.map, {
        label: child.meta?.label || '',
      })
      continue
    }
    const occurrence = definition.refs.length + 1
    child.meta.resolved = true
    child.meta.number = definition.number
    child.meta.targetId = definition.id
    child.meta.id = `${docId}table-local-${targetOrdinal}-ref-${definition.number}-${occurrence}`
    definition.refs.push({ id: child.meta.id })
  }
}

const resolveTableReferences = (
  tokens,
  start,
  end,
  captionInlineToken,
  captionBeforeTarget,
  definitions,
  env,
  group,
  docId,
  targetOrdinal,
) => {
  if (captionBeforeTarget && captionInlineToken) {
    resolveReferencesFromChildren(
      captionInlineToken.children,
      definitions,
      env,
      group,
      docId,
      targetOrdinal,
    )
  }
  for (let i = start; i <= end; i++) {
    resolveReferencesFromChildren(
      tokens[i]?.children,
      definitions,
      env,
      group,
      docId,
      targetOrdinal,
    )
  }
  if (!captionBeforeTarget && captionInlineToken) {
    resolveReferencesFromChildren(
      captionInlineToken.children,
      definitions,
      env,
      group,
      docId,
      targetOrdinal,
    )
  }
}

export const prepareReferencedLocalNotes = (decision, env) => {
  if (!decision || decision.kind !== 'referenced-local-notes') return false
  const definitions = collectDefinitionMap(decision.group, env)
  if (decision.group.invalid) return false
  decision.definitions = definitions
  return true
}

export const analyzeReferencedLocalNotesAt = (tokens, index) => {
  const open = tokens[index]
  if (open?.type !== 'figure_referenced_notes_open') return null
  const group = open.meta?.group
  if (!group?.closeToken) return null
  const expectedEnd = index + 1 + (group.definitions.length * 3)
  const end = tokens[expectedEnd] === group.closeToken
    ? expectedEnd
    : tokens.indexOf(group.closeToken, index + 1)
  if (end < 0) return null
  return {
    kind: 'referenced-local-notes',
    start: index,
    end,
    group,
  }
}

export const resolveReferencedLocalNotes = (
  tokens,
  targetStart,
  targetEnd,
  decision,
  captionInlineToken,
  captionBeforeTarget,
  env,
  runtime,
) => {
  if (!decision || decision.kind !== 'referenced-local-notes') return false
  const group = decision.group
  const definitions = decision.definitions || collectDefinitionMap(group, env)
  if (group.invalid) return false
  runtime.targetOrdinal++
  const targetOrdinal = runtime.targetOrdinal
  if (runtime.docIdPrefix === undefined) {
    runtime.docIdPrefix = env?.docId ? `${escapeIdPart(env.docId)}-` : ''
  }
  const docId = runtime.docIdPrefix
  for (let i = 0; i < group.definitions.length; i++) {
    const definition = group.definitions[i]
    definition.number = i + 1
    definition.id = `${docId}table-local-${targetOrdinal}-note-${i + 1}`
    definition.refs.length = 0
  }
  resolveTableReferences(
    tokens,
    targetStart,
    targetEnd,
    captionInlineToken,
    captionBeforeTarget,
    definitions,
    env,
    group,
    docId,
    targetOrdinal,
  )
  for (let i = 0; i < group.definitions.length; i++) {
    const definition = group.definitions[i]
    if (definition.refs.length === 0) {
      pushFigureNotesDiagnostic(env, 'unreferenced-definition', group.map, {
        label: definition.label,
      })
    }
  }
  group.resolved = true
  return true
}

export const finalizeReferencedLocalNotes = (tokens, env) => {
  const runtime = getEnvState(env)
  if (!runtime) return
  for (let i = 0; i < runtime.groups.length; i++) {
    const group = runtime.groups[i]
    if (!group.resolved && !group.invalid) {
      group.invalid = true
      pushFigureNotesDiagnostic(env, 'target-not-found', group.map)
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    const children = tokens[i]?.children
    if (!Array.isArray(children)) continue
    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci]
      if (
        child?.type !== 'figure_local_note_ref'
        || child.meta?.resolved
        || child.meta?.scopeSeen
      ) continue
      child.meta.scopeSeen = true
      pushFigureNotesDiagnostic(env, 'scope-outside-reference', tokens[i].map, {
        label: child.meta?.label || '',
      })
    }
  }
}
