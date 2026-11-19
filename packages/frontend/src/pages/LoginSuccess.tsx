import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { createRoutePath } from '../lib/route'
import { useAuth } from '../state/auth/hooks'

function restorePath(state: string | null) {
  if (!state) {
    return createRoutePath({ type: 'top' })
  }
  try {
    const path = decodeURIComponent(state)
    return path.startsWith('/rooms/')
      ? path
      : createRoutePath({ type: 'top' })
  } catch {
    return createRoutePath({ type: 'top' })
  }
}

const LoginSuccess = () => {
  const navigate = useNavigate()
  const { authTokenAfterRedirect } = useAuth()
  const consumed = useRef(false)

  useEffect(() => {
    if (consumed.current) {
      return
    }
    consumed.current = true

    const { searchParams } = new URL(document.location.toString())
    const code = searchParams.get('code')
    if (!code) {
      navigate('/?auth_error=1')
      return
    }
    authTokenAfterRedirect(code).then((success) => {
      if (success) {
        navigate(restorePath(searchParams.get('state')))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <></>
}

export default LoginSuccess
