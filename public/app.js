/* ===== ESTADO GLOBAL ===== */
let socket = null;
let me = null;           // { id, username, avatar, color }
let currentRoom = null;  // id de sala activa
let allRooms = [];
let allUsers = [];
let replyTo = null;      // { id, username, text }
let typingTimer = null;
let typingUsers = {};
let lastMsgDate = null;

const REACT_EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🎉'];

/* ===== UTILS ===== */
const $ = id => document.getElementById(id);
const qs = s => document.querySelector(s);

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const diff = (today - d) / 86400000;
  if (diff < 1) return 'Hoy';
  if (diff < 2) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
}

/* ===== AUTH ===== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// Avatar picker
const avatarGrid = $('avatar-picker');
const emojis = avatarGrid.textContent.trim().split(/\s+/);
avatarGrid.innerHTML = '';
emojis.forEach(em => {
  const span = document.createElement('span');
  span.className = 'emoji-grid-item';
  if (em === emojis[0]) span.classList.add('selected');
  span.textContent = em;
  span.addEventListener('click', () => {
    document.querySelectorAll('.emoji-grid-item').forEach(s => s.classList.remove('selected'));
    span.classList.add('selected');
    $('reg-avatar').value = em;
  });
  avatarGrid.appendChild(span);
});

// Color picker
document.querySelectorAll('.color-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    $('reg-color').value = opt.dataset.color;
  });
});

// Registro
$('btn-register').addEventListener('click', async () => {
  const username = $('reg-name').value.trim();
  const avatar = $('reg-avatar').value;
  const color = $('reg-color').value;
  if (!username) { $('reg-error').textContent = 'Escribe tu nombre'; return; }
  const res = await fetch('/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, avatar, color }),
  });
  const data = await res.json();
  if (!res.ok) { $('reg-error').textContent = data.error; return; }
  localStorage.setItem('kiomi_userId', data.userId);
  startChat(data.user);
});

// Login
$('btn-login').addEventListener('click', async () => {
  const username = $('login-name').value.trim();
  if (!username) { $('login-error').textContent = 'Escribe tu nombre'; return; }
  const res = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) { $('login-error').textContent = data.error; return; }
  localStorage.setItem('kiomi_userId', data.userId);
  startChat(data.user);
});

// Enter key en inputs de auth
[$('reg-name'), $('login-name')].forEach(inp => {
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp === $('reg-name') ? $('btn-register').click() : $('btn-login').click(); } });
});

// Auto-login si hay sesión guardada
window.addEventListener('load', async () => {
  const savedId = localStorage.getItem('kiomi_userId');
  if (savedId) {
    const res = await fetch('/api/users');
    const users = await res.json();
    const user = users.find(u => u.id === savedId);
    if (user) { startChat(user); return; }
  }
  $('screen-auth').classList.add('active');
});

/* ===== INICIO DE CHAT ===== */
function startChat(user) {
  me = user;
  $('screen-auth').classList.remove('active');
  $('screen-chat').classList.add('active');
  $('my-avatar').textContent = user.avatar;
  $('my-name').textContent = user.username;

  initSocket();
  loadRooms();
  loadUsers();
}

/* ===== SOCKET ===== */
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('user:join', { userId: me.id, roomId: 'global' });
  });

  socket.on('joined', ({ roomId }) => {
    currentRoom = roomId;
    updateActiveRoom(roomId);
    showChatPanel();
  });

  socket.on('history', ({ roomId, messages }) => {
    if (roomId !== currentRoom) return;
    $('messages-list').innerHTML = '';
    lastMsgDate = null;
    messages.forEach(renderMessage);
    scrollBottom();
  });

  socket.on('message:new', msg => {
    if (msg.roomId !== currentRoom) {
      highlightRoom(msg.roomId);
      return;
    }
    renderMessage(msg);
    scrollBottom(true);
  });

  socket.on('message:deleted', ({ messageId }) => {
    const el = document.querySelector(`[data-msg-id="${messageId}"]`);
    if (el) el.remove();
  });

  socket.on('message:reaction', ({ messageId, reactions }) => {
    const el = document.querySelector(`[data-msg-id="${messageId}"] .msg-reactions`);
    if (el) renderReactions(el.parentElement, messageId, reactions);
  });

  socket.on('user:status', user => {
    const existing = allUsers.find(u => u.id === user.userId);
    if (existing) {
      existing.online = user.online;
      if (user.username) existing.username = user.username;
    } else {
      allUsers.push({ id: user.userId, username: user.username, avatar: user.avatar, color: user.color, online: user.online });
    }
    renderUsers();
  });

  socket.on('room:created', room => {
    allRooms.push(room);
    renderRooms();
  });

  socket.on('typing:update', ({ userId, username, typing }) => {
    if (typing) { typingUsers[userId] = username; }
    else { delete typingUsers[userId]; }
    updateTypingIndicator();
  });

  socket.on('error', ({ message }) => alert('Error: ' + message));
}

