const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'chatflow_secret_key_2024';

exports.register = async (req, res) => {
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
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  const { data: user, error } = await supabase.from('users').select('*').eq('email', email.trim().toLowerCase()).single();

  if (error || !user) return res.status(400).json({ error: 'Account not found' });
  
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Wrong password' });

  await supabase.from('users').update({ status: 'online' }).eq('id', user.id);
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
};