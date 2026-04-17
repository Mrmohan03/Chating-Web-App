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