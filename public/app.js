/* ─── STATE ─── */
let token       = localStorage.getItem('cf_token');
let currentUser = null;
try { currentUser = JSON.parse(localStorage.getItem('cf_user')); } catch { currentUser = null; }

let contacts      = [];
let activeContact = null;
let unreadCounts  = {};
let socket        = null;
let allUsers      = []; 
let activeMessages = [];
let activeChatRefreshTimer = null;
let pendingAttachment = null;
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
    
    await refreshActiveMessages();
    startActiveChatRefresh();
    renderChatList(); // refresh unread dots
}

function renderMessages(messages) {
    activeMessages = Array.isArray(messages) ? [...messages] : [];
    const wrapper = document.getElementById('messagesWrapper');
    wrapper.innerHTML = '';
    activeMessages.forEach(m => wrapper.appendChild(makeBubble(m)));
    scrollBottom();
}

function makeBubble(msg) {
    const isOut = String(msg.sender_id) === String(currentUser.id);
    const div = document.createElement('div');
    div.className = `msg-row ${isOut ? 'out' : 'in'}`;
    div.dataset.messageKey = getMessageKey(msg);
    
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tick = isOut ? renderTick(msg) : '';

    // PRO FEATURE: Dynamic Media Rendering
    let mediaHTML = '';
    if (msg.file_url) {
        if (msg.file_type.startsWith('image/')) {
            mediaHTML = `<img src="${msg.file_url}" class="chat-media-img" onclick="window.open('${msg.file_url}', '_blank')">`;
        } else if (msg.file_type.startsWith('video/')) {
            mediaHTML = `<video src="${msg.file_url}" class="chat-media-video" controls preload="metadata"></video>`;
        } else {
            // ZIPs, PDFs, Docs
            const mbSize = (msg.file_size / (1024 * 1024)).toFixed(2);
            mediaHTML = `
                <div class="chat-doc" onclick="window.open('${msg.file_url}', '_blank')">
                    <div class="doc-icon">📄</div>
                    <div class="doc-info">
                        <span class="doc-name">${msg.file_name}</span>
                        <span class="doc-size">${mbSize} MB • ${msg.file_type.split('/')[1] || 'File'}</span>
                    </div>
                </div>`;
        }
    }

    // Only render text div if there is actually text
    const textHTML = msg.text ? `<div class="bubble-text">${msg.text}</div>` : '';

    div.innerHTML = `
        <div class="bubble">
            ${mediaHTML}
            ${textHTML}
            <div class="bubble-meta">${time} ${tick}</div>
        </div>`;
    return div;
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.textContent.trim();
    
    // Allow sending if there's text OR a pending attachment
    if ((!text && !pendingAttachment) || !activeContact) return;

    const client_id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const msg = {
        client_id,
        sender_id: currentUser.id,
        receiver_id: activeContact.id,
        text: text,
        created_at: new Date().toISOString(),
        is_read: false,
        delivery_status: activeContact.status === 'online' ? 'delivered' : 'sent',
        
        // This handles your 'type' column from the database
        type: pendingAttachment ? 'media' : 'text', 
        
        // These are the new file columns
        file_url: pendingAttachment?.url || null,
        file_name: pendingAttachment?.name || null,
        file_type: pendingAttachment?.type || null,
        file_size: pendingAttachment?.size || null
    };

    upsertMessage(msg);
    socket.emit('message:send', msg);
    
    // Clear inputs
    input.textContent = '';
    pendingAttachment = null; 
    renderMessages(activeMessages);
}

/* ─── DRAG & DROP AND FILE UPLOAD ─── */

// 1. Handle the standard attachment button click
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) await uploadFileDirectly(file);
    event.target.value = ''; // Reset input
}

// 2. The core upload function used by both button and drag-and-drop
async function uploadFileDirectly(file) {
    const overlay = document.getElementById('uploadOverlay');
    overlay.classList.remove('hidden'); // Show spinner

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Save to pending attachment and auto-trigger send
        pendingAttachment = data;
        sendMessage(); 

    } catch (err) {
        alert("Upload failed: " + err.message);
    } finally {
        overlay.classList.add('hidden'); // Hide spinner
    }
}

