import { ApiClient } from '@/interfaces/ApiClient.js';
import { ConfigService } from '../../config/Config.js';
import { QueryResponse, QueryRequest } from '../../domain/models/QueryResponse.js';
import { SalesforceAuthService } from '../auth/SalesforceAuthService.js';

export class SalesforceApiClient implements ApiClient {
  private config = ConfigService.getInstance().getConfig();
  private authService: SalesforceAuthService | null = null;

  constructor() {
    if (this.config.useOAuth && this.config.clientId && this.config.clientSecret) {
      this.authService = new SalesforceAuthService(
        this.config.clientId,
        this.config.clientSecret
      );
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
      throw new Error(`Query POST failed ${response.status}: ${text}`);
    }

    const data = await response.json() as QueryResponse;
    
    console.log('[API] Query response:', {
      done: data.done,
      rowCount: data.rowCount,
      returnedRows: data.returnedRows,
      queryId: data.queryId,
      dataLength: data.data?.length || 0,
      metadataFields: data.metadata?.length || 0,
      metadataNames: data.metadata?.map(item => item.name) || []
    });

    return data;
  }

  async getNextBatch(nextBatchId: string): Promise<QueryResponse> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.instanceUrl}/services/data/${this.config.apiVersion}/ssot/query-sql/${encodeURIComponent(nextBatchId)}?dataspace=${encodeURIComponent(this.config.dataspace)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Query NEXT failed ${response.status}: ${text}`);
    }

    const data = await response.json() as QueryResponse;
    
    console.log('[API] Next batch response:', {
      done: data.done,
      rowCount: data.rowCount,
      queryId: data.queryId,
      dataLength: data.data?.length || 0,
      nextBatchId: data.nextBatchId
    });

    return data;
  }
}
