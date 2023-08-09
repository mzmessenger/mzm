import { marked } from 'marked'
import { mangle } from 'marked-mangle'
import escape from 'validator/lib/escape'
import { expose } from 'comlink'
import { emojis, type EmojisKey } from '../constants'

// bundle size
import hljs from 'highlight.js/lib/common'

const escapeTxt = (text: string) => escape(text)
const r = new marked.Renderer()
const originalLink = r.link.bind(r)

marked.use(
  mangle(),
  {
    headerIds: false
  },
  {
    renderer: {
      text: (text) => {
        try {
          return emojiConvert(text)
        } catch (e) {
          return text
        }
      },
      heading: escapeTxt,
      html: escapeTxt,
      hr: () => '',
      table: escapeTxt,
      tablerow: escapeTxt,
      tablecell: escapeTxt,
      em: escapeTxt,
      br: () => '',
      image: escapeTxt,
      link: (href, title, text) => {
        const url = new URL(href)

        if (
          url.host === location.host &&
          url.pathname !== '/' &&
          href === text
        ) {
          return originalLink(
            href,
            title,
            text.slice(text.indexOf('/rooms'))
          ).replace('<a ', `<a class="mzm-room-link" `)
        }

        return originalLink(href, title, text)
      },
      // @todo
      checkbox: (checked) => {
        return `<span class="check">${checked ? '[x]' : '[ ]'}</span>`
      },
      code: (code, lang) => {
        const language = hljs.getLanguage(lang) ? lang : 'bash'
        const classAttr = 'hljs language_' + escape(language)
        const html = [
          '<pre>',
          `<code class="${classAttr}">`,
          hljs.highlight(code, { language }).value,
          '</code>',
          '</pre>'
        ].join('')
        return html
      },
      codespan: (code) => {
        const html = ['<span class="codespan">', escapeTxt(code), '</span>']
        return html.join('')
      }
    }
  }
)

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
