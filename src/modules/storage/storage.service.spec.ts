import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  NotFound,
} from '@aws-sdk/client-s3';

import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  const s3Mock = mockClient(S3Client);

  const CONFIG: Record<string, string> = {
    R2_ACCOUNT_ID: 'test-account-id',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET_NAME: 'test-bucket',
    R2_PUBLIC_URL_BASE: 'https://pub-test.r2.dev',
  };

  const mockConfigService = {
    get: jest.fn((key: string): string | undefined => CONFIG[key]),
  };

  beforeEach(async () => {
    s3Mock.reset();
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
    it('sends a PutObjectCommand with the bucket/key/body/contentType and returns the public URL', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const url = await service.uploadFile(Buffer.from('fake-image-bytes'), 'company-logos/company-1/abc.png', 'image/png');

      expect(url).toBe('https://pub-test.r2.dev/company-logos/company-1/abc.png');
      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({
        Bucket: 'test-bucket',
        Key: 'company-logos/company-1/abc.png',
        Body: Buffer.from('fake-image-bytes'),
        ContentType: 'image/png',
      });
    });

    it('strips a trailing slash from R2_PUBLIC_URL_BASE before joining the key', async () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'R2_PUBLIC_URL_BASE' ? 'https://pub-test.r2.dev/' : CONFIG[key],
      );
      s3Mock.on(PutObjectCommand).resolves({});

      const url = await service.uploadFile(Buffer.from('x'), 'company-logos/company-1/abc.png', 'image/png');

      expect(url).toBe('https://pub-test.r2.dev/company-logos/company-1/abc.png');
    });

    it('throws a clear error when a required credential is missing, without ever calling the SDK', async () => {
      mockConfigService.get.mockImplementation((key: string) => (key === 'R2_ACCOUNT_ID' ? undefined : CONFIG[key]));

      await expect(service.uploadFile(Buffer.from('x'), 'k', 'image/png')).rejects.toThrow(InternalServerErrorException);
      expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
    });
  });

  describe('deleteFile', () => {
    it('sends a DeleteObjectCommand for the given bucket/key', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});

      await service.deleteFile('company-logos/company-1/abc.png');

      const calls = s3Mock.commandCalls(DeleteObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toEqual({
        Bucket: 'test-bucket',
        Key: 'company-logos/company-1/abc.png',
      });
    });

    it('is idempotent — a NotFound error is swallowed, not thrown', async () => {
      s3Mock.on(DeleteObjectCommand).rejects(new NotFound({ message: 'not found', $metadata: {} }));

      await expect(service.deleteFile('missing-key')).resolves.toBeUndefined();
    });

    it('re-throws any other storage error', async () => {
      s3Mock.on(DeleteObjectCommand).rejects(new Error('network down'));

      await expect(service.deleteFile('some-key')).rejects.toThrow('network down');
    });
  });
});
