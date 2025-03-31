import { markReg } from 'p7d-markdown-it-p-captions'

const imgReg = /^( *!\[)(.*?)\]\( *?((.*?)(?: +?"(.*?)")?) *?\)( *?\{.*?\})? *$/

const imgAttrToPCaption = (state, startLine, opt) => {
  const imgMarkReg = markReg['img']
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]
  let inline = state.src.slice(pos, max)
  const img = inline.match(imgReg)
  if (!img) return

  let alt = img[2] ?? ''
  let title = img[5] ?? ''
  const caption = opt.imgTitleCaption ? title : (opt.imgAltCaption ? alt : '')
  const altCap = typeof opt.imgAltCaption === 'string' ? opt.imgAltCaption : ''
  const titleCap = typeof opt.imgTitleCaption === 'string' ? opt.imgTitleCaption : ''

  const hasMarkLabel = caption.match(imgMarkReg)
  let modCaption = ''
  if (hasMarkLabel) {
    modCaption = caption
  } else {
    const prefix = altCap || titleCap || ''
    if (prefix && /[a-zA-Z]/.test(prefix)) {
      modCaption = caption === '' ? prefix + '.' : prefix + '. ' + caption
    } else {
      modCaption = caption === '' ? prefix + ' ' : prefix + '　' + caption
    }
    if (!prefix) {
      modCaption = 'Figure.' + (caption !== '' ? ' ' + caption : '')
    }
  }
  let token = state.push('paragraph_open', 'p', 1)
  token.map = [startLine, startLine + 1]
  token = state.push('inline', '', 0)
  token.content = modCaption
  token.children = [new state.Token('text', modCaption, 0)]
  if (!opt.setFigureNumber) {
    if(caption === '') token.attrs = [['class', 'nocaption']]
  }
  token = state.push('paragraph_close', 'p', -1)
  return true
}

const setAltToLabel = (state, n) => {
  if (n < 2) return false
  const imageToken = state.tokens[n+1].children[0]
  if (imageToken.type !== 'image' || !state.tokens[n-2].children) return false
  const prevTokenChild = state.tokens[n-2].children[0]
  if (state.tokens[n-2].children) {
    state.tokens[n+1].content = state.tokens[n+1].content.replace(/^!\[.*?\]/, '![' + prevTokenChild.content + ']')
    if (!imageToken.children[0]) {
      const textToken  = new state.Token('text', '', 0)
      imageToken.children.push(textToken)
    }
    imageToken.children[0].content = ''
  }
  imageToken.content = ''
  return true
}

const setTitleToLabel = (state, n) => {
  if (n < 2) return false
  const imageToken = state.tokens[n+1].children[0]
  if (imageToken.type !== 'image') return false
  if (!state.tokens[n-2].children[0]) return false
  imageToken.attrSet('alt', imageToken.content)
  if (!imageToken.children[0]) {
    const textToken  = new state.Token('text', '', 0)
    imageToken.children.push(textToken)
  }
  for (let i = 0; i < imageToken.attrs.length; i++) {
    if (imageToken.attrs[i][0] === 'title') {
      imageToken.attrs.splice(i, 1)
      break
    }
  }
  return true
}

export { imgAttrToPCaption, setAltToLabel, setTitleToLabel }