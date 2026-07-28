import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { StorageModule } from './modules/storage/storage.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InspectionModule } from './modules/inspection/inspection.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { BarracksModule } from './modules/barracks/barracks.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GisModule } from './modules/gis/gis.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './modules/identity/guards/jwt-auth.guard';
import { RolesGuard } from './modules/identity/guards/roles.guard';
import { ProblemExceptionFilter } from './common/filters/problem-exception.filter';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Nạp .env ở gốc monorepo rồi backend/.env.
      envFilePath: ['../.env', '.env'],
    }),
    DatabaseModule,
    // Nền tảng xuyên suốt (Pha A): audit append-only, idempotency, object storage.
    AuditModule, // M15 — Audit & Operations (UC-23)
    IdempotencyModule, // Idempotency-Key cho POST quan trọng
    StorageModule, // Object storage MinIO (nền cho M08)
    IdentityModule, // M01 — Identity & Access
    OrganizationModule, // M02 — Organization & Area
    MasterDataModule, // M03 — Master Data (danh mục + vật chất)
    InventoryModule, // M06 — Inventory (tồn kho UC-08)
    InspectionModule, // M07 — Inspection & Review (UC-09/10/11)
    DocumentsModule, // M08 — Documents & Media (UC-12, MinIO)
    MaintenanceModule, // M09 — Maintenance & Recovery (UC-13/14)
    BarracksModule, // M04 — Barracks (workflow UC-05/06)
    FacilitiesModule, // M05 — Facilities (công trình thuộc doanh trại, UC-07)
    GisModule, // M11 — GIS (UC-17)
    DashboardModule, // M12 — Dashboard tổng hợp
    HealthModule,
    // Roadmap còn lại: Inventory(M06), Inspection(M07), Documents(M08),
    // Maintenance(M09), Scenario(M10), Reporting/Export(M12), Alert(M13),
    // Integration(M14). Xem docs/ROADMAP.md.
  ],
  providers: [
    // Xác thực mặc định toàn hệ thống, endpoint công khai đánh dấu @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
