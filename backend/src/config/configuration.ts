// Cấu hình tập trung, đọc từ biến môi trường (Configuration over hard-code).
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.BACKEND_PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:8000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'csdl',
    password: process.env.DB_PASSWORD ?? 'csdl_dev_pw',
    name: process.env.DB_NAME ?? 'csdl_doanhtrai',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
});
