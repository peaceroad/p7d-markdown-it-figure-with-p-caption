import assert from 'node:assert/strict'
import fs from 'node:fs'
import markdownIt from 'markdown-it'

import figure from '../index.js'
import { detectHtmlFigureCandidate } from '../embeds/detect.js'

const createMd = (options = {}, html = true) => markdownIt({ html }).use(figure, {
  keepEmbedScriptsInPlace: true,
  ...options,
})
const captionlessOptions = { iframeTypeBlockquoteWithoutCaption: true, videoWithoutCaption: true }
const baseline = markdownIt({ html: true })
const defaultMd = createMd()
const captionlessMd = createMd(captionlessOptions)
const collectingMd = createMd({ ...captionlessOptions, keepEmbedScriptsInPlace: false })
const script = '<script async src="https://platform.x.com/dummy-widgets.js" charset="utf-8"></script>'
// Preserve provider domains and structural attributes, with dummy payloads,
// IDs, and resource paths. These fixtures never fetch external resources.
const fixture = fs.readFileSync(new URL('./examples-embeds.txt', import.meta.url), 'utf8')
  .replace(/\r\n?/g, '\n')
const examples = fixture.split('[Markdown]\n').slice(1).map(section => {
  const pair = section.split('\n[HTML]\n')
  assert.equal(pair.length, 2)
  return { source: pair[0].trim(), expected: pair[1].trim() + '\n' }
})
assert.equal(examples.length, 6)

console.log('=== Embed tests ===')

for (const { source, expected } of examples) {
  const isVideo = source.startsWith('<iframe')
  const mark = isVideo ? 'video' : 'img'
  const label = isVideo ? 'Video' : 'Figure'
  assert.equal(captionlessMd.render(source), expected)
  assert.equal(
    markdownIt({ html: true, linkify: true, typographer: true }).use(figure, {
      ...captionlessOptions,
      keepEmbedScriptsInPlace: true,
    }).render(source),
    expected,
  )
  // Reassembly also preserves provider HTML when captionless wrapping is off.
  assert.equal(defaultMd.render(source), source + '\n')
  const caption = `<figcaption><span class="f-${mark}-label">${label}<span class="f-${mark}-label-joint">.</span></span> Dummy embed.</figcaption>\n`
  assert.equal(
    defaultMd.render(`${label}. Dummy embed.\n\n` + source),
    expected.replace(`<figure class="f-${mark}">\n`, `<figure class="f-${mark}">\n` + caption),
  )
  assert.equal(
    defaultMd.render(source + `\n\n${label}. Dummy embed.`),
    expected.replace('</figure>\n', caption + '</figure>\n'),
  )
  assert.equal(
    captionlessMd.render(source + '\n\nFollowing paragraph.'),
    expected + '<p>Following paragraph.</p>\n',
  )
  assert.equal(captionlessMd.render(source.replaceAll('\n', '\r\n')), expected)

  const disabledBaseline = markdownIt({ html: false }).render(source)
  assert.equal(createMd(captionlessOptions, false).render(source), disabledBaseline)

  const md = createMd(captionlessOptions)
  let sourceTokens
  let originalToken
  md.core.ruler.before('figure_with_caption', 'capture_embed_tokens', state => {
    sourceTokens = state.tokens
    originalToken = state.tokens[0]
  })
  const tokens = md.parse(source, {})
  assert.equal(tokens, sourceTokens)
  assert.equal(tokens.filter(token => token.type === 'html_block').length, 1)
  assert.equal(tokens.find(token => token.type === 'html_block'), originalToken)
  assert.equal(originalToken.content, source + '\n')
  for (const type of ['figure_open', 'figure_close']) {
    const token = tokens.find(token => token.type === type)
    assert.deepEqual(token.map, [0, source.split('\n').length])
    assert.equal(token.block, true)
    assert.equal(token.level, 0)
  }

  if (source.includes('\n\n')) {
    const sourceWithExtraParagraph = source.replace('\n\n', '\n\nDummy middle paragraph with **literal Markdown**.\n\n')
    assert.equal(
      captionlessMd.render(sourceWithExtraParagraph),
      expected.replace('\n\n', '\n\nDummy middle paragraph with **literal Markdown**.\n\n'),
    )
    for (const blankLines of [1, 2, 4]) {
      const gap = '\n'.repeat(blankLines + 1)
      const spacedSource = source.replaceAll('\n\n', gap)
      assert.equal(captionlessMd.render(spacedSource), expected.replaceAll('\n\n', gap))
      assert.equal(defaultMd.render(spacedSource), spacedSource + '\n')
    }
  }
  const detectionTokens = baseline.parse(source, {})
  const snapshot = JSON.stringify(detectionTokens)
  const detection = detectHtmlFigureCandidate(detectionTokens, detectionTokens[0], 0, {
    iframeTypeBlockquote: true,
    video: true,
  }, source.length)
  assert.equal(detection.en, detectionTokens.length - 1)
  assert.equal(detection.isIframeTypeBlockquote, !isVideo)
  assert.equal(detection.isVideoIframe, isVideo)
  assert.equal(JSON.stringify(detectionTokens), snapshot, 'Detection must not mutate tokens')
}

