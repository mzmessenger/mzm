import React, { PropsWithChildren } from 'react'
import { UserProvider } from './user'
import { SearchProvider } from './search'
import { PostTextAreaProvider } from './postTextArea'
import { MessagesProvider } from './messages'
import { RoomsProvider } from './rooms'

export const Provider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  return (
    <UserProvider>
      <SearchProvider>
        <MessagesProvider>
          <RoomsProvider>
            <PostTextAreaProvider>{children}</PostTextAreaProvider>
          </RoomsProvider>
        </MessagesProvider>
      </SearchProvider>
    </UserProvider>
  )
}
