# AGENTS notes for `p7d-markdown-it-figure-with-p-caption`

## 1. Scope
- Wrap media/table/code/blockquote blocks in `<figure>` and convert adjacent caption paragraphs to `<figcaption>`.
- Delegate caption label parsing/numbering to `p7d-markdown-it-p-captions`; this plugin focuses on detection, wrapping, and figure-level classes.
- Preserve markdown-it-attrs metadata and renderer-specific styling hooks.
- The package publishes untranspiled ESM directly. Keep the two public entry files (`index.js` and `caption-numbering.js`) at the project root and group implementation by stable domain (`caption-numbering/`, `embeds/`). A `src/` forwarding layer adds no boundary or build benefit here; revisit only if a real build output, platform-specific entrypoints, or substantially more domains require a source/package split.

## 2. Core Pipeline
- Registers the `figure_with_caption` core rule before `replacements` (after markdown-it-attrs has decorated paragraphs).
- Repeated `.use(mditFigureWithPCaption)` calls on one markdown-it instance are ignored before later options are validated. Initial setup validates/registers before setting the sentinel, so an invalid first call leaves the instance reusable; use separate instances for different successful option sets.
- `figureWithCaptionCore` walks token arrays recursively, respecting container boundaries (`blockquote`, `list_item`, `dd`).
- Tight list paragraphs (`token.hidden`) are skipped to avoid invalid HTML.
- Caption detection (delegated to p-captions) intentionally skips paragraphs that appear immediately after `list_item_open`; first-block captions inside list items are treated as non-captions.
- Final structural eligibility (`canWrap`, hidden/tight-list guards) is established before adjacent-caption or auto-caption mutation. Invalid candidates must preserve the original caption tokens.
- Unbalanced block-container token ranges fail closed instead of wrapping a lone open token.
- When advanced numbering uses heading scopes, only configured top-level headings update the render-local scope state. Recursive container walkers inherit that state but do not create nested heading scopes.
- After a captioned blockquote, its recursive walker must return at that blockquote's close token so following top-level headings remain visible to the top-level scope walker.

## 3. Detection Inputs
- Block tokens: `table_open`, `pre_open`, `blockquote_open` via `detectCheckTypeOpen`.
- Fences: `fence` tokens become `pre-code` or `pre-samp` when info matches `samp|shell|console`.
- HTML blocks: `video`, `audio`, `iframe`, `blockquote`, and `div` wrappers that contain an `<iframe>`; tag detection is case-insensitive. Social blockquotes (Twitter/Mastodon/etc.) are treated as iframe-type embeds only when known embed class patterns match.
- Known video iframe hosts include `www.youtube.com`, `youtube.com`, `www.youtube-nocookie.com`, `youtube-nocookie.com`, and `player.vimeo.com`; known video iframes can be captionlessly wrapped by `videoWithoutCaption`.
- An unknown iframe can still accept an explicit `Video.` / `動画` caption through the existing iframe caption-mark path. Its wrapper remains `f-iframe`; do not promote it to a known video wrapper based on caption text alone.
- Provider-specific HTML knowledge is kept under `embeds/` (`providers.js` registry + `detect.js` detector) so `index.js` only consumes detection results and wrapper policy.
- Image paragraphs: inline children that start with an `image` and meet the image-only rules below.

## 4. Image Paragraph Rules
- A valid image-only paragraph can include:
  - one or more `image` tokens,
  - spaces (`text` tokens of only ASCII spaces),
  - softbreaks (for vertical layouts),
  - and an optional trailing `{.class #id}` block in the last text token.
- Any other text content invalidates wrapping (prevents accidental figures when text follows images).
- Multi-image wrapping uses `multipleImages` and sets the figure class suffix:
  - `-horizontal` (spaces only), `-vertical` (softbreak only), or `-multiple` (mixed).
