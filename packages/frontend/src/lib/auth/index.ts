const createCodeVerifier = () => {
  const mask =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.'

  const randomValues = crypto.getRandomValues(new Uint8Array(43))

  let random = ''
  for (const value of randomValues) {
    random += mask[value % mask.length]
  }

  return random
}

const convertSha256 = async (str: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hash = await crypto.subtle.digest({ name: 'SHA-256' }, data)

  return urlsafeBase64Encode(hash)
}

const urlsafeBase64Encode = (buffer: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/=/g, '')
}

const generateCodeChallenge = async (codeVerifier: string) => {
  const challenge = await convertSha256(codeVerifier)

  return challenge
}

export const pkceChallenge = async () => {
  const code_verifier = createCodeVerifier()
  const code_challenge = await generateCodeChallenge(code_verifier)

  return {
    code_verifier,
    code_challenge
  }
}

export const verifyCodeChallenge = async (
  code_verifier: string,
  code_challenge: string
) => {
  const generated = await generateCodeChallenge(code_verifier)

  return generated === code_challenge
}
