# ============================================================
#  KIOMI CHAT - CONFIGURAR NOTIFICACIONES PUSH
#  Ejecutar desde la carpeta raiz del repo (donde esta index.html):
#  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
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

# ---------- 0. Verificar que estamos en la carpeta correcta ----------
if (-not (Test-Path ".\index.html") -or -not (Test-Path ".\firebase-messaging-sw.js")) {
    Write-Host "  ERROR: corre este script desde la carpeta raiz del repo kiomi_CHAT (donde esta index.html)." -ForegroundColor Red
    exit 1
}

# ---------- 1. Verificar Node.js ----------
Write-Host "  [1/6] Verificando Node.js..." -ForegroundColor Cyan
try {
    $nodeVer = node --version
    Write-Host "       Node.js $nodeVer encontrado ✓" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: no se encontro Node.js. Instalalo desde https://nodejs.org (version 20 o superior) y vuelve a correr este script." -ForegroundColor Red
    exit 1
}

# ---------- 2. Instalar Firebase CLI ----------
Write-Host ""
Write-Host "  [2/6] Verificando Firebase CLI..." -ForegroundColor Cyan
$fbInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $fbInstalled) {
    Write-Host "       Instalando firebase-tools (npm install -g firebase-tools)..." -ForegroundColor Yellow
    npm install -g firebase-tools
} else {
    Write-Host "       Firebase CLI ya esta instalada ✓" -ForegroundColor Green
}

# ---------- 3. Login y elegir proyecto ----------
Write-Host ""
Write-Host "  [3/6] Iniciando sesion en Firebase..." -ForegroundColor Cyan
Write-Host "       Se abrira tu navegador. Usa la cuenta de Google donde creaste el proyecto de Kiomi Chat." -ForegroundColor Gray
firebase login

Write-Host ""
Write-Host "  Elige tu proyecto de Firebase de la lista:" -ForegroundColor Cyan
firebase use --add

# ---------- 4. Pedir clave VAPID y firebaseConfig ----------
Write-Host ""
Write-Host "  [4/6] Configuracion de notificaciones" -ForegroundColor Cyan
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
Write-Host "  [5/6] Actualizando archivos..." -ForegroundColor Cyan

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
Write-Host "  [6/6] Desplegando la funcion de notificaciones..." -ForegroundColor Cyan
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
Write-Host ""
Write-Host "  Despues, en cada celular: abre la app y toca el icono 🔔 una vez" -ForegroundColor Cyan
Write-Host "  para activar las notificaciones en ese dispositivo." -ForegroundColor Cyan
