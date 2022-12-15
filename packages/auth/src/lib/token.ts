import jwt from 'jsonwebtoken'
import { JWT } from '../config.js'

export type AccessToken = {
  user: {
    _id: string
    twitterId: string | null
    githubId: string | null
  }
}

export const createAccessToken = (user: {
  _id: string
  twitterId?: string
  githubId?: string
}) => {
  return new Promise<string>((resolve, reject) => {
    const payload: AccessToken = {
      user: {
        _id: user._id,
        twitterId: user.twitterId ?? null,
        githubId: user.githubId ?? null
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

export const createTokens = async (user: {
  _id: string
  twitterId?: string
  githubId?: string
}) => {
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
