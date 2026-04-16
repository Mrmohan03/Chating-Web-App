const supabase = require('../config/supabase');

exports.getUsers = async (req, res) => {
  const { data } = await supabase.from('users').select('id, name, email, bio, avatar_color, status').neq('id', req.user.id);
  res.json(data || []);
};

exports.getContacts = async (req, res) => {
  const { data } = await supabase.from('contacts').select('users:contact_id(id, name, email, bio, avatar_color, status)').eq('user_id', req.user.id);
  res.json((data || []).map(d => d.users));
};

exports.addContact = async (req, res) => {
  const { contact_id } = req.body;
  await supabase.from('contacts').upsert([{ user_id: req.user.id, contact_id }, { user_id: contact_id, contact_id: req.user.id }]);
  res.json({ success: true });
};

exports.getMessages = async (req, res) => {
  const otherId = req.params.userId;
  const { data } = await supabase.from('messages').select('*')
    .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${req.user.id})`)
    .order('created_at', { ascending: true });
  
  await supabase.from('messages').update({ is_read: true }).match({ sender_id: otherId, receiver_id: req.user.id, is_read: false });
  res.json(data || []);
};

exports.getUnread = async (req, res) => {
  const { data } = await supabase.from('messages').select('sender_id').match({ receiver_id: req.user.id, is_read: false });
  const counts = {};
  data?.forEach(m => counts[m.sender_id] = (counts[m.sender_id] || 0) + 1);
  res.json(counts);
};

exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    console.log("📤 Starting upload for:", req.file.originalname);
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `${req.user.id}/${fileName}`;

    const { error } = await supabase.storage.from('chat_media').upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) {
      console.error("❌ SUPABASE STORAGE ERROR:", error.message);
      return res.status(400).json({ error: error.message });
    }

    const { data: publicUrlData } = supabase.storage.from('chat_media').getPublicUrl(filePath);
    console.log("✅ Upload successful! URL:", publicUrlData.publicUrl);

    res.json({
      url: publicUrlData.publicUrl,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error("❌ SERVER UPLOAD CRASH:", error);
    res.status(500).json({ error: 'Internal server error during upload.' });
  }
};