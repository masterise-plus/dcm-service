import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import logger from '../utils/Logger.js';

async function checkBuckets() {
  try {
    logger.info('🔍 Checking available Google Cloud Storage buckets...');
    
    const storage = new Storage({ keyFilename: './unique-pixel-463108-r1-8c1eb5d5c32d.json' });
    
    const [buckets] = await storage.getBuckets();
    
    if (buckets.length === 0) {
      logger.info('📦 No buckets found in your project');
      logger.info('💡 You can create a bucket using:');
      logger.info('   gsutil mb gs://your-bucket-name');
      logger.info('   or visit: https://console.cloud.google.com/storage');
    } else {
      logger.info('📦 Available buckets:');
      buckets.forEach((bucket, index) => {
        logger.info(`   ${index + 1}. ${bucket.name}`);
      });
    }
    
    // Also check if the configured bucket exists
    const config = await import('../config/Config.js');
    const configService = config.ConfigService.getInstance();
    const bucketName = configService.getConfig().gcsBucketName;
    
    if (bucketName) {
      logger.info(`🔍 Checking if configured bucket '${bucketName}' exists...`);
      const bucket = storage.bucket(bucketName);
      const [exists] = await bucket.exists();
      
      if (exists) {
        logger.info(`✅ Bucket '${bucketName}' exists and is accessible`);
      } else {
        logger.info(`❌ Bucket '${bucketName}' does not exist`);
        logger.info(`💡 To create this bucket, run: gsutil mb gs://${bucketName}`);
      }
    }
    
  } catch (error) {
    logger.error('❌ Error checking buckets:', error);
    if (error instanceof Error) {
      logger.error('Error details:', { message: error.message });
    }
  }
}

// Run the check
if (require.main === module) {
  checkBuckets().catch(err => {
    logger.error('❌ Check failed:', err);
    process.exit(1);
  });
}
