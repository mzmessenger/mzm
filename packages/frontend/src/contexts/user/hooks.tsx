import { useContext, useState, useCallback } from 'react'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { UserContext, UserDispatchContext } from './index'
import { useDispatchAuth } from '../auth/hooks'
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
}

type SocialAccount = {
  twitterUserName: string | null
  githubUserName: string | null
}

export const useUserForContext = () => {
  const { getAccessToken, refreshToken, logout } = useDispatchAuth()
  const [socialAccount, setSocialAccount] = useState<SocialAccount>({
    twitterUserName: null,
    githubUserName: null
  })
  const [me, setMe] = useState<MyInfo>({
    id: '',
    account: '',
    iconUrl: ''
  })

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

  const fetchMyInfo = useCallback(async () => {
    const { accessToken, user } = await getAccessToken()

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

          setMe({
            ...payload,
            iconUrl: payload.icon
          })
          setSocialAccount({
            twitterUserName: user.twitterUserName,
            githubUserName: user.githubUserName
          })
        } else if (res.status === 404) {
          const payload = (await res.json()) as ResponseType[404]

          setMe({
            id: payload.id,
            account: '',
            iconUrl: ''
          })
        } else if (res.status === 403) {
          logout()
        }
        return res
      }
    )
  }, [getAccessToken, logout])

  const removeTwitter = async () => {
    if (!socialAccount.twitterUserName || !socialAccount.githubUserName) {
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
      refreshToken().then((token) => {
        setSocialAccount({
          twitterUserName: token.user.twitterUserName,
          githubUserName: token.user.githubUserName
        })
      })
    }
    return res
  }

  const removeGithub = async () => {
    if (!socialAccount.twitterUserName || !socialAccount.githubUserName) {
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
      refreshToken().then((token) => {
        setSocialAccount({
          twitterUserName: token.user.twitterUserName,
          githubUserName: token.user.githubUserName
        })
      })
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
      logout()
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
    state: {
      me,
      socialAccount
    },
    updateUser: useCallback(updateUser, []),
    fetchMyInfo,
    removeTwitter: useCallback(removeTwitter, [
      refreshToken,
      socialAccount.githubUserName,
      socialAccount.twitterUserName
    ]),
    removeGithub: useCallback(removeGithub, [
      refreshToken,
      socialAccount.githubUserName,
      socialAccount.twitterUserName
    ]),
    removeUser: useCallback(removeUser, [logout]),
    uploadIcon: useCallback(uploadIcon, [me])
  } as const
}
