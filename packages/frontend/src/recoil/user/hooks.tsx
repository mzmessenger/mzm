import type { API } from 'mzm-shared/src/type/api'
import type { useAuth } from '../../recoil/auth/hooks'
import { useCallback } from 'react'
import {
  atom,
  useRecoilState,
  useSetRecoilState,
  selector,
  useRecoilValue
} from 'recoil'
import { uploadUserIcon, clients, authClients } from '../../lib/client'
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

  type UpdateUserType = API['/api/user/@me']['PUT']
  const updateUser = useCallback(
    async (body: UpdateUserType['request']['body']) => {
      const res = await clients['/api/user/@me']['PUT']({ body })
      if (res.status === 200) {
        const body = res.body as UpdateUserType['response'][200]['body']
        setUser((current) => ({
          ...current,
          account: body.account,
          iconUrl: `/api/icon/user/${body.account}`
        }))
        return {
          ...res,
          body
        }
      }
      return res
    },
    [setUser]
  )

  const uploadIcon = useCallback(
    async (blob: Blob) => {
      const formData = new FormData()
      formData.append('icon', blob)
      const res = await uploadUserIcon(blob)

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
    [setUser, user.account]
  )

  return {
    updateUser,
    uploadIcon
  } as const
}

export const useMyInfoActions = () => {
  const setUser = useSetRecoilState(userState)

  const fetchMyInfo = useCallback(async () => {
    const res = await clients['/api/user/@me']['GET']({})
    type ResponseType = API['/api/user/@me']['GET']['response']

    if (res.status === 200) {
      const payload = res.body as ResponseType[200]['body']

      setUser((current) => ({
        ...current,
        id: payload.id,
        account: payload.account,
        iconUrl: payload.icon
      }))
    } else if (res.status === 404) {
      const payload = res.body as ResponseType[404]['body']

      setUser((current) => ({
        ...current,
        id: payload.id,
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
    const res = await authClients['/auth/user']['DELETE']({})
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
      const res = await authClients['/auth/twitter']['DELETE']({})
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
      const res = await authClients['/auth/github']['DELETE']({})
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
