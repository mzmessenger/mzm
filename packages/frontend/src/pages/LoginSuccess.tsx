import React, { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { createRoutePath } from '../lib/route'
import { useAuth } from '../state/auth/hooks'

const LoginSuccess = () => {
  const navigate = useNavigate()
  const { authTokenAfterRedirect } = useAuth()

  useEffect(() => {
    const { searchParams } = new URL(document.location.toString())
    const code = searchParams.get('code')
    authTokenAfterRedirect(code).finally(() => navigate(createRoutePath({ type: 'top' })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <></>
}

export default LoginSuccess
