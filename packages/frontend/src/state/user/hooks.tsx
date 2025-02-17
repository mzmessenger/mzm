import type { useAuth } from '../../state/auth/hooks'
import { useCallback } from 'react'
import { atom, useAtom, useAtomValue } from 'jotai'
import { clients, authClients, fetcher } from '../../lib/client'
import { API_URL_BASE } from '../../constants'

type UserState = {
  id: string
  account: string
  iconUrl: string
  twitterUserName: string | null
  githubUserName: string | null
}

export const userState = atom<UserState>({
  id: '',
  account: '',
  iconUrl: '',
  twitterUserName: null,
  githubUserName: null
})

export const userAccountState = atom((get) => {
  const { account } = get(userState)
  return { userAccount: account }
})

export const useUserAccount = () => useAtomValue(userAccountState)

export const userIdAndAccountState = atom((get) => {
  const { id, account, iconUrl } = get(userState)
  return {
    userId: id,
    userAccount: account,
    userIconUrl: iconUrl
  }
})

export const useUserIdAndAccount = () => useAtomValue(userIdAndAccountState)

export const socialAccountState = atom((get) => {
  const { twitterUserName, githubUserName } = get(userState)
  return {
    twitterUserName,
    githubUserName
  }
})

export const useSocialAccount = () => useAtomValue(socialAccountState)

type UseAuthType = ReturnType<typeof useAuth>

export const useUser = () => {
  const [user, setUser] = useAtom(userState)

  const client = clients['/api/user/@me']['PUT'].client
  const updateUser = useCallback(
    async (params: Omit<Parameters<typeof client>[0], 'fetcher'>) => {
      const res = await client({ ...params, fetcher })
      if (res.status === 200) {
        setUser((current) => ({
          ...current,
          account: res.body.account,
          iconUrl: `/api/icon/user/${res.body.account}`
        }))
        return {
          ...res,
          body: res.body
        }
      }
      return res
    },
    [client, setUser]
  )

  const uploadIconClient = clients['/api/icon/user']['POST'].client
  const uploadIcon = useCallback(
    async (blob: Blob) => {
      const res = await uploadIconClient({ fetcher, form: { icon: blob } })

      if (!res.ok) {
        return res
      }

      const { version } = res.body
      const iconUrl = API_URL_BASE + `/api/icon/user/${user.account}/${version}`
      setUser((current) => ({
        ...current,
        iconUrl
      }))

      return res
    },
    [setUser, uploadIconClient, user.account]
  )

  return {
    updateUser,
    uploadIcon
  } as const
}

export const useMyInfoActions = () => {
  const setUser = useAtom(userState)[1]

  const fetchMyInfo = useCallback(async () => {
    const res = await clients['/api/user/@me']['GET'].client({ fetcher })

    if (res.status === 200) {
      setUser((current) => ({
        ...current,
        id: res.body.id,
        account: res.body.account,
        iconUrl: res.body.icon
      }))
    } else if (res.status === 404) {
      setUser((current) => ({
        ...current,
        id: res.body.id,
        account: '',
        iconUrl: ''
      }))
    } else if (res.status === 403) {
      // @todo
      alert('認証情報が切れてるかもしれません')
    }
    return res
  }, [setUser])

  return {
    fetchMyInfo
  }
}

export const useRemoveUserActions = ({
  logout
}: {
  logout: UseAuthType['logout']
}) => {
  const removeUser = useCallback(async () => {
    const res = await authClients['/auth/user']['DELETE'].client({ fetcher })
    if (res.status === 200) {
      logout()
    }
    return res
  }, [logout])

  return {
    removeUser
  } as const
}

export const useRemoveAccountActions = () => {
  const [user] = useAtom(userState)

  const removeTwitter = useCallback(
    async (handleSuccessRemove: () => void) => {
      if (!user.twitterUserName || !user.githubUserName) {
        return
      }
      const res = await authClients['/auth/twitter']['DELETE'].client({
        fetcher
      })
      if (res.status === 200) {
        handleSuccessRemove()
      }
      return res
    },
    [user.githubUserName, user.twitterUserName]
  )

  const removeGithub = useCallback(
    async (handleSuccessRemove: () => void) => {
      if (!user.twitterUserName || !user.githubUserName) {
        return
      }
      const res = await authClients['/auth/github']['DELETE'].client({
        fetcher
      })
      if (res.status === 200) {
        handleSuccessRemove()
      }
      return res
    },
    [user.githubUserName, user.twitterUserName]
  )

  return {
    removeTwitter,
    removeGithub
  } as const
}
