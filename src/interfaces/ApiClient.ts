import { QueryResponse } from "@/domain/models/QueryResponse";

export interface ApiClient {
  postQuery(sql: string, rowLimit?: number): Promise<QueryResponse>;
  getNextBatch(nextBatchId: string): Promise<QueryResponse>;
  getQueryResults(queryId: string, offset: number, rowLimit: number): Promise<QueryResponse>;
}
