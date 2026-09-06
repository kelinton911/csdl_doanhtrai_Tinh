# Kế hoạch triển khai: Quản lý Tài khoản – Đơn vị – Chức vụ – Phân quyền RBAC (Position–Function)

> Trạng thái: ĐỀ XUẤT (chưa code) · Ngày: 2026-08-12
> Tham chiếu thiết kế: dự án `hvhc_bigdata_management` (Next.js + Prisma) — chỉ **port thiết kế**, không copy mã.

## 1. Bối cảnh & mục tiêu

Dự án CSDL Doanh trại cấp tỉnh cần hoàn thiện phân hệ Quản trị (M01/M02) cho ngang tầm `hvhc_bigdata_management`:
quản lý **tài khoản**, **đơn vị**, **chức vụ**, và **phân quyền RBAC** ở mức hạt mịn.

**Khác biệt then chốt về công nghệ (buộc phải viết lại, không copy file):**

| | Dự án này (P08 Doanh trại) | hvhc (nguồn tham chiếu) |
|---|---|---|
| Backend | **NestJS + TypeORM + Postgres** | Next.js API routes + Prisma |
| Auth | `@nestjs/jwt` + bcryptjs (tự viết) | NextAuth + Prisma adapter |
| Frontend | **Vite + React Router + React Query** | Next.js App Router + Radix/shadcn |
| Migration | TypeORM migration (đánh số timestamp) | Prisma migrate |

➡️ Cái "sao chép" được là **mô hình dữ liệu + thuật toán authorize + bố cục màn hình quản trị**, viết lại bằng TypeORM entity / NestJS guard-service / React page.

**Quyết định đã chốt với chủ dự án:** làm **RBAC đầy đủ theo Chức vụ–Chức năng (Position–Function), fail-closed**, giống hvhc (không dừng ở role thô).

## 2. Hiện trạng (đã có) vs Khoảng cách (cần bổ sung)

### Đã có trong dự án
- **Tài khoản** — [user.entity.ts](../backend/src/modules/identity/entities/user.entity.ts): username, passwordHash, `roles: string[]`, organizationId, `dataScopes` jsonb, khóa/mở khóa, mfaSecret, rowVersion. CRUD + gán vai trò + gán scope + reset password ở [users.controller.ts](../backend/src/modules/identity/users.controller.ts) / [users.service.ts](../backend/src/modules/identity/users.service.ts).
- **Đơn vị** — [organization.entity.ts](../backend/src/modules/identity/entities/organization.entity.ts): code, name, type (PROVINCE/COMMUNE/UNIT), parentId, status. CRUD ở [organization module](../backend/src/modules/organization/).
- **Auth/JWT** — [auth.service.ts](../backend/src/modules/identity/auth.service.ts): login, khóa 5 lần sai, TOTP/MFA, refresh. JWT payload: `{ sub, username, roles, organizationId, dataScopes }`.
- **Guard toàn cục** — [app.module.ts](../backend/src/app.module.ts) đăng ký `JwtAuthGuard` → `RolesGuard` (APP_GUARD). `@Roles()` + [roles.guard.ts](../backend/src/modules/identity/guards/roles.guard.ts) (SYS_ADMIN bypass).
- **UI quản trị** — [AdminPage.tsx](../webapp/src/pages/AdminPage.tsx): đã có tab **Đơn vị & địa bàn** và **Người dùng & phân quyền** (React Query + DataTable + Modal). FE gating role ở [lib/roles.ts](../webapp/src/lib/roles.ts), [lib/auth.tsx](../webapp/src/lib/auth.tsx), [lib/scope.ts](../webapp/src/lib/scope.ts).

### Còn thiếu (khoảng cách so với hvhc)
1. **Chức vụ (Position)** — chưa có entity/CRUD nào.
2. **Chức năng hạt mịn (Function)** — hiện chỉ có role string thô, chưa có quyền theo `module.action`.
3. **Ma trận Chức vụ ↔ Chức năng (PositionFunction)** kèm **scope** (SELF/UNIT/PROVINCE/ALL).
4. **Gán User ↔ Chức vụ ↔ Đơn vị (UserPosition)** — bổ nhiệm, isPrimary, ngày/QĐ.
5. **Cấp quyền lẻ có hạn (UserPermissionGrant)** + thu hồi.
6. **Xung đột tách biệt trách nhiệm (PermissionConflict / SoD)**.
7. **Engine `authorize(user, functionCode, ctx)` fail-closed** + guard `@RequirePermission`.
8. **Bộ màn hình quản trị**: Chức vụ, Chức năng, Ma trận phân quyền, Bổ nhiệm, Cấp quyền lẻ, SoD.

