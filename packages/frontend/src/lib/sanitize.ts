import createDOMPurify from 'dompurify'
const DOMPurify = createDOMPurify(self)

export const sanitize = (html: string) => {
  const sanitize = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
  return sanitize.trim()
}
