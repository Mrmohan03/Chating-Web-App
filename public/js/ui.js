import { state } from './state.js';

const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

export function makeAvatar(user, size) {
    // Use the user's uploaded image, OR the default image
    const imgUrl = user.avatar_url || DEFAULT_AVATAR;
    
    // Don't show online dots for groups
    const statusDot = user.isGroup ? '' : `<span class="status-dot ${user.status === 'online' ? 'dot-online' : 'dot-offline'}"></span>`;

    return `
    <div class="avatar-circle" style="width:${size}px;height:${size}px;flex-shrink:0;position:relative;background:none;">
        <img src="${imgUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
        ${statusDot}
    </div>`;
}

export function renderSelfAvatar() {
    const el = document.getElementById('selfAvatar');
    if (!el) return; // Safety check
    
    const imgUrl = state.currentUser.avatar_url || DEFAULT_AVATAR;
    el.innerHTML = `<img src="${imgUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    el.style.background = 'none';
}

export function scrollBottom() {
    const area = document.getElementById('messagesArea');
    if (area) { // SAFETY CHECK: Only scroll if the chat area is actually on screen!
        area.scrollTop = area.scrollHeight;
    }
}

export function buildEmojiPicker() {
    const p = document.getElementById('emojiPicker');
    if (!p) return; // SAFETY CHECK: Prevent crash if picker isn't found
    
    state.EMOJIS.forEach(e => {
        const b = document.createElement('button');
        b.textContent = e;
        b.onclick = () => {
            document.getElementById('messageInput').textContent += e;
            p.classList.add('hidden');
        };
        p.appendChild(b);
    });
}

export function toggleEmoji() {
    const p = document.getElementById('emojiPicker');
    if (p) {
        p.classList.toggle('hidden');
    }
}

export function togglePasswordVisibility(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        input.classList.add("password-visible");
        
        // Change to Eye-Slash (Hidden) Icon
        btnElement.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.28 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;
    } else {
        input.type = "password";
        input.classList.remove("password-visible");
        
        // Change back to Eye (Visible) Icon
        btnElement.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
    }
}