## 3. Mô hình dữ liệu mới (TypeORM entities)

Đặt trong **module mới `modules/rbac/`** (giữ `identity` cho tài khoản/auth). Entity tự nạp qua glob `**/*.entity.{ts,js}` trong [data-source.ts](../backend/src/database/data-source.ts) — chỉ cần thêm file entity + 1 migration.

Bảng mới (đặt tên snake_case, khớp phong cách hiện có):

| Entity | Bảng | Trường chính | Ghi chú |
|---|---|---|---|
| `Position` | `positions` | code (unique), name, description, `positionScope` (UNIT/PROVINCE/SYSTEM), level int, isActive | Chức vụ. Port từ hvhc `Position`. |
| `AppFunction` | `functions` | code (unique), name, module, `actionType` (VIEW/CREATE/UPDATE/DELETE/APPROVE/EXPORT), isCritical bool, isActive | Chức năng hạt mịn. `code` dạng `BARRACKS_UPDATE`. Tên class tránh trùng từ khóa. |
| `PositionFunction` | `position_functions` | positionId, functionId, `scope` (SELF/UNIT/PROVINCE/ALL), conditions jsonb, isActive; unique(positionId,functionId) | Ma trận phân quyền. |
| `UserPosition` | `user_positions` | userId, positionId, organizationId (đơn vị bổ nhiệm), startDate, endDate, isPrimary, appointmentDoc, isActive | Bổ nhiệm user vào chức vụ. Dùng `organizationId` (không phải unitId) cho khớp entity Organization sẵn có. |
| `UserPermissionGrant` | `user_permission_grants` | userId, functionCode, `scope`, organizationId?, expiresAt?, reason, grantedById, isRevoked, revokedAt/By/Reason | Cấp quyền lẻ có hạn + thu hồi. |
| `PermissionConflict` | `permission_conflicts` | functionCodeA, functionCodeB, description, severity (BLOCK/WARN), isActive; unique(A,B) | SoD — chặn/ cảnh báo khi 1 chức vụ ôm 2 chức năng xung khắc. |

**Enum** (đặt trong `modules/rbac/rbac.enums.ts`, thống nhất với `Role` cũ ở [roles.ts](../backend/src/modules/identity/roles.ts)):
- `PositionScope = UNIT | PROVINCE | SYSTEM`
- `FunctionScope = SELF | UNIT | PROVINCE | ALL` (ánh xạ vào `dataScopes`/`organizationId` sẵn có của user)
- `ActionType = VIEW | CREATE | UPDATE | DELETE | APPROVE | EXPORT | IMPORT`
- `ConflictSeverity = BLOCK | WARN`

**Liên kết:** không cần sửa `User.entity`/`Organization.entity` (dùng khóa mềm `userId`/`organizationId` như phần lớn entity domain hiện tại để tránh migration nặng). Đọc quan hệ bằng query trong service.

**Quan hệ đến hồ sơ nhân sự:** hvhc gắn chức vụ vào cả `Personnel`; ở đây phạm vi là "tài khoản" (User) nên chỉ gắn `UserPosition`. Nếu sau này có bảng nhân sự riêng thì mở rộng thêm.

## 4. Backend — Engine phân quyền & wiring

### 4.1 Engine `authorize` (port từ [hvhc lib/rbac/authorize.ts])
`modules/rbac/authorization.service.ts` với hàm:
```
authorize(user, functionCode, ctx?) → { allowed, scope?, deniedReason? }
```
Nguyên tắc **fail-closed** (giống hvhc):
1. Chưa đăng nhập → DENY.
2. Nạp quyền hiệu lực của user = hợp của: (a) các `PositionFunction` qua `UserPosition` đang hiệu lực (isActive, trong khoảng ngày), + (b) `UserPermissionGrant` còn hạn & chưa thu hồi. Trừ đi những gì bị SoD chặn.
3. Không có `functionCode` → DENY.
4. Kiểm tra **scope** so với `ctx` (resourceOwnerId, organizationId) dựa trên `dataScopes`/`organizationId` của user: SELF/UNIT/PROVINCE/ALL.
5. Lỗi hệ thống → DENY (không allow mặc định).
- **Cache**: nạp quyền theo `userId` với cache in-memory TTL ngắn (30–60s) để tránh query mỗi request; invalidation khi đổi bổ nhiệm/grant. (hvhc cũng tính động theo request.)
- Tùy chọn `authorizeWithAudit` ghi [AuditModule](../backend/src/modules/audit/) sẵn có.

