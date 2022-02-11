import React, { createContext } from 'react'

import { useMessagesForContext } from './hooks'

type MessagesContextType = ReturnType<typeof useMessagesForContext>['state']
type DispatchContextType = Omit<
  ReturnType<typeof useMessagesForContext>,
  'state'
>

export const MessagesContext = createContext<MessagesContextType>(
  {} as MessagesContextType
)
export const MessagesDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const MessagesProvider: React.FC = ({ children }) => {
  const { state, ...dispatchActions } = useMessagesForContext()

  return (
    <MessagesContext.Provider value={state}>
      <MessagesDispatchContext.Provider value={dispatchActions}>
        {children}
      </MessagesDispatchContext.Provider>
    </MessagesContext.Provider>
  )
}
