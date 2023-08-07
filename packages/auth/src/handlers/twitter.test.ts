/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, vi, beforeEach } from 'vitest'
import { BadRequest } from 'mzm-shared/lib/errors'
import { getTestMongoClient } from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import { verifyAccessToken } from 'mzm-shared/auth/index'

vi.mock('../config.js', async () => ({
  ...(await import('../../test/mock.js')).mockConfig
}))
vi.mock('../lib/logger.js', async () => ({
  ...(await import('../../test/mock.js')).mockLogger
}))

vi.mock('../lib/redis.js', async () => {
  const { mockRedis } = await import('../../test/mock.js')
  return { ...(await mockRedis()) }
})

vi.mock('../lib/db.js', async () => {
  const { mockDb } = await import('../../test/mock.js')
  return { ...(await mockDb(await vi.importActual('../lib/db.js'))) }
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

beforeEach(() => {
  vi.resetAllMocks()
})

test('removeTwitter', async () => {
  const db = await getTestMongoClient()
  const user = await collections(db).users.insertOne({
    twitterId: 'twitterId',
    twitterUserName: 'twitterUserName',
    githubId: 'githubId',
    githubUserName: 'githubUserName'
  })

  const verifyAccessTokenMock = vi.mocked(verifyAccessToken).mockResolvedValue({
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

  const db = await getTestMongoClient()
  const user = await collections(db).users.insertOne({
    githubId: 'githubId',
    githubUserName: 'githubUserName'
  })

  const verifyAccessTokenMock = vi.mocked(verifyAccessToken).mockResolvedValue({
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
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('not linked')
  }
})

test('removeTwitter (can not remove)', async () => {
  expect.assertions(3)

  const db = await getTestMongoClient()
  const user = await collections(db).users.insertOne({
    twitterId: 'twitterId',
    twitterUserName: 'twitterUserName'
  })

  const verifyAccessTokenMock = vi.mocked(verifyAccessToken).mockResolvedValue({
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
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('can not remove')
  }
})
