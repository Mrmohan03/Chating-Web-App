import { state } from './state.js';

export async function apiCall(method, path, body) {
    try {
        const res = await fetch(path, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {})
            },
            body: body ? JSON.stringify(body) : undefined
        });
        return await res.json();
    } catch (e) {
        return { error: 'Server connection failed' };
    }
}