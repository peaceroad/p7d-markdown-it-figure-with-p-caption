import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import markdownIt from 'markdown-it'
import mditAttrs from 'markdown-it-attrs'
import mditRendererFence from '@peaceroad/markdown-it-renderer-fence'

import mdFigureWithPCaption from '../../index.js'

const thisFile = fileURLToPath(import.meta.url)
const rootDir = path.resolve(path.dirname(thisFile), '..')
const fixturePath = path.join(rootDir, 'examples-no-option.txt')

const normalize = (text) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

const loadMarkdownSections = (filePath) => {
  const content = normalize(fs.readFileSync(filePath, 'utf8'))
  const sections = content.split(/\n*\[Markdown\]\n/).slice(1)
  const markdowns = []
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    const split = section.split(/\n+\[HTML[^\]]*?\]\n/)
    if (!split[0]) continue
    const markdown = split[0].trim()
    if (markdown) markdowns.push(markdown)
  }
  return markdowns
}

const median = (values) => {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

const p95 = (values) => {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
  return sorted[idx]
}

const formatMs = (value) => value.toFixed(3) + ' ms'

const runRenderBench = (label, md, source, rounds = 30, warmup = 10) => {
  for (let i = 0; i < warmup; i++) md.render(source)
  const times = []
  for (let i = 0; i < rounds; i++) {
    const start = performance.now()
    md.render(source)
    times.push(performance.now() - start)
  }
  const result = {
    label,
    median: median(times),
    p95: p95(times),
  }
  console.log(
    `${label}: median=${formatMs(result.median)} p95=${formatMs(result.p95)} (rounds=${rounds})`,
  )
  return result
}

const getBlockquoteStats = (tokens) => {
  let openCount = 0
  let maxLevel = 0
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'blockquote_open') openCount++
    if (typeof token.level === 'number' && token.level > maxLevel) maxLevel = token.level
  }
  return { openCount, maxLevel }
}

const indentAsNestedBlockquote = (markdown, depth) => {
  const prefix = '> '.repeat(depth)
  return markdown
    .split('\n')
    .map((line) => (line ? prefix + line : prefix.trimEnd()))
    .join('\n')
}

const buildNestedFigureDocument = (depth) => {
  const leaf = 'Figure. Deep caption\n\n![deep](https://example.com/deep.png)'
  return indentAsNestedBlockquote(leaf, depth)
}

const runDepthProbe = (md, depths) => {
  const results = []
  console.log('\nDepth probe (nested blockquotes):')
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i]
    const doc = buildNestedFigureDocument(depth)
    const tokens = md.parse(doc, {})
    const stats = getBlockquoteStats(tokens)
    const start = performance.now()
    try {
      md.render(doc)
      const elapsed = performance.now() - start
      results.push({ depth, ok: true, elapsed, openCount: stats.openCount, maxLevel: stats.maxLevel })
      console.log(
        `depth=${depth}: ok (${formatMs(elapsed)}) parsed_opens=${stats.openCount} max_level=${stats.maxLevel}`,
      )
    } catch (error) {
      results.push({ depth, ok: false, error, openCount: stats.openCount, maxLevel: stats.maxLevel })
      const message = error && error.message ? error.message : String(error)
      console.log(
        `depth=${depth}: fail (${message}) parsed_opens=${stats.openCount} max_level=${stats.maxLevel}`,
      )
      break
    }
  }
  return results
}

const markdownSections = loadMarkdownSections(fixturePath)
const corpusSmall = markdownSections.slice(0, 8).join('\n\n')
const corpusFull = markdownSections.join('\n\n')

const baseMd = markdownIt({ html: true }).use(mditAttrs).use(mditRendererFence)
const pluginMd = markdownIt({ html: true })
  .use(mdFigureWithPCaption)
  .use(mditAttrs)
  .use(mditRendererFence)

console.log(`markdown-it maxNesting=${pluginMd.options.maxNesting}`)
console.log('=== Render benchmark ===')
runRenderBench('baseline/small', baseMd, corpusSmall)
runRenderBench('plugin/small', pluginMd, corpusSmall)
runRenderBench('baseline/full', baseMd, corpusFull)
runRenderBench('plugin/full', pluginMd, corpusFull)

runDepthProbe(pluginMd, [5, 10, 20, 40, 80, 120, 180, 260, 360, 500, 700, 900])
