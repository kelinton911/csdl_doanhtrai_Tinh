# Runbook — Sao lưu, phục hồi & kiểm tra tính toàn vẹn (UC-24 / M15)

> Phạm vi: CSDL PostGIS + object storage MinIO của hệ thống CSDL Vật chất Doanh trại.
> Bản dựng hiện tại là DEV (dữ liệu giả lập). Với PROD nội bộ: **mã hóa** bản sao, **tách vùng
> lưu trữ**, và **diễn tập phục hồi định kỳ** (đo RPO/RTO).

## 1. Thành phần cần sao lưu

| Thành phần | Nội dung | Công cụ |
| --- | --- | --- |
| PostgreSQL/PostGIS (`csdl-db`) | Toàn bộ schema + dữ liệu nghiệp vụ | `pg_dump -F c` |
| MinIO (`csdl-minio`, bucket `csdl-documents`) | Tệp/ảnh/hồ sơ, báo cáo đã xuất | `mc mirror` |
| Cấu hình | `.env` (bí mật) — **quản lý riêng qua secret store, KHÔNG nằm trong backup thường** | — |

## 2. Sao lưu

```bash
# Yêu cầu: docker compose đang chạy (csdl-db, csdl-minio healthy)
bash infra/backup.sh
# → tạo thư mục infra/data/backups/<timestamp>/ gồm:
#    db.dump · objects/ · CHECKSUMS.txt · MANIFEST.txt
```

- `pg_dump` định dạng custom (`-F c`) cho phép phục hồi chọn lọc và song song.
- `CHECKSUMS.txt` (sha256) để kiểm tra tính toàn vẹn trước khi phục hồi.
- **Lịch khuyến nghị (PROD):** full hằng ngày + WAL archiving cho point-in-time; giữ theo chính
  sách retention; sao chép ra vùng lưu trữ tách biệt (mã hóa AES-256).

## 3. Kiểm tra tính toàn vẹn

```bash
cd infra/data/backups/<timestamp>
sha256sum -c CHECKSUMS.txt        # phải PASS trước khi dùng để phục hồi
```

## 4. Phục hồi (thử nghiệm an toàn)

```bash
# Phục hồi vào CSDL tạm "<DB_NAME>_restore" để đối chiếu, KHÔNG ghi đè trực tiếp production
bash infra/restore.sh infra/data/backups/<timestamp>
```

Quy trình:
1. Kiểm checksum (bước 0 tự chạy).
2. DROP/CREATE CSDL `<DB_NAME>_restore` + `pg_restore`.
3. Mirror object storage về bucket.
4. **Đối chiếu** số bản ghi trọng yếu (barracks, facilities, materials, audit_logs, documents)
   giữa bản phục hồi và kỳ vọng trước khi chuyển production.

Chuyển production (khi đã xác nhận):
```bash
# Đổi tên CSDL (dừng backend trước)
docker exec -i csdl-db psql -U csdl -d postgres -c \
  "ALTER DATABASE csdl_doanhtrai RENAME TO csdl_doanhtrai_old; \
   ALTER DATABASE csdl_doanhtrai_restore RENAME TO csdl_doanhtrai;"
```

## 5. Diễn tập & chỉ số

- **RPO** (mất mát dữ liệu tối đa chấp nhận): xác định theo cấp hệ thống (ví dụ ≤ 24h với full
  hằng ngày; ≤ vài phút nếu bật WAL archiving).
- **RTO** (thời gian phục hồi mục tiêu): đo bằng diễn tập thực tế; ghi biên bản mỗi lần.
- **Lịch diễn tập:** phục hồi thử định kỳ (khuyến nghị hằng quý), lập biên bản kết quả + thời gian.

## 6. Nguyên tắc an toàn (Backend §9)

- Bản sao lưu **không chứa secret dạng rõ**; `.env`/khóa quản lý qua secret store riêng.
- Mã hóa bản sao khi lưu trữ dài hạn; kiểm soát truy cập kho backup.
- Mọi lần backup/restore ghi biên bản (MANIFEST) phục vụ truy nguyên (append-only audit).

## 7. Trạng thái hiện tại

- Script `infra/backup.sh` + `infra/restore.sh` sẵn sàng cho DEV nội bộ.
- **Lộ trình PROD:** WAL archiving/point-in-time, mã hóa, off-site, tự động hóa lịch (cron/CI) và
  giám sát cảnh báo khi backup thất bại; endpoint `/admin/backups` (chỉ SYS_ADMIN) để kích hoạt và
  theo dõi qua giao diện (chưa hiện thực — hiện chạy bằng script vận hành).
