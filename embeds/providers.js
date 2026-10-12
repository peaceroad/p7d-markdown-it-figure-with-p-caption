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
  },
])

export const BLOCKQUOTE_EMBED_CLASS_NAMES = new Set([
  'twitter-tweet',
  'twitter-video',
  'instagram-media',
  'text-post-media',
  'bluesky-embed',
  'mastodon-embed',
])

// Match loader hosts, while keeping the complete src and all attributes in
// the deduplication key. Mastodon uses the origin of data-embed-url instead.
export const SOCIAL_EMBED_SCRIPT_HOSTS = Object.freeze({
  'twitter-tweet': ['platform.x.com', 'platform.twitter.com'],
  'twitter-video': ['platform.x.com', 'platform.twitter.com'],
  'instagram-media': ['www.instagram.com', 'instagram.com'],
  'text-post-media': ['www.threads.com', 'threads.com', 'www.threads.net', 'threads.net'],
  'bluesky-embed': ['embed.bsky.app'],
})

export const VIDEO_IFRAME_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
])