// Both script hosts, class-token positions, quote forms, and tag case work
// through the same social-embed policy, including the existing class overrides.
for (const provider of ['twitter-tweet', 'twitter-video', 'bluesky-embed', 'mastodon-embed', 'text-post-media', 'instagram-media']) {
  for (const host of ['platform.x.com', 'platform.twitter.com']) {
    for (const classValue of [provider, `${provider} social-card`, `social-card ${provider}`]) {
      for (const quote of ['"', "'"]) {
        const source = `<BLOCKQUOTE class=${quote}${classValue}${quote} data-dummy="dummy-value"><p>Dummy post.</p></BLOCKQUOTE>\n${script.replace('platform.x.com', host)}`
        const wrapped = '<figure class="f-img">\n' + source + '\n</figure>\n'
        assert.equal(captionlessMd.render(source), wrapped)
        assert.equal(defaultMd.render(source), source + '\n')
        for (const options of [
          { ...captionlessOptions, figureClassThatWrapsIframeTypeBlockquote: 'f-social' },
          { ...captionlessOptions, allIframeTypeFigureClassName: 'f-embed' },
        ]) {
          const className = options.allIframeTypeFigureClassName || options.figureClassThatWrapsIframeTypeBlockquote
          assert.equal(createMd(options).render(source), wrapped.replace('f-img', className))
        }
      }
    }
  }
}

// Keep the existing inline-script fallback as well as the new separate block.
for (const { source, expected } of examples.filter(example => !example.source.startsWith('<iframe'))) {
  for (const separator of ['', ' ', '\n']) {
    assert.equal(
      captionlessMd.render(source.replace(/<\/blockquote>[ \t\n]*<script/, `</blockquote>${separator}<script`)),
      expected.replace(/<\/blockquote>[ \t\n]*<script/, `</blockquote>${separator}<script`),
    )
  }
  const caption = '<figcaption><span class="f-img-label">Figure<span class="f-img-label-joint">.</span></span> Dummy embed.</figcaption>\n'
  for (const blankLines of [1, 2, 4]) {
    const separator = '\n'.repeat(blankLines + 1)
    const spacedSource = source.replace(/<\/blockquote>[ \t\n]*<script/, `</blockquote>${separator}<script`)
    const spacedExpected = expected.replace(/<\/blockquote>[ \t\n]*<script/, `</blockquote>${separator}<script`)
    assert.equal(captionlessMd.render(spacedSource), spacedExpected)
    assert.equal(defaultMd.render(spacedSource), spacedSource + '\n')
    assert.equal(
      defaultMd.render(spacedSource + '\n\nFigure. Dummy embed.'),
      spacedExpected.replace('</figure>\n', caption + '</figure>\n'),
    )
    const tokens = captionlessMd.parse(spacedSource, {})
    for (const type of ['figure_open', 'figure_close']) {
      assert.deepEqual(tokens.find(token => token.type === type).map, [0, spacedSource.split('\n').length])
    }
  }
}
assert.equal(
  captionlessMd.render(examples.map(example => example.source).join('\n\n')),
  examples.map(example => example.expected).join(''),
)

