import { marked } from 'marked'
import { mangle } from 'marked-mangle'
import escape from 'validator/lib/escape'
import { expose } from 'comlink'

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
      heading: escapeTxt,
      html: escapeTxt,
      hr: () => '',
      table: escapeTxt,
      tablerow: escapeTxt,
      tablecell: escapeTxt,
      em: escapeTxt,
      codespan: escapeTxt,
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
      }
    }
  }
)

// markedで取りこぼしたものをescape
const postEscape = (str: string) => {
  return str.replace(/<marquee[^\s]+marquee>/g, (match) => {
    return escape(match)
  })
}

export class Markdown {
  async convertToHtml(message: string) {
    const html = await marked.parse(message, { async: true })
    return postEscape(html)
  }
}

expose(Markdown)
