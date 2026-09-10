@echo off
setlocal
cd /d "%~dp0"
echo Dung stack CSDL Vat chat Doanh trai (du lieu duoc GIU LAI)...
docker compose -f docker-compose.windows.yml --env-file .env.windows down
echo [OK] Da dung. Chay start.bat de bat lai.
pause