- Trailing `{...}` attrs from inline text are parsed only when `styleProcess` is enabled; parsed attrs are forwarded to the `<figure>`. The fallback parser supports simple `.class`, `#id`, bare attrs, and quoted `key="value with spaces"` / `key='value with spaces'` pairs.
- Attribute forwarding and the `styleProcess` fallback parser are not sanitizers. Keep untrusted-input sanitization as a host/application responsibility; this plugin only preserves or moves attributes.
- The trailing `{...}` text is removed only after a successful attr parse; failed parses leave the original text untouched and do not satisfy image-only wrapping.
- Image paragraph attrs already materialized on tokens by `markdown-it-attrs` are forwarded to `<figure>` regardless of `styleProcess`.
- `imageOnlyParagraphWithoutCaption` is the canonical captionless image wrapping option. `oneImageWithoutCaption` remains a legacy alias; when both are set, `imageOnlyParagraphWithoutCaption` wins. Multi-image image-only paragraphs keep their layout class suffixes (`-horizontal`, `-vertical`, `-multiple`) when wrapped captionlessly.

## 5. Caption Pairing & Auto Caption
- `checkPrevCaption` / `checkNextCaption` normally call `setCaptionParagraph` (from p-captions), then convert paragraphs into `figcaption` tokens. The iframe + figure-class-mirroring path uses p-captions' analyze/apply pair so a caption-driven slide class is final before label/body spans are constructed.
- Caption detection trusts `sp.captionDecision.mark` from p-captions rather than re-parsing class strings.
- `labelPrefixMarker` (optional) strips a prefix marker before a label; `allowLabelPrefixMarkerWithoutLabel` allows marker-only captions.
- Caption regex resolution is language-aware via p-captions helper state (`getMarkRegStateForLanguages`); image auto-caption reuse goes through p-captions' pure `analyzeCaptionStart(...preferredMark:'img')` helper.
- Auto caption for images runs only when no caption paragraph exists:
  - uses labeled `alt` or `title` text recognized by p-captions,
  - or fallback labels (`autoAltCaption` / `autoTitleCaption`) with language-aware generated-label defaults from p-captions.
  - string fallback labels are treated as p-captions-recognizable label stems; invalid strings fail during plugin setup. Fallback values are limited to `false`/`null`, `true`, or a recognized string label. Default joints/spaces are added unless the string already ends with a recognized joint; a trailing full-width joint space (`U+3000`) is preserved rather than duplicated.
  - empty `alt` / `title` values do not synthesize label-only captions.
- `languages` remains the optional available caption-catalog/recognition-dictionary list delegated to p-captions; default `['en', 'ja']` is enough for normal English/Japanese use. It is not the active locale.
- Generated fallback tie-break order is an active-locale concern and is resolved lazily at most once per render, when an actual image token needs an unlabeled fallback. Canonical runtime inputs are `env.locale` and `env.preferredLocales`; compatibility fallbacks are `preferredLanguages`, `env.preferredLanguages`, `env.lang`, and `env.language`. The cheap document-script heuristic remains the last fallback before raw `languages` order. `env.locale` / `env.preferredLocales` intentionally override legacy `preferredLanguages` for generated fallback labels.
- Consumed `alt`/`title` attributes are cleared to avoid duplicate captions in downstream renderers.
- Auto-caption source attributes and image-only separator/attribute text are mutated only after wrapping is confirmed; rejected candidates and tight-list paragraphs preserve baseline output.

