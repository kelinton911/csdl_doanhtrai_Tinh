# Bộ cài đặt Windows (offline) — CSDL Vật chất Doanh trại Tỉnh

Bộ cài triển khai toàn bộ hệ thống trên **một máy Windows trong mạng nội bộ (air‑gapped)**
bằng Docker Desktop. Toàn bộ image được đóng gói sẵn (`docker save`) nên **không cần Internet**
lúc cài trên máy đích.

---

## 0. Kiến trúc gói cài

| Thành phần | Vai trò |
| --- | --- |
| `db` (PostGIS 16‑3.4) | CSDL không gian |
| `redis` | cache / hàng đợi / outbox |
| `minio` | object storage nội bộ (hồ sơ, biên bản) |
| `backend` (NestJS) | API `/api/v1`, tự chạy migration khi khởi động |
| `webapp` (Vite) | giao diện, proxy `/api` → backend |
| `tile-server` *(tuỳ chọn)* | bản đồ số GIS offline (cần thêm `*.mbtiles`) |

---

## 1. Yêu cầu máy Windows đích

- **Windows 10/11 64‑bit** (hoặc Windows Server 2022).
- **Docker Desktop for Windows** đã cài và **đang chạy** (bật WSL2).
- Còn trống vài GB đĩa cho image + dữ liệu.
- **Không cần** cài Node.js/PostgreSQL — tất cả chạy trong container.

---

## 2. Bước 1 — Tạo gói offline (trên máy DEV có Docker + Internet)

Chạy **một lần** trên máy phát triển (Linux/macOS/WSL) tại gốc repo:

```bash
bash installer/windows/prepare-offline.sh
```

Script sẽ: build image backend + webapp, kéo image hạ tầng, `docker save` tất cả thành
`installer/windows/dist/images/csdl-doanhtrai-images.tar`, và sao chép script + GIS + tiles
vào `installer/windows/dist/`.

Kết quả: thư mục **`installer/windows/dist/`** là bộ cài hoàn chỉnh mang đi.

---

## 3. Bước 2 — Cài trên máy Windows (chọn 1 trong 2 cách)

### Cách A — Trình cài đặt Setup.exe (khuyến nghị)

1. Trên **Windows** cài **Inno Setup 6** (https://jrsoftware.org/isdl.php).
2. Mở `installer/windows/installer.iss` bằng Inno Setup → **Build** (Ctrl+F9).
   → Sinh ra `Output\CSDL-DoanhTrai-Setup.exe` (đã nhúng sẵn image offline).
3. Chép `CSDL-DoanhTrai-Setup.exe` sang máy đích, chạy → Next → Install.
4. Tích **"Triển khai ngay"** ở màn hình cuối để tự nạp image, khởi động và nạp dữ liệu mẫu.

Sau khi cài: có shortcut trong Start Menu và Desktop (Khởi động / Dừng / Nạp lại dữ liệu / Gỡ cài).

### Cách B — Chạy thẳng từ thư mục (không cần build .exe)

1. Chép cả thư mục `dist/` sang máy Windows (ví dụ `C:\CSDL-DoanhTrai`).
2. Bảo đảm Docker Desktop đang chạy.
3. Nhấp đúp **`install.bat`** (hoặc chuột phải → Run as administrator nếu cần).

`install.bat` sẽ: nạp image → sinh `.env.windows` (bí mật ngẫu nhiên) → dựng stack →
chờ backend sẵn sàng → nạp dữ liệu mẫu "chuỗi vàng" → mở trình duyệt.

---

## 4. Truy cập sau khi cài

| Dịch vụ | Địa chỉ |
| --- | --- |
| Giao diện | http://localhost:8000 |
| API | http://localhost:3010/api/v1 |
| Swagger | http://localhost:3010/api/v1/docs |
| MinIO Console | http://localhost:9001 |

**Tài khoản demo** (mật khẩu chung `admin@123`): `admin`, `chihuy`, `hckt`, `xa01`, `kiemduyet`.

> Đổi cổng: sửa `.env.windows` (`FRONTEND_PORT_HOST`, `BACKEND_PORT_HOST`, …) rồi chạy `start.bat`.

---

## 5. Vận hành hằng ngày

| Việc | Thao tác |
| --- | --- |
| Bật hệ thống | `start.bat` |
| Tắt hệ thống (giữ dữ liệu) | `stop.bat` |
| Nạp lại dữ liệu mẫu | `seed-demo.bat` |
| Gỡ cài đặt (xoá dữ liệu) | `uninstall.bat` hoặc Start Menu → Gỡ cài đặt |

Dữ liệu nằm trong Docker volume (`db_data`, `minio_data`) nên **còn nguyên** sau khi
`stop.bat` / khởi động lại máy. Chỉ `uninstall` mới xoá dữ liệu.

---

## 6. Tuỳ chọn: bản đồ nền GIS offline

Mặc định `tile-server` không bật (chưa có tệp bản đồ). Muốn có bản đồ nền offline:

1. Đặt tệp `*.mbtiles` và `config.json` vào thư mục `tiles\` của bản cài.
2. Chạy: `docker compose -f docker-compose.windows.yml --profile tiles up -d`
3. Kiểm tra cổng `8080` (`TILE_SERVER_PORT_HOST`).

---

## 7. Xử lý sự cố

| Hiện tượng | Xử lý |
| --- | --- |
| "Docker Desktop chua chay" | Mở Docker Desktop, đợi biểu tượng xanh rồi chạy lại. |
| Cổng bị trùng (8000/3010/9000) | Sửa `*_PORT_HOST` trong `.env.windows`, chạy `start.bat`. |
| Backend không lên `/health` | `docker compose -f docker-compose.windows.yml logs backend` |
| Seed lỗi | Chạy lại `seed-demo.bat` (idempotent, an toàn). |
| Xem trạng thái container | `docker compose -f docker-compose.windows.yml ps` |

> ⚠ Bản dựng dùng **dữ liệu GIẢ LẬP**. Chỉ nạp dữ liệu thật sau khi đã chuyển hẳn về
> hạ tầng nội bộ, theo đúng quy định bảo mật.
