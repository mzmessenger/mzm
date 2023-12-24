import { type ToClientType } from 'mzm-shared/src/type/socket'
export type MessageEvent = CustomEvent<ToClientType>

export const events = {
  authorized: 'mzm:authorized',
  message: 'mzm:message'
} as const

const authorizedEvent = new CustomEvent(events.authorized, {
  bubbles: false
})

export function dispatchAuthorizedEvent() {
  window.dispatchEvent(authorizedEvent)
}

export function dispatchMessageEvent(detail: ToClientType) {
  const messageEvent = new CustomEvent<ToClientType>(events.message, {
    bubbles: false,
    detail
  })
  window.dispatchEvent(messageEvent)
}
