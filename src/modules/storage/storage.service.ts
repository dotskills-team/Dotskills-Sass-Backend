import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3';

/**
 * Thin wrapper around Cloudflare R2 (S3-API-compatible, hence the official
 * `@aws-sdk/client-s3` package works unchanged — just a custom `endpoint`
 * and `region: 'auto'`, R2's own documented convention). Kept deliberately
 * generic (`uploadFile`/`deleteFile`, no "logo"-specific naming) so any
 * future feature needing object storage reuses this instead of a second
 * S3 client somewhere else.
 *
 * Credentials are read via `ConfigService` (mirrors
 * `sslcommerz.adapter.ts`'s established convention for external-service
 * config), not validated at app-boot — R2 is optional infrastructure that
 * may not be configured yet in every environment, so a missing credential
 * only fails the specific upload/delete call that needs it, never blocks
 * the whole app from starting.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
    const client = this.getClient();
    const bucket = this.requireConfig('R2_BUCKET_NAME');

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const publicUrlBase = this.requireConfig('R2_PUBLIC_URL_BASE').replace(/\/+$/, '');
    return `${publicUrlBase}/${key}`;
  }

  /** Idempotent — a not-found object is not an error (the caller may be cleaning up a key that was never actually written). */
  async deleteFile(key: string): Promise<void> {
    const client = this.getClient();
    const bucket = this.requireConfig('R2_BUCKET_NAME');

    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      if (error instanceof NotFound) return;
      this.logger.warn({ event: 'storage_delete_failed', key, message: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private getClient(): S3Client {
    if (this.client) return this.client;

    const accountId = this.requireConfig('R2_ACCOUNT_ID');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.requireConfig('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.requireConfig('R2_SECRET_ACCESS_KEY'),
      },
    });
    return this.client;
  }

  private requireConfig(key: 'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY' | 'R2_BUCKET_NAME' | 'R2_PUBLIC_URL_BASE'): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured — cloud storage is unavailable`);
    }
    return value;
  }
}
