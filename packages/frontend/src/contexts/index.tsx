import React, { PropsWithChildren } from 'react'
import { SearchProvider } from './search'
import { PostTextAreaProvider } from './postTextArea'
import { MessagesProvider } from './messages'
import { RoomsProvider } from './rooms'

export const Provider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  return (
    <SearchProvider>
      <MessagesProvider>
        <RoomsProvider>
          <PostTextAreaProvider>{children}</PostTextAreaProvider>
        </RoomsProvider>
      </MessagesProvider>
    </SearchProvider>
  )
}
