import React from 'react'
import { SocketProvider } from './socket'
import { UserProvider } from './user'

export const Provider: React.FC = ({ children }) => {
  return (
    <SocketProvider>
      <UserProvider>{children}</UserProvider>
    </SocketProvider>
  )
}
