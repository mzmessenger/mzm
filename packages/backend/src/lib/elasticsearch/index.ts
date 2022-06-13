import { Client } from '@elastic/elasticsearch'
import * as config from '../../config.js'

export const client = new Client(config.elasticsearch.client)
