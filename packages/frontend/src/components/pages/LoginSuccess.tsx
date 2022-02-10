import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useDispatchUser } from '../../contexts/user/hooks'

const LoginSuccess = () => {
  const { fetchMyInfo, signupUser } = useDispatchUser()
  const dispatch = useDispatch()

  useEffect(() => {
    fetchMyInfo().then((res) => {
      if (res.status === 404) {
        return res
          .json()
          .then((body: { id: string; twitter?: string; github?: string }) => {
            const account = body.twitter || body.github || ''
            signupUser(account)
          })
      }
    })
  }, [dispatch])

  return <></>
}

export default LoginSuccess
