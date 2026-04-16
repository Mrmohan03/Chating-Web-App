import { state } from './state.js';

export function makeAvatar(user, size) {
    const letter = user.name[0].toUpperCase();
    return `<div class="avatar-circle" style="width:${size}px;height:${size}px;background:${user.avatar_color};flex-shrink:0">
        ${letter}
        <span class="status-dot ${user.status === 'online' ? 'dot-online' : 'dot-offline'}"></span>
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