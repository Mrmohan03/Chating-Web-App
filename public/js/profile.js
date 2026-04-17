import { state } from './state.js';
import { apiCall } from './api.js';
import { loadContacts } from './contacts.js';
import { renderSelfAvatar } from './ui.js';

/* ── PROFILE LOGIC ── */
export function openProfileModal() {
    document.getElementById('profileModal').classList.remove('hidden');
    document.getElementById('editName').value = state.currentUser.name;
    document.getElementById('editBio').value = state.currentUser.bio || '';
    
    const preview = document.getElementById('profileAvatarPreview');
    if (state.currentUser.avatar_url) {
        preview.innerHTML = `<img src="${state.currentUser.avatar_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
        preview.innerHTML = state.currentUser.name[0].toUpperCase();
        preview.style.background = state.currentUser.avatar_color;
    }
}

export function closeProfileModal() { document.getElementById('profileModal').classList.add('hidden'); }

export async function saveProfile() {
    const name = document.getElementById('editName').value;
    const bio = document.getElementById('editBio').value;
    
    const updatedUser = await apiCall('PUT', '/api/profile', { name, bio, avatar_url: state.currentUser.avatar_url });
    if (updatedUser && !updatedUser.error) {
        state.currentUser = updatedUser;
        localStorage.setItem('cf_user', JSON.stringify(updatedUser));
        renderSelfAvatar();
        closeProfileModal();
    }
}

/* ── GROUP CREATION LOGIC ── */
export function openGroupModal() {
    document.getElementById('groupModal').classList.remove('hidden');
    const list = document.getElementById('groupMembersList');
    list.innerHTML = '';
    
    state.contacts.forEach(c => {
        const li = document.createElement('li');
        li.className = 'modal-item';
        li.innerHTML = `<label style="display:flex; align-items:center; gap:10px; cursor:pointer; width:100%;">
            <input type="checkbox" value="${c.id}" class="group-member-checkbox" style="width:18px; height:18px;">
            <span>${c.name}</span>
        </label>`;
        list.appendChild(li);
    });
}

export function closeGroupModal() { document.getElementById('groupModal').classList.add('hidden'); }

export async function submitCreateGroup() {
    const name = document.getElementById('groupNameInput').value;
    const checkboxes = document.querySelectorAll('.group-member-checkbox:checked');
    const memberIds = Array.from(checkboxes).map(cb => cb.value);

    if (!name || memberIds.length === 0) return alert("Enter a name and select at least 1 member.");

    await apiCall('POST', '/api/groups', { name, memberIds });
    closeGroupModal();
    loadContacts(); // Refresh sidebar to show new group
}
export async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show a quick loading state
    const preview = document.getElementById('profileAvatarPreview');
    preview.innerHTML = `<span class="spinner"></span>`;

    const formData = new FormData();
    formData.append('file', file);

    try {
        // We can reuse the same /api/upload route we made for chat media!
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` },
            body: formData
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Update the state and UI with the new image URL
        state.currentUser.avatar_url = data.url;
        preview.innerHTML = `<img src="${data.url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        
    } catch (err) {
        alert("Avatar upload failed: " + err.message);
        preview.innerHTML = state.currentUser.name[0].toUpperCase(); // revert on fail
    }
}