import React from 'react'
import { SocketProvider } from './socket'
import { UserProvider } from './user'
import { SearchProvider } from './search'
import { UiProvider } from './ui'
import { PostTextAreaProvider } from './postTextArea'
import { MessagesProvider } from './messages'
import { RoomsProvider } from './rooms'

export const Provider: React.FC = ({ children }) => {
  return (
    <SocketProvider>
      <UserProvider>
        <UiProvider>
          <SearchProvider>
            <MessagesProvider>
              <RoomsProvider>
                <PostTextAreaProvider>{children}</PostTextAreaProvider>
              </RoomsProvider>
            </MessagesProvider>
          </SearchProvider>
        </UiProvider>
      </UserProvider>
    </SocketProvider>
  )
}
