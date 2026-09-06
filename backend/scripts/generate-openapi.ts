// Sinh snapshot hợp đồng OpenAPI (Sprint 0 §1 GAP-8) mà KHÔNG cần kết nối CSDL:
// dùng preview mode của Nest (quét metadata controller, không khởi tạo provider/DB).
// Kết quả rút gọn (paths → methods → operationId) ghi ra openapi.snapshot.json để
// contract test so sánh, phát hiện breaking change (mất path/operation).
import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

export interface OpenApiContract {
  version: string;
  // path → danh sách method (get/post/...) đã sắp xếp.
  paths: Record<string, string[]>;
  // path::method → operationId (nếu có) để bắt đổi tên ngầm.
  operations: Record<string, string>;
}

export function buildContract(doc: {
  paths?: Record<string, Record<string, { operationId?: string }>>;
}): OpenApiContract {
  const paths: Record<string, string[]> = {};
  const operations: Record<string, string> = {};
  for (const [path, methods] of Object.entries(doc.paths ?? {})) {
    const verbs = Object.keys(methods).sort();
    paths[path] = verbs;
    for (const verb of verbs) {
      const op = methods[verb]?.operationId;
      if (op) operations[`${path}::${verb}`] = op;
    }
  }
  return { version: '1.0', paths, operations };
}

async function run() {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const config = new DocumentBuilder()
    .setTitle('CSDL Vật chất Doanh trại cấp tỉnh — API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const contract = buildContract(document as never);

  const out = join(__dirname, '..', 'openapi.snapshot.json');
  writeFileSync(out, JSON.stringify(contract, null, 2) + '\n');
  const count = Object.keys(contract.paths).length;
  console.log(`OpenAPI snapshot: ${count} path ghi vào ${out}`);
  await app.close();
}

// Chỉ chạy khi gọi trực tiếp như script (tránh side-effect khi contract test import buildContract).
if (require.main === module) {
  run().catch((e) => {
    console.error('Lỗi sinh OpenAPI snapshot:', e);
    process.exit(1);
  });
}
