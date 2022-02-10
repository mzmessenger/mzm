import React from 'react'
import { SocketProvider } from './socket'
import { UserProvider } from './user'
import { SearchProvider } from './search'

export const Provider: React.FC = ({ children }) => {
  return (
    <SocketProvider>
      <UserProvider>
        <SearchProvider>{children}</SearchProvider>
      </UserProvider>
    </SocketProvider>
  )
}
