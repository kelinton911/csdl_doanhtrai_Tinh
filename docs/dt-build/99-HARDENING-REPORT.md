# Hardening — Báo cáo tích hợp & nghiệm thu tổng thể DT-2026 (Core)

> Điều kiện mở: DT-01…DT-12 PASS DoD. Vai trò: kỹ sư tích hợp/vận hành.
> Phạm vi pass này = **Core hardening** (khép các mục kiểm chứng được trong repo).
> Mục hoãn (load-at-scale, backup mã hóa, di trú M01…M15) ghi ở §7.
> Bằng chứng test: `cd backend && npm test` → **287 unit PASS / 28 suite** (gồm contract test).

## 1. Kiểm chứng bất biến toàn hệ (SYS-BR-01…08)

| Mã | Bất biến | Cưỡng chế (vị trí) | Bằng chứng test |
| --- | --- | --- | --- |
| SYS-BR-01 | Mã R00 ≠ mã lô ≠ asset_code | UNIQUE catalog/lot/asset (DT-01/04) | catalog-rules.spec, materiel-rules.spec |
| SYS-BR-02 | Không sửa số dư trực tiếp — qua giao dịch/điều chỉnh | `signedQuantity`, `assertMovementEditable` (POSTED→LOCKED_IMMUTABLE); điều chỉnh DT-10→DT-05 CONVERSION | **sys-br.spec** BR-02, materiel-rules.spec |
| SYS-BR-03 | Snapshot/phát hành bất biến → revision/reversal | `assertSnapshotUnlocked`, `assertScenarioEditable`, report ISSUED immutable | **sys-br.spec** BR-03, report/materiel/calc int-spec |
| SYS-BR-04 | NO_RULE/CONFLICT không tự quy 0 | `determineLineStatus`, `computeMaterialNeed` (NC giữ dấu âm) | **sys-br.spec** BR-04, calc-rules.spec |
| SYS-BR-05 | Không tính trùng nguồn: Σ ≤ khả dụng | `assertExclusiveWithinAllocatable` (→OVER_ALLOCATED), reservation DT-09 | **sys-br.spec** BR-05, alloc/balance int-spec |
| SYS-BR-06 | Dashboard/báo cáo có lineage, không tạo số riêng | report_lineage, metric_instance.lineage_json | report/dt12 int-spec, **golden-chain.int-spec** (lineage không mồ côi) |
| SYS-BR-07 | Effective_time + version/snapshot | `hcAtTime` as-of (loại movement sau t / chưa POSTED) | **sys-br.spec** BR-07 |
| SYS-BR-08 | Quyền = chức năng ∧ phạm vi (data-scope) | `DataScopeGuard` + **service-level `applyOrgScope`/`applyJsonOrgScope`/`assertReadScope`** trên DT-04…12 | **scope-query.spec**, **scope-enforcement.int-spec** (403 NO_PERMISSION_SCOPE) |

**Khắc phục trọng yếu (SYS-BR-08 — rò rỉ list/search):** trước pass này, list/read của DT-05/08/09/10/11
(và phần lớn DT-04/06/12) **không** áp `req.scope` ⇒ trả dữ liệu mọi đơn vị. Đã thêm
`common/scope/scope-query.ts` (`orgScopeWhere`, `applyOrgScope`, `applyJsonOrgScope`, `assertReadScope`)
và áp vào service list/read theo bảng dưới; bổ sung `@Scoped('organization')` + `@CurrentUser` ở controller.

| Phân hệ | Chiều org | List lọc | Read-by-id 403 |
| --- | --- | --- | --- |
| DT-04 materiel | `organization_id` | movements | lot/asset/by-qr |
| DT-05 documents | `organization_id`/`from_org`/`to_org` | documents, periods, in-transit | document |
| DT-06 allocation | `organization_id` | (allocatable đã @Scoped) | allocation |
| DT-08 calc | `scope_json.org` | scenarios | scenario |
| DT-09 balance | `scope_json.organizationId` | balance-plans | plan |
| DT-10 count | `scope_json.organizationId` | campaigns | campaign |
| DT-11 report | `scope_json.organizationId` | report-instances, dataset-instances | report, dataset |
| DT-12 dashboard | `scope_json.organizationId` | metrics, alerts (+ semantic/map đã @Scoped) | decision-session |

> Dữ liệu **cấu hình dùng chung** (report/dataset/norm-set/calculation-parameter/authority-rank/catalog
> definitions — không mang org) vẫn cho mọi user đã xác thực. User `SYS_ADMIN`/province-wide xem toàn tỉnh
> (không hồi quy webapp demo); user giới hạn mới bị lọc — đúng SYS-BR-08.

## 2. Chuỗi vàng E2E & tái lập (§2)

- **Seed orchestrator** `npm run seed:golden-chain` — chạy tuần tự DT-01→DT-12 (nền→catalog→technical→
  norms→count→report→dashboard), idempotent, dựng dữ liệu demo xuyên phân hệ (TC-HD-001).
- **golden-chain.int-spec** (`npm run test:int`) — đối chiếu **cấu trúc** trên DB thật, đúng trên mọi
  DB đã seed: danh mục R00 hiện diện; truy vết chứng từ→movement không mồ côi (DT-05↔DT-04, TC-HD-002);
  lineage biểu→báo cáo không mồ côi (DT-11 drill-down); không tồn kho âm xuyên phân hệ.
- **Tái lập (TC-HD-003)**: `computeInputHash`/`computeOutputHash` tất định (cùng input⇒cùng hash, ổn
  định theo material) — **sys-br.spec**; đồng thời calc.int-spec (TC-DT08-016) chạy lại cùng input→output_hash trùng.
