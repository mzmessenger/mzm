import React, { PropsWithChildren } from 'react'
import { SearchProvider } from './search'
import { PostTextAreaProvider } from './postTextArea'
import { MessagesProvider } from './messages'

export const Provider: React.FC<PropsWithChildren<unknown>> = ({
  children
}) => {
  return (
    <SearchProvider>
      <MessagesProvider>
        <PostTextAreaProvider>{children}</PostTextAreaProvider>
      </MessagesProvider>
    </SearchProvider>
  )
}
