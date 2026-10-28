const databaseName = 'mzm-realtime-events'
const storeName = 'event-ids'
const retentionMs = 35 * 24 * 60 * 60 * 1000

type StoredEvent = { id: string; subject: string; receivedAt: number }

let activeSubject: string | undefined

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      const store = database.createObjectStore(storeName, { keyPath: 'id' })
      store.createIndex('by-subject-received-at', ['subject', 'receivedAt'])
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error))
  })
}

async function deleteSubject(database: IDBDatabase, subject: string) {
  const transaction = database.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  const index = store.index('by-subject-received-at')
  const range = IDBKeyRange.bound([subject, 0], [subject, Number.MAX_SAFE_INTEGER])
  const request = index.openCursor(range)
  let current = await requestResult(request)
  while (current) {
    current.delete()
    current.continue()
    current = await requestResult(request)
  }
}

export async function acceptEventId(subject: string, eventId: string) {
  const database = await openDatabase()
  try {
    if (activeSubject && activeSubject !== subject) {
      await deleteSubject(database, activeSubject)
    }
    activeSubject = subject
    const now = Date.now()
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const previous = await requestResult(store.get(`${subject}:${eventId}`))
    if (previous) {
      return false
    }
    store.put({ id: `${subject}:${eventId}`, subject, receivedAt: now } satisfies StoredEvent)
    const index = store.index('by-subject-received-at')
    const expired = IDBKeyRange.bound([subject, 0], [subject, now - retentionMs])
    const request = index.openCursor(expired)
    let cursor = await requestResult(request)
    while (cursor) {
      cursor.delete()
      cursor.continue()
      cursor = await requestResult(request)
    }
    return true
  } finally {
    database.close()
  }
}
