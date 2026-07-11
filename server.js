const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Configuración ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'PCSS82';
const GITHUB_REPO  = process.env.GITHUB_REPO  || 'kiomi_CHAT';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // sincronizar cada 5 minutos

// --- Estado en memoria ---
const users    = new Map(); // id -> { id, username, avatar, color, socketId, online }
const rooms    = new Map(); // id -> { id, name, members: Set<userId>, messages: [] }
const sessions = new Map(); // socketId -> userId
const adminPassword = bcrypt.hashSync(process.env.ADMIN_PASS || 'kiomi2024', 10);

// Buffer de mensajes pendientes de sincronizar con GitHub
const pendingLog = [];

// Palabras bloqueadas
const BLOCKED_WORDS = [
  'odio','muere','idiota','estupido','imbecil','maldito',
  'hate','kill','die','stupid','idiot',
];

function filterMessage(text) {
  let filtered = text;
  for (const word of BLOCKED_WORDS) {
    const re = new RegExp(word, 'gi');
    filtered = filtered.replace(re, '***');
  }
  return filtered;
}

// Sala global
const globalRoom = { id: 'global', name: 'General', members: new Set(), messages: [] };
rooms.set('global', globalRoom);

/* ================================================================
   GITHUB CSV SYNC
   ================================================================ */

function escapeCsv(val) {
  const s = String(val == null ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function githubRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      path: urlPath,
      method,
      headers: {
        'User-Agent': 'kiomi-chat/1.0',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function syncToGitHub() {
  if (!GITHUB_TOKEN) {
    if (pendingLog.length > 0) {
      console.log('[CSV] GITHUB_TOKEN no configurado — mensajes no se guardarán en GitHub');
    }
    return;
  }
  if (pendingLog.length === 0) return;

  const snapshot = pendingLog.splice(0, pendingLog.length);
  const today = new Date().toISOString().split('T')[0];
  const filePath = `conversations/kiomi_chat_${today}.csv`;
  const apiPath = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

  try {
    // Obtener SHA y contenido existente
    let sha = null;
    let base = 'timestamp,sala,usuario,mensaje\n';
    const existing = await githubRequest('GET', apiPath);
    if (existing && existing.sha) {
      sha = existing.sha;
      base = Buffer.from(existing.content, 'base64').toString('utf8');
    }

    const newLines = snapshot.map(m =>
      [escapeCsv(m.timestamp), escapeCsv(m.room), escapeCsv(m.username), escapeCsv(m.text)].join(',')
    ).join('\n') + '\n';

    const updatedContent = base + newLines;

    const putBody = {
      message: `chat: sync conversaciones ${today} (${snapshot.length} mensajes)`,
      content: Buffer.from(updatedContent).toString('base64'),
      branch: 'main',
    };
    if (sha) putBody.sha = sha;

    const result = await githubRequest('PUT', apiPath, putBody);
    if (result && result.content) {
      lastSyncTime = new Date().toISOString();
      console.log(`[CSV] ${snapshot.length} mensajes guardados en GitHub → ${filePath}`);
    } else {
      console.error('[CSV] Error al guardar en GitHub:', JSON.stringify(result).slice(0, 200));
      // Devolver al buffer para reintentar
      pendingLog.unshift(...snapshot);
    }
  } catch (err) {
    console.error('[CSV] Error de red:', err.message);
    pendingLog.unshift(...snapshot);
  }
}

// Sincronizar periódicamente
setInterval(syncToGitHub, SYNC_INTERVAL_MS);

// Sincronizar al cerrar el servidor
process.on('SIGTERM', async () => { await syncToGitHub(); process.exit(0); });
process.on('SIGINT',  async () => { await syncToGitHub(); process.exit(0); });

/* ================================================================
   API REST
   ================================================================ */

app.post('/api/register', (req, res) => {
  const { username, avatar, color } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Nombre muy corto' });
  }
  const existing = [...users.values()].find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'Ese nombre ya está en uso' });
  const id = uuidv4();
  const user = { id, username: username.trim(), avatar: avatar || '😊', color: color || '#25D366', online: false, socketId: null };
  users.set(id, user);
  res.json({ userId: id, user });
});

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  const user = [...users.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ userId: user.id, user });
});

app.get('/api/users', (req, res) => {
  res.json([...users.values()].map(u => ({
    id: u.id, username: u.username, avatar: u.avatar, color: u.color, online: u.online,
  })));
});

app.get('/api/rooms', (req, res) => {
  res.json([...rooms.values()].map(r => ({
    id: r.id, name: r.name, memberCount: r.members.size,
  })));
});

app.post('/api/rooms', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Nombre inválido' });
  const id = uuidv4();
  const room = { id, name: name.trim(), members: new Set(), messages: [] };
  rooms.set(id, room);
  io.emit('room:created', { id, name: room.name, memberCount: 0 });
  res.json({ roomId: id, room: { id, name: room.name } });
});

