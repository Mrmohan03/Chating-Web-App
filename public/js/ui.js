import { state } from './state.js';

export function makeAvatar(user, size) {
    const name = user.name || 'Group';
    const letter = name[0].toUpperCase();
    const color = user.avatar_color || '#005c4b'; // Default WhatsApp Green for groups
    
    // Don't show online dots for groups
    const statusDot = user.isGroup ? '' : `<span class="status-dot ${user.status === 'online' ? 'dot-online' : 'dot-offline'}"></span>`;

    // If they uploaded a custom image, show it!
    if (user.avatar_url) {
        return `
        <div class="avatar-circle" style="width:${size}px;height:${size}px;flex-shrink:0;position:relative;">
            <img src="${user.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
            ${statusDot}
        </div>`;
    }

    // Otherwise, show the letter
    return `
    <div class="avatar-circle" style="width:${size}px;height:${size}px;background:${color};flex-shrink:0;position:relative;">
        ${letter}
        ${statusDot}
    </div>`;
}

export function renderSelfAvatar() {
    const el = document.getElementById('selfAvatar');
    el.style.background = state.currentUser.avatar_color;
    el.textContent = state.currentUser.name[0].toUpperCase();
}

export function scrollBottom() {
    const area = document.getElementById('messagesArea');
    area.scrollTop = area.scrollHeight;
}

export function buildEmojiPicker() {
    const p = document.getElementById('emojiPicker');
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
    document.getElementById('emojiPicker').classList.toggle('hidden');
}