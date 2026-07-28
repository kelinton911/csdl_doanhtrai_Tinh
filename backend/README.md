# Backend — CSDL Vật chất Doanh trại cấp tỉnh

NestJS (Modular Monolith) · TypeORM · PostgreSQL/PostGIS · REST `/api/v1` · JWT/RBAC.

## Chạy

```bash
npm install
npm run migration:run     # áp dụng migration (cần CSDL đang chạy — docker compose up -d db)
npm run seed              # dữ liệu demo (chỉ DEV)
npm run start:dev         # watch mode
npm run build             # biên dịch ra dist/
```

Yêu cầu: CSDL PostGIS đang chạy (xem `docker-compose.yml` ở gốc). Biến môi trường đọc
từ `../.env` (gốc monorepo) hoặc `backend/.env`.

## Cấu trúc mã nguồn

```
src/
  main.ts                         Bootstrap: /api/v1, Swagger, ValidationPipe, CORS, auto free-port
  app.module.ts                   Ghép module + APP_GUARD (JWT, RBAC) + APP_FILTER (problem+json)
  config/configuration.ts         Cấu hình từ biến môi trường
  common/
    decorators/                   @Public, @Roles, @CurrentUser
    filters/                      ProblemExceptionFilter (application/problem+json)
    middleware/                   CorrelationIdMiddleware (X-Correlation-ID)
  database/
    data-source.ts                DataSource dùng chung (app + CLI migration)
    database.module.ts            TypeOrmModule.forRoot
    migrations/                   Migration có version (forward/rollback)
    seeds/seed.ts                 Seed dữ liệu giả lập
  modules/
    identity/                     M01 — Identity & Access (auth, user, roles) — ĐÃ DỰNG
    health/                       Health check (ping CSDL)
```

## Chuẩn kỹ thuật đã áp dụng (theo hồ sơ)

- **API-first:** OpenAPI/Swagger tại `/api/v1/docs` là hợp đồng chính thức.
- **Security by design:** JWT Bearer ở server, RBAC theo vai trò, `ValidationPipe`
  whitelist chống mass assignment, CORS giới hạn theo cấu hình.
- **Mã lỗi ổn định:** `application/problem+json` với `code` (AUTH-001, AUTH-003,
  DATA-001, DATA-003, VAL-001, SYS-001…) và `correlationId`.
- **No silent overwrite:** `synchronize:false`, mọi thay đổi schema qua migration;
  entity có `row_version` (optimistic concurrency).
- **Observable:** X-Correlation-ID xuyên suốt, health check.

## Lộ trình module (M02–M15)

Xem [`../docs/ROADMAP.md`](../docs/ROADMAP.md). Mỗi module mới đặt dưới `src/modules/<tên>/`
theo đúng khuôn: `entities/`, DTO, service, controller, module; ánh xạ use case UC-xx
và mã truy vết FR-xx trong hồ sơ.

## Kiểm thử

```bash
npm test        # jest (hiện --passWithNoTests; bổ sung unit/integration theo module)
```
