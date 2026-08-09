import en from './locales/en.js'
import ja from './locales/ja.js'

const LOCALES = Object.freeze({ en, ja })
const ANNOTATION_ROLES = Object.freeze(['source', 'credit', 'rights'])
const TARGET_TYPES = Object.freeze(['img', 'table'])

const foldAsciiCode = (code) => (
  code >= 0x41 && code <= 0x5A ? code + 0x20 : code
)

const isJointCode = (code) => (
  code === 0x2E // .
  || code === 0x3A // :
  || code === 0x3000 // ideographic space
  || code === 0x3002 // Japanese full stop
  || code === 0xFF0E // full-width full stop
  || code === 0xFF1A // full-width colon
)

const normalizeLanguage = (value) => {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase().replace(/_/g, '-')
  if (!normalized) return ''
  const dash = normalized.indexOf('-')
  return dash === -1 ? normalized : normalized.slice(0, dash)
}

const asciiFold = (value) => {
  let result = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    result += code >= 65 && code <= 90
      ? String.fromCharCode(code + 32)
      : value[i]
  }
  return result
}

const addEntry = (entries, ownerByKey, rawLabel, role, locale) => {
  const label = String(rawLabel)
  const folded = locale === 'en'
  const key = folded ? asciiFold(label) : label
  const previousRole = ownerByKey.get(key)
  if (previousRole && previousRole !== role) {
    throw new Error(`Figure note label "${label}" is assigned to both ${previousRole} and ${role}.`)
  }
  if (previousRole) return
  ownerByKey.set(key, role)
  entries.push(Object.freeze({ label, key, role, folded }))
}

const sortEntries = (entries) => entries.sort((a, b) => (
  b.label.length - a.label.length || a.label.localeCompare(b.label)
))

const bucketEntries = (entries) => {
  const buckets = new Map()
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const firstCode = entry.label.charCodeAt(0)
    const first = entry.folded ? foldAsciiCode(firstCode) : firstCode
    let bucket = buckets.get(first)
    if (!bucket) {
      bucket = []
      buckets.set(first, bucket)
    }
    bucket.push(entry)
  }
  for (const bucket of buckets.values()) Object.freeze(bucket)
  return buckets
}

const skipAsciiSpaces = (text, start) => {
  let index = start
  while (index < text.length) {
    const code = text.charCodeAt(index)
    if (code !== 0x20 && code !== 0x09) break
    index++
  }
  return index
}

const matchEntryAtStart = (text, buckets) => {
  if (!text) return null
  const firstCode = text.charCodeAt(0)
  const foldedFirstCode = foldAsciiCode(firstCode)
  const bucket = buckets.get(foldedFirstCode)
    || (foldedFirstCode === firstCode ? null : buckets.get(firstCode))
  if (!bucket) return null
  for (let i = 0; i < bucket.length; i++) {
    const entry = bucket[i]
    if (!entry.folded) {
      if (text.startsWith(entry.label)) return entry
      continue
    }
    if (text.length < entry.key.length) continue
    let matches = true
    for (let ci = 0; ci < entry.key.length; ci++) {
      if (foldAsciiCode(text.charCodeAt(ci)) !== entry.key.charCodeAt(ci)) {
        matches = false
        break
      }
    }
    if (matches) return entry
  }
  return null
}

const matchJointAndBody = (text, labelEnd) => {
  if (labelEnd >= text.length) return -1
  const code = text.charCodeAt(labelEnd)
  if (!isJointCode(code)) return -1
  const bodyStart = skipAsciiSpaces(text, labelEnd + 1)
  return bodyStart >= text.length ? -1 : bodyStart
}

