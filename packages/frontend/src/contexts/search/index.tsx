import React, { createContext } from 'react'

import { userSearchForContext } from './hooks'

type SearchContextType = ReturnType<typeof userSearchForContext>['state']
type DispatchContextType = Omit<
  ReturnType<typeof userSearchForContext>,
  'state'
>

export const SearchContext = createContext<SearchContextType>(
  {} as SearchContextType
)
export const SearchDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const SearchProvider: React.FC = ({ children }) => {
  const { state, ...dispatchActions } = userSearchForContext()

  return (
    <SearchContext.Provider value={{ ...state }}>
      <SearchDispatchContext.Provider value={{ ...dispatchActions }}>
        {children}
      </SearchDispatchContext.Provider>
    </SearchContext.Provider>
  )
}
