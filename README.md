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