## 6. Numbering Integration
- p-captions owns number resolution and label mutation through `createCaptionNumberingPolicy` / `createCaptionNumberingRuntime`; this plugin supplies the enabled marks and optional scope context. Do not reintroduce post-hoc label-span scanning.
- Build one stable policy at setup and one runtime per render. All recursive walkers for that render share the runtime; separate renders, even on the same markdown-it instance, never share counters.
- `autoLabelNumberSets` accepts strict user-facing marks `img`, `table`, `code` / `pre-code`, `samp` / `pre-samp`, and `video`; p-captions owns alias normalization. Unknown/non-string/empty entries and explicit `undefined` / `null` fail initial setup. `[]` explicitly disables numbering. `autoLabelNumber: true` remains only the img/table shorthand, and an explicit sets property wins.
- Enabled checks use canonical `captionDecision.mark`, not wrapper classes or counter series. `removeUnnumberedLabelExceptMarks` is also compared by canonical decision mark after code/samp alias normalization.
- The stable policy supplies a semantic `getCounterKey`: `img -> figure`, `pre-code -> listing`, `video -> video`, `table -> table`; `pre-samp` joins `figure` when its exact source label is also an active img label, joins `listing` when also a pre-code label, otherwise uses `samp`. Exact overlap checks call p-captions' cached `isCaptionLabelForMark` only for enabled pre-samp decisions.
- Shared series advance only for enabled marks. Enabling img alone does not let a samp `図` advance the figure counter, and enabling samp alone does not let an image advance it. Manual exact decimals synchronize all enabled marks sharing the same counter key and scope key; compound/alphanumeric values are preserved without seeding an incompatible sequence.
- Numbered marks use automatic Chapter/Appendix scope by default: parsed `env.frontmatter.title` plus top-level H1 headings, `.` separator, and repeated-scope continuation. `autoLabelNumberPolicy` customizes this behavior but does not enable marks; `scope: 'document'` (or explicit policy `null`) opts out to document-wide decimal counters, while scope objects can select sources, heading levels, and repeat behavior.
- Advanced numbering passes normalized context on every caption, including the unscoped form with `scopeKey`, `sequenceKey` set to `null`. `repeatScope: continue` uses semantic `scopeKey` as the counter partition; `reset` allocates a new finite render-local `sequenceKey` per occurrence.
- Heading/frontmatter scope recognition adds Chapter/Appendix/Japanese marker vocabulary, but delegates the suffix boundary to p-captions' `isCaptionLabelBoundary`. Visible heading prefixes are bounded and assembled conservatively from inline children; ambiguous token continuations, including formatted text attached immediately after a half-width joint, fail closed.
- Canonical initial metadata is per-render `env.frontmatter.title`. Parsed frontmatter may override the render through the nested `env.frontmatter['figure-caption-numbering']` object or the exact dotted keys `figure-caption-numbering.scope` / `figure-caption-numbering.separator`: `scope` is `auto` or `document`, and `separator` is `.` or `-`. Nested and dotted forms may supply different fields, but duplicate definitions of one field throw. Abbreviated aliases remain unsupported. Unknown nested properties and invalid values throw before caption mutation.
- Render-level `env.figureCaptionNumbering` takes precedence over parsed frontmatter; its `scope` accepts `auto`, `document`, or a validated fixed scope object, and its optional `separator` overrides the setup default for that render. `document` fixes the render to the unscoped per-series context so later headings cannot re-enable chapter/appendix prefixes.
- Existing raw `front_matter` tokens require the explicit `resolveFrontmatterTitle` adapter; the plugin neither registers a frontmatter rule nor parses YAML. The parsed frontmatter override is available only when the host supplies the parsed object in `env`.
- The public `caption-numbering.js` subpath exposes only opaque policy normalization, an immutable scope timeline, the semantic counter-key resolver, and the scope-aware number codec. These APIs reuse the same modules as the renderer but never expose candidate detection, wrapping, or token mutation. Policies and numbering contexts are branded/frozen; do not replace them with look-alike objects or duplicate their hidden state in consumers.
- `createFigureCaptionScopeTimeline` is a batch-analysis API for source editors. Call it with the real post-inline `StateCore`; it must not mutate state/tokens/children. Its top-level-heading scan mirrors the streaming walker's container exclusion, and recognized headings without a valid source map set `hasUnmappableBoundaries` so source editors can fail closed.
- `captionDecision` remains source-only. Generated numbers never overwrite its `number` / `hasExplicitNumber` fields.
- All policy callbacks, explicit overrides, and generated-number validation complete before p-captions mutates tokens; counter commit follows successful label construction. Callback external side effects are outside rollback guarantees, so callbacks must be pure and synchronous.
- Reject p-captions' `setFigureNumber` at setup. This plugin owns numbering through `autoLabelNumber` / `autoLabelNumberSets`; enabling both systems can duplicate labels and resets p-captions counters because helper calls are figure-local.

## 7. Figure Tokens, Classes, and Attrs
- `wrapWithFigure` inserts `figure_open` / `figure_close` and forwards:
  - figure class names (prefix + type, or iframe overrides),
  - attrs from image paragraphs/image tokens (`styleProcess` path), especially trailing `{...}` attrs on image-only paragraphs.
