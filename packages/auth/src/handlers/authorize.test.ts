/* eslint-disable @typescript-eslint/no-explicit-any,no-empty-pattern */
import assert from 'node:assert'
import { test as baseTest, expect, vi } from 'vitest'
import { BadRequest, Unauthorized } from 'mzm-shared/src/lib/errors'
import {
  getTestMongoClient
} from '../../test/testUtil.js'
import {
  saveAuthorizationCode,
  generateUniqAuthorizationCode
} from '../lib/pkce/index.js'
import {
  generateCodeChallenge,
  generateCodeVerifier
} from '../lib/pkce/util.js'
import { collections } from '../lib/db.js'
import { createTokens, verifyRefreshToken } from '../lib/token.js'

vi.mock('../lib/logger.js')

vi.mock('../lib/redis.js', async () => {
  return { sessionRedis: vi.fn() }
})

vi.mock('../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/db.js')>('../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

vi.mock('../lib/token.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/token.js')>('../lib/token.js')
  return {
    ...actual,
    createTokens: vi.fn(),
    verifyRefreshToken: vi.fn()
  }
})

import { createTokenHandler } from './authorize.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('token (authorization_code)', async ({ testDb }) => {
  const genCode = await generateUniqAuthorizationCode(testDb)
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const user = await collections(testDb).users.insertOne({
    twitterId: 'twitterId',
    githubId: 'githubId'
  })

  expect(genCode.success).toStrictEqual(true)
  assert.strictEqual(genCode.success, true)

  await saveAuthorizationCode(testDb, {
    code: genCode.data.code,
    code_challenge,
    userId: user.insertedId.toHexString()
  })

  vi.mocked(createTokens).mockResolvedValue({
    accessToken: 'accessToken',
    refreshToken: 'refreshToken'
  })

  const body = {
    code: genCode.data.code,
    grant_type: 'authorization_code',
    code_verifier
  }

  const res = await createTokenHandler(testDb)({ body } as any)

  expect(res.accessToken).toStrictEqual('accessToken')
  expect(res.refreshToken).toStrictEqual('refreshToken')
  expect(res.user._id).toStrictEqual(user.insertedId.toHexString())
  expect(res.user.twitterId).toStrictEqual('twitterId')
  expect(res.user.githubId).toStrictEqual('githubId')
})

test('token (refresh_token)', async ({ testDb }) => {
  const user = await collections(testDb).users.insertOne({
    twitterId: 'twitterId',
    githubId: 'githubId'
  })

  vi.mocked(createTokens).mockResolvedValue({
    accessToken: 'accessToken',
    refreshToken: 'refreshToken'
  })

  const verifyRefreshTokenMock = vi
    .mocked(verifyRefreshToken)
    .mockResolvedValue({
      err: null,
      decoded: {
        user: {
          _id: user.insertedId.toHexString()
        }
      }
    })

  const body = {
    grant_type: 'refresh_token',
    refresh_token: 'sendRefreshTokenValue'
  }

  const res = await createTokenHandler(testDb)({ body } as any)

  expect(verifyRefreshTokenMock).toBeCalledTimes(1)
  expect(verifyRefreshTokenMock).toHaveBeenCalledWith('sendRefreshTokenValue')
  expect(res.accessToken).toStrictEqual('accessToken')
  expect(res.refreshToken).toStrictEqual('refreshToken')
  expect(res.user._id).toStrictEqual(user.insertedId.toHexString())
  expect(res.user.twitterId).toStrictEqual('twitterId')
  expect(res.user.githubId).toStrictEqual('githubId')
})

test('fail token (invalid grant_type)', async ({ testDb }) => {
  expect.assertions(1)

  const body = {
    grant_type: 'access_token'
  }

  try {
    await createTokenHandler(testDb)({ body } as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('fail token (invalid code)', async ({ testDb }) => {
  expect.assertions(1)

  const genCode = await generateUniqAuthorizationCode(testDb)
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const user = await collections(testDb).users.insertOne({
    twitterId: 'twitterId',
    githubId: 'githubId'
  })

  assert.strictEqual(genCode.success, true)

  await saveAuthorizationCode(testDb, {
    code: genCode.data.code,
    code_challenge,
    userId: user.insertedId.toHexString()
  })

  const body = {
    code: 'invalid_code',
    grant_type: 'authorization_code',
    code_verifier
  }

  try {
    await createTokenHandler(testDb)({ body } as any)
  } catch (e) {
    expect(e instanceof Unauthorized).toStrictEqual(true)
  }
})

test('fail token (invalid refresh_token)', async ({ testDb }) => {
  expect.assertions(2)

  const actual =
    await vi.importActual<typeof import('../lib/token.js')>('../lib/token.js')
  const verifyRefreshTokenMock = vi
    .mocked(verifyRefreshToken)
    .mockClear()
    .mockImplementationOnce(actual.verifyRefreshToken)

  const body = {
    grant_type: 'refresh_token',
    refresh_token: 'invalid_refresh_token'
  }

  try {
    await createTokenHandler(testDb)({ body } as any)
  } catch (e) {
    expect(e instanceof Unauthorized).toStrictEqual(true)
    expect(verifyRefreshTokenMock).toBeCalledTimes(1)
  }
})
