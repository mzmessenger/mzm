import { wrap, Remote } from 'comlink'
import type { MessageConverter } from '../worker/messageConverter'

let markdown: Awaited<InstanceType<Remote<typeof MessageConverter>>> = null

export async function convertToHtml(message: string): Promise<string> {
  if (!markdown) {
    const MWorker = await import('../worker/messageConverter?worker')
    const MarkdownWorker = wrap<typeof MessageConverter>(new MWorker.default())

    markdown = await new MarkdownWorker()
  }

  return await markdown.convertToHtml(message)
}
