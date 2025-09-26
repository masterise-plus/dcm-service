import { ApiClient } from '@/infrastructure/api/SalesforceApiClient';
import { QueryResponse } from '@/domain/models/QueryResponse';
import { createServiceLogger } from '@/utils/Logger';

export interface QueryService {
  executeQuery(sql: string): Promise<QueryResponse>;
  getAllResults(sql: string): Promise<QueryResponse[]>;
  getAllResultsWithPagination(sql: string): Promise<QueryResponse[]>;
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

  /**
   * Get all results using response-based pagination approach
   * Uses actual response pagination information (returnedRows) to determine next offset
   * This approach adapts to the actual batch sizes returned by the API
   */
  async getAllResultsWithPagination(sql: string): Promise<QueryResponse[]> {
    this.logger.info('🔄 Fetching all query results with response-based pagination', { 
      sqlLength: sql.length,
      sqlPreview: sql.substring(0, 100) + (sql.length > 100 ? '...' : '')
    });

    try {
      // First, execute the initial query to get queryId and total row count
      // Use rowLimit=1 to minimize data transfer for the initial query
      const initialResponse = await this.apiClient.postQuery(sql, 1);
      
      // Extract queryId from multiple possible locations in the response
      const queryId = initialResponse.queryId || 
                     initialResponse.status?.queryId || 
                     (initialResponse.status as any)?.queryId;
      
      if (!queryId) {
        this.logger.error('❌ No queryId found in initial response', {
          responseKeys: Object.keys(initialResponse),
          statusKeys: initialResponse.status ? Object.keys(initialResponse.status) : 'no status',
          queryId: initialResponse.queryId,
          statusQueryId: initialResponse.status?.queryId,
          fullResponse: JSON.stringify(initialResponse, null, 2)
        });
        throw new Error('No queryId returned from initial query');
      }

      const totalRowCount = initialResponse.status?.rowCount || initialResponse.rowCount || 0;

      this.logger.info('Initial query executed', {
        queryId: queryId,
        totalRowCount,
        returnedRows: initialResponse.returnedRows,
        chunkCount: initialResponse.status?.chunkCount,
        completionStatus: initialResponse.status?.completionStatus
      });

      // Use dynamic batch sizing based on response pagination
      const results: QueryResponse[] = [];
      let currentOffset = 0;
      let batchCount = 0;
      const maxBatchSize = 25000; // Maximum batch size to prevent memory issues

      // Continue fetching until we have all rows
      while (currentOffset < totalRowCount) {
        batchCount++;
        
        // Calculate batch size for this iteration
        const remainingRows = totalRowCount - currentOffset;
        const batchSize = Math.min(maxBatchSize, remainingRows);
        
        this.logger.info(`Fetching batch ${batchCount}`, {
          offset: currentOffset,
          batchSize,
          remainingRows,
          totalRowCount
        });

        // Fetch this batch
        const batchResponse = await this.apiClient.getQueryResults(queryId, currentOffset, batchSize);
        results.push(batchResponse);
        
        // Use the actual returned rows to determine next offset
        // This adapts to the actual batch sizes returned by the API
        const actualReturnedRows = batchResponse.returnedRows || batchResponse.data?.length || 0;
        currentOffset += actualReturnedRows;
        
        this.logger.info(`Batch ${batchCount} completed`, {
          actualReturnedRows,
          newOffset: currentOffset,
          progress: `${Math.round((currentOffset / totalRowCount) * 100)}%`
        });

        // If we've fetched all rows, break
        if (currentOffset >= totalRowCount) {
          break;
        }

        // Small delay to prevent overwhelming the API
        if (batchCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Validate that we got all expected data
      const totalFetchedRows = results.reduce((sum, response) => 
        sum + (response.returnedRows || response.data?.length || 0), 0
      );

      this.logger.info('✅ All query results fetched successfully with response-based pagination', {
        totalBatches: results.length,
        totalRowCount,
        totalFetchedRows,
        finalOffset: currentOffset,
        sqlLength: sql.length
      });

      return results;
    } catch (error) {
      this.logger.error('❌ Failed to fetch all query results with pagination', { 
        sqlLength: sql.length,
        error 
      });
      throw error;
    }
  }
}