// 3. Setup Drag & Drop Listeners
const chatWindowEl = document.getElementById('chatWindow');
const dragOverlayEl = document.getElementById('dragOverlay');

chatWindowEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (activeContact) {
        dragOverlayEl.classList.remove('hidden');
        dragOverlayEl.classList.add('active');
    }
});

chatWindowEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragOverlayEl.classList.remove('active');
    // Slight delay to prevent flickering when moving mouse over children
    setTimeout(() => {
        if (!dragOverlayEl.classList.contains('active')) {
            dragOverlayEl.classList.add('hidden');
        }
    }, 150);
});

chatWindowEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dragOverlayEl.classList.remove('active');
    dragOverlayEl.classList.add('hidden');
    
    if (!activeContact) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        uploadFileDirectly(file);
    }
});

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

function getMessageKey(msg) {
    return String(msg.id || msg.client_id || `${msg.sender_id}-${msg.receiver_id}-${msg.created_at}-${msg.text}`);
}

function getMessageStatus(msg) {
    if (msg.is_read) return 'read';
    if (msg.delivery_status) return msg.delivery_status;

    const receiverId = String(msg.receiver_id);
    const contact = contacts.find(c => String(c.id) === receiverId) || activeContact;
    return contact?.status === 'online' ? 'delivered' : 'sent';
}

function renderTick(msg) {
    const status = getMessageStatus(msg);
    if (status === 'read') return `<span class="tick read">✓✓</span>`;
    if (status === 'delivered') return `<span class="tick">✓✓</span>`;
    return `<span class="tick">✓</span>`;
}

function upsertMessage(message) {
    const nextKey = getMessageKey(message);
    const existingIndex = activeMessages.findIndex((item) =>
        String(item.id || '') === String(message.id || '') ||
        String(item.client_id || '') === String(message.client_id || '') ||
        getMessageKey(item) === nextKey
    );

    if (existingIndex >= 0) {
        activeMessages[existingIndex] = { ...activeMessages[existingIndex], ...message };
    } else {
        activeMessages.push(message);
    }

    activeMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function mergeMessages(serverMessages) {
    const pendingMessages = activeMessages.filter((message) => !message.id && message.client_id);
    const nextMessages = [...(serverMessages || [])];

    pendingMessages.forEach((message) => {
        const alreadySaved = nextMessages.some((item) => item.client_id && item.client_id === message.client_id);
        if (!alreadySaved) nextMessages.push(message);
    });

    return nextMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

async function refreshActiveMessages() {
    if (!activeContact) return;

    const msgs = await apiCall('GET', `/api/messages/${activeContact.id}`);
    if (msgs?.error || !Array.isArray(msgs)) return;

    renderMessages(mergeMessages(msgs));
}

function startActiveChatRefresh() {
    // PRO FIX: We use Socket.io for instant updates now.
    // We do NOT need to refresh the screen every 2 seconds.
   if (activeChatRefreshTimer) clearInterval(activeChatRefreshTimer);
}

function connectSocket() {
    socket = io();
    socket.emit('user:join', currentUser.id);

    socket.on('message:sent', (msg) => {
        if (!activeContact || String(activeContact.id) !== String(msg.receiver_id)) return;
        upsertMessage(msg);
        renderMessages(activeMessages);
    });

    socket.on('message:receive', (msg) => {
        console.log("📥 RECEIVED MESSAGE FROM SERVER:", msg); // <-- ADD THIS LINE
        
        if (activeContact && String(activeContact.id) === String(msg.sender_id)) {
            upsertMessage(msg);
            renderMessages(activeMessages);
            refreshActiveMessages();
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
            if(activeContact?.id === userId) {
                document.getElementById('chatStatus').textContent = status;
                renderMessages(activeMessages);
            }
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

document.addEventListener('keydown', (e) => {
    if (document.activeElement.id === 'messageInput') {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent newline
            sendMessage();
        }
        // If Shift+Enter, let it naturally create a new line
    }
});
