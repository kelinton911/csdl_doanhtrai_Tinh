import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectMilestone } from './entities/project-milestone.entity';
import { Facility } from '../facilities/entities/facility.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

// M13 — Xây dựng cơ bản & dự án đầu tư (vòng đời + milestones; bàn giao sinh tài sản).
@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectMilestone, Facility])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
