import { Outlet } from 'react-router'
import { useApp } from './App.hooks'

export default function App() {
  useApp()

  return (
    <>
      <Outlet />
    </>
  )
}
