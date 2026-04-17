# ChatFlow — Pro WhatsApp Web Clone

A highly professional, modular, real-time chat application inspired by WhatsApp Web. Built with Vanilla JS (ES6 Modules), Node.js, Express, Socket.io, and Supabase.

---

## ✨ Features

- **Professional UI/UX:** WhatsApp-style dark mode, SVG icons, floating input labels, and glassmorphism modals.
- **Real-Time Messaging:** Instant message delivery, online/offline status indicators, and read receipts (✓✓) using Socket.io.
- **Media Uploads:** Send Images, Videos, PDFs, and ZIPs.
- **Drag & Drop:** Drag files directly from your computer onto the chat window to upload.
- **Modular Architecture:** Cleanly separated backend (MVC pattern) and frontend (ES6 Modules).
- **Secure:** JWT Authentication, Bcrypt password hashing, and Supabase Row Level Security (RLS).

---

## 🛠 Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
- **Backend:** Node.js, Express.js
- **Database & Storage:** Supabase (PostgreSQL)
- **Real-Time:** Socket.io
- **File Uploads:** Multer (Memory Storage) -> Supabase Storage Bucket

---

## 🚀 Local Setup Guide

### 1. Prerequisites
- **Node.js**: [Download here](https://nodejs.org/) (LTS version recommended).
- **Supabase Account**: [Create a free account](https://supabase.com/).

### 2. Database Setup (Supabase)
1. Create a new project in Supabase.
2. Go to the **SQL Editor** and run this query to create your tables:

```sql
CREATE TABLE users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_color TEXT,
    status TEXT DEFAULT 'offline'
);

CREATE TABLE contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    contact_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sender_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    text TEXT,
    type TEXT DEFAULT 'text',
    is_read BOOLEAN DEFAULT FALSE,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Secure your database
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

2. Go to Storage and create a public bucket named chat_media.

3. Project Configuration
Clone or download this repository, then create a file named exactly .env in the root folder:
code
Env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your_secret_service_role_key_here
JWT_SECRET=super_secret_chatflow_key_2024
PORT=3000

(Note: Use your service_role secret key from Supabase > Project Settings > API).
4. Install Dependencies
Open your terminal in the project folder and run:
npm install
You should see: 🚀 ChatFlow online at http://localhost:3000
Open http://localhost:3000 in your browser. Open a second window to register two different accounts and test the real-time chat!

📂 Professional Folder Structure
The application follows a strict modular separation of concerns.
code
Text
chatflow/
├── .env                    # Secret API keys
├── package.json            # npm dependencies
├── server.js               # Entry point: Starts Express & WebSockets
│
├── src/                    # ⚙️ BACKEND
│   ├── config/             
│   │   └── supabase.js     # DB Connection
│   ├── controllers/        
│   │   ├── authController.js # Login/Register logic
│   │   └── chatController.js # Messages, Contacts, Uploads
│   ├── middleware/         
│   │   ├── auth.js         # JWT validation
│   │   └── upload.js       # Multer memory storage config
│   ├── routes/             
│   │   └── api.js          # Express Router endpoints
│   └── socket/             
│       └── index.js        # Socket.io event listeners
│
└── public/                 # 🌐 FRONTEND
    ├── index.html          # Main UI
    ├── css/                
    │   └── style.css       # Pro WhatsApp-style CSS
    └── js/                 # ES6 Modules
        ├── api.js          # Fetch requests
        ├── auth.js         # Authentication state
        ├── chat.js         # Message rendering & Drag-and-Drop
        ├── contacts.js     # Sidebar & Modal logic
        ├── main.js         # Bootstrapper
        ├── socket.js       # Client WebSocket logic
        ├── state.js        # Global app state
        └── ui.js           # DOM visual helpers
📡 API Endpoints Reference
Method	URL	Auth?	Description
POST	/api/register	No	Create a new account
POST	/api/login	No	Login, returns JWT token
GET	/api/users	Yes	List all registered users
GET	/api/contacts	Yes	Get logged-in user's contacts
POST	/api/contacts	Yes	Add a new contact
GET	/api/messages/:userId	Yes	Fetch chat history with a user
GET	/api/unread	Yes	Get unread message counts
POST	/api/upload	Yes	Upload media to Supabase Storage
⚡ Socket.IO Events
Event	Direction	Description
user:join	Client -> Server	Marks the user as online upon login
message:send	Client -> Server	Delivers a message (text/media) to DB
message:sent	Server -> Client	Confirms to sender that DB saved message
message:receive	Server -> Client	Delivers message to target receiver
user:status	Server -> All	Broadcasts online/offline status changes
