/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { Request } from 'express'

const save = async (req: Request, key: string, data: unknown) => {
  return new Promise((resolve, reject) => {
    // @ts-expect-error
    req.session[key] = data
    req.session.save((err) => {
      if (err) {
        return reject({
          success: false,
          error: { message: err.message }
        })
      }
      resolve({ success: true, data })
    })
  })
}

type SaveCodeChallenge = {
  code_challenge: string
  code_challenge_method: string
  redirect_uri: string
}
const codeChallengeKey = 'mzm:oauth:code_challenge'

export const saveCodeChallenge = async (
  req: Request,
  options: SaveCodeChallenge
) => {
  const data: SaveCodeChallenge = options
  await save(req, codeChallengeKey, data)
  return data
}

export const getCodeChallenge = async (req: Request) => {
  // @ts-expect-error
  const val = req.session[codeChallengeKey]
  if (val) {
    return val as SaveCodeChallenge
  }
  return null
}

export const removeCodeChallenge = async (req: Request) => {
  // @ts-expect-error
  delete req.session[codeChallengeKey]
}