/* ===== ROOMS ===== */
async function loadRooms() {
  const res = await fetch('/api/rooms');
  allRooms = await res.json();
  renderRooms();
}

function renderRooms() {
  const list = $('rooms-list');
  list.innerHTML = '';
  allRooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-item' + (room.id === currentRoom ? ' active' : '');
    div.dataset.roomId = room.id;
    div.innerHTML = `
      <div class="room-icon">${room.id === 'global' ? '🌐' : '💬'}</div>
      <div class="room-info">
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-sub">${room.memberCount} persona${room.memberCount !== 1 ? 's' : ''}</div>
      </div>`;
    div.addEventListener('click', () => joinRoom(room.id));
    list.appendChild(div);
  });
}

function joinRoom(roomId) {
  if (roomId === currentRoom) return;
  currentRoom = roomId;
  lastMsgDate = null;
  $('messages-list').innerHTML = '';
  replyTo = null;
  hideReplyBar();
  socket.emit('room:join', { roomId });
  updateActiveRoom(roomId);
  showChatPanel();
}

function updateActiveRoom(roomId) {
  document.querySelectorAll('.room-item').forEach(el => {
    el.classList.toggle('active', el.dataset.roomId === roomId);
    el.style.borderLeft = '';
  });
  const room = allRooms.find(r => r.id === roomId);
  if (room) {
    $('chat-room-name').textContent = room.name;
    $('chat-room-icon').textContent = roomId === 'global' ? '🌐' : '💬';
    $('chat-room-members').textContent = `${room.memberCount || 0} personas`;
  }
}

function highlightRoom(roomId) {
  const el = document.querySelector(`[data-room-id="${roomId}"]`);
  if (el) el.style.borderLeft = '4px solid #FF9500';
}

/* ===== USERS ===== */
async function loadUsers() {
  const res = await fetch('/api/users');
  allUsers = await res.json();
  renderUsers();
}

function renderUsers() {
  const list = $('users-list');
  list.innerHTML = '';
  const sorted = [...allUsers].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
  sorted.forEach(user => {
    if (user.id === me.id) return;
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
      <div class="user-avatar">${user.avatar || '👤'}</div>
      <div class="user-info">
        <div class="user-name">${escapeHtml(user.username)}</div>
        <div class="user-status ${user.online ? 'online' : 'offline'}">${user.online ? '● En línea' : '○ Desconectado'}</div>
      </div>`;
    list.appendChild(div);
  });
}

/* ===== MESSAGES ===== */
function renderMessage(msg) {
  const isOut = msg.userId === me.id;
  const msgDate = fmtDate(msg.timestamp);

  if (msgDate !== lastMsgDate) {
    lastMsgDate = msgDate;
    const divider = document.createElement('div');
    divider.className = 'date-divider';
    divider.innerHTML = `<span>${msgDate}</span>`;
    $('messages-list').appendChild(divider);
  }

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${isOut ? 'out' : 'in'}`;
  wrapper.dataset.msgId = msg.id;

  let replyHtml = '';
  if (msg.replyTo) {
    const orig = msg.replyTo;
    replyHtml = `<div class="msg-reply-preview" style="border-color:${orig.color || '#25D366'}">
      <div class="reply-sender" style="color:${orig.color || '#25D366'}">${escapeHtml(orig.username)}</div>
      <div class="reply-body">${escapeHtml(orig.text)}</div>
    </div>`;
  }

  const senderHtml = !isOut ? `<div class="msg-sender" style="color:${msg.color || '#25D366'}">${escapeHtml(msg.username)}</div>` : '';

  wrapper.innerHTML = `
    <div class="msg-bubble" style="position:relative">
      ${senderHtml}
      ${replyHtml}
      <div class="msg-text">${escapeHtml(msg.text)}</div>
      <div class="msg-meta">
        <span class="msg-time">${fmtTime(msg.timestamp)}</span>
        ${isOut ? '<span class="msg-check">✓✓</span>' : ''}
      </div>
      <div class="msg-reactions"></div>
    </div>`;

  // Swipe / long-press to reply
  const bubble = wrapper.querySelector('.msg-bubble');
  bubble.addEventListener('click', () => setReply(msg));

  // Hover -> reaction bar
  bubble.addEventListener('mouseenter', () => showReactionBar(bubble, msg));
  bubble.addEventListener('mouseleave', () => {
    const bar = bubble.querySelector('.emoji-react-bar');
    if (bar) bar.remove();
  });

  if (msg.reactions) renderReactions(wrapper, msg.id, msg.reactions);

  $('messages-list').appendChild(wrapper);
}

function renderReactions(wrapper, msgId, reactions) {
  const container = wrapper.querySelector('.msg-reactions') || wrapper.parentElement?.querySelector('.msg-reactions');
  if (!container) return;
  container.innerHTML = '';
  for (const [emoji, count] of Object.entries(reactions)) {
    if (!count) continue;
    const badge = document.createElement('div');
    badge.className = 'reaction-badge';
    badge.innerHTML = `${emoji} <span class="reaction-count">${count}</span>`;
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      socket.emit('message:react', { roomId: currentRoom, messageId: msgId, emoji });
    });
    container.appendChild(badge);
  }
}

