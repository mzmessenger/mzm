import React from 'react'
import CircularProgress from '@mui/material/CircularProgress'

export const Loading = () => {
  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <CircularProgress />
    </div>
  )
}
