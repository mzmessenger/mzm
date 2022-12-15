import type { AccessToken } from 'mzm-shared/type/auth'
import jwt from 'jsonwebtoken'
import { JWT } from '../config.js'

type CreateAccessTokenArgs = {
  _id: string
  twitterId?: string
  twitterUserName?: string
  githubId?: string
  githubUserName?: string
}

export const createAccessToken = (user: CreateAccessTokenArgs) => {
  return new Promise<string>((resolve, reject) => {
    const payload: AccessToken = {
      user: {
        _id: user._id,
        twitterId: user.twitterId ?? null,
        twitterUserName: user.twitterUserName,
        githubId: user.githubId ?? null,
        githubUserName: user.githubUserName ?? null
      }
    }

    jwt.sign(
      payload,
      JWT.accessTokenSecret,
      {
        expiresIn: '10m'
      },
      (err, token) => {
        if (err) {
          return reject(err)
        }
        resolve(token)
      }
    )
  })
}

export type RefeshToken = {
  user: {
    _id: string
  }
}

const createRefreshToken = (_id: string) => {
  return new Promise<string>((resolve, reject) => {
    const payload: RefeshToken = {
      user: { _id }
    }
    jwt.sign(
      payload,
      JWT.refreshTokenSecret,
      { expiresIn: '30d' },
      (err, token) => {
        if (err) {
          return reject(err)
        }
        resolve(token)
      }
    )
  })
}

export const createTokens = async (user: CreateAccessTokenArgs) => {
  const accessToken = await createAccessToken(user)
  const refreshToken = await createRefreshToken(user._id)

  return {
    accessToken,
    refreshToken
  }
}

export const decodeRefreshToken = (token: string) => {
  return new Promise<jwt.JwtPayload | string>((resolve, reject) => {
    jwt.verify(token, JWT.refreshTokenSecret, (err, decode) => {
      if (err) {
        return reject()
      }
      resolve(decode)
    })
  })
}
