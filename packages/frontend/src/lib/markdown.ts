import { wrap, Remote } from 'comlink'
import type { Markdown } from '../worker/markdown'

let markdown: Awaited<InstanceType<Remote<typeof Markdown>>> = null

export async function convertToHtml(message: string): Promise<string> {
  // eslint-disable-next-line require-atomic-updates
  if (!markdown) {
    // @ts-ignore
    const MWorker = await import('../worker/markdown?worker')
    const MarkdownWorker = wrap<typeof Markdown>(new MWorker.default())

    markdown = await new MarkdownWorker()
  }

  return await markdown.convertToHtml(message)
}
