import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiErrorResponse } from 'cloudinary';

/**
 * Thin wrapper around Cloudinary. Kept deliberately generic
 * (`uploadFile`/`deleteFile`, no "logo"-specific naming) so any future
 * feature needing object storage reuses this instead of a second client
 * elsewhere — this is exactly why swapping the actual provider (this file
 * previously wrapped Cloudflare R2 via `@aws-sdk/client-s3`) never had to
 * touch `CompanySettingsService`/`CompanySettingsController` at all.
 *
 * `key` is treated as a Cloudinary `public_id` with any trailing file
 * extension stripped before every SDK call — Cloudinary manages the
 * delivered URL's extension itself from the detected format, and passing
 * an extension inside `public_id` at upload time produces an inconsistent,
 * documented Cloudinary gotcha (a literal double extension). The caller
 * (`CompanySettingsService`) still constructs/stores a key WITH an
 * extension (`company-logos/{companyId}/{uuid}.png`) and extracts it back
 * out of the returned `secure_url` unchanged — Cloudinary's delivery URL
 * always contains that same "public_id.detected-extension" substring, so
 * that round-trip still works without either side needing to know about
 * the other's extension-handling quirk.
 *
 * Credentials are read via `ConfigService` (mirrors
 * `sslcommerz.adapter.ts`'s established convention for external-service
 * config), not validated at app-boot — cloud storage is optional
 * infrastructure that may not be configured in every environment, so a
 * missing credential only fails the specific upload/delete call that needs
 * it, never blocks the whole app from starting.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private configured = false;

  constructor(private readonly configService: ConfigService) {}

  async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
    this.ensureConfigured();
    const publicId = this.stripExtension(key);
    const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
    });
    return result.secure_url;
  }

  /** Idempotent — a not-found asset is not an error (the caller may be cleaning up a key that was never actually written). */
  async deleteFile(key: string): Promise<void> {
    this.ensureConfigured();
    const publicId = this.stripExtension(key);

    try {
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error(`Cloudinary destroy returned "${result.result}"`);
      }
    } catch (error) {
      const message = this.isUploadApiError(error) ? error.message : error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn({ event: 'storage_delete_failed', key, message });
      throw error;
    }
  }

  private stripExtension(key: string): string {
    return key.replace(/\.[a-zA-Z0-9]+$/, '');
  }

  private isUploadApiError(error: unknown): error is UploadApiErrorResponse {
    return typeof error === 'object' && error !== null && 'message' in error;
  }

  private ensureConfigured(): void {
    if (this.configured) return;

    const cloudName = this.requireConfig('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.requireConfig('CLOUDINARY_API_KEY');
    const apiSecret = this.requireConfig('CLOUDINARY_API_SECRET');

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.configured = true;
  }

  private requireConfig(key: 'CLOUDINARY_CLOUD_NAME' | 'CLOUDINARY_API_KEY' | 'CLOUDINARY_API_SECRET'): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(`${key} is not configured — cloud storage is unavailable`);
    }
    return value;
  }
}
