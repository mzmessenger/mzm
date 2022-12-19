import React, { PropsWithChildren } from 'react'
import { PostTextAreaProvider } from './postTextArea'
import { MessagesProvider } from './messages'

export const Provider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  return (
    <MessagesProvider>
      <PostTextAreaProvider>{children}</PostTextAreaProvider>
    </MessagesProvider>
  )
}
