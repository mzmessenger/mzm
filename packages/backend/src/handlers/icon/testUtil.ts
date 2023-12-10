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

type GetObject = Awaited<ReturnType<typeof getObject>>

export const createGetObjectMockValue = async (options: { Body: Readable }) => {
  const mock: GetObject = {
    Body: options.Body as GetObject['Body'],
    $metadata: {}
  }

  return mock
}
