import { markReg } from 'p7d-markdown-it-p-captions'

const imgReg = /^( *!\[)(.*?)\]\( *?((.*?)(?: +?\"(.*?)\")?) *?\)( *?\{.*?\})? *$/

const imgAttrToPCaption = (state, startLine, opt) => {
  let pos = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]
  //console.log('init inline: ' + state.src.slice(pos, max))
  let inline = state.src.slice(pos, max)
  const img = inline.match(imgReg)
  if (!img) return

  let alt = img[2] === undefined ? '' : img[2]
  let title = img[5] === undefined ? '' : img[5]
  //console.log('alt: ' + alt + ', title: ' + title)

  let caption = ''
  if (opt.imgAltCaption) caption = alt
  if (opt.imgTitleCaption) caption = title

  const hasMarkLabel = caption.match(markReg['img'])

  let modCaption = ''
  if (hasMarkLabel) {
    modCaption = caption
  } else {
    if (typeof opt.imgAltCaption === 'string' || typeof opt.imgTitleCaption === 'string') {
      if (/[a-zA-Z]/.test(opt.imgAltCaption)) {
        if (caption ===  '') {
          modCaption = (opt.imgAltCaption ? opt.imgAltCaption : opt.imgTitleCaption) + '.'
        } else {
          modCaption = (opt.imgAltCaption ? opt.imgAltCaption : opt.imgTitleCaption) + '. ' + caption
        }
      } else {
        if (caption ===  '') {
          modCaption = (opt.imgAltCaption ? opt.imgAltCaption : opt.imgTitleCaption) + ' '
        } else {
          modCaption = (opt.imgAltCaption ? opt.imgAltCaption : opt.imgTitleCaption) + '　' + caption
        }
      }
    } else {
      modCaption = 'Figure.'
      if (caption !== '') modCaption += ' ' + caption
    }
  }
  //console.log('modCaption: ' + modCaption)
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
  if (state.tokens[n+1].children[0].type !== 'image' || !state.tokens[n-2].children) return false
  if (state.tokens[n-2].children) {
    state.tokens[n+1].content = state.tokens[n+1].content.replace(/^!\[.*?\]/, '![' + state.tokens[n-2].children[0].content + ']')
    if (!state.tokens[n+1].children[0].children[0]) {
      const textToken  = new state.Token('text', '', 0)
      state.tokens[n+1].children[0].children.push(textToken)
    }
    // Set figure label:
    //state.tokens[n+1].children[0].children[0].content = state.tokens[n-2].children[2].content
    // Set img alt to empty value:
    state.tokens[n+1].children[0].children[0].content = ''
  }
  // Set figure label:
  //state.tokens[n+1].children[0].content = state.tokens[n-2].children[2].content
  // Set img alt to empty value:
  state.tokens[n+1].children[0].content = ''
  //console.log(state.tokens[n+1].children[0])
  return true
}

const setTitleToLabel = (state, n) => {
  if (n < 2) return false
  if (state.tokens[n+1].children[0].type !== 'image') return false
  if (!state.tokens[n-2].children[0]) return false
  state.tokens[n+1].children[0].attrSet('alt', state.tokens[n+1].children[0].content)
  if (!state.tokens[n+1].children[0].children[0]) {
    const textToken  = new state.Token('text', '', 0)
    state.tokens[n+1].children[0].children.push(textToken)
  }
  let i = 0
  while (0 < state.tokens[n+1].children[0].attrs.length) {
    if (state.tokens[n+1].children[0].attrs[i][0] === 'title') {
      state.tokens[n+1].children[0].attrs.splice(i, i + 1)
      break
    } else {
      state.tokens[n+1].children[0].attrJoin('title', '')
    }
    i++
  }
  //console.log(state.tokens[n+1].children[0])
  return true
}

export { imgAttrToPCaption, setAltToLabel, setTitleToLabel }