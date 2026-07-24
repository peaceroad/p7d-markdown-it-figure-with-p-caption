import { markAfterNum } from 'p7d-markdown-it-p-captions'

const captionNumberReg = new RegExp('^(?:' + markAfterNum + ')$')
const numberingContexts = new WeakSet()

const parseAsciiPositiveIntegerOrNull = (text) => {
  if (typeof text !== 'string' || text.length === 0) return null
  let value = 0
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code < 0x30 || code > 0x39) return null
    value = value * 10 + code - 0x30
  }
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

const freezeNumberingContext = (context) => {
  const frozen = Object.freeze(context)
  numberingContexts.add(frozen)
  return frozen
}

export const createUnscopedNumberingContext = (separator) => freezeNumberingContext({
  scoped: false,
  scopeKey: null,
  sequenceKey: null,
  displayPrefix: '',
  separator,
})

export const createScopedNumberingContext = (
  scopeKey,
  sequenceKey,
  displayPrefix,
  separator,
) => freezeNumberingContext({
  scoped: true,
  scopeKey,
  sequenceKey,
  displayPrefix,
  separator,
})

export const getFigureCaptionNumberingContext = (value) => {
  if (!value || !numberingContexts.has(value)) {
    throw new TypeError('numberingContext must be created by the figure caption-numbering API.')
  }
  return value
}

export const getCaptionNumberingContext = (captionContext) => {
  return getFigureCaptionNumberingContext(captionContext && captionContext.numbering)
}

export const parseFigureCaptionExplicitNumberUnchecked = (number, numbering) => {
  if (!numbering.scoped) return parseAsciiPositiveIntegerOrNull(number)
  const prefix = numbering.displayPrefix + numbering.separator
  if (!number.startsWith(prefix)) return null
  return parseAsciiPositiveIntegerOrNull(number.slice(prefix.length))
}

export const formatFigureCaptionGeneratedNumberUnchecked = (sequence, numbering) => {
  return numbering.scoped
    ? numbering.displayPrefix + numbering.separator + sequence
    : String(sequence)
}

export const parseFigureCaptionExplicitNumber = (number, context) => {
  if (typeof number !== 'string') {
    throw new TypeError('number must be a string.')
  }
  return parseFigureCaptionExplicitNumberUnchecked(
    number,
    getFigureCaptionNumberingContext(context),
  )
}

export const formatFigureCaptionGeneratedNumber = (sequence, context) => {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new RangeError('sequence must be a positive safe integer.')
  }
  return formatFigureCaptionGeneratedNumberUnchecked(
    sequence,
    getFigureCaptionNumberingContext(context),
  )
}

const numberCodec = Object.freeze({
  parseExplicit(number, context) {
    return parseFigureCaptionExplicitNumber(number, context)
  },
  format(sequence, context) {
    const number = formatFigureCaptionGeneratedNumber(sequence, context)
    if (!captionNumberReg.test(number)) {
      throw new RangeError('The generated figure caption number exceeds the p-captions number grammar.')
    }
    return number
  },
})

export const createFigureCaptionNumberCodec = () => numberCodec
