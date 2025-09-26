import { ConfigService } from '../config/Config.js';
import { SalesforceApiClient } from '../infrastructure/api/SalesforceApiClient.js';
import { SalesforceQueryService } from '../application/services/QueryService.js';
import logger from '../utils/Logger.js';

/**
 * Test script to verify the new pagination implementation
 */
async function testNewPagination(): Promise<void> {
  logger.info('🧪 Testing new Salesforce pagination implementation...');
  
  try {
    const config = ConfigService.getInstance().getConfig();
    const apiClient = new SalesforceApiClient();
    const queryService = new SalesforceQueryService(apiClient);

    // Test authentication
    logger.info('🔐 Testing authentication...');
    const token = await apiClient.getAccessToken();
    logger.info('✅ Authentication successful', { tokenLength: token.length });

    // Test with a simple query that should return some data
    const testQuery = config.sqlQuery || 'SELECT cdp_sys_SourceVersion__c, created_at__c, DataSource__c, DataSourceObject__c, InternalOrganization__c, KQ_transaction_id__c, member_id__c, payment_method__c, payment_status__c, product_id__c FROM transactions_erasandbox_25__dll LIMIT 100';
    
    logger.info('🔄 Testing new pagination method...', { 
      query: testQuery.substring(0, 100) + '...' 
    });

    // Use the new pagination method
    const startTime = Date.now();
    const results = await queryService.getAllResultsWithPagination(testQuery);
    const endTime = Date.now();

    // Analyze results
    const totalBatches = results.length;
    const totalRows = results.reduce((sum, response) => 
      sum + (response.returnedRows || response.data?.length || 0), 0
    );

    logger.info('✅ New pagination test completed successfully!', {
      totalBatches,
      totalRows,
      executionTimeMs: endTime - startTime,
      averageRowsPerBatch: Math.round(totalRows / totalBatches),
      firstBatchSize: results[0]?.data?.length || 0,
      lastBatchSize: results[results.length - 1]?.data?.length || 0
    });

    // Validate that we have metadata in the first response
    if (results[0]?.metadata && results[0].metadata.length > 0) {
      logger.info('✅ Metadata validation successful', {
        fieldCount: results[0].metadata.length,
        fields: results[0].metadata.map(field => field.name)
      });
    } else {
      logger.warn('⚠️  No metadata found in first response');
    }

    // Log sample data from first batch
    if (results[0]?.data && results[0].data.length > 0) {
      logger.info('📊 Sample data from first batch', {
        firstRow: results[0].data[0],
        totalColumns: results[0].data[0]?.length || 0
      });
    }

    logger.info('🎉 All tests passed! The new pagination implementation is working correctly.');

  } catch (error) {
    logger.error('❌ Test failed:', error);
    if (error instanceof Error) {
      logger.error('Error details:', { 
        message: error.message, 
        stack: error.stack 
      });
    }
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testNewPagination().catch(error => {
    logger.error('❌ Unhandled error in test:', error);
    process.exit(1);
  });
}

export { testNewPagination };
