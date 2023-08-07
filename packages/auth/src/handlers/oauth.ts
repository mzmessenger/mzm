import type { Request, Response, NextFunction } from 'express'
import type { PassportStatic } from 'passport'
import type { Redis } from 'ioredis'
import type { Result } from 'mzm-shared/type'
import type { SerializeUser } from '../types.js'
import { sessionRedis } from '../lib/redis.js'
import {
  getParametaerFromState,
  generageAuthorizationCode,
  saveAuthorizationCode,
  saveParameterWithReuqest
} from '../lib/pkce/index.js'
import { logger } from '../lib/logger.js'
import { CLIENT_URL_BASE } from '../config.js'

const _oauthCallback = async (
  req: Request & { user: SerializeUser }
): Promise<Result<{ redirectUrl: string }>> => {
  const { state } = req.query
  if (!state) {
    return { success: false, error: { status: 400, message: 'invalid state' } }
  }

  const params = await getParametaerFromState(sessionRedis!, state as string)
  if (params.success === false) {
    return {
      success: false,
      error: { status: 400, message: params.error.message }
    }
  }
  const code = generageAuthorizationCode()

  await saveAuthorizationCode(sessionRedis!, {
    code,
    code_challenge: params.data.code_challenge,
    userId: req.user._id.toHexString()
  })
  const queryParams = new URLSearchParams([['code', code]])
  return {
    success: true,
    data: {
      redirectUrl: `${CLIENT_URL_BASE}/login/success?${queryParams.toString()}`
    }
  }
}

export const oauthCallback = (
  req: Request & { user: SerializeUser },
  res: Response
) => {
  _oauthCallback(req).then((params) => {
    if (params.success === false) {
      logger.error({ label: 'oauth2Callback', error: params.error.message })
      return res.status(params.error.status ?? 500).send(params.error.message)
    }
    return res.redirect(params.data.redirectUrl)
  })
}

export const oauth = (
  client: Redis,
  passport: PassportStatic,
  strategy: string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code_challenge, code_challenge_method } = req.query
      if (!code_challenge || !code_challenge_method) {
        return res.status(400).send('Bad Request')
      }
      const save = await saveParameterWithReuqest(client, req)
      if (save.success === false) {
        return res.status(500).send('Internal Server Error')
      }
      passport.authenticate(strategy, {
        state: save.data.state
      })(req, res, next)
    } catch (e) {
      return res.status(500).send('Internal Server Error')
    }
  }
}
