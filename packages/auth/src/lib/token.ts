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
        twitterUserName: user.twitterUserName ?? null,
        githubId: user.githubId ?? null,
        githubUserName: user.githubUserName ?? null
      }
    }

    jwt.sign(
      payload,
      JWT.accessTokenSecret,
      {
        expiresIn: '30m',
        issuer: JWT.issuer,
        subject: 'access token',
        audience: JWT.audience
      },
      (err, token) => {
        if (err) {
          return reject(err)
        }
        if (!token) {
          return reject('no token')
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
      {
        expiresIn: '30d',
        issuer: JWT.issuer,
        subject: 'refresh token',
        audience: JWT.audience
      },
      (err, token) => {
        if (err) {
          return reject(err)
        }
        if (!token) {
          return reject('no token')
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

type PartialRefresToken = {
  user?: Partial<RefeshToken['user']>
}

export const verifyRefreshToken = (token: string) => {
  return new Promise<
    | {
        err: jwt.VerifyErrors
        decoded: null
      }
    | {
        err: null
        decoded: jwt.JwtPayload & PartialRefresToken
      }
  >((resolve) => {
    jwt.verify(
      token,
      JWT.refreshTokenSecret,
      { algorithms: ['HS256'] },
      (err, decode) => {
        if (err) {
          return resolve({
            err,
            decoded: null
          })
        }
        const d = decode as jwt.JwtPayload & PartialRefresToken
        resolve({
          err: null,
          decoded: d
        })
      }
    )
  })
}
