const socket = io();

// Ask user for their name
let username = prompt("Enter your name to join the chat:");
if (!username) {
    username = "Anonymous";
}

const form = document.getElementById('chat-form');
const input = document.getElementById('msg-input');
const chatMessages = document.getElementById('chat-messages');

// Function to display a message in the UI
function displayMessage(msg) {
    const div = document.createElement('div');
    // Check if the message was sent by us or someone else
    div.classList.add('message', msg.sender === username ? 'sent' : 'received');
    
    div.innerHTML = `
        <span class="sender">${msg.sender}</span>
        <p>${msg.text}</p>
    `;
    
    chatMessages.appendChild(div);
    // Auto-scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Listen for form submission
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        const msgData = {
            sender: username,
            text: input.value
        };
        // Send message to server
        socket.emit('chat message', msgData);
        input.value = '';
    }
});

// Load old messages when first connecting
socket.on('load messages', (messages) => {
    messages.forEach((msg) => {
        displayMessage(msg);
    });
});

// Listen for new messages from server
socket.on('chat message', (msg) => {
    displayMessage(msg);
});