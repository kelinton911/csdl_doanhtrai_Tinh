import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { DocumentsService } from './documents.service';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class DocumentQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;
}

class UploadMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classification?: string;
}

// M08 — Documents & Media. Tải trực tiếp qua backend rồi lưu MinIO (tránh CORS MinIO).
@ApiTags('Documents & Media (M08)')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('files')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'UC-12: Tải tệp (ảnh/PDF/tài liệu) và liên kết thực thể' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadMetaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.upload(file, body, user);
  }

  @Get('documents')
  @ApiOperation({ summary: 'UC-12: Danh sách tài liệu theo thực thể' })
  list(@Query() q: DocumentQuery) {
    return this.service.list(q, q.entityType, q.entityId);
  }

  @Get('files/:id/download-url')
  @ApiOperation({ summary: 'UC-12: Lấy URL tải có thời hạn' })
  downloadUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.downloadUrl(id);
  }
}
