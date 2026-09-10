<#
.SYNOPSIS
  Trình cài đặt OFFLINE cho Windows — CSDL Vật chất Doanh trại Tỉnh.
.DESCRIPTION
  1) Kiểm tra Docker Desktop đang chạy.
  2) Nạp image từ gói offline (docker load images\*.tar).
  3) Sinh .env.windows (bí mật ngẫu nhiên) nếu chưa có.
  4) Dựng stack: docker compose -f docker-compose.windows.yml up -d.
  5) Chờ backend healthy (migration tự chạy trong container).
  6) (Mặc định) nạp dữ liệu mẫu "chuỗi vàng" anchor Thanh Hóa.
  7) Mở trình duyệt vào giao diện.
.PARAMETER NoSeed
  Bỏ qua bước nạp dữ liệu mẫu (chỉ tạo lược đồ rỗng + tài khoản nền).
.PARAMETER SkipBrowser
  Không tự mở trình duyệt sau khi cài.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1
  powershell -ExecutionPolicy Bypass -File install.ps1 -NoSeed
#>
[CmdletBinding()]
param(
  [switch]$NoSeed,
  [switch]$SkipBrowser
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Root

$ComposeFile = Join-Path $Root 'docker-compose.windows.yml'
$EnvFile     = Join-Path $Root '.env.windows'
$EnvExample  = Join-Path $Root '.env.windows.example'
$ImagesDir   = Join-Path $Root 'images'

function Write-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Write-Err($m)  { Write-Host "  [X]  $m" -ForegroundColor Red }

function New-HexSecret([int]$Bytes = 32) {
  $buf = New-Object 'System.Byte[]' $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
}

function Read-EnvFile([string]$Path) {
  $map = @{}
  if (Test-Path $Path) {
    foreach ($line in Get-Content $Path) {
      $t = $line.Trim()
      if ($t -eq '' -or $t.StartsWith('#')) { continue }
      $i = $t.IndexOf('=')
      if ($i -lt 1) { continue }
      $map[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
  }
  return $map
}

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  CAI DAT: CSDL VAT CHAT DOANH TRAI TINH (Offline / Windows)"   -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

# --- 1) Kiểm tra Docker ------------------------------------------------------
Write-Step "Kiem tra Docker Desktop"
try { docker version --format '{{.Server.Version}}' | Out-Null } catch {
  Write-Err "Khong goi duoc 'docker'. Hay cai va MO Docker Desktop roi chay lai."
  Write-Host "       Tai: Docker Desktop for Windows (yeu cau WSL2)."
  exit 1
}
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Err "Docker Desktop chua chay (daemon khong phan hoi). Mo Docker Desktop roi chay lai."
  exit 1
}
docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Err "Thieu 'docker compose' (v2). Cap nhat Docker Desktop ban moi."
  exit 1
}
Write-Ok "Docker da san sang."

# --- 2) Nạp image offline ----------------------------------------------------
Write-Step "Nap image tu goi offline"
$tars = @()
if (Test-Path $ImagesDir) { $tars = Get-ChildItem -Path $ImagesDir -Filter '*.tar' -ErrorAction SilentlyContinue }
if ($tars.Count -eq 0) {
  Write-Warn "Khong thay images\*.tar. Bo qua docker load (gia su image da co san tren may)."
} else {
  foreach ($t in $tars) {
    Write-Host "  - docker load -i $($t.Name) ..."
    docker load -i $t.FullName
    if ($LASTEXITCODE -ne 0) { Write-Err "Nap image that bai: $($t.Name)"; exit 1 }
  }
  Write-Ok "Da nap $($tars.Count) tep image."
}

# --- 3) Sinh .env.windows ----------------------------------------------------
Write-Step "Chuan bi cau hinh (.env.windows)"
if (Test-Path $EnvFile) {
  Write-Ok ".env.windows da co — giu nguyen cau hinh hien tai."
} else {
  if (-not (Test-Path $EnvExample)) { Write-Err "Thieu .env.windows.example."; exit 1 }
  $content = Get-Content $EnvExample -Raw
  # Thay lan luot tung __GENERATE__ bang mot bi mat rieng.
  while ($content -match '__GENERATE__') {
    $content = ([regex]'__GENERATE__').Replace($content, (New-HexSecret 32), 1)
  }
  Set-Content -Path $EnvFile -Value $content -Encoding UTF8
  Write-Ok "Da sinh .env.windows voi bi mat ngau nhien."
}
$envMap = Read-EnvFile $EnvFile
$FrontendPort = if ($envMap['FRONTEND_PORT_HOST']) { $envMap['FRONTEND_PORT_HOST'] } else { '8000' }
$BackendPort  = if ($envMap['BACKEND_PORT_HOST'])  { $envMap['BACKEND_PORT_HOST']  } else { '3010' }

# --- 4) Dựng stack -----------------------------------------------------------
Write-Step "Dung stack container (db, redis, minio, backend, webapp)"
docker compose -f $ComposeFile --env-file $EnvFile up -d
if ($LASTEXITCODE -ne 0) { Write-Err "docker compose up that bai. Xem log phia tren."; exit 1 }
Write-Ok "Container dang khoi dong."

# --- 5) Chờ backend healthy --------------------------------------------------
Write-Step "Cho backend san sang (migration tu chay ben trong container)"
$healthUrl = "http://localhost:$BackendPort/api/v1/health"
$deadline = (Get-Date).AddMinutes(4)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 4
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
  Write-Host "  . cho backend ($healthUrl) ..."
  Start-Sleep -Seconds 5
}
if (-not $ready) {
  Write-Warn "Backend chua tra /health=200 sau 4 phut. Xem: docker compose -f docker-compose.windows.yml logs backend"
} else {
  Write-Ok "Backend da san sang: $healthUrl"
}

# --- 6) Nạp dữ liệu mẫu (chuỗi vàng) ----------------------------------------
if ($NoSeed) {
  Write-Warn "Bo qua nap du lieu mau (-NoSeed)."
} elseif ($ready) {
  Write-Step "Nap du lieu mau 'chuoi vang' (anchor Thanh Hoa) — co the mat vai phut"
  docker compose -f $ComposeFile --env-file $EnvFile exec -T backend npm run seed:chain
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "Seed khong thanh cong (khong chan cai dat). Chay lai sau: seed-demo.bat"
  } else {
    Write-Ok "Da nap du lieu mau."
  }
} else {
  Write-Warn "Bo qua seed vi backend chua san sang. Chay lai sau: seed-demo.bat"
}

# --- 7) Hoàn tất -------------------------------------------------------------
$appUrl = "http://localhost:$FrontendPort"
Write-Host "`n==============================================================" -ForegroundColor Green
Write-Host "  CAI DAT HOAN TAT" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host "  Giao dien:   $appUrl"
Write-Host "  API:         http://localhost:$BackendPort/api/v1"
Write-Host "  Swagger:     http://localhost:$BackendPort/api/v1/docs"
Write-Host ""
Write-Host "  Tai khoan demo (mat khau chung: admin@123):"
Write-Host "    admin / chihuy / hckt / xa01 / kiemduyet"
Write-Host ""
Write-Host "  Khoi dong lai:  start.bat      Dung:  stop.bat"
Write-Host "  Go cai dat:     uninstall.bat"
Write-Host "=============================================================="

if (-not $SkipBrowser) {
  try { Start-Process $appUrl } catch { }
}
