# 🌸 Kiomi Chat

Chat seguro por WiFi para niños, inspirado en WhatsApp.

## Características
- Chat en tiempo real por red local (WiFi) — sin necesidad de internet
- Interfaz estilo WhatsApp con burbujas de chat
- Múltiples salas de chat
- Reacciones a mensajes con emojis
- Responder mensajes (reply)
- Indicador de "está escribiendo..."
- Filtro automático de palabras inapropiadas
- Panel de usuarios en línea
- Avatares y colores personalizados
- Control parental: contraseña de admin para eliminar mensajes

## Instalación

```bash
npm install
npm start
```

## Uso en red local (WiFi)
1. Ejecuta `npm start` en la computadora que actuará de servidor
2. Encuentra la IP local del servidor (ej: `192.168.1.10`)
3. En cada dispositivo (tablet, teléfono, otra PC) abre el navegador y escribe: `http://192.168.1.10:3000`
4. ¡Listo! Todos en la misma red WiFi pueden chatear

## Variables de entorno
- `PORT`: Puerto del servidor (default: 3000)
- `ADMIN_PASS`: Contraseña del panel de administración (default: `kiomi2024`)

## Seguridad
- Filtra palabras inapropiadas automáticamente
- Sin registro de email — solo nombre de usuario
- Los datos viven en memoria (se resetean al reiniciar)
- Red local únicamente, sin exposición a internet
