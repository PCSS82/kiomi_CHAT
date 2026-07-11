const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Estado en memoria ---
const users = new Map();       // id -> { id, username, avatar, color, socketId, online }
const rooms = new Map();       // id -> { id, name, members: Set<userId>, messages: [] }
const sessions = new Map();    // socketId -> userId
const adminPassword = bcrypt.hashSync(process.env.ADMIN_PASS || 'kiomi2024', 10);

// Palabras bloqueadas (filtro básico de contenido)
const BLOCKED_WORDS = [
  'odio', 'muere', 'idiota', 'estupido', 'imbecil', 'maldito',
  'hate', 'kill', 'die', 'stupid', 'idiot',
];

function filterMessage(text) {
  let filtered = text;
  for (const word of BLOCKED_WORDS) {
    const re = new RegExp(word, 'gi');
    filtered = filtered.replace(re, '***');
  }
  return filtered;
}

// Sala global por defecto
const globalRoom = { id: 'global', name: 'General', members: new Set(), messages: [] };
rooms.set('global', globalRoom);

// --- API REST ---
app.post('/api/register', (req, res) => {
  const { username, avatar, color } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'Nombre muy corto' });
  }
  const existing = [...users.values()].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Ese nombre ya está en uso' });
  }
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
  const list = [...users.values()].map(u => ({
    id: u.id, username: u.username, avatar: u.avatar, color: u.color, online: u.online,
  }));
  res.json(list);
});

app.get('/api/rooms', (req, res) => {
  const list = [...rooms.values()].map(r => ({
    id: r.id, name: r.name, memberCount: r.members.size,
  }));
  res.json(list);
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

// --- Socket.IO ---
io.on('connection', (socket) => {

  socket.on('user:join', ({ userId, roomId = 'global' }) => {
    const user = users.get(userId);
    if (!user) return socket.emit('error', { message: 'Usuario no válido' });

    // Desconectar sesión anterior si existe
    if (user.socketId && user.socketId !== socket.id) {
      const oldSocket = io.sockets.sockets.get(user.socketId);
      if (oldSocket) oldSocket.disconnect(true);
    }

    user.online = true;
    user.socketId = socket.id;
    sessions.set(socket.id, userId);

    socket.join(roomId);
    const room = rooms.get(roomId) || globalRoom;
    room.members.add(userId);

    // Enviar historial de mensajes
    socket.emit('history', { roomId, messages: room.messages.slice(-100) });

    // Avisar a todos que este usuario está en línea
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
    const msgs = room.messages.slice(-100);
    socket.emit('history', { roomId, messages: msgs });
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
    // Mantener solo los últimos 500 mensajes
    if (room.messages.length > 500) room.messages.shift();

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
    if (set.has(userId)) {
      set.delete(userId);
    } else {
      set.add(userId);
    }
    const reactions = {};
    for (const [em, s] of Object.entries(msg.reactions)) {
      reactions[em] = s.size;
    }
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
    for (const room of rooms.values()) {
      room.members.delete(userId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌸 Kiomi Chat corriendo en http://0.0.0.0:${PORT}`);
});
