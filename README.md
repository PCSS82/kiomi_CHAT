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

## Llamadas de video (botón 📱)

Cualquier invitado y Kiomi pueden llamarse por video con el botón 📱 del
header. En reposo dice **"OFF"** con fondo naranja; en cuanto hay una
llamada (sonando o en curso) se pone **verde** y parpadea. Al llamar:

- El otro lado ve, sin importar en qué pantalla de la app esté en ese
  momento, una pantalla de llamada entrante con opción de contestar (📹) o
  rechazar (📞), y suena un timbre + vibra (Android; en iPhone no es
  posible vibrar desde una web) mientras la app esté abierta.
- Con la app cerrada, llega como notificación push para avisar que hay
  una llamada — al tocarla se abre la app.
- Requiere la misma configuración de notificaciones push descrita arriba
  para que avise con la app cerrada.
- Queda un registro tipo "📹 Llamada de video · 2:15" (o "perdida",
  "rechazada", "cancelada") en el chat, como en WhatsApp.

**Importante — límite técnico real**: la conexión de video usa solo un
servidor STUN gratuito de Google (sin servidor TURN, que tiene costo). Esto
funciona bien cuando ambos están en la misma WiFi o en muchas redes
móviles, pero en algunas combinaciones de red (datos móviles restrictivos
de los dos lados, por ejemplo) la llamada puede no lograr conectar. Si eso
pasa seguido, se puede agregar un servidor TURN más adelante.

### Videollamada grupal (chat familiar)

En el chat "Familia" el mismo botón 📱 inicia o se une a una **videollamada
grupal**. A diferencia de antes, ahora suena y aparece la pantalla de
llamada entrante **automáticamente para los demás miembros, sin importar
en qué chat/pestaña estén mirando** — igual que una llamada grupal de
WhatsApp — no hace falta estar parado en la pestaña Familia para enterarse.
Cada participante se conecta directo con todos los demás (sin servidor de
video intermedio), así que funciona mejor con 2-4 personas conectadas a la
vez — con más gente el consumo de datos y de batería de cada teléfono sube
bastante, porque cada uno envía su cámara a todos los demás por separado.

- Mientras hay una llamada familiar activa, el botón 📱 se pone **verde y
  parpadea** para todos.
- Con la app cerrada, apenas empieza la llamada llega una notificación push
  a todos los miembros de la familia (menos a quien la inició) para avisar.
- Quien rechaza o cuelga no vuelve a sonarle por esa misma llamada puntual
  (aunque siga activa para los demás) — pero si se corta del todo y alguien
  arranca una llamada nueva, ahí sí vuelve a sonar para todos.
- Cada quien sale con el botón de colgar (📞); cuando se va el último
  participante la llamada se cierra sola.
- Aplican las mismas limitaciones de red (solo STUN) que en las llamadas
  1:1 — con más de 2-3 personas en redes restrictivas, algún par puntual
  puede no lograr conectar entre sí aunque el resto de la llamada funcione.

### Por qué no suena exactamente como una llamada de WhatsApp/FaceTime con la app cerrada

Con el teléfono bloqueado o la app totalmente cerrada, lo máximo que puede
hacer una app web (PWA) es lo que ya hace acá: mandar una notificación push
que vibra y se queda fija en la pantalla hasta que alguien la toca — al
tocarla, recién ahí se abre la app. **No hay forma de que una PWA abra sola
una pantalla de "llamada entrante" a pantalla completa sin que la persona
toque algo primero**, ni de sonar con un tono de llamada real mientras el
teléfono está bloqueado. Eso (CallKit en iPhone, la pantalla de llamada de
Android) es una función exclusiva de apps nativas instaladas desde la
App Store / Play Store — Apple y Google no le dan ese permiso a una app
que se instaló desde el navegador, sin excepción. Si en algún momento hace
falta ese nivel de "suena como llamada de verdad", la única forma real es
convertir la app en una app nativa (con Capacitor/React Native, por
ejemplo) y publicarla en las tiendas — es un proyecto bastante más grande.

### Llamada telefónica de respaldo (opcional, con Twilio)

Como esta app reemplaza al botón de pánico, y una notificación push puede
fallar (celular sin datos, permiso de notificación rechazado, app
desinstalada), se puede agregar una **llamada telefónica real** de
respaldo: cuando alguien llama por video (a Kiomi, a un invitado, o a todo
el grupo familiar), además de la notificación push, cada destinatario
recibe una **llamada de teléfono de verdad** que dice "Fulano te está
llamando en la aplicación de Kiomi Chat, por favor abrí la app para
contestar". Como usa la red del operador (no internet ni el navegador),
suena igual con el celular bloqueado, sin wifi/datos, o con la app
totalmente cerrada — es la opción más confiable que existe sin convertir
la app en una app nativa.

Esto es **opcional y tiene un costo pequeño** (por minuto de llamada, más
un alquiler mensual del número de teléfono que hace la llamada — anotá que
Twilio da algo de crédito gratis para probar, y después es de pago por
uso). Si no se configura, el resto de la app sigue funcionando exactamente
igual, sin errores.

**Configuración** (una sola vez):

