import { ApiClient } from '@/infrastructure/api/SalesforceApiClient';
import { QueryResponse } from '@/domain/models/QueryResponse';
import { createServiceLogger } from '@/utils/Logger';

export interface QueryService {
  executeQuery(sql: string): Promise<QueryResponse>;
  getAllResults(sql: string): Promise<QueryResponse[]>;
}

export class SalesforceQueryService implements QueryService {
  private logger = createServiceLogger('SalesforceQueryService');

  constructor(private apiClient: ApiClient) {}

  async executeQuery(sql: string): Promise<QueryResponse> {
    this.logger.info('🔄 Executing query', { 
      sqlLength: sql.length,
      sqlPreview: sql.substring(0, 100) + (sql.length > 100 ? '...' : '')
    });

    try {
      const response = await this.apiClient.postQuery(sql);
      
      this.logger.info('✅ Query executed successfully', {
        returnedRows: response.returnedRows,
        rowCount: response.rowCount,
        done: response.done,
        hasNextBatch: !!response.nextBatchId,
        queryId: response.queryId
      });

      return response;
    } catch (error) {
      this.logger.error('❌ Query execution failed', { 
        sqlLength: sql.length,
        error 
      });
      throw error;
    }
  }

  async getAllResults(sql: string): Promise<QueryResponse[]> {
    this.logger.info('🔄 Fetching all query results', { 
      sqlLength: sql.length,
      sqlPreview: sql.substring(0, 100) + (sql.length > 100 ? '...' : '')
    });

    try {
      const results: QueryResponse[] = [];
      let currentResponse = await this.apiClient.postQuery(sql);
      results.push(currentResponse);

      let batchCount = 1;
      while (!currentResponse.done && currentResponse.nextBatchId) {
        this.logger.info(`📄 Fetching additional batch ${batchCount + 1}...`);
        currentResponse = await this.apiClient.getNextBatch(currentResponse.nextBatchId);
        results.push(currentResponse);
        batchCount++;
      }

      const totalRows = results.reduce((sum, response) => sum + (response.returnedRows || response.rowCount || 0), 0);
      
      this.logger.info('✅ All query results fetched successfully', {
        totalBatches: results.length,
        totalRows,
        sqlLength: sql.length
      });

      return results;
    } catch (error) {
      this.logger.error('❌ Failed to fetch all query results', { 
        sqlLength: sql.length,
        error 
      });
      throw error;
    }
  }
}
