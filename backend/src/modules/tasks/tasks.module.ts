import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskUpdate } from './entities/task-update.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

// M21 — Kế hoạch công tác & giao nhiệm vụ.
@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskUpdate])],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
