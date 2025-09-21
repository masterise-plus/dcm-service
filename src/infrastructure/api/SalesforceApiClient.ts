import { ApiClient } from '@/interfaces/ApiClient.js';
import { ConfigService } from '../../config/Config.js';
import { QueryResponse } from '../../domain/models/QueryResponse.js';
import { QueryRequest } from '@/domain/models/QueryRequest.js';
import { SalesforceAuthService } from '../auth/SalesforceAuthService.js';
import { createServiceLogger } from '../../utils/Logger.js';

export class SalesforceApiClient implements ApiClient {
  private config = ConfigService.getInstance().getConfig();
  private authService: SalesforceAuthService | null = null;
  private logger = createServiceLogger('SalesforceApiClient');

  constructor() {
    if (this.config.useOAuth && this.config.clientId && this.config.clientSecret) {
      this.authService = new SalesforceAuthService(
        this.config.clientId,
        this.config.clientSecret
      );
      this.logger.info('OAuth authentication configured', { 
        clientId: this.config.clientId,
        hasClientSecret: !!this.config.clientSecret 
      });
    } else {
      this.logger.info('Using static access token authentication');
    }
  }

  public async getAccessToken(): Promise<string> {
    if (this.authService) {
      return this.authService.getAccessToken();
    }
    return this.config.accessToken;
  }

  async postQuery(sql: string): Promise<QueryResponse> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.instanceUrl}/services/data/${this.config.apiVersion}/ssot/query-sql?dataspace=${encodeURIComponent(this.config.dataspace)}`;
    
    this.logger.info('Executing Salesforce query', { 
      dataspace: this.config.dataspace,
      queryLength: sql.length,
      instanceUrl: this.config.instanceUrl
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error('Query POST failed', { 
        status: response.status, 
        statusText: response.statusText,
        errorText: text,
        url: url 
      });
      throw new Error(`Query POST failed ${response.status}: ${text}`);
    }

    const data = await response.json() as QueryResponse;
    
    this.logger.info('✅ Query executed successfully', {
      done: data.done,
      rowCount: data.rowCount,
      returnedRows: data.returnedRows,
      queryId: data.queryId,
      dataLength: data.data?.length || 0,
      metadataFields: data.metadata?.length || 0,
      metadataNames: data.metadata?.map(item => item.name) || [],
      hasNextBatch: !!data.nextBatchId
    });

    return data;
  }

  async getNextBatch(nextBatchId: string): Promise<QueryResponse> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.instanceUrl}/services/data/${this.config.apiVersion}/ssot/query-sql/${encodeURIComponent(nextBatchId)}?dataspace=${encodeURIComponent(this.config.dataspace)}`;
    
    this.logger.info('Fetching next batch of query results', { 
      nextBatchId,
      dataspace: this.config.dataspace 
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error('Query NEXT failed', { 
        status: response.status, 
        statusText: response.statusText,
        errorText: text,
        nextBatchId,
        url: url 
      });
      throw new Error(`Query NEXT failed ${response.status}: ${text}`);
    }

    const data = await response.json() as QueryResponse;
    
    this.logger.info('✅ Next batch fetched successfully', {
      done: data.done,
      rowCount: data.rowCount,
      queryId: data.queryId,
      dataLength: data.data?.length || 0,
      nextBatchId: data.nextBatchId,
      hasMoreBatches: !!data.nextBatchId
    });

    return data;
  }
}
export { ApiClient };
