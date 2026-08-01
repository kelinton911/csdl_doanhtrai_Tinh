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
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationService } from './integration.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// M14 — Integration & Sync. UC-21/22.
@ApiTags('Integration & Sync (M14)')
@ApiBearerAuth()
@Controller()
export class IntegrationController {
  constructor(private readonly service: IntegrationService) {}

  @Post('imports')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.INTEGRATION_CLIENT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'UC-21: Tải tệp CSV vào staging (target=materials)' })
  createImport(
    @Query('target') target: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createImport(target ?? 'materials', file, user);
  }

  @Get('imports/:id/validation')
  @ApiOperation({ summary: 'UC-21: Báo cáo lỗi theo dòng/cột' })
  validation(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getValidation(id);
  }

  @Post('imports/:id/commit')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.INTEGRATION_CLIENT)
  @ApiOperation({ summary: 'UC-21: Commit các dòng hợp lệ (transaction)' })
  commit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.commitImport(id, user);
  }

  @Post('sync/batches')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.INTEGRATION_CLIENT, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-22/M26: Nhận lô đồng bộ offline (barracks|facility; idempotent, phát hiện xung đột)' })
  sync(
    @Body() body: { batchKey: string; clientId?: string; items: Array<{ localId: string; entityType: string; targetId: string; baseVersion: number; payload: Record<string, unknown> }> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.syncBatch(body, user);
  }

  @Get('sync/batches/:id')
  @ApiOperation({ summary: 'UC-22: Trạng thái lô đồng bộ' })
  getSync(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSyncBatch(id);
  }
}
