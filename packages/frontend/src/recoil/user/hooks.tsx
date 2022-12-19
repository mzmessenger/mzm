import { useCallback, useEffect } from 'react'
import { atom, useRecoilState, selector, useRecoilValue } from 'recoil'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { useAuth } from '../../recoil/auth/hooks'
import { createApiClient } from '../../lib/client'

type UserState = {
  id: string
  account: string
  iconUrl: string
  twitterUserName: string | null
  githubUserName: string | null
}

const userState = atom<UserState>({
  key: 'state:user',
  default: {
    id: '',
    account: '',
    iconUrl: '',
    twitterUserName: null,
    githubUserName: null
  }
})

const userAccountState = selector({
  key: 'state:user:selector:account',
  get: ({ get }) => {
    const { account } = get(userState)
    return { userAccount: account }
  }
})

export const useUserAccountState = () => {
  return useRecoilValue(userAccountState)
}

const userIdAndAccountState = selector({
  key: 'state:user:selector:id-and-account',
  get: ({ get }) => {
    const { id, account, iconUrl } = get(userState)
    return {
      userId: id,
      userAccount: account,
      userIconUrl: iconUrl
    }
  }
})

export const useUserIdAndAccountState = () => {
  return useRecoilValue(userIdAndAccountState)
}

const socialAccountState = selector({
  key: 'state:user:selector:social-account',
  get: ({ get }) => {
    const { twitterUserName, githubUserName } = get(userState)
    return {
      twitterUserName,
      githubUserName
    }
  }
})

export const useSocialAccountState = () => {
  return useRecoilValue(socialAccountState)
}

export const useUser = () => {
  const { getAccessToken, refreshToken, logout } = useAuth()
  const [user, setUser] = useRecoilState(userState)

  useEffect(() => {
    getAccessToken().then(({ user }) => {
      setUser((current) => ({
        ...current,
        id: user._id,
        twitterUserName: user.twitterUserName,
        githubUserName: user.githubUserName
      }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateUser = useCallback(
    async (account: string) => {
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
                setUser((current) => ({
                  ...current,
                  account: json.account,
                  iconUrl: `/api/icon/user/${json.account}`
                }))
              })
          }

          return res
        }
      )
    },
    [getAccessToken, setUser]
  )

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

          setUser((current) => ({
            ...current,
            id: user._id,
            account: payload.account,
            iconUrl: payload.icon,
            twitterUserName: user.twitterUserName,
            githubUserName: user.githubUserName
          }))
        } else if (res.status === 404) {
          const payload = (await res.json()) as ResponseType[404]

          setUser((current) => ({
            ...current,
            id: payload.id,
            account: '',
            iconUrl: ''
          }))
        } else if (res.status === 403) {
          logout()
        }
        return res
      }
    )
  }, [getAccessToken, setUser, logout])

  const removeTwitter = useCallback(async () => {
    if (!user.twitterUserName || !user.githubUserName) {
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
            setUser((current) => ({
              ...current,
              twitterUserName: token.user.twitterUserName,
              githubUserName: token.user.githubUserName
            }))
          })
        }
        return res
      }
    )
  }, [
    getAccessToken,
    refreshToken,
    setUser,
    user.githubUserName,
    user.twitterUserName
  ])

  const removeGithub = useCallback(async () => {
    if (!user.twitterUserName || !user.githubUserName) {
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
            setUser((current) => ({
              ...current,
              twitterUserName: token.user.twitterUserName,
              githubUserName: token.user.githubUserName
            }))
          })
        }
        return res
      }
    )
  }, [
    getAccessToken,
    refreshToken,
    setUser,
    user.githubUserName,
    user.twitterUserName
  ])

  const removeUser = useCallback(async () => {
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
  }, [getAccessToken, logout])

  const uploadIcon = useCallback(
    async (blob: Blob) => {
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

      const { version } =
        (await res.json()) as RESPONSE['/api/icon/user']['POST']
      const iconUrl = `/api/icon/user/${user.account}/${version}`
      setUser((current) => ({
        ...current,
        iconUrl
      }))

      return res
    },
    [getAccessToken, setUser, user.account]
  )

  return {
    updateUser,
    fetchMyInfo,
    removeTwitter,
    removeGithub,
    removeUser,
    uploadIcon
  } as const
}
