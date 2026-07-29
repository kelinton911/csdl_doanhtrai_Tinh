# Kiểm thử tự động toàn ngăn xếp (container hoá)

> Mục tiêu: sau **mỗi đợt phát triển**, một lệnh duy nhất dựng đủ ngăn xếp, chạy toàn bộ
> kiểm thử, dọn sạch và báo **PASS/FAIL** — giảm ma sát của kiến trúc backend/frontend
> tách rời (gom lại thành trải nghiệm "một app" như Next.js).

## 1. Yêu cầu

- **Docker** + **Docker Compose v2** (đã có: Docker 29.x, Compose v5.x).
- Không cần cài Node/Postgres trên máy để chạy `verify` — mọi thứ chạy trong container.

## 2. Lệnh chính

Chạy ở thư mục gốc dự án:

```bash
npm run verify        # Build + Unit (Jest) + E2E (Playwright, 5 luồng) → PASS/FAIL
npm run verify:unit   # Chỉ unit test backend
npm run verify:e2e    # Chỉ E2E toàn stack (bỏ unit)
```

Gỡ lỗi khi fail — giữ nguyên container để soi:

```bash
KEEP=1 npm run verify
docker compose -f docker-compose.test.yml -p csdl-test logs backend
docker compose -f docker-compose.test.yml -p csdl-test down -v   # dọn thủ công
```

Mã thoát: `0` = tất cả đạt, khác `0` = có lỗi (dùng cho git hook/CI).

## 3. Pipeline `verify` làm gì (scripts/verify.sh)

| Bước | Nội dung | Bắt lỗi gì |
|------|----------|-----------|
| 1. Build | `nest build` (backend) + `tsc --noEmit && vite build` (webapp) trong image | Lỗi biên dịch TypeScript, thiếu phụ thuộc |
| 2. Unit | `jest` trong container backend (không cần DB) | Lỗi logic đơn vị (data-scope, barracks…) |
| 3. E2E | Dựng `db(ephemeral)+minio+backend(migrate+seed)`, Playwright chạy **5 luồng nghiệp vụ** | Hồi quy end-to-end (đăng nhập, kiểm kê, duyệt, dashboard, báo cáo) |

Ngăn xếp test (`docker-compose.test.yml`) **biệt lập**:
- CSDL/MinIO chạy **tmpfs** (trong RAM) → mỗi lần là môi trường **sạch, tất định**, tự xoá.
- **Không publish cổng ra host** → không đụng cổng dự án khác (5435/6380/9004…).
- Thông tin đăng nhập trong file test là **giả dùng-một-lần**, không phải bí mật thật.

## 4. Chạy cả ngăn xếp như một app (DEV)

Ngoài kiểm thử, có thể chạy cả backend + webapp bằng container (giống "một app"):

```bash
npm run stack         # docker compose --profile app up --build (foreground)
npm run stack:up      # nền (-d)
npm run stack:down
npm run stack:logs
```

Mặc định (không profile) `docker compose up` **vẫn chỉ dựng hạ tầng** (db/redis/minio/adminer)
như trước — giữ nguyên quy trình cũ để chạy backend/webapp bằng Node trên host.

Cổng host (đổi qua `.env` nếu trùng):
- webapp: `FRONTEND_HOST_PORT` (mặc định **8000**) → `http://localhost:8000`
- backend: `BACKEND_HOST_PORT` (mặc định **3010**) → `http://localhost:3010/api/v1`

Bật seed dữ liệu giả lập cho stack DEV: `SEED_ON_START=true npm run stack`.

## 5. Kích hoạt tự động sau mỗi đợt phát triển (git hook)

```bash
npm run hooks:install   # trỏ core.hooksPath → .githooks (chạy 1 lần sau clone)
```

Sau đó mỗi `git push` sẽ tự chạy `npm run verify`; **fail thì chặn push**.

Bỏ qua khi cần:

```bash
git push --no-verify        # bỏ qua toàn bộ hook
SKIP_VERIFY=1 git push      # bỏ qua riêng bước verify
```

> `npm install` ở thư mục gốc cũng tự cài hook (script `prepare`).

## 6. Tài khoản demo (do seed tạo)

Mật khẩu chung: `admin@123`. Tài khoản: `admin`, `chihuy`, `hckt`, `xa01`, `kiemduyet`.
Seed **idempotent** (guard `findOne`) nên chạy lại an toàn.

## 7. Cấu trúc file liên quan

```
docker-compose.yml            # hạ tầng (mặc định) + backend/webapp (profile "app")
docker-compose.test.yml       # ngăn xếp test biệt lập, ephemeral
backend/Dockerfile            # image backend (build + migrate/seed + serve)
backend/docker-entrypoint.sh  # chờ DB → migrate → (tuỳ chọn) seed → chạy app
webapp/Dockerfile             # image webapp (build tĩnh + vite preview có proxy)
webapp/Dockerfile.e2e         # image chạy Playwright (Chromium bundled)
scripts/verify.sh             # điều phối build + unit + e2e + báo cáo
scripts/install-hooks.sh      # cài git hooks
.githooks/pre-push            # tự verify trước khi push
package.json (gốc)            # lệnh gộp: verify / stack / infra / hooks
```

## 8. Giới hạn đã biết / hướng mở rộng

- Image backend giữ cả devDependencies + mã nguồn để chạy migration/seed bằng `ts-node`.
  Phù hợp DEV/test, **chưa tối ưu cho PROD** (cần multi-stage + migration biên dịch sẵn).
- E2E dùng Vite dev server (proxy `/api`) đúng như thiết kế sẵn có; webapp app-stack dùng
  `vite preview` (proxy cấu hình ở `vite.config.ts` mục `preview`).
- Chưa tích hợp CI đám mây; `verify.sh` trả mã thoát chuẩn nên gắn vào GitHub Actions/GitLab
  CI dễ dàng khi cần.
