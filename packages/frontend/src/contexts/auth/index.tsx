import React, { createContext, PropsWithChildren } from 'react'

import { useAuthForContext } from './hooks'

type DispatchContextType = Omit<ReturnType<typeof useAuthForContext>, 'state'>

export const AuthDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const AuthProvider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  const { ...dispatchActions } = useAuthForContext()

  return (
    <AuthDispatchContext.Provider value={dispatchActions}>
      {children}
    </AuthDispatchContext.Provider>
  )
}
