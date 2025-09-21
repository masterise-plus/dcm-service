export interface MetadataItem {
  name: string;
  nullable: boolean;
  type: string;
}

export interface QueryResponse {
  data: any[];
  done: boolean;
  nextBatchId?: string;
  queryId?: string;
  startTime?: string;
  endTime?: string;
  rowCount?: number;
  metadata: MetadataItem[];
  returnedRows?: number;
  status?: {
    chunkCount: number;
    completionStatus: string;
    expirationTime: string;
    progress: number;
    queryId: string;
    rowCount: number;
  };
}


