export const authorizeTemplate = (options: {
  targetOrigin: string
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
          window.parent.postMessage(res, targetOrigin)
        })(this, this.document)
      </script>
    </body>
  </html>`
}

export const authorizeErrorTemplate = (options: {
  nonce: string
  status: number
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
          window.parent.postMessage(res, '*')
        })(this, this.document)
      </script>
    </body>
  </html>`
}
