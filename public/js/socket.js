import { state } from './state.js';
import { upsertMessage, renderMessages, refreshActiveMessages } from './chat.js';
import { renderChatList } from './contacts.js';

export function connectSocket() {
    state.socket = io();
    state.socket.emit('user:join', state.currentUser.id);

    state.socket.on('message:sent', (msg) => {
        if (!state.activeContact || String(state.activeContact.id) !== String(msg.receiver_id)) return;
        upsertMessage(msg);
        renderMessages(state.activeMessages);
    });

    state.socket.on('message:receive', (msg) => {
        if (state.activeContact && String(state.activeContact.id) === String(msg.sender_id)) {
            upsertMessage(msg);
            renderMessages(state.activeMessages);
            refreshActiveMessages();
        } else {
            state.unreadCounts[msg.sender_id] = (state.unreadCounts[msg.sender_id] || 0) + 1;
            renderChatList();
        }
    });
    
    state.socket.on('user:status', ({ userId, status }) => {
        const contact = state.contacts.find(c => String(c.id) === String(userId));
        if(contact) {
            contact.status = status;
            renderChatList();
            if(state.activeContact?.id === userId) {
                document.getElementById('chatStatus').textContent = status;
                renderMessages(state.activeMessages);
            }
        }
    });
}