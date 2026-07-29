# Image backend NestJS cho stack container hoá (DEV + kiểm thử tự động).
# Một stage: giữ cả devDependencies + mã nguồn để chạy migration/seed bằng ts-node
# (npm run migration:run / seed dùng ts-node). Không nhằm tối ưu PROD — xem docs.
FROM node:22-bookworm-slim

WORKDIR /app

# Cài phụ thuộc trước để tận dụng cache lớp Docker.
COPY package*.json ./
RUN npm ci

# Mã nguồn + build (nest build cũng là bước kiểm tra biên dịch TypeScript).
COPY . .
RUN npm run build

# Backend tự tìm cổng trống từ 3000; trong container 3000 luôn trống → cố định 3000.
EXPOSE 3000
ENV NODE_ENV=production

# Healthcheck bằng chính Node (không cần cài thêm wget/curl). Node 22 có fetch toàn cục.
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
