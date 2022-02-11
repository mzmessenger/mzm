import React, { createContext } from 'react'

import { usePostTextAreaForContext } from './hooks'

type PostTextAreaContextType = ReturnType<
  typeof usePostTextAreaForContext
>['state']
type DispatchContextType = Omit<
  ReturnType<typeof usePostTextAreaForContext>,
  'state'
>

export const PostTextAreaContext = createContext<PostTextAreaContextType>(
  {} as PostTextAreaContextType
)
export const PostTextAreaDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const PostTextAreaProvider: React.FC = ({ children }) => {
  const { state, ...dispatchActions } = usePostTextAreaForContext()

  return (
    <PostTextAreaContext.Provider value={state}>
      <PostTextAreaDispatchContext.Provider value={dispatchActions}>
        {children}
      </PostTextAreaDispatchContext.Provider>
    </PostTextAreaContext.Provider>
  )
}
