# ============================================================
#  KIOMI CHAT - CONFIGURAR NOTIFICACIONES PUSH
#  Correr donde sea (no hace falta ubicarse en ninguna carpeta antes):
#  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
#  .\configurar_notificaciones.ps1
#
#  Antes de correr este script necesitas tener listos, desde la
#  consola de Firebase (console.firebase.google.com):
#    1. El plan Blaze activado (Configuracion del proyecto ->
#       Uso y facturacion -> Modificar plan -> Blaze).
#    2. Tu clave VAPID (Configuracion del proyecto -> pestaña
#       "Cloud Messaging" -> "Web Push certificates" ->
#       "Generar par de claves").
# ============================================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Kiomi Chat - Notificaciones push"

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Magenta
Write-Host "   🔔  KIOMI CHAT  -  Notificaciones push" -ForegroundColor Magenta
Write-Host "  ============================================" -ForegroundColor Magenta
Write-Host ""

# ---------- 0. Ubicar o descargar el repo ----------
Write-Host "  [1/7] Buscando el repo de Kiomi Chat..." -ForegroundColor Cyan
$repoFolder = Join-Path $env:USERPROFILE "kiomi_CHAT"

if ((Test-Path ".\index.html") -and (Test-Path ".\firebase-messaging-sw.js")) {
    Write-Host "       Ya estás dentro del repo: $(Get-Location)" -ForegroundColor Green
} else {
    if (Test-Path (Join-Path $repoFolder "index.html")) {
        Write-Host "       Usando el repo ya descargado en $repoFolder" -ForegroundColor Green
        if (Test-Path (Join-Path $repoFolder ".git")) {
            Push-Location $repoFolder
            git pull 2>$null
            Pop-Location
        }
    } else {
        Write-Host "       No encontré el repo, lo voy a descargar en $repoFolder..." -ForegroundColor Yellow
        $gitInstalled = Get-Command git -ErrorAction SilentlyContinue
        if (-not $gitInstalled) {
            Write-Host "       Git no está instalado. Intentando instalarlo con winget..." -ForegroundColor Yellow
            try {
                winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
                $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
            } catch {}
            $gitInstalled = Get-Command git -ErrorAction SilentlyContinue
        }
        if (-not $gitInstalled) {
            Write-Host "  ERROR: no se pudo instalar Git automáticamente. Instálalo desde https://git-scm.com/download/win, abre una NUEVA ventana de PowerShell y vuelve a correr este script." -ForegroundColor Red
            exit 1
        }
        git clone https://github.com/PCSS82/kiomi_CHAT.git $repoFolder
    }
    Set-Location $repoFolder
}

if (-not (Test-Path ".\index.html") -or -not (Test-Path ".\firebase-messaging-sw.js")) {
    Write-Host "  ERROR: no se pudo ubicar el repo correctamente en $(Get-Location)." -ForegroundColor Red
    exit 1
}
Write-Host "       Carpeta de trabajo: $(Get-Location)" -ForegroundColor Green

# ---------- 1. Verificar Node.js ----------
Write-Host "  [2/7] Verificando Node.js..." -ForegroundColor Cyan
try {
    $nodeVer = node --version
    Write-Host "       Node.js $nodeVer encontrado ✓" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: no se encontro Node.js. Instalalo desde https://nodejs.org (version 20 o superior) y vuelve a correr este script." -ForegroundColor Red
    exit 1
}

