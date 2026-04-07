const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = 'chatflow_secret_key_2024';
const PORT       = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ══════════════════════════════
   DATABASE SETUP
══════════════════════════════ */
const db = new sqlite3.Database('./chatflow.db', (err) => {
  if (err) { console.error('DB Error:', err.message); process.exit(1); }
  console.log('Connected to SQLite database (chatflow.db)');
});

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    name         TEXT     NOT NULL,
    email        TEXT     UNIQUE NOT NULL,
    password     TEXT     NOT NULL,
    bio          TEXT     DEFAULT 'Hey there! I am using ChatFlow.',
    avatar_color TEXT     DEFAULT '#00a884',
    status       TEXT     DEFAULT 'offline',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    sender_id   INTEGER  NOT NULL,
    receiver_id INTEGER  NOT NULL,
    text        TEXT,
    type        TEXT     DEFAULT 'text',
    is_read     INTEGER  DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id)   REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    contact_id INTEGER NOT NULL,
    UNIQUE(user_id, contact_id),
    FOREIGN KEY(user_id)    REFERENCES users(id),
    FOREIGN KEY(contact_id) REFERENCES users(id)
  )`);
});

/* ══════════════════════════════
   AUTH MIDDLEWARE
══════════════════════════════ */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired. Please login again.' });
  }
}

/* ══════════════════════════════
   AUTH ROUTES
══════════════════════════════ */

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are all required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const COLORS = ['#00a884','#ef4444','#f97316','#3b82f6','#a855f7','#ec4899','#14b8a6','#eab308'];
  const avatar_color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const hash = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (name, email, password, avatar_color) VALUES (?,?,?,?)`,
    [name.trim(), email.trim().toLowerCase(), hash, avatar_color],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE'))
          return res.status(400).json({ error: 'This email is already registered' });
        return res.status(500).json({ error: 'Registration failed: ' + err.message });
      }
      const token = jwt.sign(
        { id: this.lastID, name: name.trim(), email: email.trim().toLowerCase() },
        JWT_SECRET, { expiresIn: '7d' }
      );
      res.json({
        token,
        user: { id: this.lastID, name: name.trim(), email: email.trim().toLowerCase(),
                bio: 'Hey there! I am using ChatFlow.', avatar_color }
      });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  db.get(`SELECT * FROM users WHERE email = ?`, [email.trim().toLowerCase()], async (err, user) => {
    if (err)   return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'No account found with this email' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Incorrect password' });

    db.run(`UPDATE users SET status='online' WHERE id=?`, [user.id]);

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email,
              bio: user.bio, avatar_color: user.avatar_color }
    });
  });
});

/* ══════════════════════════════
   USER ROUTES
══════════════════════════════ */

app.get('/api/profile', authMiddleware, (req, res) => {
  db.get(
    `SELECT id, name, email, bio, avatar_color, status, created_at FROM users WHERE id=?`,
    [req.user.id], (err, row) => {
      if (err || !row) return res.status(500).json({ error: 'Could not fetch profile' });
      res.json(row);
    }
  );
});

app.put('/api/profile', authMiddleware, (req, res) => {
  const { name, bio } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.run(`UPDATE users SET name=?, bio=? WHERE id=?`,
    [name.trim(), (bio||'').trim(), req.user.id], (err) => {
      if (err) return res.status(500).json({ error: 'Update failed' });
      res.json({ success: true });
    }
  );
});

app.get('/api/users', authMiddleware, (req, res) => {
  db.all(
    `SELECT id, name, email, bio, avatar_color, status FROM users WHERE id != ?`,
    [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows || []);
    }
  );
});

/* ══════════════════════════════
   CONTACTS ROUTES
══════════════════════════════ */

app.get('/api/contacts', authMiddleware, (req, res) => {
  db.all(
    `SELECT u.id, u.name, u.email, u.bio, u.avatar_color, u.status
     FROM contacts c JOIN users u ON u.id = c.contact_id
     WHERE c.user_id = ? ORDER BY u.name ASC`,
    [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows || []);
    }
  );
});

