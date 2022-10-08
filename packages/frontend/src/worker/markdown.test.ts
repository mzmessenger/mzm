import { test, expect } from 'vitest'
import { Markdown } from './markdown'

test.each([
  [
    'simple link',
    'http://mzm.dev',
    '<p><a href="http://mzm.dev">http://mzm.dev</a></p>'
  ],
  [
    'markdown link',
    '[mzm](https://mzm.dev)',
    '<p><a href="https://mzm.dev">mzm</a></p>'
  ],
  [
    'simple link (top)',
    `http://${location.host}`,
    `<p><a href="http://${location.host}">http://${location.host}</a></p>`
  ],
  [
    'simple link (room)',
    `http://${location.host}/rooms/test`,
    `<p><a class="mzm-room-link" href="http://${location.host}/rooms/test">/rooms/test</a></p>`
  ],
  [
    'simple  link (room:日本語)',
    `http://${location.host}/rooms/要望室`,
    `<p><a class="mzm-room-link" href="http://${location.host}/rooms/%E8%A6%81%E6%9C%9B%E5%AE%A4">/rooms/要望室</a></p>`
  ],
  [
    'markdown link (room)',
    `[makrdownlink](https://${location.host}/rooms/test)`,
    `<p><a href="https://${location.host}/rooms/test">makrdownlink</a></p>`
  ],
  [
    'marquee',
    '<marquee>aaa</marquee>',
    '<p>&lt;marquee&gt;aaa&lt;&#x2F;marquee&gt;</p>'
  ]
])('convertToHtml (%s)', async (_label, src, converted) => {
  const worker = new Markdown()
  const html = await worker.convertToHtml(src)
  expect(html.trim()).toEqual(converted)
})