# ---------- 2. Instalar Firebase CLI ----------
Write-Host ""
Write-Host "  [3/7] Verificando Firebase CLI..." -ForegroundColor Cyan
$fbInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $fbInstalled) {
    Write-Host "       Instalando firebase-tools (npm install -g firebase-tools)..." -ForegroundColor Yellow
    npm install -g firebase-tools
    # Refresca el PATH de esta misma ventana para que "firebase" se reconozca
    # sin tener que cerrar y volver a abrir PowerShell.
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    $fbInstalled = Get-Command firebase -ErrorAction SilentlyContinue
    if (-not $fbInstalled) {
        Write-Host "  ERROR: firebase-tools se instaló pero esta ventana de PowerShell no lo detecta todavía." -ForegroundColor Red
        Write-Host "  Cierra esta ventana, abre una NUEVA, entra a la carpeta $(Get-Location) y vuelve a correr este script." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "       Firebase CLI ya esta instalada ✓" -ForegroundColor Green
}

# ---------- 3. Login y elegir proyecto ----------
Write-Host ""
Write-Host "  [4/7] Iniciando sesion en Firebase..." -ForegroundColor Cyan
Write-Host "       Se abrira tu navegador. Usa la cuenta de Google donde creaste el proyecto de Kiomi Chat." -ForegroundColor Gray
firebase login

Write-Host ""
Write-Host "  Elige tu proyecto de Firebase de la lista:" -ForegroundColor Cyan
firebase use --add

# ---------- 4. Pedir clave VAPID y firebaseConfig ----------
Write-Host ""
Write-Host "  [5/7] Configuracion de notificaciones" -ForegroundColor Cyan
Write-Host "       Si todavia no generaste tu clave VAPID: consola de Firebase ->" -ForegroundColor Gray
Write-Host "       Configuracion del proyecto -> pestaña 'Cloud Messaging' ->" -ForegroundColor Gray
Write-Host "       'Web Push certificates' -> 'Generar par de claves'." -ForegroundColor Gray
$vapidKey = Read-Host "  Pega aqui tu clave VAPID"
if ([string]::IsNullOrWhiteSpace($vapidKey)) {
    Write-Host "  ERROR: no se ingreso ninguna clave VAPID." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "       Ahora pega tu firebaseConfig completo (el mismo objeto JSON" -ForegroundColor Gray
Write-Host "       que pegaste al configurar la app la primera vez)." -ForegroundColor Gray
Write-Host '       Ejemplo: {"apiKey":"AIza...","authDomain":"...","databaseURL":"https://...","projectId":"...","messagingSenderId":"...","appId":"..."}' -ForegroundColor DarkGray
$configJson = Read-Host "  Pega aqui tu firebaseConfig (una sola linea)"
try {
    $config = $configJson | ConvertFrom-Json
} catch {
    Write-Host "  ERROR: ese texto no es JSON valido. Copia el objeto completo, incluyendo las llaves { }." -ForegroundColor Red
    exit 1
}
foreach ($field in @("apiKey", "databaseURL", "projectId", "messagingSenderId", "appId")) {
    if (-not $config.$field) {
        Write-Host "  ADVERTENCIA: falta el campo '$field' en tu firebaseConfig; revisa firebase-messaging-sw.js despues si algo no funciona." -ForegroundColor Yellow
    }
}

# ---------- 5. Escribir los archivos ----------
Write-Host ""
Write-Host "  [6/7] Actualizando archivos..." -ForegroundColor Cyan

$indexContent = Get-Content ".\index.html" -Raw
$indexContent = $indexContent.Replace("PEGAR_AQUI_TU_VAPID_KEY_DE_FIREBASE", $vapidKey)
Set-Content ".\index.html" -Value $indexContent -NoNewline
Write-Host "       index.html actualizado ✓" -ForegroundColor Green

$swContent = Get-Content ".\firebase-messaging-sw.js" -Raw
$newConfigBlock = @"
firebase.initializeApp({
  apiKey: "$($config.apiKey)",
  authDomain: "$($config.authDomain)",
  databaseURL: "$($config.databaseURL)",
  projectId: "$($config.projectId)",
  messagingSenderId: "$($config.messagingSenderId)",
  appId: "$($config.appId)"
});
"@
$replacementSafe = $newConfigBlock.Replace('$', '$$')  # escapa los $ literales para -replace
$swContent = $swContent -replace '(?s)firebase\.initializeApp\(\{.*?\}\);', $replacementSafe
Set-Content ".\firebase-messaging-sw.js" -Value $swContent -NoNewline
Write-Host "       firebase-messaging-sw.js actualizado ✓" -ForegroundColor Green
Write-Host "       (revisa este archivo para confirmar que quedo bien escrito)" -ForegroundColor Gray

# ---------- 6. Desplegar la funcion ----------
Write-Host ""
Write-Host "  [7/7] Desplegando la funcion de notificaciones..." -ForegroundColor Cyan
Push-Location functions
npm install
Pop-Location
firebase deploy --only functions

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "   ✓ Listo" -ForegroundColor Green
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Revisa los cambios con 'git diff' y, si se ven bien, subelos:" -ForegroundColor Cyan
Write-Host "    git add index.html firebase-messaging-sw.js" -ForegroundColor White
Write-Host "    git commit -m 'chore: configurar notificaciones push'" -ForegroundColor White
Write-Host "    git push" -ForegroundColor White
Write-Host "  (si git push pide usuario/contraseña, necesitas iniciar sesion con tu" -ForegroundColor Gray
Write-Host "   cuenta de GitHub o un token de acceso personal)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Despues, en cada celular basta con abrir la app: el permiso de" -ForegroundColor Cyan
Write-Host "  notificaciones se pide automaticamente la primera vez." -ForegroundColor Cyan
