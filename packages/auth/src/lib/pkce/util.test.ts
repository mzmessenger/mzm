import { test, expect } from 'vitest'
import {
  verifyCodeChallenge,
  generateCodeChallenge,
  verifyAuthorizationCode,
  generateCodeVerifier
} from './util.js'

test('verifyCodeChallenge', () => {
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const verify = verifyCodeChallenge({ code_verifier, code_challenge })
  expect(verify).toStrictEqual(true)
})

test('verifyAuthorizationCode', async () => {
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const verify = await verifyAuthorizationCode({
    code: 'aaa',
    grant_type: 'authorization_code',
    code_verifier,
    code_challenge
  })
  expect(verify.success).toStrictEqual(true)
})

test.each([
  ['empty code', '', 'authorization_code'],
  ['invalid grant_type', 'aaa', 'authorization_code_xxx']
])('verifyAuthorizationCode:fail (%s)', async (_, code, grant_type) => {
  const code_verifier = generateCodeVerifier()
  const code_challenge = generateCodeChallenge(code_verifier)
  const verify = await verifyAuthorizationCode({
    code,
    grant_type,
    code_verifier,
    code_challenge
  })
  expect(verify.success).toStrictEqual(false)
})

test('verifyAuthorizationCode:fail (invalid code_challenge)', async () => {
  const code_verifier = generateCodeVerifier()
  const verify = await verifyAuthorizationCode({
    code: 'aaa',
    grant_type: 'authorization_code',
    code_verifier,
    code_challenge: 'xxx'
  })
  expect(verify.success).toStrictEqual(false)
})
