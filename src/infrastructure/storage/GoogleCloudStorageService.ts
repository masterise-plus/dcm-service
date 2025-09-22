import { Storage } from '@google-cloud/storage';
import { createReadStream } from 'node:fs';
import logger, { createServiceLogger } from '../../utils/Logger.js';

export class GoogleCloudStorageService {
  private storage: Storage;
  private logger = createServiceLogger('GoogleCloudStorageService');

  constructor(keyFilename?: string) {
    // Initialize with service account key if provided, otherwise use Application Default Credentials
    this.storage = keyFilename 
      ? new Storage({ keyFilename })
      : new Storage();
  }

  async uploadFile(
    bucketName: string,
    filePath: string,
    destinationFileName: string,
    options: {
      makePublic?: boolean;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<string> {
    try {
      this.logger.info(`📤 Uploading file to GCS`, {
        bucketName,
        filePath,
        destinationFileName
      });

      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(destinationFileName);

      // Upload options
      const uploadOptions: any = {
        destination: destinationFileName,
        metadata: {
          contentType: 'text/csv',
          ...options.metadata
        }
      };

      // Upload the file
      await bucket.upload(filePath, uploadOptions);

      // Make public if requested
      if (options.makePublic) {
        await file.makePublic();
        this.logger.info(`🌐 File made public`, { destinationFileName });
      }

      // Get the public URL
      const publicUrl = `gs://${bucketName}/${destinationFileName}`;
      const httpsUrl = `https://storage.googleapis.com/${bucketName}/${destinationFileName}`;

      this.logger.info(`✅ File uploaded successfully`, {
        publicUrl,
        httpsUrl,
        bucketName,
        destinationFileName
      });

      return httpsUrl;
    } catch (error) {
      this.logger.error(`❌ Failed to upload file to GCS`, {
        bucketName,
        filePath,
        destinationFileName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async fileExists(bucketName: string, fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      this.logger.error(`❌ Error checking file existence`, {
        bucketName,
        fileName,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async deleteFile(bucketName: string, fileName: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(bucketName);
      await bucket.file(fileName).delete();
      this.logger.info(`🗑️ File deleted from GCS`, { bucketName, fileName });
    } catch (error) {
      this.logger.error(`❌ Failed to delete file from GCS`, {
        bucketName,
        fileName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async listFiles(bucketName: string, prefix?: string): Promise<string[]> {
    try {
      const bucket = this.storage.bucket(bucketName);
      const [files] = await bucket.getFiles({ prefix });
      return files.map(file => file.name);
    } catch (error) {
      this.logger.error(`❌ Failed to list files in bucket`, {
        bucketName,
        prefix,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
