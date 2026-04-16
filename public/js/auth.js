import { state } from './state.js';
import { apiCall } from './api.js';
import { renderSelfAvatar } from './ui.js';
import { connectSocket } from './socket.js';
import { loadContacts, loadUnread } from './contacts.js';

export function showAuth() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
    toggleAuth(false);
}

export function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    renderSelfAvatar();
    connectSocket();
    loadContacts();
    loadUnread();
}

export function toggleAuth(isRegister) {
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

export async function doLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if(!email || !password) return alert("Please fill in all fields");

    const res = await apiCall('POST', '/api/login', { email, password });
    if (res.error) return alert(res.error);
    saveSession(res);
}

export async function doRegister() {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    if(!name || !email || !password) return alert("Please fill in all fields");

    const res = await apiCall('POST', '/api/register', { name, email, password });
    if (res.error) return alert(res.error);
    saveSession(res);
}

function saveSession(res) {
    state.token = res.token;
    state.currentUser = res.user;
    localStorage.setItem('cf_token', state.token);
    localStorage.setItem('cf_user', JSON.stringify(state.currentUser));
    showApp();
}

export function doLogout() {
    localStorage.clear();
    location.reload();
}