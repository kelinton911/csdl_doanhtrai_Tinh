import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { DocumentStatus } from '../../common/enums';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import {
  AddLineDto,
  CreateDocumentDto,
  CreatePeriodDto,
  CreateTransferDto,
  ReceiveTransferDto,
  UnlockPeriodDto,
} from './dt05.dto';

// DT-05 — Chứng từ nhập/xuất/điều chuyển (Quyển V §XVI). Sinh movement DT-04 khi POST.
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-05 Nhập–xuất–điều chuyển')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  // ---- Documents ----
  @Get('inventory-documents')
  list(@Query('status') status: string, @Query('organizationId') org: string) {
    return this.service.listDocuments(status || undefined, org || undefined);
  }

  @Post('inventory-documents')
  @Roles(...WRITERS)
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthUser) {
    return this.service.createDocument(dto, user);
  }

  @Get('inventory-documents/:id')
  get(@Param('id') id: string) {
    return this.service.getDocument(id);
  }

  @Post('inventory-documents/:id/lines')
  @Roles(...WRITERS)
  addLine(@Param('id') id: string, @Body() dto: AddLineDto, @CurrentUser() user: AuthUser) {
    return this.service.addLine(id, dto, user);
  }

  @Post('inventory-documents/:id/submit')
  @Roles(...WRITERS)
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionDocument(id, DocumentStatus.SUBMITTED, user);
  }

  @Post('inventory-documents/:id/review')
  @Roles(...APPROVERS)
  review(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionDocument(id, DocumentStatus.UNDER_REVIEW, user);
  }

  @Post('inventory-documents/:id/approve')
  @Roles(...APPROVERS)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionDocument(id, DocumentStatus.APPROVED, user);
  }

  @Post('inventory-documents/:id/post')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Ghi sổ nguyên tử (sinh movement DT-04; Idempotency-Key)' })
  post(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.postDocument(id, user);
  }

  @Post('inventory-documents/:id/reverse')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Đảo chứng từ POSTED (BR-DT05-002)' })
  reverse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.reverseDocument(id, user);
  }

  @Post('inventory-documents/:id/cancel')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Hủy chứng từ (chỉ khi chưa POST — BR-DT05-003)' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionDocument(id, DocumentStatus.CANCELLED, user);
  }

  @Get('inventory-documents/:id/trace')
  @ApiOperation({ summary: 'Truy vết chứng từ → dòng → movement → sổ cái (BR-DT05-030)' })
  trace(@Param('id') id: string) {
    return this.service.trace(id);
  }

  // ---- Transfer orders (2 đầu) ----
  @Get('transfer-orders/in-transit')
  inTransit() {
    return this.service.inTransit();
  }

  @Post('transfer-orders')
  @Roles(...WRITERS)
  createTransfer(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser) {
    return this.service.createTransfer(dto, user);
  }

  @Post('transfer-orders/:id/dispatch')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Xuất điều chuyển (→IN_TRANSIT, giảm HC bên nguồn)' })
  dispatch(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.dispatchTransfer(id, user);
  }

  @Post('transfer-orders/:id/receive')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Nhận điều chuyển (tăng HC bên nhận; ghi chênh lệch)' })
  receive(@Param('id') id: string, @Body() dto: ReceiveTransferDto, @CurrentUser() user: AuthUser) {
    return this.service.receiveTransfer(id, dto.receivedQty, user);
  }

  @Post('transfer-orders/:id/close')
  @Roles(...WRITERS)
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.closeTransfer(id, user);
  }

  // ---- Stock periods ----
  @Get('stock-periods')
  listPeriods(@Query('organizationId') org: string) {
    return this.service.listPeriods(org || undefined);
  }

  @Post('stock-periods')
  @Roles(...APPROVERS)
  createPeriod(@Body() dto: CreatePeriodDto, @CurrentUser() user: AuthUser) {
    return this.service.createPeriod(dto, user);
  }

  @Post('stock-periods/:id/lock')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Khóa kỳ (cấm backdate — BR-DT05-010)' })
  lockPeriod(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.lockPeriod(id, user);
  }

  @Post('stock-periods/:id/unlock')
  @Roles(...APPROVERS)
  unlockPeriod(@Param('id') id: string, @Body() dto: UnlockPeriodDto, @CurrentUser() user: AuthUser) {
    return this.service.unlockPeriod(id, dto.reason, user);
  }
}
