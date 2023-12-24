const DEFAULT_INTERVAL = 1000
const RECONNECT_DECAY = 1.5
const MAX_RECONNECT = 10
const INIT_RECONNECT_INTERVAL = 10

type Recconect = {
  interval: number
  attempts: number
}

export function incrementRecconectAttenmpts(recconect: Recconect): Recconect {
  const newInterval =
    recconect.interval <= INIT_RECONNECT_INTERVAL
      ? DEFAULT_INTERVAL
      : recconect.interval *
        Math.floor(Math.pow(RECONNECT_DECAY, recconect.attempts))

  recconect.interval = newInterval
  recconect.attempts += 1
  return {
    interval: newInterval,
    attempts: recconect.attempts + 1
  }
}

export function initRecconect() {
  return {
    interval: DEFAULT_INTERVAL,
    attempts: 0
  }
}

export function isMax(recconect: Recconect) {
  return recconect.attempts >= MAX_RECONNECT
}
