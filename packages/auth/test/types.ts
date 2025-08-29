import type { MongoClient } from 'mongodb'

declare global {
  var testMongoClient: MongoClient
}
