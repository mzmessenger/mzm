/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert'
import { test, expect, vi, beforeAll } from 'vitest'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import { getTestMongoClient } from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import { verifyAccessToken } from 'mzm-shared/src/auth/index'

vi.mock('../lib/logger.js')

vi.mock('../lib/redis.js', async () => {
  return { sessionRedis: vi.fn() }
})

vi.mock('../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/db.js')>('../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
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

import { removeGithub } from './github.js'

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('removeGithub', async () => {
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

  await removeGithub(req as any)
  expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)

  const updated = await collections(db).users.findOne({
    _id: user.insertedId
  })
  expect(updated?.twitterId).toStrictEqual('twitterId')
  expect(updated?.twitterUserName).toStrictEqual('twitterUserName')
  expect(updated?.githubId).toStrictEqual(undefined)
  expect(updated?.githubUserName).toStrictEqual(undefined)
})

test('removeGithub (no access token)', async () => {
  expect.assertions(1)

  const req = {
    headers: {}
  }

  try {
    await removeGithub(req as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('removeGithub (not linked)', async () => {
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
          twitterUserName: 'twitterUserName',
          twitterId: 'twitterId',
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
    await removeGithub(req as any)
  } catch (e) {
    expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)
    assert(e instanceof BadRequest)
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('not linked')
  }
})

test('removeGithub (can not remove)', async () => {
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
    await removeGithub(req as any)
  } catch (e) {
    expect(verifyAccessTokenMock).toHaveBeenCalledTimes(1)
    assert(e instanceof BadRequest)
    expect(e instanceof BadRequest).toStrictEqual(true)
    expect(e.toResponse()).contains('can not remove')
  }
})
