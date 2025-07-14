import { marked, type RendererObject } from 'marked'
import { mangle } from 'marked-mangle'
import escape from 'validator/lib/escape'
import { expose } from 'comlink'
import { emojis, type EmojisKey } from '../constants'

// bundle size
import hljs from 'highlight.js/lib/common'

const renderer: RendererObject = {
  text({ text }) {
    try {
      return emojiConvert(text)
    } catch (e) {
      return escape(text)
    }
  },
  heading({ tokens }) {
    const text = this.parser.parseInline(tokens)
    return escape(text)
  },
  html({ text }) {
    return escape(text)
  },
  hr: () => '',
  em({ tokens }) {
    const text = this.parser.parseInline(tokens)
    return escape(text)
  },
  br: () => '',
  image({ href, text }) {
    return `<img src="${escape(href)}" alt="${escape(text)}" />`
  },
  link({ href, text }) {
    try {
      const url = new URL(href)

      if (url.host === location.host && url.pathname !== '/' && href === text) {
        const t = escape(text.slice(text.indexOf('/rooms')))
        return `<a class="mzm-room-link" href="${escape(href)}">${t}</a>`
      }

      if (url.host === location.host) {
        return `<a href="${escape(href)}">${escape(text)}</a>`
      }

      return `<a href="${escape(href)}" target="_blank">${escape(text)}</a>`
    } catch (e) {
      return escape(text)
    }
  },
  // @todo
  checkbox({ checked }) {
    return `<span class="check">${checked ? '[x]' : '[ ]'}</span>`
  },
  code({ text, lang }) {
    const language = hljs.getLanguage(lang) ? lang : 'bash'
    const classAttr = 'hljs language_' + escape(language)
    const html = [
      '<pre>',
      `<code class="${classAttr}">`,
      hljs.highlight(text, { language }).value,
      '</code>',
      '</pre>'
    ].join('')
    return html
  },
  codespan({ text }) {
    return `<span class="codespan">${escape(text)}</span>`
  },
  blockquote({ text }) {
    return `<p class="codespan">${escape(text)}</p>`
  }
}

marked.use(mangle(), { renderer })

function emojiConvert(text: string): string {
  const regexp = /(^|\s)(:[a-zA-Z0-9_+]+:)(\s|$)/
  let found = null
  let index = 0
  let convertedStr = ''
  while ((found = regexp.exec(text.substring(index))) !== null) {
    const [, p1, emojiStr] = found
    const offset = found.index + p1.length
    convertedStr += found.input.substring(0, offset)
    convertedStr += emojis.has(emojiStr as EmojisKey)
      ? emojis.get(emojiStr as EmojisKey).value
      : emojiStr
    index += offset + emojiStr.length
    found = text.substring(index).match(regexp)
  }
  if (index < text.length) {
    convertedStr += text.substring(index)
  }
  return convertedStr
}

// markedで取りこぼしたものをescape
function postEscape(str: string) {
  return str.replace(/<marquee[^\s]+marquee>/g, (match) => {
    return escape(match)
  })
}

export class MessageConverter {
  async convertToHtml(message: string) {
    const html = await marked.parse(message, { async: true })
    return postEscape(html)
  }
}

expose(MessageConverter)