- Truy vết 2 chiều 1 ô biểu→dataset→snapshot đã có ở report.int-spec (TC-DT11-002).

## 3. Hiệu năng & mở rộng (§3)

- Truy vấn list đã tham số hóa + `take` giới hạn; lọc theo `organization_id`/`scope_json->>org` (dùng index org/time).
- Quan trắc latency qua histogram `http_request_duration_seconds` (§5) để theo dõi HC(t)/export.
- **Hoãn** test tải ≥ N triệu dòng (đo SLA HC(t)) — nền `scripts/load-test-500-users.js` (§7).

## 4. Bảo mật & tuân thủ (§4)

- **Data-scope 403** đồng nhất `NO_PERMISSION_SCOPE` (§1) — scope-enforcement.int-spec.
- **Rate-limit** `@nestjs/throttler` (APP_GUARD, mặc định 300 req/60s, cấu hình `THROTTLE_LIMIT/TTL_MS`),
  bỏ qua `/health`,`/metrics`. **Security headers** `helmet` (main.ts).
- Audit append-only interceptor (M15) phủ POST/PUT/PATCH/DELETE + correlation-id (đã có).
- Checksum sha256 snapshot/biểu phát hành bất biến (DT-04/09/10/11), `source_fingerprint` (DT-09/11).
- Chống injection: query tham số hóa (TypeORM QueryBuilder) + ValidationPipe whitelist (main.ts).

## 5. Quan trắc & vận hành (§5)

- **Health tổng hợp** `/api/v1/health` (+ `/health/live`, `/health/ready`): DB + PostGIS extension +
  object storage (MinIO HeadBucket) + **backlog outbox** (PENDING/FAILED). `degraded` khi có phụ thuộc
  down hoặc outbox FAILED > 0.
- **Prometheus** `/api/v1/metrics` (@Public, ẩn khỏi Swagger): default metrics + `http_request_duration_seconds`
  (histogram method/route/status) + `http_requests_total` + gauge `outbox_backlog{status}`.
- **Log có correlation-id** (`LoggingInterceptor`): method path status durationMs cid=<correlationId>.
- Outbox dispatcher: retry ≤ 5 → dead-letter FAILED (đã có); nay có gauge + health giám sát backlog.
- Backup/restore: `infra/backup.sh` (pg_dump + `mc mirror` + sha256 `CHECKSUMS.txt`), `infra/restore.sh`
  (verify checksum trước khi phục hồi, restore vào DB `_restore` an toàn), `scripts/disaster-recovery-drill.sh`
  (đo RPO/RTO), `scripts/check-ha-failover.sh`. Runbook: `docs/RUNBOOK-backup-restore.md`.
- Migration DT-xx reversible (`down()` thật). Pass này **không thêm schema** (thay đổi read-only + endpoint mới).

## 6. Chất lượng dữ liệu (§6)

- `GET /api/v1/data-quality/system` (`@Scoped('organization')`): tồn âm (FAIL), dataset lệch reconciliation
  (WARN), định mức LEGACY_UNVERIFIED (WARN), outbox FAILED (WARN); tổng hợp PASS/WARN/FAIL. Mỗi check
  best-effort (bảng thiếu→SKIPPED). Hàm thuần + unit test `data-quality.rules.spec`.

## 7. Mục HOÃN (ngoài Core — có runbook/nền sẵn)

- Test tải sổ cái ≥ N triệu dòng + đo HC(t) SLA (§3) — nền `scripts/load-test-500-users.js`.
- Backup **mã hóa** AES-256 + diễn tập failover thật (§5) — nền `infra/backup.sh`/`restore.sh` + DR drill.
- Di trú legacy **M01…M15** → mô hình DT-xx: mapping + dry-run + đối chiếu tổng + rollback (§6).
- Kích hoạt `PermissionGuard` (RBAC fine-grained) làm APP_GUARD — hiện `@Roles` phủ tầng chức năng.

## 8. Definition of Done (Core)

- [x] SYS-BR-01…08 có bằng chứng test (sys-br.spec + scope-enforcement.int-spec + các int-spec phân hệ).
- [x] Chuỗi vàng: seed orchestrator + golden-chain.int-spec (trace 2 chiều + đối chiếu); tái lập PASS.
- [x] Bảo mật: data-scope 403 đồng nhất; rate-limit + helmet; checksum/audit (đã có).
- [x] Quan trắc: health tổng hợp + Prometheus metrics + log correlation-id; backup-restore có checksum (runbook).
- [x] DQ toàn hệ xanh (endpoint + unit test).
- [x] `backend npm test` xanh (**287/28**); contract test OpenAPI xanh (baseline 425 path, additive).
- [x] Cập nhật `01-DOI-CHIEU-GAP.md` (Hardening PASS) + `ROADMAP.md`.
- [ ] (Hoãn §7) load-at-scale, backup mã hóa, di trú M01…M15.

## 9. Người dùng chạy để nghiệm thu stack (ngoài `npm test`)

```
cd backend && npm run migration:run          # xác nhận schema (không migration mới)
npm run seed:golden-chain                     # dựng chuỗi DT-01→DT-12
npm run test:int                              # sys-br/scope-enforcement/golden-chain + int-spec phân hệ (DB thật)
bash scripts/verify.sh                         # Docker: build + unit + E2E stack (TC-HD-008 additive)
# thủ công: GET /api/v1/health · /api/v1/metrics · /api/v1/data-quality/system
#           user org A đọc resource org B → 403 NO_PERMISSION_SCOPE (TC-HD-004)
```
