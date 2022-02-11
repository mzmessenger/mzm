import React, { createContext } from 'react'

import { useSocketForContext } from './hooks'

type SocketContextType = ReturnType<typeof useSocketForContext>['state']
type DispatchContextType = Omit<ReturnType<typeof useSocketForContext>, 'state'>

export const SocketContext = createContext<SocketContextType>(
  {} as SocketContextType
)
export const SocketDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const SocketProvider: React.FC = ({ children }) => {
  const { state, ...dispatchActions } = useSocketForContext()

  return (
    <SocketContext.Provider value={state}>
      <SocketDispatchContext.Provider value={dispatchActions}>
        {children}
      </SocketDispatchContext.Provider>
    </SocketContext.Provider>
  )
}
