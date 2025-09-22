import 'dotenv/config';
import { GoogleCloudStorageService } from '../infrastructure/storage/GoogleCloudStorageService.js';
import { ConfigService } from '../config/Config.js';
import logger from '../utils/Logger.js';

async function testGcsUpload() {
  const config = ConfigService.getInstance().getConfig();
  
  if (!config.gcsUploadEnabled || !config.gcsBucketName) {
    logger.info('⚠️  GCS upload is not enabled or bucket name is not configured');
    logger.info('Set GCS_UPLOAD_ENABLED=true and GCS_BUCKET_NAME to enable GCS upload');
    return;
  }

  const gcsService = new GoogleCloudStorageService(config.gcsKeyFilename);
  
  try {
    // Create a test CSV file
    const testFilePath = './test-upload.csv';
    const fs = await import('node:fs');
    
    // Write test content to file
    fs.writeFileSync(testFilePath, 'id,name,email\n1,Test User,test@example.com\n2,Another User,another@example.com');
    
    const destinationFileName = config.gcsDestinationPrefix 
      ? `${config.gcsDestinationPrefix}/test-upload-${Date.now()}.csv`
      : `test-upload-${Date.now()}.csv`;

    logger.info('🧪 Testing GCS upload...', {
      bucketName: config.gcsBucketName,
      filePath: testFilePath,
      destinationFileName
    });

    // Upload the file
    const uploadedUrl = await gcsService.uploadFile(
      config.gcsBucketName,
      testFilePath,
      destinationFileName,
      {
        makePublic: config.gcsMakePublic || false,
        metadata: {
          'test-upload': 'true',
          'uploaded-at': new Date().toISOString()
        }
      }
    );

    logger.info('✅ Test upload completed successfully!', {
      uploadedUrl,
      bucketName: config.gcsBucketName,
      destinationFileName
    });

    // Check if file exists
    const exists = await gcsService.fileExists(config.gcsBucketName, destinationFileName);
    logger.info(`🔍 File exists check: ${exists ? 'YES' : 'NO'}`);

    // Clean up test file
    fs.unlinkSync(testFilePath);
    logger.info('🧹 Cleaned up test file');

  } catch (error) {
    logger.error('❌ Test upload failed:', error);
    if (error instanceof Error) {
      logger.error('Error details:', { message: error.message, stack: error.stack });
    }
  }
}

// Run the test
if (require.main === module) {
  testGcsUpload().catch(err => {
    logger.error('❌ Test failed:', err);
    process.exit(1);
  });
}