// Unknown classes and incomplete or ambiguous split ranges preserve the
// baseline, even when a caption-looking paragraph or a later embed follows.
for (const source of [
  `<blockquote class="twitter-video-extra"><p>First.\n\nLast.</p></blockquote>\n${script}`,
  `<blockquote class="ordinary"><p>First.\n\nLast.</p></blockquote>\n${script}`,
  `<blockquote class="twitter-video"><p>First.\n\nFigure. Keep caption.`,
  `<blockquote class="twitter-video"><p>First.\n\nLast.</p></blockquote>\n<script async src="https://platform.x.com/dummy-widgets.js">`,
  `<blockquote class="twitter-video"><p>First.\n\nLast.</p></blockquote>\n${script}<p>Unrelated HTML.</p>`,
  `<blockquote class="twitter-video"><p>First.\n\n<blockquote>Nested.</blockquote></p></blockquote> ${script}`,
  `<blockquote class="twitter-video"><p>First.\n\n# Heading\n\nLast.</p></blockquote>\n${script}`,
]) {
  assert.equal(captionlessMd.render(source), baseline.render(source))
}
const unclosed = '<blockquote class="twitter-video"><p>Incomplete.\n\nKeep this paragraph.'
assert.equal(
  captionlessMd.render(unclosed + '\n\n' + examples[0].source),
  baseline.render(unclosed) + examples[0].expected,
)

const numbered = createMd({ ...captionlessOptions, autoLabelNumber: true })
const numberedSource = examples[0].source + '\n\n' + examples[1].source + '\n\nFigure. Numbered post.\n\n![Image](image.png)\n\nFigure. Next figure.'
const numberedOutput = numbered.render(numberedSource)
assert.ok(numberedOutput.includes('>Figure 1<span'))
assert.ok(numberedOutput.includes('>Figure 2<span'))
assert.ok(!numberedOutput.includes('>Figure 3<span'))
const collectedNumberedOutput = createMd({
  ...captionlessOptions,
  autoLabelNumber: true,
  keepEmbedScriptsInPlace: false,
}).render(numberedSource)
assert.equal(collectedNumberedOutput.replaceAll(script + '\n', ''), numberedOutput.replaceAll(script + '\n', ''))
assert.equal(collectedNumberedOutput.match(/<script\b/g).length, 1)
assert.ok(collectedNumberedOutput.endsWith(script + '\n'))

const videoSource = examples.find(example => example.source.startsWith('<iframe')).source
for (const host of ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'player.vimeo.com']) {
  const source = videoSource.replace('www.youtube-nocookie.com', host)
  for (const options of [{ videoWithoutCaption: true }, { iframeWithoutCaption: true }]) {
    assert.equal(createMd(options).render(source), '<figure class="f-video">\n' + source + '\n</figure>\n')
  }
}
for (const host of ['example.com', 'www.youtube-nocookie.com.example.com']) {
  const source = videoSource.replace('www.youtube-nocookie.com', host)
  assert.equal(createMd({ videoWithoutCaption: true }).render(source), source + '\n')
  assert.equal(
    createMd({ iframeWithoutCaption: true }).render(source),
    '<figure class="f-iframe">\n' + source + '\n</figure>\n',
  )
}

