import { QueryResponse } from "@/domain/models/QueryResponse";

export interface ApiClient {
  postQuery(sql: string): Promise<QueryResponse>;
  getNextBatch(nextBatchId: string): Promise<QueryResponse>;
}