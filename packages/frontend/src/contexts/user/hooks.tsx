import { useContext, useState, useCallback } from 'react'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { UserContext, UserDispatchContext } from './index'
import { useDispatchAuth } from '../auth/hooks'
import { createApiClient } from '../../lib/client'

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

    const { accessToken } = await getAccessToken()
    return await createApiClient(
      '/api/user/@me',
      {
        method: 'PUT',
        accessToken,
        body: JSON.stringify(body)
      },
      async (res) => {
        if (res.status === 200) {
          res
            .json()
            .then((json: RESPONSE['/api/user/@me']['PUT']['body'][200]) => {
              setMe({
                ...me,
                account: json.account,
                iconUrl: `/api/icon/user/${json.account}`
              })
            })
        }

        return res
      }
    )
  }

  const fetchMyInfo = useCallback(async () => {
    const { accessToken, user } = await getAccessToken()

    return await createApiClient(
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
    const { accessToken } = await getAccessToken()
    return await createApiClient(
      '/auth/twitter',
      {
        method: 'DELETE',
        accessToken
      },
      async (res) => {
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
    )
  }

  const removeGithub = async () => {
    if (!socialAccount.twitterUserName || !socialAccount.githubUserName) {
      return
    }
    const { accessToken } = await getAccessToken()
    return await createApiClient(
      '/auth/github',
      {
        method: 'DELETE',
        accessToken
      },
      async (res) => {
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
    )
  }

  const removeUser = async () => {
    const { accessToken } = await getAccessToken()
    return await createApiClient(
      '/auth/user',
      {
        method: 'DELETE',
        accessToken
      },
      async (res) => {
        if (res.status === 200) {
          logout()
        }
        return res
      }
    )
  }

  const uploadIcon = async (blob: Blob) => {
    const formData = new FormData()
    formData.append('icon', blob)
    const { accessToken } = await getAccessToken()
    const res = await fetch('/api/icon/user', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
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
    updateUser: useCallback(updateUser, [me]),
    fetchMyInfo,
    removeTwitter: useCallback(removeTwitter, [
      getAccessToken,
      refreshToken,
      socialAccount.githubUserName,
      socialAccount.twitterUserName
    ]),
    removeGithub: useCallback(removeGithub, [
      getAccessToken,
      refreshToken,
      socialAccount.githubUserName,
      socialAccount.twitterUserName
    ]),
    removeUser: useCallback(removeUser, [logout]),
    uploadIcon: useCallback(uploadIcon, [me])
  } as const
}
