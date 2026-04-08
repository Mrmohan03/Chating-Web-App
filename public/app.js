/* ─── STATE ─── */
let token       = localStorage.getItem('cf_token');
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('cf_user')); } catch { currentUser = null; }

let contacts      = [];
let activeContact = null;
let unreadCounts  = {};
let socket        = null;
let allUsers      = []; 
const EMOJIS      = ['😀','😂','😍','🤩','😎','👍','❤️','🔥','🚀','🍕','🎉','✨','🙏','💡'];

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', () => {
    buildEmojiPicker();
    if (token && currentUser) {
        showApp();
    } else {
        showAuth();
    }
});

/* ─── UI NAVIGATION ─── */
function showAuth() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
    toggleAuth(false); // Default to login
}

function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    renderSelfAvatar();
    connectSocket();
    loadContacts();
    loadUnread();
}

function toggleAuth(isRegister) {
    const subtitle = document.getElementById('authSubtitle');
    const loginView = document.getElementById('loginView');
    const registerView = document.getElementById('registerView');

    if (isRegister) {
        subtitle.textContent = "Create your account to start chatting";
        loginView.classList.add('hidden');
        registerView.classList.remove('hidden');
    } else {
        subtitle.textContent = "Sign in to continue chatting";
        loginView.classList.remove('hidden');
        registerView.classList.add('hidden');
    }
}

/* ─── API HELPER ─── */
async function apiCall(method, path, body) {
    try {
        const res = await fetch(path, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        return await res.json();
    } catch (e) {
        return { error: 'Server connection failed' };
    }
}

/* ─── AUTH ACTIONS ─── */
async function doLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if(!email || !password) return alert("Please fill in all fields");

    const res = await apiCall('POST', '/api/login', { email, password });
    if (res.error) return alert(res.error);
    
    saveSession(res);
}

async function doRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    if(!name || !email || !password) return alert("Please fill in all fields");

    const res = await apiCall('POST', '/api/register', { name, email, password });
    if (res.error) return alert(res.error);

    saveSession(res);
}

function saveSession(res) {
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('cf_token', token);
    localStorage.setItem('cf_user', JSON.stringify(currentUser));
    showApp();
}

function doLogout() {
    localStorage.clear();
    location.reload();
}

/* ─── CONTACTS ─── */
async function loadContacts() {
    const data = await apiCall('GET', '/api/contacts');
    if (!data.error) {
        contacts = data;
        renderChatList();
    }
}

function renderChatList(filter = '') {
    const list = document.getElementById('chatList');
    list.innerHTML = '';
    
    const filtered = contacts.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(c => {
        const unread = unreadCounts[String(c.id)] || 0;
        const li = document.createElement('li');
        li.className = `chat-item ${activeContact?.id === c.id ? 'active' : ''}`;
        
        li.innerHTML = `
            ${makeAvatar(c, 45)}
            <div class="chat-item-meta">
                <div class="chat-item-top">
                    <span>${c.name}</span>
                </div>
                <div class="chat-item-bottom">
                    <span class="status-text">${c.status}</span>
                    ${unread ? `<span class="unread-badge">${unread}</span>` : ''}
                </div>
            </div>`;
        li.onclick = () => openChat(c);
        list.appendChild(li);
    });
}

/* ─── MESSAGING ─── */
async function openChat(contact) {
    activeContact = contact;
    unreadCounts[String(contact.id)] = 0;
    
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('chatWindow').classList.remove('hidden');
    document.getElementById('chatName').textContent = contact.name;
    document.getElementById('chatStatus').textContent = contact.status;
    document.getElementById('chatAvatar').innerHTML = makeAvatar(contact, 40);
    
    const msgs = await apiCall('GET', `/api/messages/${contact.id}`);
    renderMessages(msgs);
    renderChatList(); // refresh unread dots
}