function showReactionBar(bubble, msg) {
  const existing = bubble.querySelector('.emoji-react-bar');
  if (existing) return;
  const bar = document.createElement('div');
  bar.className = 'emoji-react-bar';
  REACT_EMOJIS.forEach(em => {
    const span = document.createElement('span');
    span.textContent = em;
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      socket.emit('message:react', { roomId: currentRoom, messageId: msg.id, emoji: em });
      bar.remove();
    });
    bar.appendChild(span);
  });
  bubble.appendChild(bar);
}

function scrollBottom(smooth = false) {
  const el = $('scroll-anchor');
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
}

/* ===== REPLY ===== */
function setReply(msg) {
  replyTo = { id: msg.id, username: msg.username, text: msg.text, color: msg.color };
  $('reply-username').textContent = msg.username;
  $('reply-text').textContent = msg.text;
  $('reply-bar').classList.remove('hidden');
  $('msg-input').focus();
}

function hideReplyBar() {
  replyTo = null;
  $('reply-bar').classList.add('hidden');
}

$('btn-cancel-reply').addEventListener('click', hideReplyBar);

/* ===== SEND MESSAGE ===== */
$('btn-send').addEventListener('click', sendMessage);
$('msg-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

function sendMessage() {
  const text = $('msg-input').value.trim();
  if (!text || !currentRoom) return;
  socket.emit('message:send', { roomId: currentRoom, text, replyTo });
  $('msg-input').value = '';
  hideReplyBar();
  stopTyping();
}

/* ===== TYPING ===== */
$('msg-input').addEventListener('input', () => {
  if (!currentRoom) return;
  socket.emit('typing:start', { roomId: currentRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 2000);
});

function stopTyping() {
  if (!currentRoom) return;
  socket.emit('typing:stop', { roomId: currentRoom });
  clearTimeout(typingTimer);
}

function updateTypingIndicator() {
  const names = Object.values(typingUsers).filter(n => n !== me.username);
  const el = $('typing-indicator');
  if (names.length === 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.textContent = names.length === 1 ? `${names[0]} está escribiendo...` : `${names.join(', ')} están escribiendo...`;
}

/* ===== EMOJI PICKER ===== */
$('btn-emoji').addEventListener('click', (e) => {
  e.stopPropagation();
  $('emoji-picker').classList.toggle('hidden');
});

document.addEventListener('click', () => $('emoji-picker').classList.add('hidden'));
$('emoji-picker').addEventListener('click', e => e.stopPropagation());

// Convertir texto en spans
const emojiPicker = $('emoji-picker');
const emojiList = emojiPicker.textContent.trim().split(/\s+/);
emojiPicker.innerHTML = '';
emojiList.forEach(em => {
  const span = document.createElement('span');
  span.textContent = em;
  span.addEventListener('click', () => {
    $('msg-input').value += em;
    $('emoji-picker').classList.add('hidden');
    $('msg-input').focus();
  });
  emojiPicker.appendChild(span);
});

/* ===== NEW ROOM ===== */
$('btn-new-room').addEventListener('click', () => $('modal-room').classList.remove('hidden'));
$('btn-room-cancel').addEventListener('click', () => $('modal-room').classList.add('hidden'));
$('btn-room-create').addEventListener('click', async () => {
  const name = $('new-room-name').value.trim();
  if (!name) return;
  await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  $('new-room-name').value = '';
  $('modal-room').classList.add('hidden');
});
$('new-room-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-room-create').click(); });

/* ===== SEARCH ===== */
$('search-input').addEventListener('input', () => {
  const q = $('search-input').value.toLowerCase();
  document.querySelectorAll('.room-item').forEach(el => {
    el.style.display = el.querySelector('.room-name').textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

/* ===== LOGOUT ===== */
$('btn-logout').addEventListener('click', () => {
  if (confirm('¿Salir del chat?')) {
    localStorage.removeItem('kiomi_userId');
    location.reload();
  }
});

/* ===== SHOW CHAT PANEL ===== */
function showChatPanel() {
  $('chat-empty').classList.add('hidden');
  $('chat-active').classList.remove('hidden');
}

/* ===== XSS ESCAPE ===== */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
