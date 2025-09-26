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
      // Check if we have a cached token first
      const cachedToken = this.authService.getCachedToken();
      const isTokenExpired = this.authService.isTokenExpired();
      const timeUntilExpiry = this.authService.getTimeUntilExpiry();
      
      this.logger.info('OAuth authentication - checking token status', {
        hasCachedToken: !!cachedToken,
        isTokenExpired: isTokenExpired,
        timeUntilExpiryMs: timeUntilExpiry,
        timeUntilExpiryMinutes: Math.round(timeUntilExpiry / 60000)
      });

      if (cachedToken && !isTokenExpired) {
        this.logger.info('Using cached OAuth token', {
          tokenLength: cachedToken.length,
          expiresInMinutes: Math.round(timeUntilExpiry / 60000),
          expiryTime: new Date(this.authService.getTokenExpiryTime()).toISOString()
        });
      }

      return this.authService.getAccessToken();
    }
    
    // For static tokens, validate before use
    const staticToken = this.config.accessToken;
    if (staticToken) {
      const isValid = await this.validateStaticToken(staticToken);
      if (isValid) {
        this.logger.info('Using validated static access token');
        return staticToken;
      } else {
        this.logger.error('Static access token is invalid');
        throw new Error('Static access token is invalid and no OAuth credentials available');
      }
    }

    throw new Error('No valid authentication method available');
  }

  /**
   * Validate static access token using Salesforce API
   */
  private async validateStaticToken(token: string): Promise<boolean> {
    try {
      this.logger.debug('Validating static access token', { 
        tokenLength: token.length,
        instanceUrl: this.config.instanceUrl 
      });

      // Use a lightweight Salesforce API endpoint to validate token
      const validationUrl = `${this.config.instanceUrl}/services/data/${this.config.apiVersion}/limits`;
      
      const response = await fetch(validationUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'SalesforceApiClient/1.0'
        }
      });

      const isValid = response.ok;
      
      if (isValid) {
        this.logger.debug('Static token validation successful');
      } else {
        this.logger.warn('Static token validation failed', { 
          status: response.status,
          statusText: response.statusText
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Static token validation error', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async postQuery(sql: string, rowLimit?: number): Promise<QueryResponse> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.instanceUrl}/services/data/${this.config.apiVersion}/ssot/query-sql?dataspace=${encodeURIComponent(this.config.dataspace)}`;
    
    this.logger.info('Executing Salesforce query', { 
      dataspace: this.config.dataspace,
      queryLength: sql.length,
      rowLimit,
      instanceUrl: this.config.instanceUrl
    });

    const requestBody: any = { sql };
    if (rowLimit !== undefined) {
      requestBody.rowLimit = rowLimit;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
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

  async getQueryResults(queryId: string, offset: number, rowLimit: number): Promise<QueryResponse> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.instanceUrl}/services/data/${this.config.apiVersion}/ssot/query-sql/${encodeURIComponent(queryId)}/rows?offset=${offset}&rowLimit=${rowLimit}`;
    
    this.logger.info('Fetching query results with pagination', { 
      queryId,
      offset,
      rowLimit,
      url 
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
      this.logger.error('Query results fetch failed', { 
        status: response.status, 
        statusText: response.statusText,
        errorText: text,
        queryId,
        offset,
        rowLimit,
        url 
      });
      throw new Error(`Query results fetch failed ${response.status}: ${text}`);
    }

    const data = await response.json() as QueryResponse;
    
    this.logger.info('✅ Query results fetched successfully', {
      returnedRows: data.returnedRows,
      rowCount: data.rowCount,
      dataLength: data.data?.length || 0,
      metadataFields: data.metadata?.length || 0,
      offset,
      rowLimit
    });

    return data;
  }
}
export { ApiClient };