### 4.2 Guard + decorator mới (song song, không phá `@Roles`)
- `@RequirePermission('BARRACKS_UPDATE', { scopeParam?: 'organizationId' })` — decorator + metadata key `PERMISSION_KEY`, theo mẫu [roles.decorator.ts](../backend/src/common/decorators/roles.decorator.ts).
- `PermissionGuard` (mẫu [roles.guard.ts](../backend/src/modules/identity/guards/roles.guard.ts)) gọi `authorize()`; ném `ForbiddenException('AUTH-003…')` khi DENY.
- Đăng ký **APP_GUARD thứ 3** trong [app.module.ts](../backend/src/app.module.ts) sau `RolesGuard`. Endpoint chưa gắn `@RequirePermission` → guard bỏ qua (tương thích ngược); chuyển dần từng module.
- Cập nhật `CurrentUser` interface ở [current-user.decorator.ts](../backend/src/common/decorators/current-user.decorator.ts) nếu cần mang thêm `positions`.

### 4.3 Endpoint `GET /me/permissions` (port `hvhc /api/me/permissions`)
Trả danh sách functionCode + scope hiệu lực cho FE gating. Thêm vào [auth.controller.ts](../backend/src/modules/identity/auth.controller.ts) hoặc controller rbac.

### 4.4 CRUD API (module `rbac`, đặt `@Roles(Role.SYS_ADMIN)` + dần `@RequirePermission`)
- `positions` — GET/POST/PUT/DELETE(soft) chức vụ.
- `functions` — GET (danh mục, chủ yếu seed) + POST/PUT quản trị.
- `positions/:id/functions` — xem/gán ma trận PositionFunction (kèm scope). Kiểm tra SoD khi gán.
- `user-positions` — bổ nhiệm/miễn nhiệm (list theo user/đơn vị, POST, PUT kết thúc).
- `permission-grants` — cấp/thu hồi quyền lẻ.
- `permission-conflicts` — CRUD danh mục SoD.
Tái dùng `PaginationQuery`/`paginated` ở [common/dto/pagination.dto.ts](../backend/src/common/dto/), pattern ConflictException/NotFoundException như [organization.service.ts](../backend/src/modules/organization/organization.service.ts).

### 4.5 Migration & module
- Thêm 1 migration `database/migrations/17530000NNNNN-RbacPositionFunction.ts` (số kế tiếp sau bản mới nhất; theo mẫu [1753000000000-InitIdentity.ts](../backend/src/database/migrations/1753000000000-InitIdentity.ts)): tạo 6 bảng + index + FK mềm.
- `modules/rbac/rbac.module.ts` (TypeOrmModule.forFeature các entity, export AuthorizationService) và import vào [app.module.ts](../backend/src/app.module.ts).

## 5. Seed dữ liệu khởi tạo
Thêm `database/seeds/seed-rbac.ts` + script `seed:rbac` trong [backend/package.json](../backend/package.json) (theo mẫu các `seed:*` hiện có):
1. **Functions**: sinh theo từng module domain × action (BARRACKS_VIEW/CREATE/UPDATE…, LANDPARCEL_*, INVENTORY_*, REPORT_EXPORT…). Lấy danh sách module từ [app.module.ts](../backend/src/app.module.ts).
2. **Positions** khởi tạo ánh xạ từ 8 role cũ ([roles.ts](../backend/src/modules/identity/roles.ts)): SYS_ADMIN→"Quản trị hệ thống", PROVINCIAL_COMMAND→"Chỉ huy tỉnh", BARRACKS_OFFICER→"Trợ lý doanh trại", COMMUNE_USER→"Cán bộ xã/phường", REVIEWER, REPORT_VIEWER, AUDITOR, INTEGRATION_CLIENT.
3. **PositionFunction**: gán chức năng phù hợp cho từng chức vụ (SYS_ADMIN = tất cả, scope ALL).
4. **Backfill**: với mỗi user hiện có, tạo `UserPosition` tương ứng theo `user.roles[]` (giữ dữ liệu cũ chạy được ngay). Đây là điểm mấu chốt để không gãy hệ thống đang chạy.

