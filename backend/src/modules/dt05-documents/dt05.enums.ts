// Enum cục bộ DT-05 (Quyển V). Trạng thái chứng từ dùng DocumentStatus chung (§3).

export enum InventoryDocumentType {
  RECEIPT = 'RECEIPT', // nhập (+)
  ISSUE = 'ISSUE', // xuất (−)
  TRANSFER = 'TRANSFER', // điều chuyển (2 đầu)
  RECALL = 'RECALL', // thu hồi (đổi trạng thái tài sản)
  DISPOSAL = 'DISPOSAL', // thanh lý (giảm thực)
  CONVERSION = 'CONVERSION', // chuyển đổi (điều chỉnh)
}

export enum TransferStatus {
  DRAFT = 'DRAFT',
  DISPATCHED = 'DISPATCHED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  CLOSED = 'CLOSED',
}

export enum StockPeriodStatus {
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  LOCKED = 'LOCKED',
}

export const TRANSFER_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  [TransferStatus.DRAFT]: [TransferStatus.DISPATCHED],
  [TransferStatus.DISPATCHED]: [TransferStatus.IN_TRANSIT, TransferStatus.RECEIVED],
  [TransferStatus.IN_TRANSIT]: [TransferStatus.RECEIVED],
  [TransferStatus.RECEIVED]: [TransferStatus.CLOSED],
  [TransferStatus.CLOSED]: [],
};

export const STOCK_PERIOD_TRANSITIONS: Record<StockPeriodStatus, StockPeriodStatus[]> = {
  [StockPeriodStatus.OPEN]: [StockPeriodStatus.CLOSING, StockPeriodStatus.LOCKED],
  [StockPeriodStatus.CLOSING]: [StockPeriodStatus.LOCKED, StockPeriodStatus.OPEN],
  [StockPeriodStatus.LOCKED]: [StockPeriodStatus.OPEN], // mở lại phải có unlock_reason
};
