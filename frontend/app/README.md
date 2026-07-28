# CSDL Vật chất Doanh trại cấp tỉnh — Frontend

Thiết kế giao diện hệ thống cơ sở dữ liệu lớn về vật chất doanh trại cấp tỉnh.
Ứng dụng web nội bộ, desktop-first, chạy trực tiếp trong trình duyệt — không cần build.

**Toàn bộ số liệu trong bản dựng này là giả lập.** Không có tọa độ thật, không có
dữ liệu đơn vị thật. Xem mục "Lưu ý khi triển khai" bên dưới.

## Chạy thử

Cần một web server tĩnh (mở trực tiếp bằng `file://` sẽ chặn iframe bản đồ):

```bash
python3 -m http.server 8000
# mở http://localhost:8000/CSDL%20Vật%20chất%20Doanh%20trại.dc.html
```

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `CSDL Vật chất Doanh trại.dc.html` | Toàn bộ ứng dụng: 24 màn hình, 5 vai trò, 2 chế độ sáng/tối |
| `ban-do-so.html` | Bản đồ số Leaflet, nhúng qua iframe; cấu hình nguồn tile ở đầu file |
| `support.js` | Runtime render template |
| `_ds/modernist-*/` | Design system: tokens, stylesheet, component bundle |
| `uploads/` | Tài liệu mô tả gốc và phù hiệu đơn vị |

## Phạm vi đã dựng

**Nghiệp vụ (14 nhóm):** tổng quan chỉ huy · bản đồ doanh trại (sơ đồ + bản đồ số) ·
danh sách doanh trại · hồ sơ doanh trại 9 tab · hồ sơ công trình · vật chất và tồn kho ·
phiếu kiểm kê wizard 4 bước · kiểm duyệt dữ liệu · sửa chữa khôi phục ·
tiềm lực HC-KT cấp xã · lập tình huống và phương án · báo cáo và xem trước bản in ·
trung tâm cảnh báo · quản trị danh mục và phân quyền.

**Bàn giao thiết kế (7 trang):** định hướng thị giác · design tokens · thư viện component ·
12 trạng thái hệ thống · responsive specs · màn tablet và điện thoại · dev handoff.

**Vai trò:** Chỉ huy tỉnh · Cơ quan HC-KT · Ban CHQS xã · Kiểm duyệt viên · Quản trị hệ thống.
Mỗi vai trò có màn hình chính riêng, phạm vi dữ liệu riêng và danh sách nhóm chức năng bị chặn.

**Dữ liệu:** 34 tỉnh/thành theo cơ cấu hành chính 2 cấp. Chọn tỉnh sẽ nạp lại toàn bộ
doanh trại, cảnh báo, tiềm lực và bản đồ của tỉnh đó.

## Lưu ý khi triển khai

1. **Nguồn bản đồ.** Mặc định dùng OpenStreetMap, cần Internet. Trên mạng nội bộ:
   mở `ban-do-so.html`, sửa `TILE_CONFIG.active` thành `'noibo'` và điền URL tile server
   của đơn vị vào `TILE_SOURCES.noibo.url`. Có sẵn chế độ ngoại tuyến tự kích hoạt
   khi không tải được tile.
2. **Lọc dữ liệu theo quyền phải làm ở máy chủ.** Giao diện có che tọa độ và ẩn nhóm
   chức năng ngoài quyền, nhưng đó là lớp trình bày — không được coi là biện pháp bảo mật.
3. **Không đưa dữ liệu thật vào bản dựng cloud.** Chỉ nạp dữ liệu thật sau khi hệ thống
   đã chuyển hẳn về hạ tầng nội bộ.
