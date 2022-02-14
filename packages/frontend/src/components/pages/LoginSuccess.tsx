import React, { useEffect } from 'react'
import { useDispatchUser } from '../../contexts/user/hooks'

const LoginSuccess = () => {
  const { fetchMyInfo, signupUser } = useDispatchUser()

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
  }, [fetchMyInfo, signupUser])

  return <></>
}

export default LoginSuccess
