import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssetProposalService, CreateProposalInput } from './asset-proposal.service';
import { AssetCatalogQuery } from './dto/asset-catalog.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

// Đề xuất bổ sung danh mục tài sản ngành Doanh trại — đáp ứng CV 2837/DT-QLDT
// ngày 16/7/2026, hạn gửi Cục Doanh trại/TCHC-KT: 30/8/2026 (kèm file dữ liệu).
@ApiTags('Đề xuất bổ sung danh mục tài sản')
@ApiBearerAuth()
@Controller('asset-catalog/proposals')
export class AssetProposalController {
  constructor(private readonly service: AssetProposalService) {}

  // --- Lô gửi (đặt trước ':id' để không bị nuốt) ---
  @Get('batches')
  @ApiOperation({ summary: 'Danh sách lô đề xuất' })
  listBatches() {
    return this.service.listBatches();
  }

  @Post('batches')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Tạo lô đề xuất (một lô = một lần gửi văn bản)' })
  createBatch(
    @Body() body: { code: string; title: string; deadline?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createBatch(body, user);
  }

  @Post('batches/:id/export')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Gom đề xuất đã trình và xuất Excel đúng 4 cột của phụ lục' })
  exportBatch(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.exportBatch(id, user);
  }

  @Get('batches/:id/download')
  @ApiOperation({ summary: 'Lấy liên kết tải tệp Excel của lô' })
  download(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.downloadUrl(id);
  }

  @Get('batches/:id/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Tải CSV (UTF-8 BOM) của lô — công văn chỉ ghi "file dữ liệu"' })
  csv(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.exportCsv(id);
  }

  // --- Đề xuất ---
  @Get()
  @ApiOperation({ summary: 'Danh sách đề xuất bổ sung' })
  list(@Query() q: AssetCatalogQuery & { status?: string; batchId?: string }) {
    return this.service.list({ ...q, skip: q.skip });
  }

  @Post()
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Tạo đề xuất bổ sung (nháp)' })
  create(@Body() body: CreateProposalInput, @CurrentUser() user: AuthUser) {
    return this.service.create(body, user);
  }

  @Get(':id/preview-code')
  @ApiOperation({
    summary: 'Xem trước mã kế tiếp trong nhánh (KHÔNG lưu) — từ chối nếu nhánh đã hết mã',
  })
  previewCode(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.previewCode(id);
  }

  @Post(':id/allocate-code')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Chốt mã đề xuất sau khi người dùng xác nhận' })
  allocate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.assignCode(id, user);
  }

  @Post(':id/submit')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Trình đề xuất để đưa vào lô gửi' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Delete(':id')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Xoá đề xuất (chưa xuất lô)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