// Earlier core rules can remove maps or supply invalid ranges. Reassembly
// keeps its conservative spacing fallback and never allocates from those maps.
for (const map of [null, [NaN, Infinity], [0, Number.MAX_SAFE_INTEGER], [-1, 4], [4, 0]]) {
  const md = createMd(captionlessOptions)
  md.core.ruler.before('figure_with_caption', 'replace_embed_maps', state => {
    for (const token of state.tokens) token.map = map
  })
  assert.equal(md.render(examples[0].source), examples[0].expected)
}
const malformedTokens = baseline.parse(examples[0].source, {})
malformedTokens.splice(malformedTokens.findIndex(token => token.type === 'paragraph_close'), 1)
const malformedSnapshot = JSON.stringify(malformedTokens)
assert.equal(
  detectHtmlFigureCandidate(malformedTokens, malformedTokens[0], 0, { iframeTypeBlockquote: true }, examples[0].source.length),
  null,
)
assert.equal(JSON.stringify(malformedTokens), malformedSnapshot)

console.log(`Passed ${examples.length} embed fixtures and regression assertions.`)

// The reviewable collection fixture uses the actual defaults, independently
// of the retained in-place render contracts above.
const collectionFixture = fs.readFileSync(new URL('./examples-embed-script-collection.txt', import.meta.url), 'utf8')
  .replace(/\r\n?/g, '\n')
const collectionExamples = collectionFixture.split('[Markdown]\n').slice(1).map(section => {
  const pair = section.split('\n[HTML]\n')
  assert.equal(pair.length, 2)
  return { source: pair[0].trim(), expected: pair[1].trim() + '\n' }
})
for (const { source, expected } of collectionExamples) {
  assert.equal(collectingMd.render(source), expected)
}

const embed = (htmlScript = script, className = 'twitter-tweet', extra = '') => (
  `<blockquote class="${className}"${extra}><p>Dummy post.</p></blockquote>\n${htmlScript}`
)
const embedBody = '<blockquote class="twitter-tweet"><p>Dummy post.</p></blockquote>\n'
const figureBody = '<figure class="f-img">\n' + embedBody + '</figure>\n'
const repeatedSource = [embed(), embed(script, 'twitter-video'), embed(), 'Dummy last paragraph.'].join('\n\n')
const repeatedOutput = collectingMd.render(repeatedSource)
assert.equal(repeatedOutput.match(/<script\b/g).length, 1)
assert.equal(repeatedOutput.match(/<blockquote\b/g).length, 3)
assert.ok(repeatedOutput.endsWith('<p>Dummy last paragraph.</p>\n' + script + '\n'))
assert.equal(createMd({ ...captionlessOptions, keepEmbedScriptsInPlace: true }).render(repeatedSource).match(/<script\b/g).length, 3)
assert.equal(markdownIt({ html: true }).use(figure).render(embed() + '\n\nDummy end.'), embedBody + '<p>Dummy end.</p>\n' + script + '\n')

// All current providers participate. Each loader keeps the first original
// spelling of its attributes, and X tweet/video share one loader.
const allSource = examples.map(example => example.source).join('\n\n')
const allOutput = collectingMd.render(allSource)
assert.equal(allOutput.match(/<script\b/g).length, 4)
assert.equal(allOutput.match(/<figure\b/g).length, 6)
assert.ok(allOutput.lastIndexOf('</figure>') < allOutput.indexOf('<script'))
assert.ok(allOutput.includes('data-allowed-prefixes="https://mastodon.social/"'))
for (const { source } of examples.filter(example => !example.source.startsWith('<iframe'))) {
  const output = collectingMd.render(source + '\n\n' + source)
  assert.equal(output.match(/<script\b/g).length, 1)
  assert.equal(output.match(/<figure\b/g).length, 2)
}

