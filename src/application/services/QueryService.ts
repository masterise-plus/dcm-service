import { ApiClient } from '@/infrastructure/api/SalesforceApiClient';
import { QueryResponse } from '@/domain/models/QueryResponse';

export interface QueryService {
  executeQuery(sql: string): Promise<QueryResponse>;
  getAllResults(sql: string): Promise<QueryResponse[]>;
}

export class SalesforceQueryService implements QueryService {
  constructor(private apiClient: ApiClient) {}

  async executeQuery(sql: string): Promise<QueryResponse> {
    return this.apiClient.postQuery(sql);
  }

  async getAllResults(sql: string): Promise<QueryResponse[]> {
    const results: QueryResponse[] = [];
    let currentResponse = await this.apiClient.postQuery(sql);
    results.push(currentResponse);

    while (!currentResponse.done && currentResponse.nextBatchId) {
      currentResponse = await this.apiClient.getNextBatch(currentResponse.nextBatchId);
      results.push(currentResponse);
    }

    return results;
  }
}
