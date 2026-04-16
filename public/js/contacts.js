import { state } from './state.js';
import { apiCall } from './api.js';
import { makeAvatar } from './ui.js';
import { openChat } from './chat.js';

export async function loadContacts() {
    const data = await apiCall('GET', '/api/contacts');
    if (!data.error) {
        state.contacts = data;
        renderChatList();
    }
}

export function renderChatList(filter = '') {
    const list = document.getElementById('chatList');
    list.innerHTML = '';
    const filtered = state.contacts.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(c => {
        const unread = state.unreadCounts[String(c.id)] || 0;
        const li = document.createElement('li');
        li.className = `chat-item ${state.activeContact?.id === c.id ? 'active' : ''}`;
        
        li.innerHTML = `
            ${makeAvatar(c, 45)}
            <div class="chat-item-meta">
                <div class="chat-item-top"><span>${c.name}</span></div>
                <div class="chat-item-bottom">
                    <span class="status-text">${c.status}</span>
                    ${unread ? `<span class="unread-badge">${unread}</span>` : ''}
                </div>
            </div>`;
        li.onclick = () => openChat(c);
        list.appendChild(li);
    });
}

export async function openAddContactModal() {
    document.getElementById('modalOverlay').classList.remove('hidden');
    const users = await apiCall('GET', '/api/users');
    const list = document.getElementById('modalList');
    list.innerHTML = '';

    const currentContactIds = state.contacts.map(c => String(c.id));
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

export function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

export async function loadUnread() {
    const data = await apiCall('GET', '/api/unread');
    state.unreadCounts = data || {};
    renderChatList();
}