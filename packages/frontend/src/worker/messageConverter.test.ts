import { test, expect } from 'vitest'
import escape from 'validator/lib/escape'
import { MessageConverter } from './messageConverter'

const worker = new MessageConverter()

test.each([
  [
    'simple link',
    'https://mzm.dev',
    `<p><a href="${escape('https://mzm.dev')}" target="_blank">${escape('https://mzm.dev')}</a></p>`
  ],
  [
    'markdown link',
    '[mzm](https://mzm.dev)',
    `<p><a href="${escape('https://mzm.dev')}" target="_blank">mzm</a></p>`
  ],
  [
    'simple link (top)',
    `http://${location.host}`,
    `<p><a href="${escape(`http://${location.host}`)}">${escape(`http://${location.host}`)}</a></p>`
  ],
  [
    'simple link (room)',
    `http://${location.host}/rooms/test`,
    `<p><a class="mzm-room-link" href="${escape(`http://${location.host}/rooms/test`)}">${escape(`/rooms/test`)}</a></p>`
  ],
  [
    'simple  link (room:日本語)',
    `http://${location.host}/rooms/要望室`,
    `<p><a class="mzm-room-link" href="${escape(`http://${location.host}/rooms/要望室`)}">${escape(`/rooms/要望室`)}</a></p>`
  ],
  [
    'markdown link (room)',
    `[makrdownlink](https://${location.host}/rooms/test)`,
    `<p><a href="${escape(`https://${location.host}/rooms/test`)}">makrdownlink</a></p>`
  ],
  [
    'marquee',
    '<marquee>aaa</marquee>',
    '<p>&lt;marquee&gt;aaa&lt;&#x2F;marquee&gt;</p>'
  ],
  [
    'code(bash:default)',
    `\`\`\`
$ echo foo
\`\`\``,
    '<pre><code class="hljs language_bash">$ <span class="hljs-built_in">echo</span> foo</code></pre>'
  ],
  [
    'code(javascript)',
    `\`\`\`javascript
console.log(1)
\`\`\``,
    `<pre>
  <code class="hljs language_javascript">
    <span class="hljs-variable language_">console</span>.<span class="hljs-title function_">log</span>(<span class="hljs-number">1</span>)
  </code>
</pre>`
  ],
  [
    'codespan',
    `precodespan \`codespan\` postcodespan`,
    `<p>precodespan <span class="codespan">codespan</span> postcodespan</p>`
  ],
  [
    'emoji',
    `:smile: aa :smile: bb :foobar: cc :+1: dd`,
    `<p>😊 aa 😊 bb :foobar: cc 👍 dd</p>`
  ],
  [
    'emoji in code',
    `\`\`\`
:smile: aa :smile: bb :foobar: cc :+1:
\`\`\``,
    '<pre><code class="hljs language_bash">:smile: aa :smile: bb :foobar: cc :+1:</code></pre>'
  ],
  [
    'emoji in codespan',
    '`:smile: aa :smile: bb :foobar: cc :+1: dd`',
    `<p><span class="codespan">:smile: aa :smile: bb :foobar: cc :+1: dd</span></p>`
  ],
  ['ipv6', '2001:db8::1', `<p>2001:db8::1</p>`],
  ['image', `![imagename](http://${location.host}/icon/rooms/test/1)`, `<p><img src="${escape(`http://${location.host}/icon/rooms/test/1`)}" alt="imagename" /></p>`],
])('convertToHtml (%s)', async (_label, src, converted) => {
  const html = await worker.convertToHtml(src)
  const expected = converted
    .split('\n')
    .map((text) => {
      text = text.trim()
      return text
    })
    .join('')
  expect(html.trim()).toEqual(expected)
})
