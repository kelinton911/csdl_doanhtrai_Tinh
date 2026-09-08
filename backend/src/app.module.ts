import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { StorageModule } from './modules/storage/storage.module';
import { IdentityModule } from './modules/identity/identity.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { AssetCatalogModule } from './modules/asset-catalog/asset-catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InspectionModule } from './modules/inspection/inspection.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { ScenarioModule } from './modules/scenario/scenario.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { BarracksModule } from './modules/barracks/barracks.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GisModule } from './modules/gis/gis.module';
import { LabelsModule } from './modules/labels/labels.module';
import { LandParcelsModule } from './modules/land-parcels/land-parcels.module';
import { UtilitiesModule } from './modules/utilities/utilities.module';
import { LocalResourcesModule } from './modules/local-resources/local-resources.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { OversightModule } from './modules/oversight/oversight.module';
import { LegalDocsModule } from './modules/legal-docs/legal-docs.module';
import { ReadinessModule } from './modules/readiness/readiness.module';
import { ReadinessMaterialsModule } from './modules/readiness-materials/readiness-materials.module';
import { LogisticsNormsModule } from './modules/logistics-norms/logistics-norms.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { C3CatalogModule } from './modules/c3-catalog/c3-catalog.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { Dt02LandModule } from './modules/dt02-land/dt02-land.module';
import { Dt03TechnicalModule } from './modules/dt03-technical/dt03-technical.module';
import { Dt04MaterielModule } from './modules/dt04-materiel/dt04-materiel.module';
import { Dt05DocumentsModule } from './modules/dt05-documents/dt05-documents.module';
import { Dt06AllocationModule } from './modules/dt06-allocation/dt06-allocation.module';
import { Dt07NormsModule } from './modules/dt07-norms/dt07-norms.module';
import { Dt08CalculationModule } from './modules/dt08-calculation/dt08-calculation.module';
import { Dt09BalanceModule } from './modules/dt09-balance/dt09-balance.module';
import { JwtAuthGuard } from './modules/identity/guards/jwt-auth.guard';
import { RolesGuard } from './modules/identity/guards/roles.guard';
import { DataScopeGuard } from './common/scope/data-scope.guard';
import { OptimisticLockInterceptor } from './common/concurrency/optimistic-lock.interceptor';
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
    OutboxModule, // Sprint 0 — Outbox pattern (domain event trong transaction)
    C3CatalogModule, // Sprint 0 — C3 catalog & ma trận truy vết
    StorageModule, // Object storage MinIO (nền cho M08)
    IdentityModule, // M01 — Identity & Access
    OrganizationModule, // M02 — Organization & Area
    MasterDataModule, // M03 — Master Data (danh mục + vật chất)
    CatalogModule, // DT-01 — Danh mục chuẩn R00 versioned (Quyển I)
    Dt02LandModule, // DT-02 — Hồ sơ Doanh trại: đất (địa chỉ lịch sử/phân bổ/biến động)
    Dt03TechnicalModule, // DT-03 — Hồ sơ kỹ thuật vật chất (model/revision/bản vẽ/BOM)
    Dt04MaterielModule, // DT-04 — Thực lực vật chất (sổ cái + HC theo thời điểm + snapshot)
    Dt05DocumentsModule, // DT-05 — Chứng từ nhập/xuất/điều chuyển (posting nguyên tử → DT-04)
    Dt06AllocationModule, // DT-06 — Dự trữ & phân bổ (lớp phủ HC; PC_SSCĐ cho DT-08)
    Dt07NormsModule, // DT-07 — Định mức có căn cứ + selector deterministic (/norms/resolve) + chỉ lệnh
    Dt08CalculationModule, // DT-08 — Engine tính nhu cầu NC=TT+PC_SSCĐ−HC + trace + supply_required (→ DT-09)
    Dt09BalanceModule, // DT-09 — Nguồn địa bàn & cân đối bảo đảm (chống overbooking) + execution → DT-05
    AssetCatalogModule, // Danh mục tài sản ngành Doanh trại (Phụ lục CV 2837/DT-QLDT)
    InventoryModule, // M06 — Inventory (tồn kho UC-08)
    InspectionModule, // M07 — Inspection & Review (UC-09/10/11)
    DocumentsModule, // M08 — Documents & Media (UC-12, MinIO)
    MaintenanceModule, // M09 — Maintenance & Recovery (UC-13/14)
    ScenarioModule, // M10 — Scenario & Planning (UC-15/16)
    AlertsModule, // M13 — Alert & Notification (UC-18)
    ReportingModule, // M12 — Reporting & Search + Export (UC-19/20)
    IntegrationModule, // M14 — Integration & Sync (UC-21/22)
    BarracksModule, // M04 — Barracks (workflow UC-05/06)
    ApprovalsModule, // Hàng chờ duyệt gộp (doanh trại + kho trạm)
    FacilitiesModule, // M05 — Facilities (công trình thuộc doanh trại, UC-07)
    GisModule, // M11 — GIS (UC-17)
    LabelsModule, // M10 (khảo sát) — Tem QR & tra cứu khi quét
    LandParcelsModule, // M04 (khảo sát) — Hồ sơ khu đất quốc phòng
    UtilitiesModule, // M11 (khảo sát) — Điện/Nước/Năng lượng
    LocalResourcesModule, // M16 (khảo sát) — Nguồn lực huy động tại địa phương
    ProjectsModule, // M13 (khảo sát) — Xây dựng cơ bản & dự án đầu tư
    BudgetsModule, // M14 (khảo sát) — Kế hoạch & ngân sách doanh trại
    TasksModule, // M21 (khảo sát) — Kế hoạch công tác & giao nhiệm vụ
    OversightModule, // M22 (khảo sát) — Kiểm tra, thanh tra & xử lý kiến nghị
    LegalDocsModule, // M20 (khảo sát) — Văn bản, tiêu chuẩn, định mức
    ReadinessModule, // M18/M19 (khảo sát) — Sẵn sàng chiến đấu, bảo đảm tác chiến & khắc phục
    ReadinessMaterialsModule, // Trục B — Khai báo vật chất SSCĐ theo 4 mức (copy-forward + duyệt)
    LogisticsNormsModule, // Khâu 4 — Định mức HC-KT + engine tính bảo đảm chiến đấu
    AnalyticsModule, // M28 (khảo sát) — Phân tích, dự báo & phát hiện bất thường
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
    // Row-level data-scope (SYS-BR-08): chạy SAU JwtAuthGuard để có req.user,
    // gắn req.scope + cưỡng chế @Scoped(...).
    { provide: APP_GUARD, useClass: DataScopeGuard },
    // Dịch OptimisticLockVersionMismatchError → 409 STALE_WRITE nhất quán.
    { provide: APP_INTERCEPTOR, useClass: OptimisticLockInterceptor },
    { provide: APP_FILTER, useClass: ProblemExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
