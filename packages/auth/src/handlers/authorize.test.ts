/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert'
import { test, expect, vi, beforeAll } from 'vitest'
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

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import(
    '../../test/testUtil.js'
  )
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('token (authorization_code)', async () => {
  const mongoClient = await getTestMongoClient(globalThis)
  const genCode = await generateUniqAuthorizationCode(mongoClient)
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const user = await collections(
    await getTestMongoClient(globalThis)
  ).users.insertOne({
    twitterId: 'twitterId',
    githubId: 'githubId'
  })

  expect(genCode.success).toStrictEqual(true)
  assert.strictEqual(genCode.success, true)

  await saveAuthorizationCode(mongoClient, {
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

  const res = await createTokenHandler()({ body } as any)

  expect(res.accessToken).toStrictEqual('accessToken')
  expect(res.refreshToken).toStrictEqual('refreshToken')
  expect(res.user._id).toStrictEqual(user.insertedId.toHexString())
  expect(res.user.twitterId).toStrictEqual('twitterId')
  expect(res.user.githubId).toStrictEqual('githubId')
})

test('token (refresh_token)', async () => {
  const user = await collections(
    await getTestMongoClient(globalThis)
  ).users.insertOne({
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

  const res = await createTokenHandler()({ body } as any)

  expect(verifyRefreshTokenMock).toBeCalledTimes(1)
  expect(verifyRefreshTokenMock).toHaveBeenCalledWith('sendRefreshTokenValue')
  expect(res.accessToken).toStrictEqual('accessToken')
  expect(res.refreshToken).toStrictEqual('refreshToken')
  expect(res.user._id).toStrictEqual(user.insertedId.toHexString())
  expect(res.user.twitterId).toStrictEqual('twitterId')
  expect(res.user.githubId).toStrictEqual('githubId')
})

test('fail token (invalid grant_type)', async () => {
  expect.assertions(1)

  const body = {
    grant_type: 'access_token'
  }

  try {
    await createTokenHandler()({ body } as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('fail token (invalid code)', async () => {
  expect.assertions(1)
  const mongoClient = await getTestMongoClient(globalThis)

  const genCode = await generateUniqAuthorizationCode(mongoClient)
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const user = await collections(
    await getTestMongoClient(globalThis)
  ).users.insertOne({
    twitterId: 'twitterId',
    githubId: 'githubId'
  })

  assert.strictEqual(genCode.success, true)

  await saveAuthorizationCode(mongoClient, {
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
    await createTokenHandler()({ body } as any)
  } catch (e) {
    expect(e instanceof Unauthorized).toStrictEqual(true)
  }
})

test('fail token (invalid refresh_token)', async () => {
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
    await createTokenHandler()({ body } as any)
  } catch (e) {
    expect(e instanceof Unauthorized).toStrictEqual(true)
    expect(verifyRefreshTokenMock).toBeCalledTimes(1)
  }
})
