import { ConfigService } from '../config/Config.js';
import { SalesforceApiClient } from '../infrastructure/api/SalesforceApiClient.js';
import { SalesforceQueryService } from './services/QueryService.js';
import { CsvWriter } from '../utils/CsvWriter.js';
import { GoogleCloudStorageService } from '../infrastructure/storage/GoogleCloudStorageService.js';
import logger, { createServiceLogger } from '../utils/Logger.js';

export class Application {
  private config = ConfigService.getInstance().getConfig();
  private apiClient = new SalesforceApiClient();
  private queryService = new SalesforceQueryService(this.apiClient);
  private gcsService = new GoogleCloudStorageService(this.config.gcsKeyFilename);
  private logger = createServiceLogger('Application');

  async run(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Salesforce data export...');
      
      // Initialize authentication if OAuth is enabled
      if (this.config.useOAuth) {
        this.logger.info('🔐 Using OAuth authentication');
        const token = await this.apiClient.getAccessToken();
        this.logger.info('✅ Authentication successful', { tokenLength: token.length });
      } else {
        this.logger.info('🔑 Using static access token');
      }
      
      const csvWriter = new CsvWriter(this.config.outputCsvPath);
      csvWriter.open();

      // Execute initial query
      const firstResponse = await this.queryService.executeQuery(this.config.sqlQuery);
      
      // Get headers from metadata array
      const headers = CsvWriter.getHeadersFromMetadata(firstResponse.metadata);
      
      // Write headers
      csvWriter.writeHeaders(headers);
      
      // Write first batch of data
      this.writeDataToCsv(csvWriter, firstResponse.data, headers);

      // Handle pagination
      let batchCount = 1;
      if (!firstResponse.done && firstResponse.nextBatchId) {
        let nextBatchId = firstResponse.nextBatchId;
        
        while (nextBatchId) {
          this.logger.info(`📄 Fetching batch ${batchCount + 1}...`);
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

      // Upload to Google Cloud Storage if enabled
      let gcsUrl: string | undefined;
      if (this.config.gcsUploadEnabled && this.config.gcsBucketName) {
        try {
          const fileName = this.config.outputCsvPath.split('/').pop() || 'export.csv';
          const destinationFileName = this.config.gcsDestinationPrefix 
            ? `${this.config.gcsDestinationPrefix}/${fileName}`
            : fileName;

          gcsUrl = await this.gcsService.uploadFile(
            this.config.gcsBucketName,
            this.config.outputCsvPath,
            destinationFileName,
            {
              makePublic: this.config.gcsMakePublic || false,
              metadata: {
                'uploaded-at': new Date().toISOString(),
                'source': 'salesforce-export',
                'rows': String(firstResponse.returnedRows || firstResponse.rowCount || 0)
              }
            }
          );
        } catch (gcsError) {
          this.logger.error('❌ Failed to upload to Google Cloud Storage:', gcsError);
          // Don't throw error - continue even if GCS upload fails
        }
      }

      this.logger.info('✅ Salesforce data export completed successfully!', {
        totalRows: firstResponse.returnedRows || firstResponse.rowCount,
        batchesProcessed: batchCount,
        outputFile: this.config.outputCsvPath,
        gcsUrl: gcsUrl || 'Not uploaded'
      });
      
    } catch (error) {
      this.logger.error('❌ Error during export:', error);
      if (error instanceof Error) {
        this.logger.error('Error details:', { message: error.message, stack: error.stack });
      }
      throw error;
    }
  }

  async runScheduled(): Promise<void> {
    const timestamp = new Date().toISOString();
    this.logger.info(`⏰ Starting scheduled Salesforce data export...`, { timestamp });
    
    try {
      await this.run();
      this.logger.info(`✅ Scheduled export completed successfully!`, { timestamp });
    } catch (error) {
      this.logger.error(`❌ Error during scheduled export:`, { timestamp, error });
      // Don't throw error in scheduled mode to prevent cron job from stopping
    }
  }

  private writeDataToCsv(csvWriter: CsvWriter, data: any[], headers: string[]): void {
    for (const row of data) {
      csvWriter.writeRow(row, headers);
    }
  }
}
