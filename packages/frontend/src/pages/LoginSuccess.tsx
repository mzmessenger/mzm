import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const LoginSuccess = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const { searchParams } = new URL(document.location.toString())
    // @todo
    console.log(searchParams.get('code'))
    navigate('/')
  }, [navigate])

  return <></>
}

export default LoginSuccess