app.post('/api/contacts', authMiddleware, (req, res) => {
  const { contact_id } = req.body || {};
  if (!contact_id) return res.status(400).json({ error: 'contact_id is required' });
  if (Number(contact_id) === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });

  db.run(`INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?,?)`,
    [req.user.id, contact_id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to add contact' });
      db.run(`INSERT OR IGNORE INTO contacts (user_id, contact_id) VALUES (?,?)`, [contact_id, req.user.id]);
      res.json({ success: true });
    }
  );
});

/* ══════════════════════════════
   MESSAGE ROUTES
══════════════════════════════ */

app.get('/api/messages/:userId', authMiddleware, (req, res) => {
  const otherId = parseInt(req.params.userId);
  if (isNaN(otherId)) return res.status(400).json({ error: 'Invalid user id' });

  db.all(
    `SELECT m.id, m.sender_id, m.receiver_id, m.text, m.type, m.is_read, m.created_at,
            u.name AS sender_name, u.avatar_color AS sender_color
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?)
     ORDER BY m.created_at ASC`,
    [req.user.id, otherId, otherId, req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      db.run(`UPDATE messages SET is_read=1 WHERE sender_id=? AND receiver_id=? AND is_read=0`,
        [otherId, req.user.id]);
      res.json(rows || []);
    }
  );
});

app.get('/api/unread', authMiddleware, (req, res) => {
  db.all(
    `SELECT sender_id, COUNT(*) AS count FROM messages WHERE receiver_id=? AND is_read=0 GROUP BY sender_id`,
    [req.user.id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      const result = {};
      (rows || []).forEach(r => { result[r.sender_id] = r.count; });
      res.json(result);
    }
  );
});

/* ══════════════════════════════
   SOCKET.IO
══════════════════════════════ */
const onlineUsers = {};

io.on('connection', (socket) => {

  socket.on('user:join', (userId) => {
    if (!userId) return;
    onlineUsers[String(userId)] = socket.id;
    db.run(`UPDATE users SET status='online' WHERE id=?`, [userId]);
    io.emit('user:status', { userId: String(userId), status: 'online' });
    console.log(`User ${userId} online`);
  });

  socket.on('message:send', (data) => {
    const { sender_id, receiver_id, text, type } = data;
    if (!sender_id || !receiver_id || !text) return;

    db.run(
      `INSERT INTO messages (sender_id, receiver_id, text, type) VALUES (?,?,?,?)`,
      [sender_id, receiver_id, text.trim(), type || 'text'],
      function (err) {
        if (err) { console.error('Message save error:', err.message); return; }
        const saved = {
          id: this.lastID, sender_id, receiver_id,
          text: text.trim(), type: type || 'text',
          is_read: 0, created_at: new Date().toISOString(),
        };
        const receiverSocket = onlineUsers[String(receiver_id)];
        if (receiverSocket) io.to(receiverSocket).emit('message:receive', saved);
        socket.emit('message:sent', saved);
      }
    );
  });

  socket.on('typing:start', ({ sender_id, receiver_id }) => {
    const s = onlineUsers[String(receiver_id)];
    if (s) io.to(s).emit('typing:start', { sender_id });
  });

  socket.on('typing:stop', ({ sender_id, receiver_id }) => {
    const s = onlineUsers[String(receiver_id)];
    if (s) io.to(s).emit('typing:stop', { sender_id });
  });

  socket.on('disconnect', () => {
    const userId = Object.keys(onlineUsers).find(k => onlineUsers[k] === socket.id);
    if (userId) {
      delete onlineUsers[userId];
      db.run(`UPDATE users SET status='offline' WHERE id=?`, [userId]);
      io.emit('user:status', { userId, status: 'offline' });
      console.log(`User ${userId} offline`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`ChatFlow running at http://localhost:${PORT}`);
});
