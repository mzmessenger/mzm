/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, vi, beforeEach } from 'vitest'
import { BadRequest, Unauthorized } from 'mzm-shared/lib/errors'
import {
  generateCodeVerifier,
  getTestRedisClient,
  getTestMongoClient
} from '../../test/testUtil.js'
import {
  generageAuthorizationCode,
  saveAuthorizationCode
} from '../lib/pkce/index.js'
import { generateCodeChallenge } from '../lib/pkce/util'
import { collections } from '../lib/db.js'
import { createTokens, verifyRefreshToken } from '../lib/token.js'

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

vi.mock('../lib/token.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/token.js')>(
    '../lib/token.js'
  )
  return {
    ...actual,
    createTokens: vi.fn(),
    verifyRefreshToken: vi.fn()
  }
})

import { token } from './authorize'

beforeEach(() => {
  vi.resetAllMocks()
})

test('token (authorization_code)', async () => {
  const code = generageAuthorizationCode()
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const user = await collections(await getTestMongoClient()).users.insertOne({
    twitterId: 'twitterId',
    githubId: 'githubId'
  })

  const { sessionRedis } = await getTestRedisClient()
  await saveAuthorizationCode(sessionRedis, {
    code,
    code_challenge,
    userId: user.insertedId.toHexString()
  })

  vi.mocked(createTokens).mockResolvedValue({
    accessToken: 'accessToken',
    refreshToken: 'refreshToken'
  })

  const body = {
    code,
    grant_type: 'authorization_code',
    code_verifier
  }

  const res = await token({ body } as any)

  expect(res.accessToken).toStrictEqual('accessToken')
  expect(res.refreshToken).toStrictEqual('refreshToken')
  expect(res.user._id).toStrictEqual(user.insertedId.toHexString())
  expect(res.user.twitterId).toStrictEqual('twitterId')
  expect(res.user.githubId).toStrictEqual('githubId')
})

test('token (refresh_token)', async () => {
  const user = await collections(await getTestMongoClient()).users.insertOne({
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

  const res = await token({ body } as any)

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
    await token({ body } as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('fail token (invalid code)', async () => {
  expect.assertions(1)

  const code = generageAuthorizationCode()
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const user = await collections(await getTestMongoClient()).users.insertOne({
    twitterId: 'twitterId',
    githubId: 'githubId'
  })

  const { sessionRedis } = await getTestRedisClient()
  await saveAuthorizationCode(sessionRedis, {
    code,
    code_challenge,
    userId: user.insertedId.toHexString()
  })

  const body = {
    code: 'invalid_code',
    grant_type: 'authorization_code',
    code_verifier
  }

  try {
    await token({ body } as any)
  } catch (e) {
    expect(e instanceof Unauthorized).toStrictEqual(true)
  }
})

test('fail token (invalid refresh_token)', async () => {
  expect.assertions(2)

  const actual = await vi.importActual<typeof import('../lib/token.js')>(
    '../lib/token.js'
  )
  const verifyRefreshTokenMock = vi
    .mocked(verifyRefreshToken)
    .mockImplementation(actual.verifyRefreshToken)

  const body = {
    grant_type: 'refresh_token',
    refresh_token: 'invalid_refresh_token'
  }

  try {
    await token({ body } as any)
  } catch (e) {
    expect(e instanceof Unauthorized).toStrictEqual(true)
    expect(verifyRefreshTokenMock).toBeCalledTimes(1)
  }
})
