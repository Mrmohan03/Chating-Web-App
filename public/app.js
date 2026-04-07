/* ════════════════════════════════════════
   ChatFlow — app.js  (fixed)
════════════════════════════════════════ */

const EMOJIS = [
  '😀','😂','🥲','😍','🤩','😎','🥳','😏','😢','😡',
  '👍','👎','👏','🙌','🤝','🤞','✌️','🫶','❤️','🔥',
  '⭐','🎉','🎊','🙏','💯','✅','❌','🚀','💡','🎮',
  '🍕','🍔','☕','🍺','🍣','🎵','🎸','📸','💻','📱',
];

/* ─── STATE ─── */
let token       = localStorage.getItem('cf_token');
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('cf_user') || 'null'); } catch { currentUser = null; }

let contacts      = [];
let activeContact = null;
let unreadCounts  = {};
let socket        = null;
let typingTimer   = null;
let allUsers      = [];   // cached for modal

/* ─── INIT — wait for DOM ─── */
document.addEventListener('DOMContentLoaded', () => {
  buildEmojiPicker();
  attachListeners();
  if (token && currentUser) {
    showApp();
  } else {
    showAuth();
  }
});

/* ════════════════════════════════════════
   AUTH
════════════════════════════════════════ */
function showAuth() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  showLoginForm();
}

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  renderSelfAvatar();
  connectSocket();
  loadContacts();
  loadUnread();
}

function showLoginForm() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  hideError('loginError');
  hideError('registerError');
}

function showRegisterForm() {
  document.getElementById('registerForm').classList.remove('hidden');
  document.getElementById('loginForm').classList.add('hidden');
  hideError('loginError');
  hideError('registerError');
}

async function doLogin() {
  const btn      = document.getElementById('loginBtn');
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  hideError('loginError');
  if (!email || !password) return showError('loginError', 'Please enter your email and password.');

  btn.disabled   = true;
  btn.textContent = 'Signing in…';

  const res = await apiCall('POST', '/api/login', { email, password });

  btn.disabled    = false;
  btn.textContent = 'Sign In';

  if (res.error) return showError('loginError', res.error);

  saveSession(res);
  showApp();
}

async function doRegister() {
  const btn      = document.getElementById('registerBtn');
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  hideError('registerError');
  if (!name || !email || !password) return showError('registerError', 'Please fill in all fields.');
  if (password.length < 6)          return showError('registerError', 'Password must be at least 6 characters.');

  btn.disabled    = true;
  btn.textContent = 'Creating account…';

  const res = await apiCall('POST', '/api/register', { name, email, password });

  btn.disabled    = false;
  btn.textContent = 'Create Account';

  if (res.error) return showError('registerError', res.error);

  saveSession(res);
  showApp();
}

function saveSession(res) {
  token       = res.token;
  currentUser = res.user;
  localStorage.setItem('cf_token', token);
  localStorage.setItem('cf_user', JSON.stringify(currentUser));
}

function doLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  localStorage.removeItem('cf_token');
  localStorage.removeItem('cf_user');
  token = null; currentUser = null; contacts = []; activeContact = null;
  if (socket) { socket.disconnect(); socket = null; }
  document.getElementById('chatWindow').classList.add('hidden');
  document.getElementById('emptyState').classList.remove('hidden');
  showAuth();
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError(id) {
  document.getElementById(id).classList.add('hidden');
}

/* ════════════════════════════════════════
   SOCKET.IO
════════════════════════════════════════ */
function connectSocket() {
  if (socket) socket.disconnect();
  socket = io();

  socket.emit('user:join', currentUser.id);

  socket.on('message:receive', (msg) => {
    const senderId = String(msg.sender_id);
    if (activeContact && String(activeContact.id) === senderId) {
      appendMessage(msg);
      scrollBottom();
    } else {
      unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
      renderChatList();
      const sender = contacts.find(c => String(c.id) === senderId);
      showToast(sender?.name || 'New message', msg.text || '');
    }
  });

  socket.on('typing:start', ({ sender_id }) => {
    if (activeContact && String(activeContact.id) === String(sender_id)) {
      document.getElementById('typingIndicator').classList.remove('hidden');
    }
  });
  socket.on('typing:stop', ({ sender_id }) => {
    if (activeContact && String(activeContact.id) === String(sender_id)) {
      document.getElementById('typingIndicator').classList.add('hidden');
    }
  });

  socket.on('user:status', ({ userId, status }) => {
    const c = contacts.find(c => String(c.id) === String(userId));
    if (c) {
      c.status = status;
      renderChatList();
      if (activeContact && String(activeContact.id) === String(userId)) {
        updateChatHeaderStatus(status);
      }
    }
  });

  socket.on('connect_error', () => console.warn('Socket connection failed'));
}

