export const authorizeTemplate = (options: {
  targetOrigin: string
  redirectUri: string
  code: string
  state: string
  nonce: string
}) => {
  return `<!doctype html>
  <html>
    <head>
      <title>Authorization Response</title>
    </head>
    <body>
      <script type="text/javascript" nonce="${options.nonce}">
        ;(function (window, document) {
          const targetOrigin = '${options.targetOrigin}'
      const res = {
            type: 'authorization_response',
            response: {
              code: '${options.code}',
              state: '${options.state}'
            }
      }
      if (window.parent === window) {
        const redirectUri = new URL('${options.redirectUri}')
        redirectUri.searchParams.set('code', '${options.code}')
        redirectUri.searchParams.set('state', '${options.state}')
        window.location.replace(redirectUri)
        return
      }
      window.parent.postMessage(res, targetOrigin)
        })(this, this.document)
      </script>
    </body>
  </html>`
}

export const authorizeErrorTemplate = (options: {
  nonce: string
  status: number
  redirectUri?: string
}) => {
  return `<!doctype html>
  <html>
    <head>
      <title>Authorization Response</title>
    </head>
    <body>
      <script type="text/javascript" nonce="${options.nonce}">
        ;(function (window, document) {
      const res = {
            type: 'authorization_error_response',
            response: {
              status: ${options.status}
            }
      }
      if (window.parent === window && '${options.redirectUri ?? ''}') {
        const redirectUri = new URL('${options.redirectUri ?? ''}')
        redirectUri.searchParams.set('auth_error', '1')
        window.location.replace(redirectUri)
        return
      }
      window.parent.postMessage(res, '*')
        })(this, this.document)
      </script>
    </body>
  </html>`
}