const equivalentScript = "<SCRIPT charset='utf-8' SRC='https://platform.x.com/dummy-widgets.js' ASYNC='async'></SCRIPT>"
assert.equal(collectingMd.render(embed() + '\n\n' + embed(equivalentScript)), figureBody + figureBody + script + '\n')
for (const otherScript of [
  script.replace('dummy-widgets.js', 'other-dummy.js'),
  script.replace('dummy-widgets.js', 'dummy-widgets.js?dummy=one'),
  script.replace('platform.x.com', 'platform.twitter.com'),
  script.replace(' async', ' defer'),
  script.replace(' charset="utf-8"', ' nonce="dummy-nonce" charset="utf-8"'),
  script.replace(' charset="utf-8"', ' data-dummy="dummy-value" charset="utf-8"'),
]) {
  const output = collectingMd.render(embed() + '\n\n' + embed(otherScript))
  assert.equal(output.match(/<script\b/g).length, 2)
  assert.ok(output.endsWith(script + '\n' + otherScript + '\n'))
}
const entityScript = script.replace('dummy-widgets.js', 'dummy-widgets.js?dummy=one&amp;other=two')
const literalScript = entityScript.replace('&amp;', '&')
assert.equal(collectingMd.render(embed(entityScript) + '\n\n' + embed(literalScript)), figureBody + figureBody + entityScript + '\n')
const escapedAttributeScript = script.replace(' charset=', ' data-dummy="\\*" charset=')
const literalAttributeScript = escapedAttributeScript.replace('\\*', '*')
assert.equal(
  collectingMd.render(embed(escapedAttributeScript) + '\n\n' + embed(literalAttributeScript)),
  figureBody + figureBody + escapedAttributeScript + '\n' + literalAttributeScript + '\n',
)
const multilineScript = script.replace(' async', '\nasync').replace(' charset=', ' data-dummy="dummy > value"\ncharset=')
const multilineSource = embed(multilineScript) + '\n\nDummy end.'
assert.equal(collectingMd.render(multilineSource), figureBody + '<p>Dummy end.</p>\n' + multilineScript + '\n')
assert.deepEqual(collectingMd.parse(multilineSource, {}).at(-1).map, [1, 4])

// A retained script still contributes source lines before later collected
// loaders. Dropping maps must change neither collection nor rendered HTML.
const mixedScriptSource = [
  embedBody.trimEnd() + script.replace(' async', ' type="module" async'),
  embedBody.trimEnd(),
  multilineScript,
  embedBody.trimEnd() + script.replace('dummy-widgets.js', 'other-dummy.js'),
].join('\n')
const mixedScriptTokens = collectingMd.parse(mixedScriptSource, {})
assert.deepEqual(mixedScriptTokens.slice(-2).map(token => token.map), [[2, 5], [5, 6]])
assert.ok(mixedScriptTokens.find(token => token.type === 'html_block').content.includes('type="module"'))
const maplessMd = createMd({ ...captionlessOptions, keepEmbedScriptsInPlace: false })
maplessMd.core.ruler.before('figure_with_caption', 'remove_embed_maps', state => {
  for (const token of state.tokens) token.map = null
})
assert.equal(maplessMd.render(mixedScriptSource), collectingMd.render(mixedScriptSource))
assert.ok(maplessMd.parse(mixedScriptSource, {}).slice(-2).every(token => token.map === null))

// Consecutive snippets can occupy a single html_block. Collection must still
// visit each complete sibling without treating the first script as the end.
for (const separator of ['', '\n', '\n\n']) {
  const output = collectingMd.render(embed() + separator + embed())
  assert.equal(output.match(/<script\b/g).length, 1)
  assert.equal(output.match(/<blockquote\b/g).length, 2)
  assert.ok(output.endsWith('</figure>\n' + script + '\n'))
}

