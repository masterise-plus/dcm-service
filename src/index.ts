import 'dotenv/config';
import { CronJob } from 'cron';
import { Application } from './application/Application';
import logger from './utils/Logger';

async function main(): Promise<void> {
  const app = new Application();
  
  // Check if we should run in scheduled mode or one-time mode
  const runScheduled = process.env.RUN_SCHEDULED === 'true';
  
  if (runScheduled) {
    logger.info('🕐 Starting Salesforce data export in scheduled mode (every 30 minutes)...');
    
    // Create cron job that runs every 30 minutes
    const job = new CronJob(
      '*/30 * * * *', // Cron pattern for every 30 minutes
      async () => {
        await app.runScheduled();
      },
      null, // onComplete callback
      true, // start the job immediately
      'Asia/Jakarta' // timeZone (adjust as needed)
    );
    
    logger.info('✅ Cron job scheduled to run every 30 minutes');
    logger.info('📝 Press Ctrl+C to stop the scheduled execution');
    
    // Keep the process alive
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping cron job...');
      job.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping cron job...');
      job.stop();
      process.exit(0);
    });
    
  } else {
    logger.info('🚀 Running Salesforce data export in one-time mode...');
    await app.run();
  }
}

// Node 18+ has global fetch. If running older Node, install undici or node-fetch.
main().catch(err => {
  logger.error('❌ Error:', err);
  process.exit(1);
});
