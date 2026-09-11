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

## 3. Khởi chạy nhanh (DEV trên Ubuntu)

Cách nhanh nhất: chạy CẢ ngăn xếp trong Docker ở **chế độ hot-reload** — sửa code trong
`backend/` hoặc `webapp/` là container **tự nạp lại ngay**, KHÔNG phải build lại image.

```bash
cp .env.example .env     # lần đầu: chuẩn bị biến môi trường (chỉnh cổng/bí mật nếu cần)

npm run dev:hot          # bật stack :8000 hot-reload (db/redis/minio + backend + webapp)
npm run dev:hot:logs     # (tuỳ chọn) theo dõi log backend + webapp
```

- Giao diện: <http://localhost:8000>  ·  API: <http://localhost:3011/api/v1>  ·  Swagger: `.../api/v1/docs`
- Lần đầu backend biên dịch TypeScript ~20–40s (nest `--watch`) trước khi sẵn sàng — theo dõi bằng `npm run dev:hot:logs`.
- Ở chế độ dev KHÔNG có service worker/PWA nên khỏi phải hard-refresh.

> **Stack `:8000` có 2 chế độ — đừng nhầm:**
> - **Hot-reload** (`npm run dev:hot`): dev-server bind-mount source, sửa là hiện ngay → dùng khi ĐANG code.
> - **Build-sẵn** (`docker compose --profile app up -d --build`): image nướng `dist/` tĩnh, `restart=unless-stopped`
>   nên tự chạy khi bật máy → dùng để demo/nghiệm thu. Muốn thấy thay đổi phải **build lại image**.
> - Chuyển qua lại: `npm run dev:hot`  ↔  `npm run dev:hot:restore`.

### Chạy native (Node trực tiếp, không container cho tầng app) — tuỳ chọn

Instance dev thứ 2, cổng riêng (backend :3100 / webapp :8100), DB cô lập :5436 — không đụng stack :8000:

```bash
bash scripts/dev-infra-up.sh   # hạ tầng cô lập (DB 5436 / Redis 6381 / MinIO 9006 / Adminer 8083)
bash scripts/dev-seed.sh       # lần đầu: migration + seed
bash scripts/dev-backend.sh    # backend :3100 (nest --watch)   — cửa sổ 1
bash scripts/dev-webapp.sh     # webapp  :8100 (vite)           — cửa sổ 2
```

### Cổng stack :8000 (theo `.env`)

| Dịch vụ | URL | Ghi chú |
| --- | --- | --- |
| Webapp | http://localhost:8000 | Vite (hot-reload hoặc preview build-sẵn) |
| Backend API | http://localhost:3011/api/v1 | REST, phiên bản hoá (`BACKEND_HOST_PORT`) |
| Swagger (OpenAPI) | http://localhost:3011/api/v1/docs | Hợp đồng API |
| PostgreSQL/PostGIS | localhost:5435 | container `csdl-db` (`DB_PORT`) |
| Adminer | http://localhost:8082 | Quản trị CSDL cho DEV |
| MinIO Console | http://localhost:9005 | Object storage (API :9004) |
| Redis | localhost:6380 | Cache/hàng đợi/outbox |

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
