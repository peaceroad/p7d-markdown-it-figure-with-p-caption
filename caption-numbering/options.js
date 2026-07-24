const policyStateByPolicy = new WeakMap()

export const normalizeNumberingSeparator = (value, optionName) => {
  if (value !== '-' && value !== '.') {
    throw new TypeError(`${optionName} must be "-" or ".".`)
  }
  return value
}

const normalizeScopeSources = (value) => {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new TypeError('autoLabelNumberPolicy.scope.sources must be an array.')
  }
  const sources = []
  for (let index = 0; index < value.length; index++) {
    const source = value[index]
    if (source !== 'frontmatter' && source !== 'heading') {
      throw new TypeError('autoLabelNumberPolicy.scope.sources entries must be "frontmatter" or "heading".')
    }
    if (sources.indexOf(source) === -1) sources.push(source)
  }
  return sources
}

const normalizeHeadingLevels = (value) => {
  const source = value === undefined ? [1] : value
  if (!Array.isArray(source)) {
    throw new TypeError('autoLabelNumberPolicy.scope.headingLevels must be an array.')
  }
  const levels = []
  for (let index = 0; index < source.length; index++) {
    const level = source[index]
    if (!Number.isInteger(level) || level < 1 || level > 6) {
      throw new RangeError('autoLabelNumberPolicy.scope.headingLevels entries must be integers from 1 through 6.')
    }
    if (levels.indexOf(level) === -1) levels.push(level)
  }
  return levels
}

export const normalizeNumberingScopeMode = (value, optionName) => {
  if (value !== 'auto' && value !== 'document') {
    throw new TypeError(`${optionName} must be "auto" or "document".`)
  }
  return value
}

export const normalizeFigureCaptionNumberingPolicy = (value) => {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('autoLabelNumberPolicy must be an object or null.')
  }
  const separator = normalizeNumberingSeparator(
    value.separator === undefined ? '.' : value.separator,
    'autoLabelNumberPolicy.separator',
  )
  let scope = null
  if (value.scope !== undefined && value.scope !== null) {
    if (typeof value.scope !== 'object' || Array.isArray(value.scope)) {
      throw new TypeError('autoLabelNumberPolicy.scope must be an object or null.')
    }
    const sources = normalizeScopeSources(value.scope.sources)
    const headingLevels = normalizeHeadingLevels(value.scope.headingLevels)
    const repeatScope = value.scope.repeatScope === undefined ? 'continue' : value.scope.repeatScope
    if (repeatScope !== 'continue' && repeatScope !== 'reset') {
      throw new TypeError('autoLabelNumberPolicy.scope.repeatScope must be "continue" or "reset".')
    }
    const resolveFrontmatterTitle = value.scope.resolveFrontmatterTitle
    if (resolveFrontmatterTitle !== undefined && resolveFrontmatterTitle !== null && typeof resolveFrontmatterTitle !== 'function') {
      throw new TypeError('autoLabelNumberPolicy.scope.resolveFrontmatterTitle must be a function or null.')
    }
    scope = Object.freeze({
      headingLevelLookup: Object.freeze(headingLevels.reduce((lookup, level) => {
        lookup[level] = true
        return lookup
      }, {})),
      repeatScope,
      resolveFrontmatterTitle: resolveFrontmatterTitle || null,
      usesFrontmatter: sources.indexOf('frontmatter') !== -1,
      usesHeading: sources.indexOf('heading') !== -1,
    })
  }
  const state = Object.freeze({ separator, scope })
  const policy = Object.freeze({})
  policyStateByPolicy.set(policy, state)
  return policy
}

export const getFigureCaptionNumberingPolicyState = (policy) => {
  const state = policy && policyStateByPolicy.get(policy)
  if (!state) {
    throw new TypeError('numberingPolicy must be created by normalizeFigureCaptionNumberingPolicy().')
  }
  return state
}
