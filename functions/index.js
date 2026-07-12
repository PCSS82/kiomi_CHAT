const { onValueCreated } = require('firebase-functions/v2/database');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

// Debe coincidir con FAMILY_MEMBERS (normalizado) en index.html
const FAMILY_MEMBERS = ['Kiomi', 'Koji', 'Ami', 'Mamá', 'Papá'];

// Suma los mensajes no leídos de un usuario en todas sus conversaciones,
// usando el mismo criterio que ya usa el cliente (from!==yo && ts>lastSeen).
async function computeUnread(db, userKey) {
  const isKiomi = userKey === 'Kiomi';
  const [lastSeenSnap, convsSnap] = await Promise.all([
    db.ref(`lastSeen/${userKey}`).once('value'),
    db.ref('conversations').once('value'),
  ]);
  const lastSeenMap = lastSeenSnap.val() || {};
  const convs = convsSnap.val() || {};
  let total = 0;
  for (const [convId, convData] of Object.entries(convs)) {
    if (!isKiomi && convId !== userKey && convId !== '__family__') continue;
    const lastSeen = lastSeenMap[convId] || 0;
    const msgs = (convData || {}).messages || {};
    for (const m of Object.values(msgs)) {
      if (m.from !== userKey && m.ts > lastSeen) total++;
    }
  }
  return total;
}

exports.onNewMessage = onValueCreated('/conversations/{convId}/messages/{msgId}', async (event) => {
  const msg = event.data.val();
  const convId = event.params.convId;
  const db = getDatabase();

  const recipients = convId === '__family__'
    ? FAMILY_MEMBERS.filter((n) => n !== msg.from)
    : [msg.from === 'Kiomi' ? convId : 'Kiomi'];

  const isPanic     = msg.type === 'panic';
  const isPanicStop = msg.type === 'panic_stop';
  const bodyText = isPanic ? '🚨 Toca para abrir el chat'
    : isPanicStop ? '🔕 La alarma se detuvo'
    : msg.type === 'image' ? '📷 Imagen'
    : msg.type === 'audio' ? '🎤 Nota de voz'
    : (msg.text || '');
  const title = isPanic ? `🚨 ALERTA DE ${msg.from.toUpperCase()}`
    : isPanicStop ? 'Kiomi Chat'
    : (convId === '__family__' ? `${msg.from} (Familia)` : msg.from);

  await Promise.all(recipients.map(async (userKey) => {
    const [tokensSnap, unread] = await Promise.all([
      db.ref(`fcmTokens/${userKey}`).once('value'),
      computeUnread(db, userKey),
    ]);
    const tokens = Object.keys(tokensSnap.val() || {});
    if (!tokens.length) return;

    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body: bodyText },
      data: {
        badge: String(unread),
        convId: String(convId),
        alarm: isPanic ? '1' : (isPanicStop ? 'stop' : '0'),
      },
      webpush: {
        notification: {
          icon: 'public/icons/kiomi_icon.png',
          ...(isPanic ? { requireInteraction: true, vibrate: [400, 200, 400, 200, 400, 200, 400] } : {}),
        },
      },
    });

    // Limpia tokens que ya no son válidos (app desinstalada, permiso revocado, etc.)
    const invalid = [];
    resp.responses.forEach((r, i) => { if (!r.success) invalid.push(tokens[i]); });
    if (invalid.length) {
      await Promise.all(invalid.map((t) => db.ref(`fcmTokens/${userKey}/${t}`).remove()));
    }
  }));
});
