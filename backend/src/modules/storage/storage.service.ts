import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredObject {
  objectKey: string;
  checksum: string; // sha256 hex
  size: number;
  contentType: string;
}

// Bọc object storage nội bộ (MinIO). Tệp lưu ngoài CSDL; CSDL chỉ giữ metadata + key.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('storage.bucket')!;
    this.client = new S3Client({
      endpoint: this.config.get<string>('storage.endpoint'),
      region: this.config.get<string>('storage.region'),
      forcePathStyle: true, // bắt buộc cho MinIO.
      credentials: {
        accessKeyId: this.config.get<string>('storage.accessKey')!,
        secretAccessKey: this.config.get<string>('storage.secretKey')!,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Đã tạo bucket "${this.bucket}"`);
      } catch (err) {
        this.logger.warn(
          `Không đảm bảo được bucket "${this.bucket}": ${(err as Error).message}`,
        );
      }
    }
  }

  // Tải trực tiếp qua backend (tránh cấu hình CORS MinIO). Tính checksum sha256.
  async putObject(
    buffer: Buffer,
    contentType: string,
    prefix = 'uploads',
  ): Promise<StoredObject> {
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const objectKey = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
        Metadata: { checksum },
      }),
    );
    return { objectKey, checksum, size: buffer.length, contentType };
  }

  // URL tải có thời hạn (mặc định 5 phút) — không lộ tệp ngoài quyền.
  async presignedGetUrl(objectKey: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn },
    );
  }
}
