// Chạy một bước seed ĐỘC LẬP (npm run seed:NN) — mở/đóng DataSource riêng.
// Khi chạy qua orchestrator run-all.ts, hàm run(ds) được gọi với DataSource DÙNG CHUNG
// (run-all tự init/destroy) nên bước con KHÔNG được tự đóng kết nối.
import { DataSource } from 'typeorm';
import dataSource from '../../../data-source';

export function standalone(run: (ds: DataSource) => Promise<void>): void {
  (async () => {
    await dataSource.initialize();
    try {
      await run(dataSource);
    } finally {
      await dataSource.destroy();
    }
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
