import { state } from './state.js';
import { buildEmojiPicker, toggleEmoji } from './ui.js';
import { showApp, showAuth, toggleAuth, doLogin, doRegister, doLogout } from './auth.js';
import { renderChatList, openAddContactModal, closeModal } from './contacts.js';
import { sendMessage, handleFileUpload, initDragAndDrop } from './chat.js';
import { openProfileModal, closeProfileModal, saveProfile, openGroupModal, closeGroupModal, submitCreateGroup, uploadAvatar } from './profile.js';
/* ─── INITIALIZE APP ─── */
document.addEventListener('DOMContentLoaded', () => {
    buildEmojiPicker();
    initDragAndDrop();

    if (state.token && state.currentUser) {
        showApp();
    } else {
        showAuth();
    }
});

/* ─── GLOBAL EVENT LISTENERS (Enter Key) ─── */
document.addEventListener('keydown', (e) => {
    if (document.activeElement.id === 'messageInput') {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            sendMessage();
        }
    }
});

/* ─── BIND FUNCTIONS TO WINDOW (For HTML onclick support) ─── */
window.doLogin = doLogin;
window.doRegister = doRegister;
window.toggleAuth = toggleAuth;
window.doLogout = doLogout;
window.renderChatList = renderChatList;
window.openAddContactModal = openAddContactModal;
window.closeModal = closeModal;
window.toggleEmoji = toggleEmoji;
window.sendMessage = sendMessage;
window.handleFileUpload = handleFileUpload;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;
window.saveProfile = saveProfile;
window.openGroupModal = openGroupModal;
window.closeGroupModal = closeGroupModal;
window.submitCreateGroup = submitCreateGroup;
window.uploadAvatar = uploadAvatar;

