/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

vi.mock('../config.js', async () => ({
  ...(await import('../../test/mock.js')).mockConfig
}))

import { createTokens, verifyRefreshToken } from './token.js'

beforeEach(() => {
  vi.resetAllMocks()
})

test('verifyRefreshToken', async () => {
  const user = {
    _id: new ObjectId().toHexString(),
    twitterId: 'twitterId',
    twitterUserName: 'twitterUserName',
    githubId: 'githubId',
    githubUserName: 'githubUserName'
  }
  const { refreshToken } = await createTokens(user)

  const { err, decoded } = await verifyRefreshToken(refreshToken)
  expect(err).toStrictEqual(null)
  expect(decoded?.user?._id).toStrictEqual(user._id)
})
