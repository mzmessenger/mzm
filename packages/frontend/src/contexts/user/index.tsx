import React, { createContext, PropsWithChildren } from 'react'

import { useUserForContext } from './hooks'

type UserContextType = ReturnType<typeof useUserForContext>['state']
type DispatchContextType = Omit<ReturnType<typeof useUserForContext>, 'state'>

export const UserContext = createContext<UserContextType>({} as UserContextType)
export const UserDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const UserProvider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  const { state, ...dispatchActions } = useUserForContext()

  return (
    <UserContext.Provider value={state}>
      <UserDispatchContext.Provider value={dispatchActions}>
        {children}
      </UserDispatchContext.Provider>
    </UserContext.Provider>
  )
}
