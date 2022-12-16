import React, { PropsWithChildren } from 'react'
import { SocketProvider } from './socket'
import { UserProvider } from './user'
import { SearchProvider } from './search'
import { UiProvider } from './ui'
import { PostTextAreaProvider } from './postTextArea'
import { MessagesProvider } from './messages'
import { RoomsProvider } from './rooms'
import { AuthProvider } from './auth'

export const Provider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  return (
    <AuthProvider>
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
    </AuthProvider>
  )
}