export const createNotesCatalog = (languages) => {
  const requested = Array.isArray(languages) ? languages : [languages]
  const seenLanguages = new Set()
  const availableLanguages = []
  const referencedTableNotesLabels = Object.create(null)
  const annotationEntries = []
  const annotationOwnerByKey = new Map()
  const localEntriesByTarget = { img: [], table: [] }
  const localOwnerByTarget = { img: new Map(), table: new Map() }

  for (let i = 0; i < requested.length; i++) {
    const locale = normalizeLanguage(requested[i])
    if (!locale || seenLanguages.has(locale) || !LOCALES[locale]) continue
    seenLanguages.add(locale)
    availableLanguages.push(locale)
    const catalog = LOCALES[locale]
    referencedTableNotesLabels[locale] = catalog.referencedTableNotesLabel
    for (let ri = 0; ri < ANNOTATION_ROLES.length; ri++) {
      const role = ANNOTATION_ROLES[ri]
      const labels = catalog.annotations[role]
      for (let li = 0; li < labels.length; li++) {
        addEntry(annotationEntries, annotationOwnerByKey, labels[li], role, locale)
      }
    }
    for (let ti = 0; ti < TARGET_TYPES.length; ti++) {
      const target = TARGET_TYPES[ti]
      const labels = catalog.localNotes[target]
      for (let li = 0; li < labels.length; li++) {
        addEntry(localEntriesByTarget[target], localOwnerByTarget[target], labels[li], target, locale)
      }
    }
  }

  sortEntries(annotationEntries)
  sortEntries(localEntriesByTarget.img)
  sortEntries(localEntriesByTarget.table)

  return Object.freeze({
    languages: Object.freeze(availableLanguages),
    referencedTableNotesLabels: Object.freeze(referencedTableNotesLabels),
    annotationBuckets: bucketEntries(annotationEntries),
    localNoteBuckets: Object.freeze({
      img: bucketEntries(localEntriesByTarget.img),
      table: bucketEntries(localEntriesByTarget.table),
    }),
  })
}

const findReferencedTableNotesLabel = (value, labels) => {
  const locale = normalizeLanguage(value)
  return locale && labels[locale] ? labels[locale] : ''
}

export const resolveReferencedTableNotesLabel = (catalog, env) => {
  const labels = catalog?.referencedTableNotesLabels
  if (!labels) return 'Table notes'

  let label = findReferencedTableNotesLabel(env?.locale, labels)
  if (label) return label

  const preferred = env?.preferredLocales
  if (typeof preferred === 'string') {
    label = findReferencedTableNotesLabel(preferred, labels)
    if (label) return label
  } else if (Array.isArray(preferred)) {
    for (let i = 0; i < preferred.length; i++) {
      label = findReferencedTableNotesLabel(preferred[i], labels)
      if (label) return label
    }
  }

  label = findReferencedTableNotesLabel(env?.lang, labels)
    || findReferencedTableNotesLabel(env?.language, labels)
  if (label) return label

  const fallbackLanguage = catalog.languages?.[0]
  return (fallbackLanguage && labels[fallbackLanguage]) || 'Table notes'
}

export const matchAnnotationLabel = (text, catalog) => {
  if (typeof text !== 'string' || !catalog) return null
  if (text[0] === '©') {
    if (text.length === 1) return null
    const next = text.charCodeAt(1)
    if (next !== 0x20 && next !== 0x09 && (next < 48 || next > 57)) return null
    const bodyStart = skipAsciiSpaces(text, 1)
    if (bodyStart >= text.length) return null
    return {
      role: 'rights',
      bodyStart,
    }
  }
  const entry = matchEntryAtStart(text, catalog.annotationBuckets)
  if (!entry) return null
  const bodyStart = matchJointAndBody(text, entry.label.length)
  if (bodyStart < 0) return null
  return {
    role: entry.role,
    bodyStart,
  }
}

export const matchLocalNoteLabel = (text, targetType, catalog) => {
  if (typeof text !== 'string' || !catalog) return null
  const buckets = catalog.localNoteBuckets[targetType]
  if (!buckets) return null
  const entry = matchEntryAtStart(text, buckets)
  if (!entry) return null
  let labelEnd = entry.label.length
  let suffixStart = labelEnd
  const spacedSuffixStart = skipAsciiSpaces(text, labelEnd)
  const spacedSuffixCode = text.charCodeAt(spacedSuffixStart)
  if (
    spacedSuffixStart > labelEnd
    && (
      (spacedSuffixCode >= 48 && spacedSuffixCode <= 57)
      || (spacedSuffixCode >= 65 && spacedSuffixCode <= 90)
    )
  ) {
    suffixStart = spacedSuffixStart
    labelEnd = spacedSuffixStart
  }
  const firstSuffixCode = text.charCodeAt(suffixStart)
  if (firstSuffixCode >= 48 && firstSuffixCode <= 57) {
    while (labelEnd < text.length) {
      const code = text.charCodeAt(labelEnd)
      if (code < 48 || code > 57) break
      labelEnd++
    }
  } else if (firstSuffixCode >= 65 && firstSuffixCode <= 90) {
    while (labelEnd < text.length) {
      const code = text.charCodeAt(labelEnd)
      if (code < 65 || code > 90) break
      labelEnd++
    }
  }
  const bodyStart = matchJointAndBody(text, labelEnd)
  if (bodyStart < 0) return null
  return {
    baseLabel: text.slice(0, entry.label.length),
    bodyStart,
  }
}
