const NOTES_OPTION_KEYS = new Set([
  'enabled',
  'annotations',
  'unreferencedLocalNotes',
  'referencedLocalNotes',
])

const DISABLED_NOTES_OPTIONS = Object.freeze({
  enabled: false,
  annotations: false,
  unreferencedLocalNotes: false,
  referencedLocalNotes: false,
})

const requireBoolean = (value, path) => {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be a boolean.`)
  }
  return value
}

const readBoolean = (options, key, fallback) => (
  Object.prototype.hasOwnProperty.call(options, key)
    ? requireBoolean(options[key], `notes.${key}`)
    : fallback
)

export const normalizeNotesOptions = (value) => {
  if (value === undefined) return DISABLED_NOTES_OPTIONS
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('notes must be an object.')
  }

  const keys = Object.keys(value)
  for (let i = 0; i < keys.length; i++) {
    if (!NOTES_OPTION_KEYS.has(keys[i])) {
      throw new TypeError(`notes.${keys[i]} is not supported.`)
    }
  }

  const enabled = readBoolean(value, 'enabled', false)
  const annotations = readBoolean(value, 'annotations', true)
  const unreferencedLocalNotes = readBoolean(value, 'unreferencedLocalNotes', true)
  const referencedLocalNotes = readBoolean(value, 'referencedLocalNotes', true)

  if (!enabled || (!annotations && !unreferencedLocalNotes && !referencedLocalNotes)) {
    return DISABLED_NOTES_OPTIONS
  }

  return Object.freeze({
    enabled: true,
    annotations,
    unreferencedLocalNotes,
    referencedLocalNotes,
  })
}
