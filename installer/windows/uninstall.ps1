<#
.SYNOPSIS
  Go stack CSDL Vat chat Doanh trai khoi may Windows.
.PARAMETER Silent
  Khong hoi xac nhan (dung khi Inno Setup goi luc go cai dat).
.PARAMETER KeepData
  Giu lai du lieu (khong xoa volume CSDL/MinIO). Mac dinh: XOA het.
#>
[CmdletBinding()]
param(
  [switch]$Silent,
  [switch]$KeepData
)

$ErrorActionPreference = 'SilentlyContinue'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Root

$ComposeFile = Join-Path $Root 'docker-compose.windows.yml'
$EnvFile     = Join-Path $Root '.env.windows'

Write-Host "==============================================================" -ForegroundColor Yellow
Write-Host "  GO CAI DAT: CSDL Vat chat Doanh trai Tinh" -ForegroundColor Yellow
Write-Host "==============================================================" -ForegroundColor Yellow

if (-not $Silent) {
  if ($KeepData) {
    Write-Host "  Se DUNG va XOA container (GIU LAI du lieu)."
  } else {
    Write-Host "  Se DUNG container va XOA TOAN BO DU LIEU (volume CSDL, MinIO)." -ForegroundColor Red
  }
  $ans = Read-Host "  Xac nhan? Go 'YES' de tiep tuc"
  if ($ans -ne 'YES') { Write-Host "  Da huy."; exit 0 }
}

if ($KeepData) {
  docker compose -f $ComposeFile --env-file $EnvFile down
} else {
  docker compose -f $ComposeFile --env-file $EnvFile down -v
}

# Xoa image cua ung dung (khong bat buoc, khong chan neu loi).
docker image rm csdl-doanhtrai-backend:offline csdl-doanhtrai-webapp:offline 2>$null | Out-Null

Write-Host "  [OK] Da go stack." -ForegroundColor Green
if (-not $Silent) { Read-Host "  Nhan Enter de dong" | Out-Null }
