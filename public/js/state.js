export const state = {
    token: localStorage.getItem('cf_token'),
    currentUser: null,
    contacts: [],
    activeContact: null,
    unreadCounts: {},
    socket: null,
    activeMessages: [],
    pendingAttachment: null,
    EMOJIS: ['😀','😂','😍','🤩','😎','👍','❤️','🔥','🚀','🍕','🎉','✨','🙏','💡']
};

try { 
    state.currentUser = JSON.parse(localStorage.getItem('cf_user')); 
} catch { 
    state.currentUser = null; 
}