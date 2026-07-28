import 'reflect-metadata';
import { createServer } from 'net';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Tự động chọn cổng trống nếu cổng cấu hình đã bị chiếm.
async function findFreePort(preferred: number, attempts = 20): Promise<number> {
  const isFree = (port: number) =>
    new Promise<boolean>((resolve) => {
      const srv = createServer();
      srv.once('error', () => resolve(false));
      // Không chỉ định host — khớp cách NestJS listen (dual-stack '::').
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(port);
    });
  for (let i = 0; i < attempts; i++) {
    const candidate = preferred + i;
    if (await isFree(candidate)) return candidate;
  }
  return 0; // 0 = để hệ điều hành cấp cổng ngẫu nhiên còn trống.
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Validation toàn cục + chống mass assignment (whitelist).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS giới hạn theo cấu hình (mạng nội bộ).
  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    credentials: true,
  });

  // OpenAPI là hợp đồng chính thức (API-first).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CSDL Vật chất Doanh trại cấp tỉnh — API')
    .setDescription('REST API /api/v1 — Modular Monolith (NestJS + PostgreSQL/PostGIS)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const preferred = config.get<number>('port') ?? 3000;
  const port = await findFreePort(preferred);
  await app.listen(port);
  const actual = (app.getHttpServer().address() as { port: number }).port;

  const logger = new Logger('Bootstrap');
  if (actual !== preferred) {
    logger.warn(`Cổng ${preferred} đang bận — đã tự chuyển sang cổng ${actual}.`);
  }
  logger.log(`Backend chạy tại http://localhost:${actual}/${apiPrefix}`);
  logger.log(`Tài liệu API (Swagger): http://localhost:${actual}/${apiPrefix}/docs`);
}

bootstrap();
