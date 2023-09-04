import type { useAuth } from '../../recoil/auth/hooks'
import { useCallback } from 'react'
import {
  atom,
  useRecoilState,
  useSetRecoilState,
  selector,
  useRecoilValue
} from 'recoil'
import { clients, authClients } from '../../lib/client'
import { API_URL_BASE } from '../../constants'

type UserState = {
  id: string
  account: string
  iconUrl: string
  twitterUserName: string | null
  githubUserName: string | null
}

export const userState = atom<UserState>({
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

export const useUserAccount = () => useRecoilValue(userAccountState)

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

export const useUserIdAndAccount = () => useRecoilValue(userIdAndAccountState)

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
export const useSocialAccount = () => useRecoilValue(socialAccountState)

type UseAuthType = ReturnType<typeof useAuth>

export const useUser = () => {
  const [user, setUser] = useRecoilState(userState)

  const client = clients['/api/user/@me']['PUT'].client
  const updateUser = useCallback(
    async (params: Parameters<typeof client>[0]) => {
      const res = await client(params)
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
      const res = await uploadIconClient({ form: { icon: blob } })

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
  const setUser = useSetRecoilState(userState)

  const fetchMyInfo = useCallback(async () => {
    const res = await clients['/api/user/@me']['GET'].client({})

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
    const res = await authClients['/auth/user']['DELETE'].client({})
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
  const [user] = useRecoilState(userState)

  const removeTwitter = useCallback(
    async (handleSuccessRemove: () => void) => {
      if (!user.twitterUserName || !user.githubUserName) {
        return
      }
      const res = await authClients['/auth/twitter']['DELETE'].client({})
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
      const res = await authClients['/auth/github']['DELETE'].client({})
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
