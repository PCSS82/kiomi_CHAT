const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database');
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

  const bodyText = msg.type === 'image' ? '📷 Imagen'
    : msg.type === 'audio' ? '🎤 Nota de voz'
    : msg.type === 'call' ? '📹 ' + (msg.text || 'Llamada de video')
    : (msg.text || '');
  const title = convId === '__family__' ? `${msg.from} (Familia)` : msg.from;

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
      data: { badge: String(unread), convId: String(convId) },
      webpush: { notification: { icon: 'public/icons/kiomi_icon.png' } },
    });

    // Limpia tokens que ya no son válidos (app desinstalada, permiso revocado, etc.)
    const invalid = [];
    resp.responses.forEach((r, i) => { if (!r.success) invalid.push(tokens[i]); });
    if (invalid.length) {
      await Promise.all(invalid.map((t) => db.ref(`fcmTokens/${userKey}/${t}`).remove()));
    }
  }));
});

// Avisa con push cuando entra una llamada de video nueva, para que suene
// aunque la app esté cerrada o en segundo plano (webRTC en sí solo puede
// negociar mientras la app está abierta — esto solo hace sonar el timbre).
exports.onIncomingCall = onValueWritten('/calls/{pairKey}', async (event) => {
  const after = event.data.after.val();
  if (!after || after.status !== 'ringing') return;
  const before = event.data.before.val();
  if (before && before.status === 'ringing') return; // ya se avisó de esta llamada

  const db = getDatabase();
  const tokensSnap = await db.ref(`fcmTokens/${after.to}`).once('value');
  const tokens = Object.keys(tokensSnap.val() || {});
  if (!tokens.length) return;

  const resp = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title: `📹 Llamada de ${after.from}`, body: 'Toca para contestar' },
    data: { type: 'call', from: String(after.from) },
    webpush: {
      notification: {
        icon: 'public/icons/kiomi_icon.png',
        requireInteraction: true,
        vibrate: [500, 300, 500, 300, 500, 300, 500],
      },
    },
  });

  const invalid = [];
  resp.responses.forEach((r, i) => { if (!r.success) invalid.push(tokens[i]); });
  if (invalid.length) {
    await Promise.all(invalid.map((t) => db.ref(`fcmTokens/${after.to}/${t}`).remove()));
  }
});

// Avisa a toda la familia cuando alguien inicia una videollamada grupal,
// para que suene aunque tengan la app cerrada (igual que onIncomingCall,
// pero notifica a todos los miembros salvo a quien la inició).
exports.onFamilyCallStart = onValueWritten('/calls/family', async (event) => {
  const after = event.data.after.val();
  if (!after || !after.active) return;
  const before = event.data.before.val();
  if (before && before.active) return; // ya se avisó de esta llamada

  const db = getDatabase();
  const recipients = FAMILY_MEMBERS.filter((n) => n !== after.startedBy);

  await Promise.all(recipients.map(async (userKey) => {
    const tokensSnap = await db.ref(`fcmTokens/${userKey}`).once('value');
    const tokens = Object.keys(tokensSnap.val() || {});
    if (!tokens.length) return;

    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: '📹 Videollamada familiar', body: `${after.startedBy} inició una llamada` },
      data: { type: 'call', from: String(after.startedBy) },
      webpush: {
        notification: {
          icon: 'public/icons/kiomi_icon.png',
          requireInteraction: true,
          vibrate: [500, 300, 500, 300, 500, 300, 500],
        },
      },
    });

    const invalid = [];
    resp.responses.forEach((r, i) => { if (!r.success) invalid.push(tokens[i]); });
    if (invalid.length) {
      await Promise.all(invalid.map((t) => db.ref(`fcmTokens/${userKey}/${t}`).remove()));
    }
  }));
});
