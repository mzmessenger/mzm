import React from 'react'
import ReactDom from 'react-dom'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import 'normalize.css'
import 'highlight.js/styles/androidstudio.css'
import './index.css'
import { store } from './modules/index'
import { Provider as ContextProvider } from './contexts'
import App from './App'

ReactDom.render(
  <Provider store={store}>
    <BrowserRouter>
      <ContextProvider>
        <App />
      </ContextProvider>
    </BrowserRouter>
  </Provider>,
  document.getElementById('root')
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
