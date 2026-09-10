@echo off
setlocal
cd /d "%~dp0"
echo ================================================================
echo   Dang khoi chay trinh cai dat CSDL Vat chat Doanh trai Tinh
echo ================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
