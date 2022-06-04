import React, { createContext, PropsWithChildren } from 'react'

import { useUiForContext } from './hooks'

type UiContextType = ReturnType<typeof useUiForContext>['state']
type DispatchContextType = Omit<ReturnType<typeof useUiForContext>, 'state'>

export const UiContext = createContext<UiContextType>({} as UiContextType)
export const UiDispatchContext = createContext<DispatchContextType>(
  {} as DispatchContextType
)

export const UiProvider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  const { state, ...dispatchActions } = useUiForContext()

  return (
    <UiContext.Provider value={state}>
      <UiDispatchContext.Provider value={dispatchActions}>
        {children}
      </UiDispatchContext.Provider>
    </UiContext.Provider>
  )
}
