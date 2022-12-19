import React, { PropsWithChildren } from 'react'
import { MessagesProvider } from './messages'

export const Provider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  return <MessagesProvider>{children}</MessagesProvider>
}
