import { promisify } from 'node:util'
import imageSize from 'image-size'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const _sizeOf = promisify(imageSize)

export const sizeOf = async (path: string) => {
  const dimentions = await _sizeOf(path)
  return { width: dimentions.width, height: dimentions.height }
}
