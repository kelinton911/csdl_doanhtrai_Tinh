import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './document.entity';
import { StorageService } from '../storage/storage.service';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// M08 — Documents. UC-12: lưu chứng cứ số an toàn, có truy nguyên.
@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly repo: Repository<Document>,
    private readonly storage: StorageService,
  ) {}

  async upload(
    file: UploadedFile | undefined,
    meta: { entityType?: string; entityId?: string; classification?: string },
    user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('VAL-001: Thiếu tệp tải lên');
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('VAL-001: Tệp vượt quá 25MB');
    }
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException(`VAL-001: Loại tệp không hỗ trợ (${file.mimetype})`);
    }
    const stored = await this.storage.putObject(file.buffer, file.mimetype, 'documents');
    return this.repo.save(
      this.repo.create({
        name: file.originalname,
        contentType: stored.contentType,
        size: String(stored.size),
        checksum: stored.checksum,
        objectKey: stored.objectKey,
        classification: meta.classification ?? null,
        entityType: meta.entityType ?? null,
        entityId: meta.entityId ?? null,
        uploadedBy: user.sub,
      }),
    );
  }

  async list(q: PaginationQuery, entityType?: string, entityId?: string) {
    const where: Record<string, string> = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async downloadUrl(id: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('DATA-001: Không tìm thấy tài liệu');
    const url = await this.storage.presignedGetUrl(doc.objectKey);
    return { url, name: doc.name, contentType: doc.contentType };
  }
}
