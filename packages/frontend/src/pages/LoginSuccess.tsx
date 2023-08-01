import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../recoil/auth/hooks'

const LoginSuccess = () => {
  const navigate = useNavigate()
  const { authToken } = useAuth()

  useEffect(() => {
    const { searchParams } = new URL(document.location.toString())
    const code = searchParams.get('code')
    authToken(code).finally(() => navigate('/'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <></>
}

export default LoginSuccess