- Wrapper/class-prefix options are trimmed during setup; whitespace-only overrides fall back to the default class for that option.
- Caption paragraph attrs remain on the converted `figcaption` token (not moved onto `figure`).
- `figure_open` / `figure_close` inherit `.map` from the wrapped source-line range to improve VS Code click/scroll sync.
- Wrapper map propagation accepts only non-negative safe-integer source ranges; malformed third-party maps are ignored instead of being copied onto synthetic figure tokens.
- `figure_open` / `figure_close` are block-level tokens, but this plugin still does not install renderer rules. `wrapWithFigure` inserts a distinct empty text token immediately after `figure_open` so markdown-it's default renderer emits the opening-tag newline without adding a blank line; image paragraph replacement still inserts an explicit newline before `figure_close`.
- `labelClassFollowsFigure` and `figureToLabelClassMap` use the final wrapper class. For slide captions, resolve `figureClassThatWrapsSlides` before p-captions builds mirrored span classes; map keys therefore use `f-slide` (or the custom final slide class), not the preliminary `f-iframe` class.

## 8. Performance Notes
- Regex caches reduce repeated allocations; `htmlRegCache` is module-level and `cleanCaptionRegCache` is instance-scoped on `opt` to avoid cross-instance leakage.
- HTML detection uses case-insensitive tag hints before regex checks and skips regex when no target tag hint exists in the block.
- HTML detection keeps newline/script normalization pending until the block is validated as a supported embed, so rejected HTML candidates remain untouched. Strict tag hints do not confuse custom tags such as `<iframe-widget>` or `<video-player>` with supported HTML elements.
- Social embed blockquotes are matched by class-token membership, so extra classes on the provider blockquote do not block detection.
- `detectHtmlFigureCandidate` has an early non-target tag guard (`video/audio/iframe/blockquote/div`) before expensive checks.
- `htmlWrapWithoutCaption` options are precomputed once and reused in HTML detection.
- Generated fallback locale resolution is skipped unless auto alt/title fallback is enabled, multiple languages are active, and a valid image candidate actually needs fallback text. Resolve from the final token stream, not a raw `![` source hint, so image tokens injected by earlier core rules are handled correctly. The document-script fallback scans the original normalized source from a frontmatter-skipping offset; do not slice/copy the remaining document merely to inspect its bounded prefix.
- Setup normalizes `languages` and compatibility `preferredLanguages` once; render-time fallback ordering reuses those arrays directly and only inspects `env` / source when it must derive a tie-break.
- Keep render-specific generated-label language order on per-render caption state rather than cloning the full option object. This lets p-captions reuse its normalized-option WeakMap entry across renders.
- Numbering-disabled renders allocate no numbering runtime. When no marks are enabled and the policy is omitted/`undefined`, setup also skips default-scope policy normalization; explicitly supplied policies are still validated. Scope catalogs and heading-prefix scans are used only when automatic/advanced numbering enables the corresponding source.
- The renderer keeps the streaming scope runtime and does not build the public immutable timeline. Timeline allocation and its full token scan are paid only by explicit API consumers such as source editors.
- The exact-label matcher table is built with the cached language state, but render-time overlap lookup occurs only for numbered `pre-samp` captions. Do not rescan the catalog or compile regexes per caption.
- Heading-scope guards and parent close-token names are precomputed per walker. Captionless image wrapping resumes after the inserted figure instead of rescanning its new child tokens.
- ASCII `Chapter` / `Appendix` prefix checks compare character codes case-insensitively instead of allocating lowercase substrings for every candidate heading.
- Raw frontmatter resolution checks only the initial token, matching frontmatter's document-start grammar instead of scanning ordinary paragraph tokens.
- Default numbering no longer scans already-created label spans; p-captions resolves and applies the number during label-token construction.
- Alt text aggregation avoids temporary arrays; auto-caption fallback does not keep a second per-mark locale cache because p-captions already caches locale metadata in `markRegState`.
- `wrapWithFigure` uses module-level token/attribute helpers to avoid allocating helper closures per figure. It must still create distinct newline tokens; do not reuse one token object across multiple insert positions.
- The current in-place walker is intentionally retained for nested-container correctness, but repeated wrapper `splice()` calls still make very large documents with many sibling figures superlinear. Fixed-width caption moves use direct slot rotation, and image/single-token wrappers use one replacement splice; preserve those local fast paths. p-captions 0.25.0 provides pure `analyzeCaptionParagraph()` plus validated `applyCaptionParagraph()` decisions for a future collect/plan/rebuild pass. Except for the narrow iframe/class-mirroring case above, do not replace the compatibility wrapper one-for-one on the current immediate path: snapshot/freeze validation adds overhead unless it also enables batched token reconstruction.

