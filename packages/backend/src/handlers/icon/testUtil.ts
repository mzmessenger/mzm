import type { Readable } from 'stream'
import type { headObject, getObject } from '../../lib/storage'

export const createHeadObjectMockValue = (options: {
  ETag: string
  ContentType: string
  ContentLength: number
  LastModified: Date
  CacheControl: string
}) => {
  const headers: Awaited<ReturnType<typeof headObject>> = {
    ETag: options.ETag,
    ContentType: options.ContentType,
    ContentLength: options.ContentLength,
    LastModified: options.LastModified,
    CacheControl: options.CacheControl,
    $response: undefined
  }

  return headers
}

export const createGetObjectMockValue = (options: {
  createReadStream: Readable
}) => {
  const mock: Awaited<ReturnType<typeof getObject>> = {
    createReadStream: () => options.createReadStream,
    abort: undefined,
    eachPage: undefined,
    isPageable: undefined,
    send: undefined,
    on: undefined,
    onAsync: undefined,
    promise: undefined,
    startTime: undefined,
    httpRequest: undefined
  }

  return mock
}
