@echo off
setlocal
cd /d "%~dp0"
echo Khoi dong stack CSDL Vat chat Doanh trai...
docker compose -f docker-compose.windows.yml --env-file .env.windows up -d
if errorlevel 1 (
  echo [X] Khong khoi dong duoc. Kiem tra Docker Desktop da chay chua.
  pause
  exit /b 1
)
echo [OK] Da khoi dong. Mo trinh duyet...
powershell -NoProfile -Command "$p=(Select-String -Path '.env.windows' -Pattern '^FRONTEND_PORT_HOST=(.*)$').Matches.Groups[1].Value; if(-not $p){$p='8000'}; Start-Process ('http://localhost:'+$p)"
