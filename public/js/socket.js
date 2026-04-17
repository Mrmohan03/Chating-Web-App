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
        // Did this come from a group or a direct message?
        const isGroupMsg = msg.group_id !== null;
        const targetChatId = isGroupMsg ? msg.group_id : msg.sender_id;

        if (state.activeContact && String(state.activeContact.id) === String(targetChatId)) {
            upsertMessage(msg);
            renderMessages(state.activeMessages);
            refreshActiveMessages();
        } else {
            state.unreadCounts[targetChatId] = (state.unreadCounts[targetChatId] || 0) + 1;
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
    // Listen for other users updating their profiles live!
    state.socket.on('user:updated', (userData) => {
        const contact = state.contacts.find(c => String(c.id) === String(userData.id));
        if (contact) {
            // Update the local data
            contact.name = userData.name;
            contact.avatar_url = userData.avatar_url;
            contact.bio = userData.bio;
            
            // Redraw the Sidebar
            renderChatList();
            
            // If we are actively chatting with them right now, update the Header!
            if (state.activeContact && String(state.activeContact.id) === String(userData.id)) {
                document.getElementById('chatName').textContent = userData.name;
                document.getElementById('chatAvatar').innerHTML = makeAvatar(userData, 40);
            }
        }
    });
}