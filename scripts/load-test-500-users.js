#!/usr/bin/env node
/**
 * Script Kiểm thử Tải nặng Đa luồng (Load Testing 500 CCU) cho CSDL Doanh trại Tỉnh (P08)
 * Giả lập 500 người dùng truy cập đồng thời vào các API cốt lõi.
 */

const http = require('http');

const CONCURRENCY = parseInt(process.env.CONCURRENCY || '500', 10);
const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '2000', 10);
const TARGET_HOST = process.env.TARGET_HOST || '127.0.0.1';
const TARGET_PORT = parseInt(process.env.TARGET_PORT || '3010', 10);

const ENDPOINTS = [
  '/api/v1/health',
  '/api/v1/queue/stats',
  '/api/v1/dashboard/summary',
];

console.log('======================================================================');
console.log('  BẮT ĐẦU KIỂM THỬ TẢI NẶNG (LOAD TESTING 500 CCU BENCHMARK)');
console.log('======================================================================');
console.log(`  Target Host        : ${TARGET_HOST}:${TARGET_PORT}`);
console.log(`  Concurrent Users   : ${CONCURRENCY} Virtual Users`);
console.log(`  Total Requests     : ${TOTAL_REQUESTS} Requests`);
console.log('----------------------------------------------------------------------\n');

const latencies = [];
let successCount = 0;
let errorCount = 0;
let completedCount = 0;

const startTime = Date.now();

function makeRequest(index, callback) {
  const endpoint = ENDPOINTS[index % ENDPOINTS.length];
  const reqStart = Date.now();

  const req = http.request(
    {
      host: TARGET_HOST,
      port: TARGET_PORT,
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': `P08-LoadTester-VU${index % CONCURRENCY}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);
        if (res.statusCode >= 200 && res.statusCode < 400) {
          successCount++;
        } else {
          errorCount++;
        }
        completedCount++;
        callback();
      });
    }
  );

  req.on('error', (err) => {
    const reqDuration = Date.now() - reqStart;
    latencies.push(reqDuration);
    errorCount++;
    completedCount++;
    callback();
  });

  req.on('timeout', () => {
    req.destroy();
  });

  req.end();
}

let activeWorkerCount = 0;
let requestIndex = 0;

function worker() {
  if (requestIndex >= TOTAL_REQUESTS) {
    activeWorkerCount--;
    if (activeWorkerCount === 0) {
      finishReport();
    }
    return;
  }

  const currentIndex = requestIndex++;
  makeRequest(currentIndex, () => {
    worker();
  });
}

// Khởi chạy 500 workers song song
activeWorkerCount = Math.min(CONCURRENCY, TOTAL_REQUESTS);
for (let i = 0; i < activeWorkerCount; i++) {
  worker();
}

function finishReport() {
  const totalDurationSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const rps = (completedCount / totalDurationSec).toFixed(2);
  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const successRate = ((successCount / completedCount) * 100).toFixed(2);

  console.log('\n======================================================================');
  console.log('  KẾT QUẢ KIỂM THỬ TẢI NẶNG (500 CONCURRENT USERS LOAD TEST RESULTS)');
  console.log('======================================================================');
  console.log(`  Thời gian thực thi     : ${totalDurationSec.toFixed(2)} giây`);
  console.log(`  Tổng số Request        : ${completedCount}`);
  console.log(`  Thành công (200 OK)    : ${successCount} (${successRate}%)`);
  console.log(`  Thất bại / Lỗi         : ${errorCount}`);
  console.log(`  Thông lượng (RPS)      : ${rps} req/sec`);
  console.log('----------------------------------------------------------------------');
  console.log('  THỜI GIAN PHẢN HỒI (LATENCY METRICS):');
  console.log(`    • Nhanh nhất (Min)   : ${minLatency} ms`);
  console.log(`    • Trung bình (Avg)   : ${avgLatency} ms`);
  console.log(`    • Phân vị P50        : ${p50} ms`);
  console.log(`    • Phân vị P95        : ${p95} ms`);
  console.log(`    • Phân vị P99 (Max)  : ${p99} ms`);
  console.log('======================================================================\n');
}
