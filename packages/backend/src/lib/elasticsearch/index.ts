import { Client } from '@elastic/elasticsearch'
import * as config from '../../config'

export const client = new Client(config.elasticsearch.client)
