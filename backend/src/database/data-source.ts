// DataSource TypeORM dùng chung cho ứng dụng và cho CLI migration.
// Nạp biến môi trường từ .env ở gốc monorepo (ưu tiên) hoặc backend/.env.
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';

// Thử nạp .env ở gốc dự án rồi tới backend/.env.
loadEnv({ path: join(__dirname, '..', '..', '..', '.env') });
loadEnv({ path: join(__dirname, '..', '..', '.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'csdl',
  password: process.env.DB_PASSWORD ?? 'csdl_dev_pw',
  database: process.env.DB_NAME ?? 'csdl_doanhtrai',
  // Entities & migrations nạp theo glob — chạy được cả .ts (ts-node) lẫn .js (dist).
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  // No silent overwrite: KHÔNG dùng synchronize; mọi thay đổi schema qua migration.
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
