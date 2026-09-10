@echo off
setlocal
cd /d "%~dp0"
echo Nap lai du lieu mau "chuoi vang" (anchor Thanh Hoa)...
echo (Idempotent - chay lai an toan, khong nhan doi du lieu.)
docker compose -f docker-compose.windows.yml --env-file .env.windows exec -T backend npm run seed:chain
echo.
pause
