import { state } from './state.js';
import { apiCall } from './api.js';
import { makeAvatar, scrollBottom } from './ui.js';
import { renderChatList } from './contacts.js';

export async function openChat(contact) {
    state.activeContact = contact;
    state.unreadCounts[String(contact.id)] = 0;
    
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('chatWindow').classList.remove('hidden');
    document.getElementById('chatName').textContent = contact.name;
    document.getElementById('chatStatus').textContent = contact.status;
    document.getElementById('chatAvatar').innerHTML = makeAvatar(contact, 40);
    
    await refreshActiveMessages();
    renderChatList(); 
}

export function renderMessages(messages) {
    state.activeMessages = Array.isArray(messages) ? [...messages] :[];
    const wrapper = document.getElementById('messagesWrapper');
    wrapper.innerHTML = '';
    state.activeMessages.forEach(m => wrapper.appendChild(makeBubble(m)));
    scrollBottom();
}

function makeBubble(msg) {
    const isOut = String(msg.sender_id) === String(state.currentUser.id);
    const div = document.createElement('div');
    div.className = `msg-row ${isOut ? 'out' : 'in'}`;
    const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tick = isOut ? `<span class="tick ${msg.is_read ? 'read' : ''}">✓✓</span>` : '';

    let senderNameHTML = '';
    if (state.activeContact.isGroup && !isOut) {
        const senderName = (msg.sender && msg.sender.name) ? msg.sender.name : 'User';
        const senderColor = (msg.sender && msg.sender.avatar_color) ? msg.sender.avatar_color : '#00a884';
        senderNameHTML = `<div style="font-size: 13px; font-weight: 600; color: ${senderColor}; margin-bottom: 4px;">${senderName}</div>`;
    }

    let mediaHTML = '';
    if (msg.file_url) {
        if (msg.file_type.startsWith('image/')) {
            mediaHTML = `<img src="${msg.file_url}" class="chat-media-img" onclick="window.open('${msg.file_url}', '_blank')">`;
        } else if (msg.file_type.startsWith('video/')) {
            mediaHTML = `<video src="${msg.file_url}" class="chat-media-video" controls preload="metadata"></video>`;
        } else {
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

    const textHTML = msg.text ? `<div class="bubble-text">${msg.text}</div>` : '';
    div.innerHTML = `<div class="bubble">${senderNameHTML}${mediaHTML}${textHTML}<div class="bubble-meta">${time} ${tick}</div></div>`;
    return div;
}

export function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.textContent.trim();
    if ((!text && !state.pendingAttachment) || !state.activeContact) return;

    const client_id = `local-${Date.now()}`;
    const isGroup = state.activeContact.isGroup;

    const msg = {
        client_id,
        sender_id: state.currentUser.id,
        receiver_id: isGroup ? null : state.activeContact.id, 
        group_id: isGroup ? state.activeContact.id : null,    
        text: text,
        created_at: new Date().toISOString(),
        is_read: false,
        type: state.pendingAttachment ? 'media' : 'text', 
        file_url: state.pendingAttachment?.url || null,
        file_name: state.pendingAttachment?.name || null,
        file_type: state.pendingAttachment?.type || null,
        file_size: state.pendingAttachment?.size || null
    };

    upsertMessage(msg);
    state.socket.emit('message:send', msg);
    
    input.textContent = '';
    state.pendingAttachment = null; 
    renderMessages(state.activeMessages);
}

export function upsertMessage(message) {
    const existingIndex = state.activeMessages.findIndex(item => 
        (item.id && item.id === message.id) || (item.client_id && item.client_id === message.client_id)
    );
    if (existingIndex >= 0) {
        state.activeMessages[existingIndex] = { ...state.activeMessages[existingIndex], ...message };
    } else {
        state.activeMessages.push(message);
    }
    state.activeMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function refreshActiveMessages() {
    if (!state.activeContact) return;
    const isGroupParam = state.activeContact.isGroup ? '?isGroup=true' : '';
    const msgs = await apiCall('GET', `/api/messages/${state.activeContact.id}${isGroupParam}`);
    if (msgs?.error || !Array.isArray(msgs)) return;
    renderMessages(msgs);
}

export async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) await uploadFileDirectly(file);
    event.target.value = ''; 
}

export async function uploadFileDirectly(file) {
    const overlay = document.getElementById('uploadOverlay');
    overlay.classList.remove('hidden'); 
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` },
            body: formData
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        state.pendingAttachment = data;
        sendMessage(); 
    } catch (err) {
        alert("Upload failed: " + err.message);
    } finally {
        overlay.classList.add('hidden');
    }
}

export function initDragAndDrop() {
    const chatWindowEl = document.getElementById('chatWindow');
    const dragOverlayEl = document.getElementById('dragOverlay');
    if(!chatWindowEl || !dragOverlayEl) return;

    chatWindowEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (state.activeContact) {
            dragOverlayEl.classList.remove('hidden');
            dragOverlayEl.classList.add('active');
        }
    });
    chatWindowEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragOverlayEl.classList.remove('active');
        setTimeout(() => { if (!dragOverlayEl.classList.contains('active')) dragOverlayEl.classList.add('hidden'); }, 150);
    });
    chatWindowEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dragOverlayEl.classList.remove('active');
        dragOverlayEl.classList.add('hidden');
        if (!state.activeContact || !e.dataTransfer.files.length) return;
        uploadFileDirectly(e.dataTransfer.files[0]);
    });
}