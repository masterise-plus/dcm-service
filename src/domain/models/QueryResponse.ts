import { MetadataField } from '../../types/MetaDataField.js';

export interface QueryResponse {
  data: any[];
  done: boolean;
  nextBatchId?: string;
  queryId?: string;
  startTime?: string;
  endTime?: string;
  rowCount?: number;
  metadata: Record<string, MetadataField>;
}

export interface QueryRequest {
  sql: string;
  dataspace: string;
}
