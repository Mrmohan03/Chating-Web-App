import { state } from './state.js';
import { apiCall } from './api.js';
import { renderSelfAvatar } from './ui.js';
import { connectSocket } from './socket.js';
import { loadContacts, loadUnread } from './contacts.js';

/* ─── REGULAR EXPRESSIONS (PRO VALIDATION) ─── */
const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,50}$/; 
// Letters, spaces, hyphens, and accents. Min 2, Max 50 chars.

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
// Standard email validation (no spaces, must have @ and a dot).

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/; 
// Minimum 6 characters, at least 1 letter AND 1 number.

/* ─── UI NAVIGATION ─── */
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
        subtitle.textContent = "Sign in to your account";
        loginView.classList.remove('hidden');
        registerView.classList.add('hidden');
    }
}

/* ─── AUTH ACTIONS (WITH REGEX VALIDATION) ─── */
export async function doLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // 1. Check if empty
    if (!email || !password) {
        return alert("⚠️ Please fill in all login fields.");
    }

    // 2. Validate Email format
    if (!emailRegex.test(email)) {
        return alert("⚠️ Please enter a valid email address.");
    }

    // 3. API Call
    const res = await apiCall('POST', '/api/login', { email, password });
    if (res.error) return alert("❌ " + res.error);
    
    saveSession(res);
}

export async function doRegister() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    // 1. Check if empty
    if (!name || !email || !password) {
        return alert("⚠️ Please fill in all registration fields.");
    }

    // 2. Validate Name
    if (!nameRegex.test(name)) {
        return alert("⚠️ Name must be between 2 and 50 characters and contain only letters.");
    }

    // 3. Validate Email
    if (!emailRegex.test(email)) {
        return alert("⚠️ Please enter a valid email address.");
    }

    // 4. Validate Password
    if (!passwordRegex.test(password)) {
        return alert("⚠️ Password must be at least 6 characters long and contain at least one letter and one number.");
    }

    // 5. API Call
    const res = await apiCall('POST', '/api/register', { name, email, password });
    if (res.error) return alert("❌ " + res.error);

    saveSession(res);
}

/* ─── SESSION HANDLING ─── */
function saveSession(res) {
    state.token = res.token;
    state.currentUser = res.user;
    localStorage.setItem('cf_token', state.token);
    localStorage.setItem('cf_user', JSON.stringify(state.currentUser));
    
    // Clear passwords from inputs for security
    document.getElementById('loginPassword').value = '';
    document.getElementById('regPassword').value = '';
    
    showApp();
}

export function doLogout() {
    localStorage.clear();
    location.reload();
}