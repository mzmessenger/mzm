import React, { createContext, PropsWithChildren } from 'react'

import { useAuthForContext } from './hooks'

type AuthContextType = ReturnType<typeof useAuthForContext>['state']
type DispatchContextType = Omit<ReturnType<typeof useAuthForContext>, 'state'>

export const AuthContext = createContext<AuthContextType>({} as AuthContextType)
export const AuthDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const AuthProvider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  const { state, ...dispatchActions } = useAuthForContext()

  return (
    <AuthContext.Provider value={state}>
      <AuthDispatchContext.Provider value={dispatchActions}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthContext.Provider>
  )
}
