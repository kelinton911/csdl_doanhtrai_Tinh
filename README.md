# Hệ thống CSDL Vật chất Doanh trại cấp tỉnh

> Cơ sở dữ liệu lớn về vật chất doanh trại cấp tỉnh trong chiến tranh bảo vệ Tổ quốc.
> Modular Monolith · PostgreSQL/PostGIS · REST `/api/v1` · triển khai ưu tiên **mạng nội bộ**.
>
> **Toàn bộ dữ liệu trong bản dựng này là GIẢ LẬP.** Không có tọa độ thật, không có
> số liệu đơn vị thật. Chỉ nạp dữ liệu thật sau khi hệ thống đã chuyển hẳn về hạ tầng nội bộ.

Kho mã liên thông GitHub: `git@github.com:kelinton911/csdl_doanhtrai_Tinh.git`

---

## 1. Cấu trúc kho mã (monorepo)

| Thư mục | Nội dung |
| --- | --- |
| `frontend/` | Giao diện **Claude Design** (no-build) + máy chủ tĩnh Node (`server.mjs`). 24 màn hình, 5 vai trò, sáng/tối, bản đồ Leaflet. |
| `backend/` | Backend **NestJS** (Modular Monolith): config, CSDL PostGIS, `/api/v1`, Swagger, RBAC, problem+json, migration, seed. |
| `docs/` | Hồ sơ thiết kế kỹ thuật, mô tả backend/frontend (PDF + DOCX) và `ROADMAP.md`. |
| `infra/` | Chỗ dành cho script hạ tầng bổ sung (dự phòng). |
| `docker-compose.yml` | Hạ tầng DEV: PostgreSQL/PostGIS, Redis, MinIO (object storage), Adminer. |
| `.env.example` | Mẫu biến môi trường. Sao chép thành `.env`. **Không commit `.env`.** |

## 2. Yêu cầu môi trường

- **Node.js** ≥ 20 (đã kiểm thử trên v24)
- **Docker Desktop** + Docker Compose (chạy PostgreSQL/PostGIS, Redis, MinIO)
- Không cần cài PostgreSQL trên máy — CSDL chạy trong container.

## 3. Khởi chạy nhanh (DEV)

```bash
# 0) Chuẩn bị biến môi trường
cp .env.example .env        # chỉnh cổng/bí mật nếu cần

# 1) Bật hạ tầng (CSDL PostGIS + Redis + MinIO + Adminer)
docker compose up -d

# 2) Backend
cd backend
npm install
npm run migration:run       # tạo schema (bật PostGIS, bảng users/organizations)
npm run seed                # tài khoản demo (chỉ DEV)
npm run start:dev           # http://localhost:3000/api/v1  (tự đổi cổng nếu bận)

# 3) Frontend (cửa sổ khác)
cd frontend
npm run dev                 # http://localhost:8000  (tự đổi cổng nếu bận)
```

> **Cổng tự động:** cả backend và frontend tự chọn cổng trống kế tiếp nếu cổng cấu
> hình đang bận — xem dòng log "đã tự chuyển sang cổng …".

### Cổng mặc định

| Dịch vụ | URL | Ghi chú |
| --- | --- | --- |
| Frontend | http://localhost:8000 | Giao diện Claude Design |
| Backend API | http://localhost:3000/api/v1 | REST, phiên bản hóa |
| Swagger (OpenAPI) | http://localhost:3000/api/v1/docs | Hợp đồng API |
| PostgreSQL/PostGIS | localhost:**5433** | (5432 dành cho dịch vụ khác trên máy) |
| Adminer | http://localhost:8081 | Quản trị CSDL cho DEV |
| MinIO Console | http://localhost:9001 | Object storage |
| Redis | localhost:6379 | Cache/hàng đợi/outbox |

### Tài khoản demo (chỉ DEV, dữ liệu giả lập)

Mật khẩu chung: `admin@123`

| Tài khoản | Vai trò |
| --- | --- |
| `admin` | SYS_ADMIN |
| `chihuy` | PROVINCIAL_COMMAND |
| `hckt` | BARRACKS_OFFICER |
| `xa01` | COMMUNE_USER |
| `kiemduyet` | REVIEWER |

Ví dụ đăng nhập:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin@123"}'
```

## 4. Kiến trúc (theo Hồ sơ thiết kế kỹ thuật)

- **ADR-01** Modular Monolith · **ADR-02** PostgreSQL + PostGIS · **ADR-03** Object Storage nội bộ (MinIO)
- **ADR-04** REST API phiên bản hóa `/api/v1` · **ADR-05** Outbox + hàng đợi (Redis)
- **ADR-06** RBAC + phạm vi dữ liệu · **ADR-07** Audit append-only · **ADR-08** Triển khai container

Backend tổ chức theo module nghiệp vụ (M01–M15). Hiện đã dựng **nền tảng (Pha 0)** và
lát cắt dọc **Identity & Access (M01)**; các module còn lại là lộ trình — xem
[`docs/ROADMAP.md`](docs/ROADMAP.md) và [`backend/README.md`](backend/README.md).

## 5. Bảo mật & dữ liệu

- Bí mật (JWT secret, mật khẩu CSDL) quản lý qua `.env`/secret store — **không ghi vào mã nguồn**.
- Lọc dữ liệu theo quyền phải thực thi ở **máy chủ**; giao diện chỉ là lớp trình bày.
- Không đưa dữ liệu/tọa độ thật vào bản dựng cloud.

## 6. Trạng thái kiểm chứng

Đã chạy và quan sát thực tế: `docker compose up` (PostGIS healthy) · `migration:run` ·
`seed` · backend build + boot · `GET /health` (DB up) · `POST /auth/login` (JWT) ·
`GET /me` có/không token (200 / 401 problem+json) · validation (VAL-001) ·
frontend phục vụ toàn bộ tài nguyên (app, runtime, design system, bản đồ, logo).
