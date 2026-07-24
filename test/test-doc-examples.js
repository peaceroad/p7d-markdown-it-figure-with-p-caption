import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import mdit from 'markdown-it'
import mditRendererFence from '@peaceroad/markdown-it-renderer-fence'

import mditFigureWithPCaption from '../index.js'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDirectory = path.join(repositoryRoot, 'docs')
const documentationFiles = [
  path.join(repositoryRoot, 'README.md'),
  ...fs.readdirSync(docsDirectory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => path.join(docsDirectory, entry.name))
    .sort(),
]

const createMarkdownIt = (options = {}, plugins = []) => {
  const md = mdit({ html: true }).use(mditFigureWithPCaption, options)
  for (let index = 0; index < plugins.length; index++) {
    md.use(plugins[index])
  }
  return md
}

const setups = Object.freeze({
  default: () => createMarkdownIt(),
  'renderer-fence': () => createMarkdownIt({}, [mditRendererFence]),
  'custom-style': () => createMarkdownIt({ classPrefix: 'custom' }),
  'auto-alt': () => createMarkdownIt({ autoAltCaption: true }),
  'auto-title': () => createMarkdownIt({ autoTitleCaption: true }),
  'role-doc-example': () => createMarkdownIt(
    { roleDocExample: true },
    [mditRendererFence],
  ),
  'captionless-image': () => createMarkdownIt({
    imageOnlyParagraphWithoutCaption: true,
  }),
  'captionless-video': () => createMarkdownIt({
    videoWithoutCaption: true,
  }),
  'captionless-iframe': () => createMarkdownIt({
    iframeWithoutCaption: true,
  }),
  'captionless-social': () => createMarkdownIt({
    iframeTypeBlockquoteWithoutCaption: true,
  }),
  'social-class': () => createMarkdownIt({
    figureClassThatWrapsIframeTypeBlockquote: 'f-social',
  }),
  'all-iframe-class': () => createMarkdownIt({
    allIframeTypeFigureClassName: 'f-embed',
  }),
  'caption-markers': () => createMarkdownIt({
    labelPrefixMarker: ['▼', '▲'],
    allowLabelPrefixMarkerWithoutLabel: true,
  }),
  numbered: () => createMarkdownIt({
    autoLabelNumber: true,
  }),
})

const normalizeLineEndings = value => value.replace(/\r\n?/g, '\n')
const normalizeTerminalNewline = value => (
  value.endsWith('\n') ? value : value + '\n'
)

const parseTestInfo = (rawInfo, file, lineNumber) => {
  const info = rawInfo.trim()
  if (!info.includes('{test')) return null
  const match = info.match(/^(md|markdown|html)\s+\{test(?:\s+([^}]*))?\}$/)
  if (!match) {
    throw new SyntaxError(`${file}:${lineNumber}: invalid documentation test fence metadata`)
  }
  const attributes = Object.create(null)
  let source = (match[2] || '').trim()
  while (source) {
    const attribute = source.match(/^([A-Za-z][A-Za-z0-9-]*)="([^"]*)"(?:\s+|$)/)
    if (!attribute) {
      throw new SyntaxError(`${file}:${lineNumber}: invalid documentation test attribute`)
    }
    const name = attribute[1]
    if (name !== 'id' && name !== 'setup') {
      throw new SyntaxError(`${file}:${lineNumber}: unsupported documentation test attribute "${name}"`)
    }
    if (Object.prototype.hasOwnProperty.call(attributes, name)) {
      throw new SyntaxError(`${file}:${lineNumber}: duplicate documentation test attribute "${name}"`)
    }
    attributes[name] = attribute[2]
    source = source.slice(attribute[0].length).trimStart()
  }
  if (!attributes.id) {
    throw new SyntaxError(`${file}:${lineNumber}: documentation test fence requires a non-empty id`)
  }
  if (match[1] === 'html' && attributes.setup) {
    throw new SyntaxError(`${file}:${lineNumber}: setup belongs on the Markdown fence only`)
  }
  return {
    id: attributes.id,
    language: match[1] === 'html' ? 'html' : 'md',
    setup: attributes.setup || 'default',
  }
}

const isClosingFence = (line, marker) => {
  const trimmed = line.trim()
  if (trimmed.length < marker.length) return false
  for (let index = 0; index < trimmed.length; index++) {
    if (trimmed[index] !== marker[0]) return false
  }
  return true
}

const collectTestFences = (absoluteFile) => {
  const relativeFile = path.relative(repositoryRoot, absoluteFile).replaceAll('\\', '/')
  const lines = normalizeLineEndings(fs.readFileSync(absoluteFile, 'utf8')).split('\n')
  const fences = []
  let active = null
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (active) {
      if (isClosingFence(line, active.marker)) {
        if (active.testInfo) {
          fences.push({
            ...active.testInfo,
            content: active.content.join('\n'),
            file: relativeFile,
            line: active.line,
          })
        }
        active = null
      } else {
        active.content.push(line)
      }
      continue
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/)
    if (!opening) continue
    active = {
      marker: opening[1],
      testInfo: parseTestInfo(opening[2], relativeFile, index + 1),
      content: [],
      line: index + 1,
    }
  }
  if (active) {
    throw new SyntaxError(`${relativeFile}:${active.line}: unclosed fenced code block`)
  }
  return fences
}

const pairTestFences = () => {
  const pairs = new Map()
  for (let fileIndex = 0; fileIndex < documentationFiles.length; fileIndex++) {
    const fences = collectTestFences(documentationFiles[fileIndex])
    for (let fenceIndex = 0; fenceIndex < fences.length; fenceIndex++) {
      const fence = fences[fenceIndex]
      let pair = pairs.get(fence.id)
      if (!pair) {
        pair = { id: fence.id, md: null, html: null }
        pairs.set(fence.id, pair)
      }
      if (pair[fence.language]) {
        throw new Error(
          `${fence.file}:${fence.line}: duplicate ${fence.language} fence for documentation test "${fence.id}"`,
        )
      }
      pair[fence.language] = fence
    }
  }
  for (const pair of pairs.values()) {
    if (!pair.md || !pair.html) {
      const fence = pair.md || pair.html
      throw new Error(
        `${fence.file}:${fence.line}: documentation test "${pair.id}" requires one md and one html fence`,
      )
    }
    if (pair.md.file !== pair.html.file) {
      throw new Error(
        `Documentation test "${pair.id}" must keep its md and html fences in the same file`,
      )
    }
    if (!Object.prototype.hasOwnProperty.call(setups, pair.md.setup)) {
      throw new Error(
        `${pair.md.file}:${pair.md.line}: unknown documentation test setup "${pair.md.setup}"`,
      )
    }
  }
  return pairs
}

console.log('=== Documentation example tests ===')

let failed = false
const pairs = pairTestFences()
assert.ok(pairs.size > 0, 'At least one documentation test pair is required.')
for (const pair of pairs.values()) {
  console.log(`Test: ${pair.id}`)
  try {
    const actual = setups[pair.md.setup]().render(pair.md.content)
    assert.equal(
      normalizeTerminalNewline(actual),
      normalizeTerminalNewline(pair.html.content),
      `${pair.md.file}:${pair.md.line} does not match ${pair.html.file}:${pair.html.line}`,
    )
  } catch (error) {
    failed = true
    console.error(`Failed: ${pair.id}`)
    console.error(error)
  }
}

if (failed) {
  process.exitCode = 1
} else {
  console.log(`Passed ${pairs.size} documentation example tests.`)
}