function renderMessages(messages) {
    const wrapper = document.getElementById('messagesWrapper');
    wrapper.innerHTML = '';
    messages.forEach(m => wrapper.appendChild(makeBubble(m)));
    scrollBottom();
}

function makeBubble(msg) {
    const isOut = String(msg.sender_id) === String(currentUser.id);
    const div = document.createElement('div');
    div.className = `msg-row ${isOut ? 'out' : 'in'}`;
    
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tick = isOut ? `<span class="tick ${msg.is_read ? 'read' : ''}">✓✓</span>` : '';

    div.innerHTML = `
        <div class="bubble">
            <div class="bubble-text">${msg.text}</div>
            <div class="bubble-meta">${time} ${tick}</div>
        </div>`;
    return div;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.textContent.trim();
    if (!text || !activeContact) return;

    const msg = { sender_id: currentUser.id, receiver_id: activeContact.id, text };
    socket.emit('message:send', msg);
    
    input.textContent = '';
    // Optimistic UI: add bubble immediately
    document.getElementById('messagesWrapper').appendChild(makeBubble({...msg, created_at: new Date()}));
    scrollBottom();
}

/* ─── HELPERS ─── */
function makeAvatar(user, size) {
    const letter = user.name[0].toUpperCase();
    return `<div class="avatar-circle" style="width:${size}px;height:${size}px;background:${user.avatar_color};flex-shrink:0">
        ${letter}
        <span class="status-dot ${user.status === 'online' ? 'dot-online' : 'dot-offline'}"></span>
    </div>`;
}

function renderSelfAvatar() {
    const el = document.getElementById('selfAvatar');
    el.style.background = currentUser.avatar_color;
    el.textContent = currentUser.name[0].toUpperCase();
}

function scrollBottom() {
    const area = document.getElementById('messagesArea');
    area.scrollTop = area.scrollHeight;
}

function connectSocket() {
    socket = io();
    socket.emit('user:join', currentUser.id);

    socket.on('message:receive', (msg) => {
        if (activeContact && String(activeContact.id) === String(msg.sender_id)) {
            document.getElementById('messagesWrapper').appendChild(makeBubble(msg));
            scrollBottom();
        } else {
            unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
            renderChatList();
        }
    });

    socket.on('user:status', ({ userId, status }) => {
        const contact = contacts.find(c => String(c.id) === String(userId));
        if(contact) {
            contact.status = status;
            renderChatList();
            if(activeContact?.id === userId) document.getElementById('chatStatus').textContent = status;
        }
    });
}

/* ─── EMOJI & MODALS ─── */
function buildEmojiPicker() {
    const p = document.getElementById('emojiPicker');
    EMOJIS.forEach(e => {
        const b = document.createElement('button');
        b.textContent = e;
        b.onclick = () => {
            document.getElementById('messageInput').textContent += e;
            p.classList.add('hidden');
        };
        p.appendChild(b);
    });
}

function toggleEmoji() {
    document.getElementById('emojiPicker').classList.toggle('hidden');
}

async function openAddContactModal() {
    document.getElementById('modalOverlay').classList.remove('hidden');
    const users = await apiCall('GET', '/api/users');
    const list = document.getElementById('modalList');
    list.innerHTML = '';

    const currentContactIds = contacts.map(c => String(c.id));

    users.filter(u => !currentContactIds.includes(String(u.id))).forEach(u => {
        const li = document.createElement('li');
        li.className = 'modal-item';
        li.innerHTML = `<span>${u.name}</span><button class="btn-primary" style="width:auto; padding:5px 15px">Add</button>`;
        li.onclick = async () => {
            await apiCall('POST', '/api/contacts', { contact_id: u.id });
            closeModal();
            loadContacts();
        };
        list.appendChild(li);
    });
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

async function loadUnread() {
    const data = await apiCall('GET', '/api/unread');
    unreadCounts = data || {};
    renderChatList();
}

// Global listeners for Enter key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement.id === 'messageInput') {
        e.preventDefault();
        sendMessage();
    }
});