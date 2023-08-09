/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert'
import { test, expect, vi, beforeAll } from 'vitest'
import { BadRequest } from 'mzm-shared/lib/errors'
import { getTestMongoClient } from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import { verifyAccessToken } from 'mzm-shared/auth/index'

vi.mock('../lib/redis.js', async () => {
  return { sessionRedis: vi.fn() }
})

vi.mock('../lib/db.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/db.js')>(
    '../lib/db.js'
  )
  return { ...actual, mongoClient: vi.fn() }
})

vi.mock('mzm-shared/auth/index', async () => {
  const actual = await vi.importActual<typeof import('mzm-shared/auth/index')>(
    'mzm-shared/auth/index'
  )
  return {
    ...actual,
    verifyAccessToken: vi.fn()
  }
})

import { removeTwitter } from './twitter.js'

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('removeTwitter', async () => {
  const db = await getTestMongoClient(globalThis)
  const user = await collections(db).users.insertOne({
    twitterId: 'twitterId',
    twitterUserName: 'twitterUserName',
    githubId: 'githubId',
    githubUserName: 'githubUserName'
  })

  const verifyAccessTokenMock = vi
    .mocked(verifyAccessToken)
    .mockClear()
    .mockResolvedValueOnce({
      err: null,
      decoded: {
        user: {
          _id: user.insertedId.toHexString(),
          twitterUserName: 'twitterUserName',
          twitterId: 'twitterId',
          githubId: 'githubId',
          githubUserName: 'githubUserName'
        }
      }
    })

  const req = {
    headers: {
      Authorization: `Bearer xxx`
    }
  }

  await removeTwitter(req as any)
  expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)

  const updated = await collections(db).users.findOne({
    _id: user.insertedId
  })
  expect(updated?.twitterId).toStrictEqual(undefined)
  expect(updated?.twitterUserName).toStrictEqual(undefined)
  expect(updated?.githubId).toStrictEqual('githubId')
  expect(updated?.githubUserName).toStrictEqual('githubUserName')
})

test('removeTwitter (no access token)', async () => {
  expect.assertions(1)

  const req = {
    headers: {}
  }

  try {
    await removeTwitter(req as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('removeTwitter (not linked)', async () => {
  expect.assertions(3)

  const db = await getTestMongoClient(globalThis)
  const user = await collections(db).users.insertOne({
    githubId: 'githubId',
    githubUserName: 'githubUserName'
  })

  const verifyAccessTokenMock = vi
    .mocked(verifyAccessToken)
    .mockClear()
    .mockResolvedValueOnce({
      err: null,
      decoded: {
        user: {
          _id: user.insertedId.toHexString(),
          twitterUserName: null,
          twitterId: null,
          githubId: 'githubId',
          githubUserName: 'githubUserName'
        }
      }
    })

  const req = {
    headers: {
      Authorization: `Bearer xxx`
    }
  }

  try {
    await removeTwitter(req as any)
  } catch (e) {
    expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)
    assert(e instanceof BadRequest)
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('not linked')
  }
})

test('removeTwitter (can not remove)', async () => {
  expect.assertions(3)

  const db = await getTestMongoClient(globalThis)
  const user = await collections(db).users.insertOne({
    twitterId: 'twitterId',
    twitterUserName: 'twitterUserName'
  })

  const verifyAccessTokenMock = vi
    .mocked(verifyAccessToken)
    .mockClear()
    .mockResolvedValueOnce({
      err: null,
      decoded: {
        user: {
          _id: user.insertedId.toHexString(),
          twitterUserName: 'twitterId',
          twitterId: 'twitterUserName',
          githubId: null,
          githubUserName: null
        }
      }
    })

  const req = {
    headers: {
      Authorization: `Bearer xxx`
    }
  }

  try {
    await removeTwitter(req as any)
  } catch (e) {
    expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)
    assert(e instanceof BadRequest)
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('can not remove')
  }
})
