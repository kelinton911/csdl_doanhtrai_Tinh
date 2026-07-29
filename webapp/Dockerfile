# Image webapp cho app-stack container hoá: build tĩnh rồi phục vụ bằng `vite preview`
# (có proxy /api → backend, cấu hình trong vite.config.ts `preview.proxy`).
# BUILD cũng là bước kiểm tra biên dịch (npm run build = tsc --noEmit && vite build).
FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# BACKEND_ORIGIN lúc BUILD không quan trọng; proxy đọc env lúc RUNTIME.
RUN npm run build

EXPOSE 5173
# --host để publish ra ngoài container; cổng khớp vite.config preview.port.
CMD ["npx", "vite", "preview", "--host", "--port", "5173"]
