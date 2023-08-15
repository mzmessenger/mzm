/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert'
import { test, expect, vi } from 'vitest'
import { saveParameterToSession } from './index.js'
import { ALLOW_REDIRECT_URIS } from '../../config.js'

vi.mock('../session.js')

import { saveCodeChallenge } from '../session.js'

test('saveParameterToSession', async () => {
  const saveCodeChallengeMock = vi
    .mocked(saveCodeChallenge)
    .mockClear()
    .mockResolvedValueOnce({
      code_challenge: '',
      code_challenge_method: '',
      redirect_uri: ''
    })

  const req = {
    query: {
      code_challenge: 'code_challenge',
      code_challenge_method: 'S256',
      redirect_uri: ALLOW_REDIRECT_URIS[0]
    }
  }
  const res = await saveParameterToSession(req as any)
  expect(saveCodeChallengeMock).toBeCalledTimes(1)
  expect(res.success).toStrictEqual(true)
  assert.strictEqual(res.success, true)
  expect(res.data.code_challenge).toStrictEqual(req.query.code_challenge)
  expect(res.data.code_challenge_method).toStrictEqual(
    req.query.code_challenge_method
  )
  expect(res.data.redirect_uri).toStrictEqual(req.query.redirect_uri)
})

test.each([
  ['', 'S256', ALLOW_REDIRECT_URIS[0]],
  ['code_challenge', 'text', ALLOW_REDIRECT_URIS[0]],
  ['code_challenge', 'S256', 'invalid_redirect_uri']
])(
  'fail saveParameterToSession (code_challenge: %s, code_challenge_method: %s, redirect_uri: %s)',
  async (code_challenge, code_challenge_method, redirect_uri) => {
    vi.mocked(saveCodeChallenge).mockClear().mockResolvedValueOnce({
      code_challenge: '',
      code_challenge_method: '',
      redirect_uri: ''
    })

    const req = {
      query: {
        code_challenge,
        code_challenge_method,
        redirect_uri
      }
    }
    const res = await saveParameterToSession(req as any)
    expect(res.success).toStrictEqual(false)
    assert.strictEqual(res.success, false)
    expect(res.error.status).toStrictEqual(400)
  }
)
