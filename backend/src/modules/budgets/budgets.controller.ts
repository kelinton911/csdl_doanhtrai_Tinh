import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BudgetsService } from './budgets.service';
import {
  CreateBudgetLineDto,
  CreateBudgetPlanDto,
  CreateExpenseDto,
  UpdateBudgetLineDto,
  UpdateBudgetPlanDto,
} from './dto/budget.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// Dữ liệu tài chính chỉ hiển thị/sửa cho người có thẩm quyền (khảo sát §8).
const FIN_READ = [Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.REPORT_VIEWER, Role.AUDITOR];
const FIN_WRITE = [Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.SYS_ADMIN];

class BudgetQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() fiscalYear?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fundingSource?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

// M14 — Kế hoạch & ngân sách doanh trại.
@ApiTags('Budgets (M14)')
@ApiBearerAuth()
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  @Roles(...FIN_READ)
  @ApiOperation({ summary: 'Danh sách dự toán (lọc niên độ/nguồn vốn/trạng thái) — theo quyền tài chính' })
  list(@Query() q: BudgetQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  @Get('summary')
  @Roles(...FIN_READ)
  @ApiOperation({ summary: 'Tổng hợp ngân sách theo niên độ (dự toán vs thực chi)' })
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user);
  }

  @Get(':id')
  @Roles(...FIN_READ)
  @ApiOperation({ summary: 'Xem dự toán + phân bổ hạn mức + đối chiếu thực chi' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/expenses')
  @Roles(...FIN_READ)
  @ApiOperation({ summary: 'Danh sách chứng từ/giải ngân của dự toán' })
  expenses(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listExpenses(id);
  }

  @Post()
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Tạo dự toán (DRAFT)' })
  create(@Body() dto: CreateBudgetPlanDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Cập nhật dự toán' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBudgetPlanDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/approve')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Chốt dự toán (DRAFT → APPROVED)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/close')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Quyết toán (APPROVED → CLOSED)' })
  close(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.close(id, user);
  }

  @Post(':id/lines')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Thêm khoản mục / phân bổ hạn mức' })
  addLine(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateBudgetLineDto, @CurrentUser() user: AuthUser) {
    return this.service.addLine(id, dto, user);
  }

  @Put(':id/lines/:lineId')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Cập nhật khoản mục' })
  updateLine(@Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string, @Body() dto: UpdateBudgetLineDto) {
    return this.service.updateLine(id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Xóa khoản mục' })
  removeLine(@Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string) {
    return this.service.removeLine(id, lineId);
  }

  @Post(':id/expenses')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Ghi chứng từ / giải ngân' })
  addExpense(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateExpenseDto, @CurrentUser() user: AuthUser) {
    return this.service.addExpense(id, dto, user);
  }

  @Delete(':id/expenses/:expenseId')
  @Roles(...FIN_WRITE)
  @ApiOperation({ summary: 'Xóa chứng từ' })
  removeExpense(@Param('id', ParseUUIDPipe) id: string, @Param('expenseId', ParseUUIDPipe) expenseId: string) {
    return this.service.removeExpense(id, expenseId);
  }
}