// Estado de sincronización (para el cliente)
let lastSyncTime = null;
app.get('/api/sync-status', (req, res) => {
  res.json({
    githubConfigured: !!GITHUB_TOKEN,
    lastSync: lastSyncTime,
    pending: pendingLog.length,
  });
});

// Forzar sincronización manual (para testing)
app.post('/api/admin/sync', async (req, res) => {
  const { password } = req.body;
  if (!bcrypt.compareSync(password, adminPassword)) {
    return res.status(403).json({ error: 'Contraseña incorrecta' });
  }
  await syncToGitHub();
  res.json({ ok: true, pending: pendingLog.length });
});

// Admin: eliminar mensaje
app.delete('/api/admin/message', (req, res) => {
  const { password, roomId, messageId } = req.body;
  if (!bcrypt.compareSync(password, adminPassword)) {
    return res.status(403).json({ error: 'Contraseña incorrecta' });
  }
  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  const idx = room.messages.findIndex(m => m.id === messageId);
  if (idx === -1) return res.status(404).json({ error: 'Mensaje no encontrado' });
  room.messages.splice(idx, 1);
  io.to(roomId).emit('message:deleted', { roomId, messageId });
  res.json({ ok: true });
});

/* ================================================================
   SOCKET.IO
   ================================================================ */

io.on('connection', (socket) => {

  socket.on('user:join', ({ userId, roomId = 'global' }) => {
    const user = users.get(userId);
    if (!user) return socket.emit('error', { message: 'Usuario no válido' });

    if (user.socketId && user.socketId !== socket.id) {
      const old = io.sockets.sockets.get(user.socketId);
      if (old) old.disconnect(true);
    }

    user.online = true;
    user.socketId = socket.id;
    sessions.set(socket.id, userId);

    socket.join(roomId);
    const room = rooms.get(roomId) || globalRoom;
    room.members.add(userId);

    socket.emit('history', { roomId, messages: room.messages.slice(-100) });
    io.emit('user:status', { userId, online: true, username: user.username, avatar: user.avatar, color: user.color });
    socket.emit('joined', { roomId, room: { id: room.id, name: room.name } });
  });

  socket.on('room:join', ({ roomId }) => {
    const userId = sessions.get(socket.id);
    if (!userId) return;
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', { message: 'Sala no existe' });
    socket.join(roomId);
    room.members.add(userId);
    socket.emit('history', { roomId, messages: room.messages.slice(-100) });
  });

  socket.on('message:send', ({ roomId, text, replyTo }) => {
    const userId = sessions.get(socket.id);
    const user = users.get(userId);
    if (!user || !text || !text.trim()) return;

    const filtered = filterMessage(text.trim());
    const msg = {
      id: uuidv4(),
      roomId,
      userId,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
      text: filtered,
      replyTo: replyTo || null,
      timestamp: Date.now(),
    };

    const room = rooms.get(roomId) || globalRoom;
    room.messages.push(msg);
    if (room.messages.length > 500) room.messages.shift();

    // Agregar al buffer CSV
    pendingLog.push({
      timestamp: new Date(msg.timestamp).toISOString(),
      room: room.name,
      username: msg.username,
      text: filtered,
    });

    io.to(roomId).emit('message:new', msg);
  });

  socket.on('typing:start', ({ roomId }) => {
    const userId = sessions.get(socket.id);
    const user = users.get(userId);
    if (!user) return;
    socket.to(roomId).emit('typing:update', { userId, username: user.username, typing: true });
  });

  socket.on('typing:stop', ({ roomId }) => {
    const userId = sessions.get(socket.id);
    if (!userId) return;
    socket.to(roomId).emit('typing:update', { userId, typing: false });
  });

  socket.on('message:react', ({ roomId, messageId, emoji }) => {
    const userId = sessions.get(socket.id);
    if (!userId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = room.messages.find(m => m.id === messageId);
    if (!msg) return;
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[emoji]) msg.reactions[emoji] = new Set();
    const set = msg.reactions[emoji];
    if (set.has(userId)) set.delete(userId); else set.add(userId);
    const reactions = {};
    for (const [em, s] of Object.entries(msg.reactions)) reactions[em] = s.size;
    io.to(roomId).emit('message:reaction', { messageId, reactions });
  });

  socket.on('disconnect', () => {
    const userId = sessions.get(socket.id);
    if (!userId) return;
    sessions.delete(socket.id);
    const user = users.get(userId);
    if (user && user.socketId === socket.id) {
      user.online = false;
      user.socketId = null;
      io.emit('user:status', { userId, online: false });
    }
    for (const room of rooms.values()) room.members.delete(userId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌸 Kiomi Chat corriendo en http://0.0.0.0:${PORT}`);
  if (!GITHUB_TOKEN) {
    console.warn('⚠️  GITHUB_TOKEN no configurado — las conversaciones NO se guardarán en GitHub');
  } else {
    console.log(`📄 Conversaciones se guardarán en GitHub → ${GITHUB_OWNER}/${GITHUB_REPO}/conversations/`);
  }
});
