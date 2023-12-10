import fs from 'fs'
import { Readable } from 'stream'
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import * as config from '../config.js'

const s3 = new S3Client({
  region: config.aws.AWS_REGION,
  endpoint: config.aws.AWS_ENDPOINT,
  credentials: {
    accessKeyId: config.aws.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.aws.AWS_SECRET_ACCESS_KEY
  }
})

export const createBodyFromFilePath = (filepath: string) => {
  return fs.createReadStream(filepath)
}

export const putObject = async (params: {
  Key: string
  Body: Buffer | Readable
  ContentType?: string
  CacheControl?: string
}) => {
  const command = new PutObjectCommand({
    ...params,
    Bucket: config.aws.AWS_BUCKET
  })
  const data = await s3.send(command)
  return data
}

export const headObject = async ({ Key }: { Key: string }) => {
  const command = new HeadObjectCommand({
    Bucket: config.aws.AWS_BUCKET,
    Key: Key
  })
  return await s3.send(command)
}

export const getObject = async ({ Key }: { Key: string }) => {
  const params = new GetObjectCommand({
    Bucket: config.aws.AWS_BUCKET,
    Key: Key
  })
  return await s3.send(params)
}
