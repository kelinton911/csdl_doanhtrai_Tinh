// Mục đích dự trữ (khung KKDT) — dùng chung cách phân loại với stock_quality_details.
export enum ReservePurpose {
  THUONG_XUYEN = 'THUONG_XUYEN', // dự trữ thường xuyên
  SSCD = 'SSCD', // sẵn sàng chiến đấu
  DOT_XUAT = 'DOT_XUAT', // đột xuất
  GOI_DAU = 'GOI_DAU', // gối đầu
  THU_HOI_XU_LY = 'THU_HOI_XU_LY', // thu hồi/xử lý
  CHAM_LUAN_CHUYEN = 'CHAM_LUAN_CHUYEN', // chậm luân chuyển
}
