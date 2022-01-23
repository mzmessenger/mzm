import fs from 'fs'
import { Readable } from 'stream'
import AWS from 'aws-sdk'
import * as config from '../config'

const credentials = new AWS.Credentials({
  accessKeyId: config.aws.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.aws.AWS_SECRET_ACCESS_KEY
})

AWS.config.update({
  credentials,
  region: config.aws.AWS_REGION
})
const s3 = new AWS.S3({ apiVersion: '2006-03-01' })

export const createBodyFromFilePath = (filepath: string) => {
  return fs.createReadStream(filepath)
}

export const putObject = async (params: {
  Key: string
  Body: Buffer | Readable
  ContentType?: string
  CacheControl?: string
}) => {
  const p = { ...params, Bucket: config.aws.AWS_BUCKET }
  const data = await s3.putObject(p).promise()
  return data
}

export const headObject = async ({ Key }: { Key: string }) => {
  const params = {
    Bucket: config.aws.AWS_BUCKET,
    Key: Key
  }
  return await s3.headObject(params).promise()
}

export const getObject = ({ Key }: { Key: string }) => {
  const params = {
    Bucket: config.aws.AWS_BUCKET,
    Key: Key
  }
  return s3.getObject(params)
}
