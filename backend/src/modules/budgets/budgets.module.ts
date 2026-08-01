import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetPlan } from './entities/budget-plan.entity';
import { BudgetLine } from './entities/budget-line.entity';
import { BudgetExpense } from './entities/budget-expense.entity';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';

// M14 — Kế hoạch & ngân sách doanh trại.
@Module({
  imports: [TypeOrmModule.forFeature([BudgetPlan, BudgetLine, BudgetExpense])],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
