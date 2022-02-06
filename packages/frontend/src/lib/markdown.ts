import { wrap } from 'comlink'
import type { Markdown } from '../worker/markdown'

const MarkdownWorker = wrap<typeof Markdown>(
  new Worker('../worker/markdown', { type: 'module' })
)

let markdown: Awaited<InstanceType<typeof MarkdownWorker>> = null

export async function convertToHtml(message: string): Promise<string> {
  // eslint-disable-next-line require-atomic-updates
  if (!markdown) markdown = await new MarkdownWorker()

  return await markdown.convertToHtml(message)
}
