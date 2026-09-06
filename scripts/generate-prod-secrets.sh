#!/usr/bin/env node
/**
 * Script sinh chuỗi bí mật ngẫu nhiên an toàn cao cho môi trường PROD (P08)
 * Sử dụng crypto.randomBytes chuẩn quân sự / mật mã học.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generatePassword(length = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  const bytes = crypto.randomBytes(length);
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}

console.log('======================================================================');
console.log('  SINH BÍ MẬT BẢO MẬT MÔI TRƯỜNG SẢN XUẤT (P08 - PROD SECRETS GENERATOR)');
console.log('======================================================================\n');

const secrets = {
  JWT_ACCESS_SECRET: generateSecret(32),
  JWT_REFRESH_SECRET: generateSecret(32),
  DB_PASSWORD: generatePassword(24),
  REDIS_PASSWORD: generatePassword(24),
  MINIO_ROOT_PASSWORD: generatePassword(24),
  COOKIE_SECRET: generateSecret(32),
};

console.log('Tự động khởi tạo các chuỗi bí mật an toàn ngẫu nhiên:\n');
for (const [key, val] of Object.entries(secrets)) {
  console.log(`  ${key.padEnd(24)} = ${val}`);
}

console.log('\n----------------------------------------------------------------------');
console.log('Hướng dẫn:');
console.log('1. Sao chép các giá trị trên vào tệp .env.production');
console.log('2. Bảo mật tuyệt đối tệp .env.production và không commit lên repository.');
console.log('======================================================================');
