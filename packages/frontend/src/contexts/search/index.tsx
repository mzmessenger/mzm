import React, { createContext, PropsWithChildren } from 'react'

import { useSearchForContext } from './hooks'

type SearchContextType = ReturnType<typeof useSearchForContext>['state']
type DispatchContextType = Omit<ReturnType<typeof useSearchForContext>, 'state'>

export const SearchContext = createContext<SearchContextType>(
  {} as SearchContextType
)
export const SearchDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const SearchProvider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  const { state, ...dispatchActions } = useSearchForContext()

  return (
    <SearchContext.Provider value={state}>
      <SearchDispatchContext.Provider value={dispatchActions}>
        {children}
      </SearchDispatchContext.Provider>
    </SearchContext.Provider>
  )
}