## 6. Frontend — mở rộng màn hình quản trị (Vite/React)
Tái dùng hạ tầng sẵn có: `DataTable`, `Pagination`, `Modal`, `StatusBadge`, React Query, [lib/api.ts](../webapp/src/lib/api.ts).

- **Mở rộng [AdminPage.tsx](../webapp/src/pages/AdminPage.tsx)** thêm tab: **Chức vụ**, **Ma trận phân quyền**, **Cấp quyền lẻ** (hoặc tách trang riêng `AdminRbacPage.tsx` nếu tab quá dài — khuyến nghị tách để dễ bảo trì, route mới trong [App.tsx](../webapp/src/App.tsx)).
- **Tab Chức vụ**: CRUD Position; mở modal "Phân quyền" hiển thị ma trận Function × scope (checkbox theo module), cảnh báo SoD.
- **Tab Người dùng** (nâng cấp `UsersTab` hiện có): thêm khu **Bổ nhiệm chức vụ** (UserPosition) và **Cấp quyền lẻ**.
- **Gating FE theo permission**: bổ sung `lib/permissions.ts` gọi `GET /me/permissions`, hook `useCan(functionCode)`; menu [lib/nav.ts](../webapp/src/lib/nav.ts) và nút thao tác ẩn/hiện theo quyền thay vì chỉ role. (Server vẫn là nơi thực thi thật — FE chỉ ẩn UI.)

## 7. Thứ tự thực hiện (đề xuất theo lát cắt dọc, mỗi bước chạy được)
1. **Data layer**: entities + enums + migration + `rbac.module` + seed functions/positions/position-functions + backfill UserPosition. → `npm run migration:run && npm run seed:rbac`.
2. **Engine + guard**: `AuthorizationService` + `PermissionGuard` + `@RequirePermission` + `/me/permissions`. Gắn thử guard cho 1 module (vd Barracks) để kiểm chứng, chưa đụng phần còn lại.
3. **CRUD API rbac**: positions, functions, position-functions, user-positions, grants, conflicts.
4. **UI quản trị**: Chức vụ + ma trận phân quyền + bổ nhiệm + cấp quyền lẻ.
5. **FE gating** theo `/me/permissions` + rollout `@RequirePermission` sang các module còn lại (từng đợt).

## 8. Kiểm thử / nghiệm thu (end-to-end)
- **Unit** (Jest, có sẵn cấu hình): test `AuthorizationService.authorize` các nhánh — không đăng nhập, thiếu function, sai scope, grant hết hạn, SoD BLOCK. Mẫu tham chiếu [roles.guard.spec.ts](../backend/src/modules/identity/guards/roles.guard.spec.ts).
- **Migration/seed**: `npm run migration:run` rồi `npm run seed:rbac`; kiểm tra user cũ vẫn đăng nhập & thao tác được (nhờ backfill).
- **API thủ công (Swagger)**: đã bật ở [main.ts](../backend/src/main.ts) — tạo chức vụ, gán chức năng (thử case SoD bị chặn), bổ nhiệm user, gọi endpoint có `@RequirePermission` với 2 tài khoản khác quyền → 200 vs 403 (AUTH-003).
- **E2E FE** (Playwright, có sẵn trong [webapp](../webapp/)): kịch bản admin tạo chức vụ → bổ nhiệm → user thứ hai thấy/không thấy nút theo quyền.

## 9. Rủi ro & lưu ý
- **Không copy mã hvhc trực tiếp** (khác stack) — chỉ dùng làm bản thiết kế.
- **Tương thích ngược**: giữ `roles[]` + `RolesGuard`; RBAC mới chạy song song, chuyển dần. Backfill `UserPosition` là bắt buộc trước khi bật guard permission rộng rãi, tránh khóa nhầm người dùng.
- **Fail-closed** có thể chặn oan nếu seed thiếu function/gán thiếu → làm rollout theo module, có tài khoản SYS_ADMIN scope ALL để cứu hộ.
- **Hiệu năng**: bắt buộc cache quyền theo user; đánh index như bảng mô tả.
- **Scope mapping**: FunctionScope phải ánh xạ nhất quán với `dataScopes`/`organizationId` sẵn có ([lib/scope.ts](../webapp/src/lib/scope.ts) & filter phía server) để tránh hai hệ scope lệch nhau.