// Moving the loader never changes which pre/post caption belongs to a figure.
for (const position of ['before', 'after']) {
  const source = position === 'before'
    ? 'Figure. Dummy caption.\n\n' + embed()
    : embed() + '\n\nFigure. Dummy caption.'
  const output = collectingMd.render(source + '\n\nDummy end.')
  assert.equal(output.match(/<figcaption>/g).length, 1)
  assert.ok(output.indexOf('Dummy caption.') < output.indexOf('</figure>'))
  assert.ok(output.endsWith('<p>Dummy end.</p>\n' + script + '\n'))
}
for (const source of [
  embed().split('\n').map(line => '> ' + line).join('\n'),
  '- Dummy first item.\n\n- ' + embed().replaceAll('\n', '\n  '),
]) {
  const tokens = collectingMd.parse(source, {})
  const finalToken = tokens.at(-1)
  assert.equal(finalToken.content, script + '\n')
  assert.equal(finalToken.type, 'html_block')
  assert.equal(finalToken.level, 0)
  assert.equal(finalToken.block, true)
  assert.ok(tokens.slice(0, -1).every(token => !token.content.includes('<script')))
}

// Collection is render-local, including reused env and repeated installation.
const reusedEnv = { dummy: 'retained' }
for (let index = 0; index < 3; index++) {
  assert.equal(collectingMd.render(embed(), reusedEnv), figureBody + script + '\n')
  assert.equal(collectingMd.render('Dummy plain text.', reusedEnv), '<p>Dummy plain text.</p>\n')
}
assert.deepEqual(reusedEnv, { dummy: 'retained' })
const duplicateUse = markdownIt({ html: true }).use(figure, captionlessOptions).use(figure, { keepEmbedScriptsInPlace: true })
assert.equal(duplicateUse.render(embed()), figureBody + script + '\n')
for (const invalid of [undefined, null, 'false', 0, 1]) {
  const md = markdownIt({ html: true })
  assert.throws(() => md.use(figure, { keepEmbedScriptsInPlace: invalid }), /keepEmbedScriptsInPlace must be a boolean/)
  md.use(figure, captionlessOptions)
  assert.equal(md.render(embed()), figureBody + script + '\n')
}
assert.equal(collectingMd.renderInline(embed()), baseline.renderInline(embed()))
assert.equal(createMd({ keepEmbedScriptsInPlace: false }, false).render(embed()), markdownIt({ html: false }).render(embed()))

// The first retained loader gets its original source map even though its
// output token is now at the document root and outside the figure.
const mappedSource = embed() + '\n\nDummy end.\n\n' + embed()
const mappingMd = createMd({ ...captionlessOptions, keepEmbedScriptsInPlace: false })
let originalTokens
let originalEmbed
mappingMd.core.ruler.before('figure_with_caption', 'capture_collected_embed_tokens', state => {
  originalTokens = state.tokens
  originalEmbed = state.tokens[0]
})
const mappedTokens = mappingMd.parse(mappedSource, {})
assert.equal(mappedTokens, originalTokens)
assert.equal(mappedTokens.find(token => token.type === 'html_block'), originalEmbed)
assert.deepEqual(mappedTokens.at(-1).map, [1, 2])
assert.deepEqual(mappedTokens.find(token => token.type === 'figure_open').map, [0, 2])
for (const map of [null, [-1, 2], [0, Infinity], [0, Number.MAX_SAFE_INTEGER]]) {
  const md = createMd({ ...captionlessOptions, keepEmbedScriptsInPlace: false })
  md.core.ruler.before('figure_with_caption', 'invalid_collected_script_map', state => {
    for (const token of state.tokens) token.map = map
  })
  const finalToken = md.parse(examples[0].source, {}).at(-1)
  assert.equal(finalToken.map, null)
}

