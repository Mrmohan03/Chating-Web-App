# ChatFlow — Local Setup Guide

Complete step-by-step guide to run this app locally on your computer.

---

## What You Need First

| Tool       | Download Link                             | Check if installed     |
|------------|-------------------------------------------|------------------------|
| Node.js    | https://nodejs.org  (download LTS version)| `node -v` in terminal  |
| npm        | Comes with Node.js automatically          | `npm -v` in terminal   |

> **Tip:** If `node -v` shows a version number, Node.js is already installed.

---

## Step 1 — Set Up the Project Folder

Open your **Terminal** (Mac/Linux) or **Command Prompt / PowerShell** (Windows) and run:

```bash
# Create a folder for the project
mkdir chatflow
cd chatflow
```

Now copy these files into the `chatflow` folder:
```
chatflow/
├── server.js
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Step 2 — Install Dependencies

Inside the `chatflow` folder, run:

```bash
npm install
```

This downloads all required packages:
- **express** — web server
- **sqlite3** — local database (no installation needed, it's a file!)
- **bcryptjs** — password hashing
- **jsonwebtoken** — login sessions
- **socket.io** — real-time messaging
- **cors** — cross-origin support

You'll see a `node_modules/` folder appear. That's normal.

---

## Step 3 — Start the Server

```bash
node server.js
```

You should see:
```
Connected to SQLite database (chatflow.db)
ChatFlow running at http://localhost:3000
```

A file called `chatflow.db` is automatically created in your project folder.
**This is your database** — all users and messages are stored here.

---

## Step 4 — Open the App

Open your browser and go to:

```
http://localhost:3000
```

You'll see the ChatFlow login screen.

---

## Step 5 — Create Accounts and Test

Since this is fresh, there are no users yet. You need to register.

**To test messaging between two users:**

1. Open `http://localhost:3000` in **Browser Tab 1** → Register as User A
2. Open `http://localhost:3000` in **Browser Tab 2** (or another browser) → Register as User B
3. In Tab 1: click the **+** button → search for User B → click Add
4. Click on User B in the sidebar → type a message → press Enter
5. In Tab 2: you'll see the message arrive in real-time!

---

## Database File Location

The SQLite database is a single file:
```
chatflow/chatflow.db
```

You can open it with a free tool to inspect your data:
- **DB Browser for SQLite**: https://sqlitebrowser.org (free, recommended)

Tables inside `chatflow.db`:
- `users` — stores all registered accounts
- `messages` — stores all chat messages
- `contacts` — stores who is connected to who

---

## Stop the Server

Press `Ctrl + C` in the terminal.

---

## Restart the Server Later

```bash
cd chatflow
node server.js
```

Your data is still there — `chatflow.db` persists between restarts.

---

## Common Errors and Fixes

### Error: `Cannot find module 'express'`
**Fix:** You forgot to run `npm install`. Run it now.

### Error: `EADDRINUSE: address already in use :::3000`
**Fix:** Port 3000 is busy. Either:
- Stop whatever is using port 3000, OR
- Change the port in `server.js`: find `const PORT = 3000` and change to `3001`, then open `http://localhost:3001`

### Error: `node is not recognized` (Windows)
**Fix:** Node.js is not installed or not in your PATH. Download it from https://nodejs.org and reinstall.

### Login says "Network error. Is the server running?"
**Fix:** The server is not running. Go to your terminal and run `node server.js`.

### Page shows nothing / blank screen
**Fix:** Make sure `index.html`, `style.css`, and `app.js` are inside the `public/` subfolder, not directly in `chatflow/`.

### Messages not sending in real-time
**Fix:** Make sure both browser tabs are open to `http://localhost:3000` (not just opening the HTML file directly).

---

## Bugs Fixed in This Version

| Bug | What was wrong | Fixed |
|-----|---------------|-------|
| Login not working | `avatar_color` field mismatch between login API and frontend | ✅ |
| Register button did nothing | `onclick` in HTML called functions before they were defined | ✅ |
| DOM errors on load | `$()` ran before DOM was ready | ✅ |
| Typing indicator broken | `sender_id` not passed in typing events | ✅ |
| Add contact modal empty | `allUsers` not cached for search filter | ✅ |
| Auth link clicks | Used `onclick=""` in HTML which failed; now uses `addEventListener` | ✅ |

---

## Project File Overview

```
chatflow/
│
├── server.js          ← Backend: Express server + SQLite + Socket.IO
├── package.json       ← Lists all npm packages needed
├── chatflow.db        ← SQLite database (auto-created on first run)
│
└── public/            ← Frontend (served as static files)
    ├── index.html     ← Full UI (auth screen + chat app)
    ├── style.css      ← All styling
    └── app.js         ← Frontend logic (login, send, receive, contacts)
```

---

## API Endpoints Reference

| Method | URL                      | Auth? | What it does                      |
|--------|--------------------------|-------|-----------------------------------|
| POST   | /api/register            | No    | Create a new account              |
| POST   | /api/login               | No    | Login, returns JWT token          |
| GET    | /api/profile             | Yes   | Get your profile                  |
| PUT    | /api/profile             | Yes   | Update your name or bio           |
| GET    | /api/users               | Yes   | List all other users              |
| GET    | /api/contacts            | Yes   | Your contacts list                |
| POST   | /api/contacts            | Yes   | Add a contact by ID               |
| GET    | /api/messages/:userId    | Yes   | Load conversation with a user     |
| GET    | /api/unread              | Yes   | Get unread counts per sender      |

---

## Socket Events Reference

| Event            | Who sends it   | What it does                      |
|------------------|----------------|-----------------------------------|
| `user:join`      | Client         | Marks you as online               |
| `message:send`   | Client         | Sends a message (saved to DB)     |
| `message:sent`   | Server         | Confirms message was saved        |
| `message:receive`| Server         | Delivers message to recipient     |
| `typing:start`   | Client         | Tells other user you're typing    |
| `typing:stop`    | Client         | Tells other user you stopped      |
| `user:status`    | Server (all)   | Broadcasts online/offline status  |
