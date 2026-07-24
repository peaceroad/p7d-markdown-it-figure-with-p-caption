import {
  getMarkRegStateForLanguages,
  isCaptionLabelForMark,
} from 'p7d-markdown-it-p-captions'

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

const validateCaptionDecision = (captionDecision) => {
  if (!captionDecision || typeof captionDecision !== 'object' || Array.isArray(captionDecision)) {
    throw new TypeError('captionDecision must be an object returned by p-captions.')
  }
  if (typeof captionDecision.mark !== 'string' || captionDecision.mark.length === 0) {
    throw new TypeError('captionDecision.mark must be a non-empty canonical mark.')
  }
  if (captionDecision.mark === 'code' || captionDecision.mark === 'samp') {
    throw new TypeError('captionDecision.mark must use the canonical pre-code or pre-samp mark.')
  }
}

export const createFigureCaptionCounterKeyResolverFromMarkRegState = (markRegState) => {
  const resolveCounterKey = (captionDecision) => {
    const mark = captionDecision.mark
    if (mark === 'img') return 'figure'
    if (mark === 'pre-code') return 'listing'
    if (mark === 'pre-samp') {
      const labelText = captionDecision.labelText
      if (isCaptionLabelForMark(labelText, 'img', markRegState)) return 'figure'
      if (isCaptionLabelForMark(labelText, 'pre-code', markRegState)) return 'listing'
      return 'samp'
    }
    return mark
  }
  return Object.freeze(resolveCounterKey)
}

export const createFigureCaptionCounterKeyResolver = (options) => {
  if (options !== undefined && (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  )) {
    throw new TypeError('counter-key resolver options must be an object or undefined.')
  }
  const normalizedOptions = options || {}
  const keys = Object.keys(normalizedOptions)
  for (let index = 0; index < keys.length; index++) {
    if (keys[index] !== 'languages') {
      throw new TypeError(`counter-key resolver option "${keys[index]}" is not supported.`)
    }
  }
  const languages = hasOwn(normalizedOptions, 'languages')
    ? normalizedOptions.languages
    : undefined
  const resolveCounterKey = createFigureCaptionCounterKeyResolverFromMarkRegState(
    getMarkRegStateForLanguages(languages),
  )
  const resolveValidatedCounterKey = (captionDecision) => {
    validateCaptionDecision(captionDecision)
    return resolveCounterKey(captionDecision)
  }
  return Object.freeze(resolveValidatedCounterKey)
}