/* ════════════════════════════════════════
   API HELPER
════════════════════════════════════════ */
async function apiCall(method, path, body) {
  try {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch (e) {
    return { error: 'Network error. Is the server running?' };
  }
}

/* ════════════════════════════════════════
   CONTACTS
════════════════════════════════════════ */
async function loadContacts() {
  const data = await apiCall('GET', '/api/contacts');
  if (data.error) return;
  contacts = data;
  renderChatList();
}

async function loadUnread() {
  const data = await apiCall('GET', '/api/unread');
  if (!data.error) {
    unreadCounts = data;
    renderChatList();
  }
}

function renderChatList(filter = '') {
  const list = document.getElementById('chatList');
  list.innerHTML = '';

  const q = filter.toLowerCase();
  const filtered = contacts.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));

  if (filtered.length === 0) {
    list.innerHTML = `<li class="empty-list">${filter ? 'No contacts match your search.' : 'No contacts yet.<br>Click + to add someone!'}</li>`;
    return;
  }

  filtered.forEach(contact => {
    const unread = unreadCounts[String(contact.id)] || 0;
    const li = document.createElement('li');
    li.className = 'chat-item' + (activeContact?.id === contact.id ? ' active' : '');

    li.innerHTML = `
      ${makeAvatar(contact, 44)}
      <div class="chat-item-meta">
        <div class="chat-item-top">
          <span class="chat-item-name">${esc(contact.name)}</span>
          <span class="chat-item-time" style="color:${contact.status==='online'?'var(--accent)':'var(--text-time)'}">
            ${contact.status === 'online' ? '● online' : ''}
          </span>
        </div>
        <div class="chat-item-bottom">
          <span class="chat-item-preview">${esc(contact.bio || 'Hey there!')}</span>
          ${unread ? `<span class="unread-badge">${unread}</span>` : ''}
        </div>
      </div>`;

    li.addEventListener('click', () => openChat(contact));
    list.appendChild(li);
  });
}

/* ════════════════════════════════════════
   OPEN CHAT
════════════════════════════════════════ */
async function openChat(contact) {
  activeContact = contact;
  unreadCounts[String(contact.id)] = 0;

  // Show chat window
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('chatWindow').classList.remove('hidden');
  document.getElementById('chatPanel').classList.add('open');   // mobile
  document.getElementById('typingIndicator').classList.add('hidden');

  // Update header
  document.getElementById('chatAvatar').innerHTML = makeAvatar(contact, 40);
  document.getElementById('chatName').textContent  = contact.name;
  updateChatHeaderStatus(contact.status);

  renderChatList(document.getElementById('searchInput').value);

  // Load messages from server
  const msgs = await apiCall('GET', `/api/messages/${contact.id}`);
  if (Array.isArray(msgs)) {
    renderMessages(msgs);
  } else {
    document.getElementById('messagesWrapper').innerHTML =
      `<div style="text-align:center;color:var(--text-secondary);padding:30px">Could not load messages.</div>`;
  }
  scrollBottom();
  document.getElementById('messageInput').focus();
}

function updateChatHeaderStatus(status) {
  const sub = document.getElementById('chatSub');
  sub.textContent = status === 'online' ? 'online' : 'offline';
  sub.style.color = status === 'online' ? 'var(--accent)' : 'var(--text-secondary)';
}

