/* eslint-disable @typescript-eslint/no-explicit-any,no-empty-pattern */
import assert from 'node:assert'
import { test as baseTest, expect, vi } from 'vitest'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import { getTestMongoClient } from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import { verifyAccessToken } from 'mzm-shared/src/auth/index'

vi.mock('../lib/redis.js', async () => {
  return { sessionRedis: vi.fn() }
})

vi.mock('mzm-shared/src/auth/index', async () => {
  const actual = await vi.importActual<
    typeof import('mzm-shared/src/auth/index')
  >('mzm-shared/src/auth/index')
  return {
    ...actual,
    verifyAccessToken: vi.fn()
  }
})

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

import { removeTwitter } from './twitter.js'

test('removeTwitter', async ({ testDb }) => {
  const user = await collections(testDb).users.insertOne({
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

  await removeTwitter(req as any, testDb)
  expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)

  const updated = await collections(testDb).users.findOne({
    _id: user.insertedId
  })
  expect(updated?.twitterId).toStrictEqual(undefined)
  expect(updated?.twitterUserName).toStrictEqual(undefined)
  expect(updated?.githubId).toStrictEqual('githubId')
  expect(updated?.githubUserName).toStrictEqual('githubUserName')
})

test('removeTwitter (no access token)', async ({ testDb }) => {
  expect.assertions(1)

  const req = {
    headers: {}
  }

  try {
    await removeTwitter(req as any, testDb)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('removeTwitter (not linked)', async ({ testDb }) => {
  expect.assertions(3)

  const user = await collections(testDb).users.insertOne({
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
    await removeTwitter(req as any, testDb)
  } catch (e) {
    expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)
    assert(e instanceof BadRequest)
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('not linked')
  }
})

test('removeTwitter (can not remove)', async ({ testDb }) => {
  expect.assertions(3)

  const user = await collections(testDb).users.insertOne({
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
    await removeTwitter(req as any, testDb)
  } catch (e) {
    expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)
    assert(e instanceof BadRequest)
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('can not remove')
  }
})
