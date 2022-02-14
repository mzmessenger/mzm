import { useContext, useState, useMemo, useCallback } from 'react'
import { UserContext, UserDispatchContext } from './index'

export const useUser = () => {
  return useContext(UserContext)
}

export const useDispatchUser = () => {
  return useContext(UserDispatchContext)
}

type MyInfo = {
  id: string
  account: string
  iconUrl: string
  twitterUserName: string | null
  githubUserName: string | null
}

export const useUserForContext = () => {
  const [signup, setSignup] = useState(false)
  const [signupAccount, setSignupAccount] = useState('')
  const [login, setLogin] = useState(false)
  const [me, setMe] = useState<MyInfo>(null)

  const state = useMemo(() => {
    return {
      signup,
      signupAccount,
      login,
      me
    }
  }, [signup, signupAccount, login, me])

  const signupUser = (account: string) => {
    setSignup(true)
    setSignupAccount(account)
  }

  const logout = () => {
    location.href = '/auth/logout'
    setLogin(false)
  }

  const fetchMyInfo = useCallback(async () => {
    const res = await fetch('/api/user/@me', { credentials: 'include' })
    if (res.status === 200) {
      const payload: {
        account: string
        id: string
        icon: string
        twitterUserName: string | null
        githubUserName: string | null
      } = await res.json()

      setLogin(true)
      setMe({
        ...payload,
        iconUrl: payload.icon
      })
    } else if (res.status === 403) {
      logout()
    }
    return res
  }, [])

  const removeTwitter = async () => {
    if (!me || !me.twitterUserName || !me.githubUserName) {
      return
    }
    const res = await fetch('/auth/twitter', {
      method: 'DELETE',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
    if (res.status === 200) {
      fetchMyInfo()
    }
    return res
  }

  const removeGithub = async () => {
    if (!me || !me.twitterUserName || !me.githubUserName) {
      return
    }
    const res = await fetch('/auth/github', {
      method: 'DELETE',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
    if (res.status === 200) {
      fetchMyInfo()
    }
    return res
  }

  const removeUser = async () => {
    const res = await fetch('/auth/user', {
      method: 'DELETE',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
    if (res.status === 200) {
      setLogin(false)
    }
    return res
  }

  const uploadIcon = async (blob: Blob) => {
    const formData = new FormData()
    formData.append('icon', blob)
    const res = await fetch('/api/icon/user', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })

    if (!res.ok) {
      return res
    }

    const { version } = await res.json()
    const iconUrl = `/api/icon/user/${me.account}/${version}`
    setMe({
      ...me,
      iconUrl
    })

    return res
  }

  return {
    state,
    signupUser: useCallback(signupUser, []),
    logout: useCallback(logout, []),
    fetchMyInfo,
    removeTwitter: useCallback(removeTwitter, [fetchMyInfo, me]),
    removeGithub: useCallback(removeGithub, [fetchMyInfo, me]),
    removeUser: useCallback(removeUser, []),
    uploadIcon: useCallback(uploadIcon, [me])
  } as const
}
