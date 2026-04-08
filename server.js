require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'chatflow_secret_key_2024';
const PORT       = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase Connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/* ── AUTH MIDDLEWARE ── */
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired.' });
  }
}

/* ── AUTH ROUTES ── */
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  const hash = await bcrypt.hash(password, 10);
  const COLORS = ['#00a884','#ef4444','#f97316','#3b82f6','#a855f7'];
  const avatar_color = COLORS[Math.floor(Math.random() * COLORS.length)];

  const { data, error } = await supabase.from('users').insert([{ 
    name: name.trim(), email: email.trim().toLowerCase(), password: hash, avatar_color 
  }]).select().single();

  if (error) return res.status(400).json({ error: 'Registration failed: ' + error.message });

  const token = jwt.sign({ id: data.id, name: data.name, email: data.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: data });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { data: user, error } = await supabase.from('users').select('*').eq('email', email.trim().toLowerCase()).single();

  if (error || !user) return res.status(400).json({ error: 'Account not found' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Wrong password' });

  await supabase.from('users').update({ status: 'online' }).eq('id', user.id);
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

/* ── USER & CONTACT ROUTES ── */
app.get('/api/users', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('users').select('id, name, email, bio, avatar_color, status').neq('id', req.user.id);
  res.json(data || []);
});

app.get('/api/contacts', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('contacts').select('users:contact_id(id, name, email, bio, avatar_color, status)').eq('user_id', req.user.id);
  res.json((data || []).map(d => d.users));
});

app.post('/api/contacts', authMiddleware, async (req, res) => {
  const { contact_id } = req.body;
  await supabase.from('contacts').upsert([{ user_id: req.user.id, contact_id }, { user_id: contact_id, contact_id: req.user.id }]);
  res.json({ success: true });
});

/* ── MESSAGES ── */
app.get('/api/messages/:userId', authMiddleware, async (req, res) => {
  const otherId = req.params.userId;
  const { data } = await supabase.from('messages').select('*')
    .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${req.user.id})`)
    .order('created_at', { ascending: true });
  
  await supabase.from('messages').update({ is_read: true }).match({ sender_id: otherId, receiver_id: req.user.id, is_read: false });
  res.json(data || []);
});

app.get('/api/unread', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('messages').select('sender_id').match({ receiver_id: req.user.id, is_read: false });
  const counts = {};
  data?.forEach(m => counts[m.sender_id] = (counts[m.sender_id] || 0) + 1);
  res.json(counts);
});

/* ── SOCKET.IO ── */
const onlineUsers = {};
io.on('connection', (socket) => {
  socket.on('user:join', async (userId) => {
    onlineUsers[String(userId)] = socket.id;
    await supabase.from('users').update({ status: 'online' }).eq('id', userId);
    io.emit('user:status', { userId, status: 'online' });
  });

  socket.on('message:send', async (data) => {
    const { data: saved } = await supabase.from('messages').insert([data]).select().single();
    if (saved) {
      const target = onlineUsers[String(data.receiver_id)];
      if (target) io.to(target).emit('message:receive', saved);
      socket.emit('message:sent', saved);
    }
  });

  socket.on('disconnect', async () => {
    const userId = Object.keys(onlineUsers).find(k => onlineUsers[k] === socket.id);
    if (userId) {
      delete onlineUsers[userId];
      await supabase.from('users').update({ status: 'offline' }).eq('id', userId);
      io.emit('user:status', { userId, status: 'offline' });
    }
  });
});

server.listen(PORT, () => console.log(`ChatFlow online at http://localhost:${PORT}`));