## 9. Tests
- Fixtures under `test/*.txt` feed `test/test.js` (`npm run test:core`).
- Caption-numbering policy, scope, option-flow, code/samp, and video regressions live in `test/test-caption-numbering.js` (`npm run test:numbering`). Keep this suite named by stable responsibility rather than a release number.
- Executable README/docs pairs use fenced info strings such as `md {test id="..."}` and `html {test id="..."}`. `test/test-doc-examples.js` discovers them through `npm run test:docs`; keep setup names on a fixed allowlist and never evaluate documentation metadata as JavaScript.
- Each documentation test ID must have exactly one complete Markdown fence and one complete HTML fence. Leave abbreviated examples containing `...` unannotated rather than weakening exact comparison.
- The pure integration subpath is covered independently by `test/test-caption-numbering-api.js` (`npm run test:numbering-api`), including branding/freeze, non-mutation, scope boundaries, mapless headings, malformed nested-container fail-closed behavior, counter series, and the number codec.
- Image-only coverage includes single/multi-image layouts, attrs, auto-caption detection, and invalid trailing text cases.
- Dedicated examples cover slide class overrides and label class mirroring.
- `npm test` aggregates the core, renderer-numbering, numbering-API, and documentation-example suites. Additional dependency-focused checks run from repository-controlled paths through `npm run test:p-captions`; `npm run test:all` includes all five suites.
- Advanced-numbering tests cover all scope catalog forms, ambiguous inline-token boundaries, heading levels/nesting, repeat continue/reset, explicit scoped synchronization, shared figure/listing samp sequences, parsed frontmatter auto/document and separator overrides, fixed env overrides, frontmatter adapters, render reuse, and pre-mutation failure behavior.
- Option/integration tests cover strict aliases and validation, invalid-first/retry and duplicate-use sentinel behavior, native fences and pre/code/samp token blocks, shared `図` / `リスト` series, raw/known/unknown video paths, captionless no-op counters, formatting options, and remove/except decision-mark filtering.
- Performance/robustness checks run via `npm run perf` (`test/performance/benchmark.js`) with render medians/p95 and deep blockquote probe output.
- Consumer repos may not include upstream dependency test files under `node_modules`; keep integration checks in root-owned scripts/tests.
- Do not rely on durable tests under `node_modules`; treat those as ephemeral.

## 10. Documentation
- Keep `README.md` user-oriented: installation, quick start, representative image/table/code/samp/video/slide conversions, recommended options, and a short automatic-numbering setup must remain visible there.
- Keep exhaustive behavior and option contracts in `docs/reference.md`, numbering and integration-API details in `docs/numbering.md`, and complete samples in `docs/examples.md`. Each document owns its contents list; do not add a redundant `docs/README.md` or grow the root README back into the complete reference.
- Automatic numbering is opt-in, but recognized frontmatter/H1 scope is the default once numbering is enabled. State the `autoLabelNumber: false` default, automatic scope behavior, and the explicit document-wide opt-out in the root README.
- Ship `docs/` in the npm package and verify its contents with `npm pack --dry-run --json` whenever documentation paths change.

## 11. Future Work
- Investigate token pooling in `wrapWithFigure` to reduce GC churn on huge documents.
- Expand HTML tag caching with subtype hints (e.g., iframe + YouTube).
- Keep dense-sibling `splice()` instrumentation and a collect/plan/rebuild comparison as a separate performance project; do not combine that traversal rewrite with numbering semantics.
- Continue splitting `index.js` only along measured, stable responsibility boundaries (remaining setup/options, candidate detection, transforms/wrapping). Numbering policy/scope/series/codec already live under `caption-numbering/`; preserve the root default entry point, the explicit pure subpath, one-way dependencies, and no per-render helper allocation.
- Explore an opt-in strategy for tight lists (temporary split/merge or diagnostics).
