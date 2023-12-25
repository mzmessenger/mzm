import React from 'react'
import { Outlet } from 'react-router-dom'
import { useApp } from './App.hooks'

const App = () => {
  useApp()

  return (
    <>
      <Outlet />
    </>
  )
}
export default App
