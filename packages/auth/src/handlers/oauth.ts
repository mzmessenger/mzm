import type { Request, Response, NextFunction } from 'express'
import type { PassportStatic } from 'passport'
import type { Result } from 'mzm-shared/src/type'
import type { SerializeUser } from '../types.js'
import type { MongoClient } from 'mongodb'
import {
  getParametaerFromSession,
  generateUniqAuthorizationCode,
  saveAuthorizationCode,
  saveParameterToSession
} from '../lib/pkce/index.js'
import { logger } from '../lib/logger.js'

async function _oauthCallback(
  req: Request & { user?: SerializeUser },
  db: MongoClient
): Promise<Result<{ redirectUrl: string }>> {
  if (!req.user) {
    return { success: false, error: { status: 400, message: 'invalid user' } }
  }

  const params = await getParametaerFromSession(req)
  if (params.success === false) {
    return {
      success: false,
      error: {
        status: params.error.status ?? 400,
        message: params.error.message
      }
    }
  }
  const generateCode = await generateUniqAuthorizationCode(db)
  if (generateCode.success === false) {
    return generateCode
  }

  const { code } = generateCode.data
  await saveAuthorizationCode(db, {
    code,
    code_challenge: params.data.code_challenge,
    userId: req.user._id.toHexString()
  })
  const queryParams = new URLSearchParams([['code', code]])
  return {
    success: true,
    data: {
      redirectUrl: `${params.data.redirect_uri}?${queryParams.toString()}`
    }
  }
}

export function oauthCallback(db: MongoClient) {
  return (req: Request & { user?: SerializeUser }, res: Response) => {
    _oauthCallback(req, db).then((params) => {
      if (params.success === false) {
        logger.error({ label: 'oauth2Callback', error: params.error.message })
        return res.status(params.error.status ?? 500).send(params.error.message)
      }
      return res.redirect(params.data.redirectUrl)
    })
  }
}

export function oauthHandler(passport: PassportStatic, strategy: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const save = await saveParameterToSession(req)
      if (save.success === false) {
        return res.status(save.error.status ?? 500).send(save.error.message)
      }
      passport.authenticate(strategy, {
        keepSessionInfo: true
      })(req, res, next)
    } catch (e) {
      logger.error('[oauth]', e)
      return res.status(500).send('Internal Server Error')
    }
  }
}
