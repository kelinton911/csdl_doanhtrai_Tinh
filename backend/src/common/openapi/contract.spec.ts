import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../../app.module';
import { buildContract, OpenApiContract } from '../../../scripts/generate-openapi';

// Contract test OpenAPI (Sprint 0 §1 GAP-8, TC-S0-005): dựng hợp đồng hiện tại
// (preview mode — không cần CSDL) rồi so với baseline đã chốt; CI ĐỎ khi có
// breaking change (mất path/operation hoặc đổi tên operationId ngầm).
// Quy trình vá hợp đồng có chủ đích: chạy `npm run openapi:snapshot` rồi cập nhật
// openapi.baseline.json trong cùng commit thay đổi API.
const BASELINE_PATH = join(__dirname, '..', '..', '..', 'openapi.baseline.json');

describe('OpenAPI contract (Sprint 0 §1 GAP-8)', () => {
  let current: OpenApiContract;

  beforeAll(async () => {
    const app = await NestFactory.create(AppModule, { preview: true, logger: false });
    const config = new DocumentBuilder().setTitle('contract').setVersion('1.0').build();
    const document = SwaggerModule.createDocument(app, config);
    current = buildContract(document as never);
    await app.close();
  }, 60000);

  it('có baseline đã chốt để đối chiếu', () => {
    expect(existsSync(BASELINE_PATH)).toBe(true);
  });

  it('không mất path nào so với baseline (không breaking)', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as OpenApiContract;
    const missing = Object.keys(baseline.paths).filter((p) => !current.paths[p]);
    expect(missing).toEqual([]);
  });

  it('không mất method nào của path đã chốt', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as OpenApiContract;
    const removed: string[] = [];
    for (const [path, verbs] of Object.entries(baseline.paths)) {
      const now = new Set(current.paths[path] ?? []);
      for (const v of verbs) if (!now.has(v)) removed.push(`${v.toUpperCase()} ${path}`);
    }
    expect(removed).toEqual([]);
  });

  it('không đổi tên operationId ngầm cho operation đã chốt', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as OpenApiContract;
    const renamed: string[] = [];
    for (const [key, opId] of Object.entries(baseline.operations)) {
      const nowId = current.operations[key];
      if (nowId && nowId !== opId) renamed.push(`${key}: ${opId} → ${nowId}`);
    }
    expect(renamed).toEqual([]);
  });

  it('các endpoint nền tảng Sprint 0 hiện diện', () => {
    expect(current.paths['/c3-catalog']).toContain('get');
    expect(current.paths['/c3-catalog/{code}']).toContain('get');
  });
});
