# 🌸 Kiomi Chat

Chat seguro por WiFi para niños, inspirado en WhatsApp. Solo texto. Todas las conversaciones se guardan automáticamente en GitHub como archivos CSV.

## Características
- Chat en tiempo real por red local (WiFi)
- Interfaz estilo WhatsApp con burbujas de chat
- Múltiples salas de chat
- Reacciones a mensajes con emojis
- Responder mensajes (reply)
- Indicador de "está escribiendo..."
- Filtro automático de palabras inapropiadas
- Panel de usuarios en línea
- Avatares y colores personalizados
- Control parental: contraseña de admin para eliminar mensajes
- **Guardado automático de conversaciones en GitHub (CSV)**

## Instalación

```bash
npm install
npm start
```

## Configuración de GitHub (guardar conversaciones)

Para que las conversaciones se guarden en GitHub, necesitas un **Personal Access Token**:

1. Ve a https://github.com/settings/tokens → "Generate new token (classic)"
2. Dale permisos: `repo` (acceso completo al repositorio)
3. Copia el token generado
4. Crea un archivo `.env` en la raíz del proyecto:

```
GITHUB_TOKEN=ghp_TuTokenAqui
GITHUB_OWNER=PCSS82
GITHUB_REPO=kiomi_CHAT
ADMIN_PASS=tuContraseñaAdmin
PORT=3000
```

Las conversaciones se guardan en `conversations/kiomi_chat_YYYY-MM-DD.csv` en la rama `main`.

## Uso en red local (WiFi)
1. Ejecuta `npm start` en la computadora servidor
2. Encuentra la IP local: en Windows `ipconfig`, en Mac/Linux `ifconfig`  
   Ejemplo: `192.168.1.10`
3. En cada dispositivo abre el navegador y escribe: `http://192.168.1.10:3000`
4. ¡Listo! Todos en la misma WiFi pueden chatear

## Formato del CSV

```
timestamp,sala,usuario,mensaje
2024-01-15T14:30:00.000Z,General,Kiomi,Hola mamá!
2024-01-15T14:30:05.000Z,General,Mamá,Hola hija!
```

## Variables de entorno

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `ADMIN_PASS` | Contraseña de administrador | `kiomi2024` |
| `GITHUB_TOKEN` | Token de GitHub para guardar CSV | *(requerido para sync)* |
| `GITHUB_OWNER` | Usuario/organización de GitHub | `PCSS82` |
| `GITHUB_REPO` | Nombre del repositorio | `kiomi_CHAT` |

## Seguridad
- Solo texto — sin fotos, videos ni audio
- Filtra palabras inapropiadas automáticamente
- Sin registro de email
- Red local WiFi únicamente
- Conversaciones archivadas en GitHub para supervisión parental

## Notificaciones push (app instalada — `index.html` + Firebase)

La app instalada (PWA en GitHub Pages) puede avisar con una notificación —
como WhatsApp— y mostrar el número de mensajes sin leer en el ícono,
incluso con el teléfono bloqueado o la app cerrada. Esto necesita un poco
de configuración que solo tú puedes hacer, porque requiere acceso a tu
propio proyecto de Firebase.

**Atajo con PowerShell (Windows)**: si ya tienes tu plan Blaze activado y
tu clave VAPID generada (pasos 1 y 2 de abajo, son de la consola de
Firebase y no se pueden automatizar), corre `.\configurar_notificaciones.ps1`
desde la raíz del repo — instala la Firebase CLI si falta, inicia sesión,
pega tu clave VAPID y tu `firebaseConfig` en los archivos correctos, y
despliega la función. Si prefieres hacerlo a mano, sigue estos pasos:

1. **Activa el plan Blaze (pago por uso)** en tu proyecto: consola de
   Firebase → ⚙️ Configuración del proyecto → Uso y facturación → Modificar
   plan → Blaze. Es necesario para poder usar Cloud Functions — el gasto
   real de una app familiar como esta normalmente cae dentro de la capa
   gratuita incluida en Blaze, pero Google igual pide vincular una tarjeta.
2. **Genera tu clave VAPID**: consola de Firebase → ⚙️ Configuración del
   proyecto → pestaña "Cloud Messaging" → sección "Web Push certificates" →
   "Generar par de claves". Copia la clave.
3. Pega esa clave en `index.html`, en la constante `FCM_VAPID_KEY` (al
   inicio del `<script>`, reemplaza `'PEGAR_AQUI_TU_VAPID_KEY_DE_FIREBASE'`).
4. Abre `firebase-messaging-sw.js` y pega ahí el mismo objeto
   `firebaseConfig` que ya usaste al configurar la app la primera vez
   (pantalla "Configuración inicial"). Un service worker no puede leer el
   `localStorage` de la página, así que necesita su propia copia.
5. Instala la CLI de Firebase y despliega la función que envía las
   notificaciones:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add          # elige tu proyecto de Firebase
   firebase deploy --only functions
   ```
6. Sube los cambios (`index.html`, `firebase-messaging-sw.js`) a GitHub
   Pages como siempre.
7. En cada celular, la primera vez que alguien entra al chat la app pide
   el permiso de notificaciones automáticamente (no hace falta tocar
   ningún botón). Solo hay que aceptar el aviso del navegador. Si alguien
   lo rechaza sin querer, tendrá que activarlo desde los ajustes de
   notificaciones del navegador para ese sitio.

**Nota sobre iPhone**: Apple solo permite notificaciones push a páginas
web si están instaladas en la pantalla de inicio (no funciona en una
pestaña normal de Safari) y requiere iOS 16.4 o superior.

## Botón de pánico (solo Kiomi)

Kiomi tiene un botón 🚨 en la parte superior de cada chat (individual o
familiar). Al tocarlo, pide confirmación y envía una alerta al chat activo:

- El celular que la recibe **vibra** (funciona en Android; en iPhone no es
  posible vibrar desde una página web, es una limitación de Apple) y
  **suena una sirena** mientras la app esté abierta.
- Con la app cerrada, llega como una notificación push normal marcada como
  urgente — usa el mismo sonido de notificación del sistema (los
  navegadores no permiten reproducir un sonido personalizado si la app
  está cerrada).
- Requiere la misma configuración de notificaciones push descrita arriba.

## Si el audio no se reproduce en un iPhone

Si al tocar ▶️ en una nota de voz no suena nada (y no aparece ningún error),
lo más probable es que el **interruptor de silencio físico** del iPhone
(el switch al lado del volumen) esté activado. iOS silencia el audio de
las páginas web cuando ese interruptor está en modo silencio, y no hay
forma de evitarlo desde el navegador — es una restricción de Apple.
Revisa ese interruptor primero. Grabar audio sí funciona incluso con el
interruptor en silencio, por eso puede parecer que "solo grabar funciona".