1. Creá una cuenta gratis en [twilio.com](https://www.twilio.com/try-twilio).
2. En el panel de Twilio, comprá un **número de teléfono con capacidad de
   voz** (Phone Numbers → Buy a number) — cualquiera con "Voice" habilitado
   sirve, no hace falta que sea de tu país.
3. Copiá tu **Account SID** y tu **Auth Token** de la página principal del
   panel de Twilio (Account → API keys & tokens).
4. Desde la carpeta del repo en tu computadora, guardá las 3 credenciales
   como secretos de Firebase (te va a pedir que pegues cada valor):
   ```bash
   npx firebase-tools functions:secrets:set TWILIO_ACCOUNT_SID
   npx firebase-tools functions:secrets:set TWILIO_AUTH_TOKEN
   npx firebase-tools functions:secrets:set TWILIO_FROM_NUMBER
   ```
   Para `TWILIO_FROM_NUMBER` pegá el número que compraste en el paso 2, en
   formato internacional (ej: `+18885551234`).
5. Volvé a desplegar las funciones para que tomen los secretos nuevos:
   ```bash
   npx firebase-tools deploy --only functions
   ```
6. Abrí la app como Kiomi, tocá el ícono ☎️ arriba a la izquierda del panel
   de conversaciones, y cargá el número de teléfono de cada miembro de la
   familia en formato internacional (ej: `+51987654321` — el `+` y el
   código de país son obligatorios). Se puede dejar vacío el de quien no
   quiera esta función.

**Cuenta de prueba (trial) de Twilio**: mientras no le agregues una tarjeta
a la cuenta de Twilio, solo puede llamar a números que verifiques primero
uno por uno desde el panel de Twilio (Verified Caller IDs) — para que
llame a cualquier número sin verificar antes hace falta pasar la cuenta a
modo pago (cargar saldo).

## Indicadores de lectura en el chat familiar

Cada mensaje del chat familiar muestra 4 puntitos (Koji, Ami, Mamá, Papá):
verde si esa persona ya vio el mensaje, amarillo si todavía no. Se
actualizan en vivo — no hace falta recargar la app.

## Si el número del ícono deja de actualizarse

Si funcionó una vez y después dejó de avisar con la app cerrada, es porque
el navegador seguía usando una versión vieja y cacheada de
`firebase-messaging-sw.js` (sin la corrección de badge que se hizo). Ya se
agregó `skipWaiting()`/`clients.claim()` para que la versión nueva tome el
control enseguida, pero por las dudas: **cerrá completamente la app (o el
navegador) y volvé a abrirla** después de actualizar el código, así el
service worker nuevo se activa del todo.

### Bolita roja / número sin actualizar solo para los invitados (no Kiomi)

Había otra causa distinta, específica de los invitados: la pantalla activa
(la pestaña "Kiomi" o "Familia" que se estuviera mirando) marcaba un
mensaje nuevo como "leído" en el mismo instante en que llegaba —incluso con
la app en segundo plano o el celular bloqueado—, así que la bolita roja y
el número nunca llegaban a aparecer (parecía que "funcionaba una vez y
después no" porque a veces alcanzaba a mostrarse un instante antes de
corregirse solo). Ya se corrigió: ahora solo se marca como leído si la
persona de verdad está mirando la app en ese momento (la pantalla
encendida y esa pestaña al frente); si no, el mensaje queda como no-leído
—con su bolita, su número y su aviso en el ícono de inicio— hasta que
alguien realmente lo abre.

## La barra de escribir tapada por el teclado

En varios celulares Android, al abrir el teclado la barra donde se escribe
el mensaje quedaba tapada — el navegador no achicaba el espacio disponible
de la página cuando aparecía el teclado, así que la barra terminaba
"debajo" de él aunque en el código estuviera pegada al fondo de la
pantalla. Se corrigió con dos cambios que se complementan: se le pide al
navegador que sí achique la página cuando el teclado se abre
(`interactive-widget=resizes-content` en el `<meta viewport>`, la forma
recomendada para Chrome/Android), y además la app escucha directamente el
tamaño real de la pantalla visible (`visualViewport`) para ajustarse sola
incluso en navegadores donde eso no alcance. En iPhone esto ya funcionaba
razonablemente bien antes; estos cambios lo hacen más consistente ahí
también.

## Si el audio no se reproduce en un iPhone

Causa más común: Android graba las notas de voz en formato **WebM/Opus**,
que Safari (iPhone) **no puede reproducir bajo ninguna circunstancia** —
no es un bug, Apple nunca implementó ese formato. Por eso las notas que
manda un Android no suenan en el iPhone, aunque entre Android sí se
escuchen bien. Ya se corrigió: ahora se graba siempre en formato
**MP4/AAC**, que reproducen tanto iPhone como Android. Esto aplica a las
notas de voz grabadas *después* de este cambio — las que ya se enviaron
antes en WebM van a seguir sin sonar en iPhone.

Si después de esto sigue sin sonar (y no aparece ningún error), revisá el
**interruptor de silencio físico** del iPhone (el switch al lado del
volumen) — iOS silencia el audio de las páginas web cuando está activado,
y no hay forma de evitarlo desde el navegador.
