import { ConfigService } from '../config/Config.js';
import { SalesforceApiClient } from '../infrastructure/api/SalesforceApiClient.js';
import { SalesforceQueryService } from './services/QueryService.js';
import { CsvWriter } from '../utils/CsvWriter.js';

export class Application {
  private config = ConfigService.getInstance().getConfig();
  private apiClient = new SalesforceApiClient();
  private queryService = new SalesforceQueryService(this.apiClient);

  async run(): Promise<void> {
    try {
      console.log('🚀 Starting Salesforce data export...');
      
      // Initialize authentication if OAuth is enabled
      if (this.config.useOAuth) {
        console.log('🔐 Using OAuth authentication');
        const token = await this.apiClient.getAccessToken();
        console.log('✅ Authentication successful');
      } else {
        console.log('🔑 Using static access token');
      }
      
      const csvWriter = new CsvWriter(this.config.outputCsvPath);
      csvWriter.open();

      // Execute initial query
      const firstResponse = await this.queryService.executeQuery(this.config.sqlQuery);
      
      // Get ordered headers
      const headers = CsvWriter.getHeaderOrder(firstResponse.metadata);
      
      // Write headers
      csvWriter.writeHeaders(headers);
      
      // Write first batch of data
      this.writeDataToCsv(csvWriter, firstResponse.data, headers);

      // Handle pagination
      if (!firstResponse.done && firstResponse.nextBatchId) {
        let nextBatchId = firstResponse.nextBatchId;
        let batchCount = 1;
        
        while (nextBatchId) {
          console.log(`📄 Fetching batch ${batchCount + 1}...`);
          const nextResponse = await this.apiClient.getNextBatch(nextBatchId);
          this.writeDataToCsv(csvWriter, nextResponse.data, headers);
          
          if (nextResponse.done || !nextResponse.nextBatchId) {
            break;
          }
          
          nextBatchId = nextResponse.nextBatchId;
          batchCount++;
        }
      }

      csvWriter.close();
      console.log('✅ Salesforce data export completed successfully!');
      console.log(`📊 Total rows processed: ${firstResponse.rowCount || 'unknown'}`);
      
    } catch (error) {
      console.error('❌ Error during export:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      throw error;
    }
  }

  private writeDataToCsv(csvWriter: CsvWriter, data: any[], headers: string[]): void {
    for (const row of data) {
      csvWriter.writeRow(row, headers);
    }
  }
}
