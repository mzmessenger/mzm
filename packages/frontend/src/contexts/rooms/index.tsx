import React, { createContext } from 'react'

import { useRoomsForContext } from './hooks'

type RoomsContextType = ReturnType<typeof useRoomsForContext>['state']
type DispatchContextType = Omit<ReturnType<typeof useRoomsForContext>, 'state'>

export const RoomsContext = createContext<RoomsContextType>(
  {} as RoomsContextType
)
export const RoomsDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const RoomsProvider: React.FC = ({ children }) => {
  const { state, ...dispatchActions } = useRoomsForContext()

  return (
    <RoomsContext.Provider value={{ ...state }}>
      <RoomsDispatchContext.Provider value={{ ...dispatchActions }}>
        {children}
      </RoomsDispatchContext.Provider>
    </RoomsContext.Provider>
  )
}