/* ════════════════════════════════════════
   MESSAGES
════════════════════════════════════════ */
function renderMessages(messages) {
  const wrapper = document.getElementById('messagesWrapper');
  wrapper.innerHTML = '';

  if (!messages.length) {
    wrapper.innerHTML = `<div style="text-align:center;color:var(--text-secondary);font-size:13.5px;padding:40px 0">
      No messages yet. Say hi! 👋</div>`;
    return;
  }

  let lastDate = null;
  messages.forEach(msg => {
    const d = formatDate(new Date(msg.created_at));
    if (d !== lastDate) {
      const div = document.createElement('div');
      div.className = 'date-divider';
      div.innerHTML = `<span>${d}</span>`;
      wrapper.appendChild(div);
      lastDate = d;
    }
    wrapper.appendChild(makeBubble(msg));
  });
}

function appendMessage(msg) {
  const wrapper = document.getElementById('messagesWrapper');

  // Remove "no messages" placeholder if present
  const placeholder = wrapper.querySelector('[data-placeholder]');
  if (placeholder) placeholder.remove();

  // Add date divider if needed
  const d = formatDate(new Date(msg.created_at));
  const lastDivider = wrapper.querySelector('.date-divider:last-of-type');
  if (!lastDivider || lastDivider.querySelector('span')?.textContent !== d) {
    const div = document.createElement('div');
    div.className = 'date-divider';
    div.innerHTML = `<span>${d}</span>`;
    wrapper.appendChild(div);
  }

  wrapper.appendChild(makeBubble(msg));
}

function makeBubble(msg) {
  const isOut = String(msg.sender_id) === String(currentUser.id);
  const row   = document.createElement('div');
  row.className = `msg-row ${isOut ? 'out' : 'in'}`;

  const tick = isOut
    ? `<span class="tick ${msg.is_read ? 'read' : ''}">✓✓</span>`
    : '';

  row.innerHTML = `
    <div class="bubble">
      <div class="bubble-text">${esc(msg.text || '')}</div>
      <div class="bubble-meta">
        <span class="bubble-time">${formatTime(new Date(msg.created_at))}</span>
        ${tick}
      </div>
    </div>`;
  return row;
}

/* ════════════════════════════════════════
   SEND MESSAGE
════════════════════════════════════════ */
function sendMessage() {
  const input = document.getElementById('messageInput');
  const text  = input.textContent.trim();
  if (!text || !activeContact || !socket) return;

  // Show message immediately (optimistic)
  const tempMsg = {
    sender_id:   currentUser.id,
    receiver_id: activeContact.id,
    text,
    type:        'text',
    is_read:     0,
    created_at:  new Date().toISOString(),
  };
  appendMessage(tempMsg);
  scrollBottom();

  // Send via socket (server saves to DB)
  socket.emit('message:send', {
    sender_id:   currentUser.id,
    receiver_id: activeContact.id,
    text,
    type:        'text',
  });

  input.textContent = '';

  // Stop typing signal
  if (socket && activeContact) {
    socket.emit('typing:stop', { sender_id: currentUser.id, receiver_id: activeContact.id });
  }
  clearTimeout(typingTimer);
}

/* ════════════════════════════════════════
   TYPING INDICATOR
════════════════════════════════════════ */
function onTyping() {
  if (!socket || !activeContact) return;
  socket.emit('typing:start', { sender_id: currentUser.id, receiver_id: activeContact.id });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    if (socket && activeContact)
      socket.emit('typing:stop', { sender_id: currentUser.id, receiver_id: activeContact.id });
  }, 1500);
}

/* ════════════════════════════════════════
   ADD CONTACT MODAL
════════════════════════════════════════ */
async function openAddContactModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('modalSearch').value = '';
  document.getElementById('modalList').innerHTML =
    `<li style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px">Loading…</li>`;

  const data = await apiCall('GET', '/api/users');
  if (data.error) {
    document.getElementById('modalList').innerHTML =
      `<li style="padding:20px;text-align:center;color:#ef4444;font-size:13px">${esc(data.error)}</li>`;
    return;
  }
  allUsers = data;
  const contactIds = new Set(contacts.map(c => String(c.id)));
  renderModalList(allUsers.filter(u => !contactIds.has(String(u.id))));
}

