import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import { StorageService } from './storage.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

describe('StorageService', () => {
  let service: StorageService;

  const CONFIG: Record<string, string> = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
  };

  const mockConfigService = {
    get: jest.fn((key: string): string | undefined => CONFIG[key]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => CONFIG[key]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(StorageService);
  });

  describe('uploadFile', () => {
    it('uploads a base64 data URI under an extension-stripped public_id and returns the secure_url', async () => {
      (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/company-logos/company-1/abc.png',
      });

      const buffer = Buffer.from('fake-image-bytes');
      const url = await service.uploadFile(buffer, 'company-logos/company-1/abc.png', 'image/png');

      expect(url).toBe('https://res.cloudinary.com/test-cloud/image/upload/v1/company-logos/company-1/abc.png');
      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
        `data:image/png;base64,${buffer.toString('base64')}`,
        { public_id: 'company-logos/company-1/abc', resource_type: 'image', overwrite: true },
      );
    });

    it('configures the Cloudinary SDK from ConfigService exactly once, even across multiple calls', async () => {
      (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({ secure_url: 'https://x' });

      await service.uploadFile(Buffer.from('a'), 'k1.png', 'image/png');
      await service.uploadFile(Buffer.from('b'), 'k2.png', 'image/png');

      expect(cloudinary.config).toHaveBeenCalledTimes(1);
      expect(cloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'test-key',
        api_secret: 'test-secret',
        secure: true,
      });
    });

    it('throws a clear error when a required credential is missing, without ever calling the SDK', async () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'CLOUDINARY_CLOUD_NAME' ? undefined : CONFIG[key],
      );

      await expect(service.uploadFile(Buffer.from('x'), 'k.png', 'image/png')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('destroys the extension-stripped public_id', async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });

      await service.deleteFile('company-logos/company-1/abc.png');

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('company-logos/company-1/abc', {
        resource_type: 'image',
      });
    });

    it('is idempotent — a "not found" result does not throw', async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'not found' });

      await expect(service.deleteFile('missing-key.png')).resolves.toBeUndefined();
    });

    it('throws when Cloudinary reports any other result', async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'error' });

      await expect(service.deleteFile('some-key.png')).rejects.toThrow('Cloudinary destroy returned "error"');
    });
  });
});
