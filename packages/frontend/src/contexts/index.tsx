import React from 'react'
import { SocketProvider } from './socket'

export const Provider: React.FC = ({ children }) => {
  return <SocketProvider>{children}</SocketProvider>
}