function renderModalList(users) {
  const list = document.getElementById('modalList');
  list.innerHTML = '';

  if (!users.length) {
    list.innerHTML = `<li style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px">No users found</li>`;
    return;
  }

  users.forEach(user => {
    const li = document.createElement('li');
    li.className = 'modal-item';
    li.innerHTML = `
      ${makeAvatar(user, 40)}
      <div class="modal-item-info">
        <div class="modal-item-name">${esc(user.name)}</div>
        <div class="modal-item-email">${esc(user.email)}</div>
      </div>
      <span class="modal-item-add">+ Add</span>`;

    li.addEventListener('click', async () => {
      const res = await apiCall('POST', '/api/contacts', { contact_id: user.id });
      if (res.error) return showToast('Error', res.error);
      document.getElementById('modalOverlay').classList.add('hidden');
      await loadContacts();
      showToast('Contact added', `${user.name} is now in your contacts`);
    });
    list.appendChild(li);
  });
}

/* ════════════════════════════════════════
   AVATAR HELPER
════════════════════════════════════════ */
function makeAvatar(user, size = 44) {
  // avatar_color comes from DB; color comes from login response
  const color  = user.avatar_color || user.color || '#00a884';
  const letter = (user.name || 'U')[0].toUpperCase();
  const dotClass = user.status === 'online' ? 'dot-online' : 'dot-offline';
  return `
    <div class="avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size*0.38)}px">
      ${letter}
      <span class="status-dot ${dotClass}"></span>
    </div>`;
}

function renderSelfAvatar() {
  const el    = document.getElementById('selfAvatar');
  // FIX: login returns avatar_color, use that. Fallback to color or default.
  const color  = currentUser.avatar_color || currentUser.color || '#00a884';
  const letter = (currentUser.name || 'U')[0].toUpperCase();
  el.style.background = color;
  el.textContent       = letter;
  el.title             = currentUser.name + ' (logged in)';
}

/* ════════════════════════════════════════
   EMOJI PICKER
════════════════════════════════════════ */
function buildEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  picker.innerHTML = '';
  EMOJIS.forEach(e => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.textContent = e;
    btn.addEventListener('click', () => {
      const input = document.getElementById('messageInput');
      input.focus();
      document.execCommand('insertText', false, e);
      picker.classList.add('hidden');
    });
    picker.appendChild(btn);
  });
}

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */
function showToast(title, msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div class="toast-title">${esc(title)}</div><div class="toast-msg">${esc(String(msg).slice(0,60))}</div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(16px)';
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

/* ════════════════════════════════════════
   UTILITIES
════════════════════════════════════════ */
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d) {
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function scrollBottom() {
  const area = document.getElementById('messagesArea');
  area.scrollTop = area.scrollHeight;
}

/* ════════════════════════════════════════
   EVENT LISTENERS — all inside DOMContentLoaded
   (called from init at top)
════════════════════════════════════════ */
function attachListeners() {

  /* ── Auth ── */
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('registerBtn').addEventListener('click', doRegister);
  document.getElementById('goToRegister').addEventListener('click', (e) => { e.preventDefault(); showRegisterForm(); });
  document.getElementById('goToLogin').addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });

  // Allow Enter key in auth inputs
  ['loginEmail','loginPassword'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); })
  );
  ['regName','regEmail','regPassword'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); })
  );

  /* ── Send ── */
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('messageInput').addEventListener('input', onTyping);

  /* ── Emoji ── */
  document.getElementById('emojiBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('emojiPicker').classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    document.getElementById('emojiPicker').classList.add('hidden');
  });

  /* ── Sidebar ── */
  document.getElementById('searchInput').addEventListener('input', (e) => renderChatList(e.target.value));
  document.getElementById('addContactBtn').addEventListener('click', openAddContactModal);
  document.getElementById('logoutBtn').addEventListener('click', doLogout);

  /* ── Modal ── */
  document.getElementById('closeModal').addEventListener('click', () =>
    document.getElementById('modalOverlay').classList.add('hidden')
  );
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay'))
      document.getElementById('modalOverlay').classList.add('hidden');
  });
  document.getElementById('modalSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const contactIds = new Set(contacts.map(c => String(c.id)));
    renderModalList(
      allUsers.filter(u => !contactIds.has(String(u.id)) &&
        (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)))
    );
  });

  /* ── Back button (mobile) ── */
  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('chatPanel').classList.remove('open');
  });

  /* ── Keyboard shortcuts ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.getElementById('emojiPicker').classList.add('hidden');
      document.getElementById('modalOverlay').classList.add('hidden');
    }
  });
}
