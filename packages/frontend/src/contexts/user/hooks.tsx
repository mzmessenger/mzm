import { useContext, useState, useMemo, useCallback } from 'react'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { UserContext, UserDispatchContext } from './index'
import { useAuthForContext } from '../auth/hooks'
import { createClient } from '../../lib/client'

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
  const { getAccessToken } = useAuthForContext()
  const [login, setLogin] = useState(false)
  const [me, setMe] = useState<MyInfo>({
    id: '',
    account: '',
    iconUrl: '',
    twitterUserName: '',
    githubUserName: ''
  })

  const state = useMemo(() => {
    return {
      signup: me.account !== '',
      login,
      me
    }
  }, [login, me])

  const updateUser = async (account: string) => {
    const body: REQUEST['/api/user/@me']['PUT']['body'] = { account }

    const res = await fetch('/api/user/@me', {
      method: 'PUT',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(body)
    })

    if (res.status === 200) {
      res.json().then((json: RESPONSE['/api/user/@me']['PUT']['body'][200]) => {
        setMe({
          ...me,
          account: json.account,
          iconUrl: `/api/icon/user/${json.account}`
        })
      })
    }

    return res
  }

  const logout = () => {
    location.href = '/auth/logout'
    setLogin(false)
  }

  const fetchMyInfo = useCallback(async () => {
    const accessToken = await getAccessToken()

    return await createClient(
      '/api/user/@me',
      {
        method: 'GET',
        accessToken
      },
      async (res) => {
        type ResponseType = RESPONSE['/api/user/@me']['GET']['body']

        if (res.status === 200) {
          const payload = (await res.json()) as ResponseType[200]

          setLogin(true)
          setMe({
            ...payload,
            iconUrl: payload.icon
          })
        } else if (res.status === 404) {
          const payload = (await res.json()) as ResponseType[404]

          setLogin(true)
          setMe({
            id: payload.id,
            account: '',
            twitterUserName: payload.twitterUserName,
            githubUserName: payload.githubUserName,
            iconUrl: ''
          })
        } else if (res.status === 403) {
          logout()
        }
        return res
      }
    )
  }, [getAccessToken])

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

    const { version } = (await res.json()) as RESPONSE['/api/icon/user']['POST']
    const iconUrl = `/api/icon/user/${me.account}/${version}`
    setMe({
      ...me,
      iconUrl
    })

    return res
  }

  return {
    state,
    updateUser: useCallback(updateUser, []),
    logout: useCallback(logout, []),
    fetchMyInfo,
    removeTwitter: useCallback(removeTwitter, [fetchMyInfo, me]),
    removeGithub: useCallback(removeGithub, [fetchMyInfo, me]),
    removeUser: useCallback(removeUser, []),
    uploadIcon: useCallback(uploadIcon, [me])
  } as const
}
