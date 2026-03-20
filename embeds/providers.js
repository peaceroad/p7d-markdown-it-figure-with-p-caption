export const HTML_EMBED_CANDIDATES = Object.freeze([
  { candidate: 'video', lookupTag: 'video', hintKey: 'hasVideoHint' },
  { candidate: 'audio', lookupTag: 'audio', hintKey: 'hasAudioHint' },
  { candidate: 'iframe', lookupTag: 'iframe', hintKey: 'hasIframeHint' },
  { candidate: 'blockquote', lookupTag: 'blockquote', hintKey: 'hasBlockquoteHint' },
  {
    candidate: 'div',
    lookupTag: 'div',
    hintKey: 'hasDivHint',
    requiresIframeTag: true,
    matchedTag: 'iframe',
    treatAsVideoIframe: true,
  },
])

export const BLOCKQUOTE_EMBED_CLASS_NAMES = new Set([
  'twitter-tweet',
  'instagram-media',
  'text-post-media',
  'bluesky-embed',
  'mastodon-embed',
])

export const VIDEO_IFRAME_HOSTS = new Set([
  'www.youtube-nocookie.com',
  'player.vimeo.com',
])
