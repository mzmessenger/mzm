/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { Readable } from 'stream'
import type { headObject, getObject } from '../../lib/storage.js'

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
    // @ts-expect-error
    $response: undefined
  }

  return headers
}

export const createGetObjectMockValue = (options: {
  createReadStream: Readable
}) => {
  const mock: Awaited<ReturnType<typeof getObject>> = {
    createReadStream: () => options.createReadStream,
    // @ts-expect-error
    abort: undefined,
    // @ts-expect-error
    eachPage: undefined,
    // @ts-expect-error
    isPageable: undefined,
    // @ts-expect-error
    send: undefined,
    // @ts-expect-error
    on: undefined,
    // @ts-expect-error
    onAsync: undefined,
    // @ts-expect-error
    promise: undefined,
    // @ts-expect-error
    startTime: undefined,
    // @ts-expect-error
    httpRequest: undefined
  }

  return mock
}
