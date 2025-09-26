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
      this.logger.info('🚀 Starting Salesforce data export with new pagination...');
      
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

      // Use the new pagination method to get all results
      const allResponses = await this.queryService.getAllResultsWithPagination(this.config.sqlQuery);
      
      if (allResponses.length === 0) {
        throw new Error('No data returned from query');
      }

      // Get headers from metadata array (use first response)
      const firstResponse = allResponses[0];
      const headers = CsvWriter.getHeadersFromMetadata(firstResponse.metadata);
      
      // Write headers
      csvWriter.writeHeaders(headers);
      
      // Write all data from all batches
      let totalRowsWritten = 0;
      for (let i = 0; i < allResponses.length; i++) {
        const response = allResponses[i];
        this.logger.info(`📝 Writing batch ${i + 1}/${allResponses.length} to CSV`, {
          rowsInBatch: response.data?.length || 0,
          totalRowsWrittenSoFar: totalRowsWritten
        });
        
        this.writeDataToCsv(csvWriter, response.data, headers);
        totalRowsWritten += response.data?.length || 0;
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
                'rows': String(totalRowsWritten)
              }
            }
          );
        } catch (gcsError) {
          this.logger.error('❌ Failed to upload to Google Cloud Storage:', gcsError);
          // Don't throw error - continue even if GCS upload fails
        }
      }

      this.logger.info('✅ Salesforce data export completed successfully with new pagination!', {
        totalRows: totalRowsWritten,
        totalBatches: allResponses.length,
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
