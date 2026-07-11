# ============================================================
#  KIOMI CHAT - INSTALADOR AUTOMATICO
#  Ejecutar en PowerShell como Administrador:
#  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#  .\instalar_kiomi.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Kiomi Chat - Instalador"

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Magenta
Write-Host "   🌸  KIOMI CHAT  -  Instalador Automático" -ForegroundColor Magenta
Write-Host "  ============================================" -ForegroundColor Magenta
Write-Host ""

# ---------- 1. Verificar / instalar Node.js ----------
Write-Host "  [1/5] Verificando Node.js..." -ForegroundColor Cyan
$nodeOk = $false
try {
    $nodeVer = node --version 2>$null
    if ($nodeVer) { $nodeOk = $true; Write-Host "       Node.js $nodeVer encontrado ✓" -ForegroundColor Green }
} catch {}

if (-not $nodeOk) {
    Write-Host "       Node.js no encontrado. Descargando instalador..." -ForegroundColor Yellow
    $nodeInstaller = "$env:TEMP\node_installer.msi"
    $nodeUrl = "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
    Start-Process msiexec.exe -Wait -ArgumentList "/I `"$nodeInstaller`" /quiet /norestart"
    Remove-Item $nodeInstaller -Force
    # Recargar PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    Write-Host "       Node.js instalado ✓" -ForegroundColor Green
}

# ---------- 2. Descargar / actualizar el repositorio ----------
Write-Host ""
Write-Host "  [2/5] Descargando Kiomi Chat..." -ForegroundColor Cyan

$appDir = "$env:USERPROFILE\KiomiChat"

if (Test-Path "$appDir\.git") {
    Write-Host "       Actualizando versión existente..." -ForegroundColor Yellow
    Push-Location $appDir
    git pull origin main --quiet
    Pop-Location
} else {
    if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
    git clone https://github.com/PCSS82/kiomi_CHAT.git $appDir --quiet
}
Write-Host "       Archivos listos en $appDir ✓" -ForegroundColor Green

# ---------- 3. Configurar .env ----------
Write-Host ""
Write-Host "  [3/5] Configuracion de GitHub (para guardar conversaciones)" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Necesitas un token de GitHub para guardar las conversaciones." -ForegroundColor White
Write-Host "  Sigue estos pasos:" -ForegroundColor White
Write-Host "    1. Abre este enlace: https://github.com/settings/tokens" -ForegroundColor Yellow
Write-Host "    2. Clic en 'Generate new token (classic)'" -ForegroundColor Yellow
Write-Host "    3. En 'Note' escribe: KiomiChat" -ForegroundColor Yellow
Write-Host "    4. Marca la casilla 'repo' (primera del listado)" -ForegroundColor Yellow
Write-Host "    5. Clic en 'Generate token' (boton verde al final)" -ForegroundColor Yellow
Write-Host "    6. COPIA el token que aparece (empieza con ghp_)" -ForegroundColor Yellow
Write-Host ""

$envFile = "$appDir\.env"
$existingToken = ""
if (Test-Path $envFile) {
    $existingContent = Get-Content $envFile -Raw
    if ($existingContent -match "GITHUB_TOKEN=(.+)") { $existingToken = $matches[1].Trim() }
}

if ($existingToken -and $existingToken -ne "ghp_TuTokenAqui") {
    Write-Host "  Token existente encontrado. ¿Quieres cambiarlo? (s/n): " -ForegroundColor Yellow -NoNewline
    $cambiar = Read-Host
    if ($cambiar -ne "s") {
        $token = $existingToken
        Write-Host "       Manteniendo token existente ✓" -ForegroundColor Green
    } else { $token = "" }
} else { $token = "" }

if (-not $token) {
    Write-Host "  Pega tu token de GitHub (o Enter para saltar): " -ForegroundColor Cyan -NoNewline
    $token = Read-Host
    if (-not $token) {
        $token = "SIN_TOKEN"
        Write-Host "       Sin token — los mensajes NO se guardarán en GitHub" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  Contraseña de administrador (para borrar mensajes): " -ForegroundColor Cyan -NoNewline
$adminPass = Read-Host
if (-not $adminPass) { $adminPass = "kiomi2024" }

$envContent = @"
PORT=3000
ADMIN_PASS=$adminPass
GITHUB_TOKEN=$token
GITHUB_OWNER=PCSS82
GITHUB_REPO=kiomi_CHAT
"@
Set-Content -Path $envFile -Value $envContent -Encoding UTF8
Write-Host "       Configuracion guardada ✓" -ForegroundColor Green

# ---------- 4. Instalar dependencias npm ----------
Write-Host ""
Write-Host "  [4/5] Instalando dependencias..." -ForegroundColor Cyan
Push-Location $appDir
npm install --quiet 2>&1 | Out-Null
Pop-Location
Write-Host "       Dependencias instaladas ✓" -ForegroundColor Green

# ---------- 5. Obtener IP local y arrancar ----------
Write-Host ""
Write-Host "  [5/5] Iniciando Kiomi Chat..." -ForegroundColor Cyan

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and
    $_.InterfaceAlias -notlike "*WSL*" -and
    $_.IPAddress -notlike "169.*"
} | Select-Object -First 1).IPAddress

if (-not $ip) { $ip = "TU-IP-LOCAL" }

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "   🌸  KIOMI CHAT LISTO!" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  En esta computadora:" -ForegroundColor White
Write-Host "    http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "  En el celular / tablet (misma WiFi):" -ForegroundColor White
Write-Host "    http://$ip`:3000" -ForegroundColor Yellow -BackgroundColor DarkGreen
Write-Host ""
Write-Host "  En el celular, despues de abrir el link:" -ForegroundColor White
Write-Host "    Android: Menu (3 puntos) → 'Agregar a pantalla de inicio'" -ForegroundColor Cyan
Write-Host "    iPhone:  Boton Compartir → 'Añadir a pantalla de inicio'" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener el servidor." -ForegroundColor Gray
Write-Host ""

# Abrir navegador automáticamente
Start-Process "http://localhost:3000"

# Arrancar servidor
Push-Location $appDir
node server.js
Pop-Location