// Fail closed for unknown hosts, data-src lookalikes, inline/module/event
// scripts, duplicate attributes, broken markup, and unrelated HTML siblings.
for (const source of [
  embed(script.replace('platform.x.com', 'platform.x.com.example.com')),
  embed(script.replace(' src=', ' data-src=')),
  embed(script.replace('</script>', 'Dummy inline body.</script>')),
  embed(script.replace(' async', ' type="module" async')),
  embed(script.replace(' async', ' onload="dummyHandler()" async')),
  embed(script.replace(' async', ' SRC="https://platform.x.com/other-dummy.js" async')),
  embed(script.replace(' async', ' data-dummy="unfinished async')),
  embed(script.replace(' async', ' type="\u00a0text/javascript" async')),
  embed(script.replace(' src=', '\u00a0src=')),
  embed().replace('</blockquote>', '</blockquote\u00a0>'),
  embed().replace('</blockquote>', '<blockquote>Nested dummy.</blockquote></blockquote>'),
  embed().replace('</blockquote>', '<!-- Dummy comment. --></blockquote>'),
  `<blockquote class="twitter-tweet"><svg><![CDATA[Dummy </blockquote>${script}<blockquote class="twitter-tweet">Dummy]]></svg></blockquote>${script}`,
  embed() + '<div>Unrelated dummy HTML.</div>',
  '<script async src="https://platform.x.com/dummy-widgets.js"></script>',
]) {
  assert.equal(collectingMd.render(source), captionlessMd.render(source))
}

const mastodonScript = '<script data-allowed-prefixes="https://mastodon.social/" async src="https://mastodon.social/dummy-embed.js"></script>'
const mastodonExtra = ' data-embed-url="https://mastodon.social/@dummy-user/dummy-post-id/embed"'
const mastodonSource = embed(mastodonScript, 'mastodon-embed', mastodonExtra)
const restrictedScript = mastodonScript.replace('data-allowed-prefixes="https://mastodon.social/"', 'data-allowed-prefixes="https://mastodon.social/@dummy-user/"')
const restrictedOutput = collectingMd.render(mastodonSource + '\n\n' + embed(restrictedScript, 'mastodon-embed', mastodonExtra))
assert.equal(restrictedOutput.match(/<script\b/g).length, 2)
assert.ok(restrictedOutput.endsWith(mastodonScript + '\n' + restrictedScript + '\n'))
assert.equal(collectingMd.render(embed(mastodonScript, 'mastodon-embed')), captionlessMd.render(embed(mastodonScript, 'mastodon-embed')))

// Closing-tag/script spellings inside raw-text and inert elements are source
// content, not sibling loaders. An unrelated later embed can still collect.
for (const tag of ['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext', 'template']) {
  for (const opener of [`<${tag}>`, `<${tag.toUpperCase()} data-dummy="dummy-value">`, `<${tag}/>`]) {
    const source = `<blockquote class="twitter-tweet">${opener}Dummy </blockquote>${script}<blockquote class="twitter-tweet">Dummy</${tag}></blockquote>${script}`
    assert.equal(collectingMd.render(source), captionlessMd.render(source), `${tag}: preserve opaque content`)
    assert.equal(
      collectingMd.render(source + '\n\n' + embed()),
      captionlessMd.render(source) + figureBody + script + '\n',
      `${tag}: preserve opaque content before a collectable embed`,
    )
  }
}
for (const quote of ['"', "'"]) {
  const innerQuote = quote === '"' ? "'" : '"'
  const innerScript = script.replaceAll('"', innerQuote)
  const source = `<blockquote class="twitter-tweet"><p title=${quote}Dummy > </blockquote>${innerScript}<blockquote class=${innerQuote}twitter-tweet${innerQuote}>Dummy${quote}>Dummy text.</p></blockquote>${script}`
  assert.equal(collectingMd.render(source), captionlessMd.render(source), 'Preserve tag-like text in attributes')
  assert.equal(
    collectingMd.render(source + '\n\n' + embed()),
    captionlessMd.render(source) + figureBody + script + '\n',
  )
}
const quotedBodySource = embed().replace('<p>', '<p title="Dummy > value">')
assert.equal(collectingMd.render(quotedBodySource), figureBody.replace('<p>', '<p title="Dummy > value">') + script + '\n')

console.log(`Passed ${collectionExamples.length} script-collection fixtures and regression assertions.`)
