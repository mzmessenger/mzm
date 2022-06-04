import React, { createContext, PropsWithChildren } from 'react'

import { INITIAL_STATE } from './constants'
import { useMessagesForContext } from './hooks'

type MessagesContextType = ReturnType<typeof useMessagesForContext>['state']
type DispatchContextType = Omit<
  ReturnType<typeof useMessagesForContext>,
  'state'
>

export const MessagesContext = createContext<MessagesContextType>(INITIAL_STATE)
export const MessagesDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const MessagesProvider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  const { state, ...dispatchActions } = useMessagesForContext()

  return (
    <MessagesContext.Provider value={state}>
      <MessagesDispatchContext.Provider value={dispatchActions}>
        {children}
      </MessagesDispatchContext.Provider>
    </MessagesContext.Provider>
  )
}
