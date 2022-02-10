import React from 'react'
import { SocketProvider } from './socket'
import { UserProvider } from './user'
import { SearchProvider } from './search'
import { UiProvider } from './ui'
import { PostTextAreaProvider } from './postTextArea'

export const Provider: React.FC = ({ children }) => {
  return (
    <SocketProvider>
      <UserProvider>
        <UiProvider>
          <SearchProvider>
            <PostTextAreaProvider>{children}</PostTextAreaProvider>
          </SearchProvider>
        </UiProvider>
      </UserProvider>
    </SocketProvider>
  )
}
