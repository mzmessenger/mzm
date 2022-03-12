import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const LoginSuccess = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/')
  }, [navigate])

  return <></>
}

export default LoginSuccess
