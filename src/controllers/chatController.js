const supabase = require('../config/supabase');

exports.getUsers = async (req, res) => {
  // Added 'avatar_url' to the select query!
  const { data } = await supabase.from('users')
    .select('id, name, email, bio, avatar_color, avatar_url, status')
    .neq('id', req.user.id);
  res.json(data || []);
};

exports.getContacts = async (req, res) => {
  // Added 'avatar_url' to the select query!
  const { data } = await supabase.from('contacts')
    .select('users:contact_id(id, name, email, bio, avatar_color, avatar_url, status)')
    .eq('user_id', req.user.id);
  res.json((data || []).map(d => d.users));
};

exports.addContact = async (req, res) => {
  const { contact_id } = req.body;
  await supabase.from('contacts').upsert([{ user_id: req.user.id, contact_id }, { user_id: contact_id, contact_id: req.user.id }]);
  res.json({ success: true });
};

exports.getMessages = async (req, res) => {
  const otherId = req.params.userId;
  const isGroup = req.query.isGroup === 'true';

  try {
    let query;
    if (isGroup) {
      // PRO FIX: Join the users table to get the sender's name & color!
      query = supabase.from('messages')
        .select(`*,sender:users!messages_sender_id_fkey(name, avatar_color)`) 
        .eq('group_id', otherId)
        .order('created_at', { ascending: true });
    } else {
      query = supabase.from('messages')
        .select(`*`)
        .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${req.user.id})`)
        .order('created_at', { ascending: true });
      
      await supabase.from('messages').update({ is_read: true }).match({ sender_id: otherId, receiver_id: req.user.id, is_read: false });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);

  } catch (error) {
    console.error("❌ GET MESSAGES ERROR:", error.message);
    res.status(400).json({ error: error.message });
  }
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
// --- NEW: Profile Update ---
exports.updateProfile = async (req, res) => {
  const { name, bio, avatar_url } = req.body;
  const { data, error } = await supabase.from('users')
    .update({ name, bio, avatar_url })
    .eq('id', req.user.id)
    .select('id, name, email, bio, avatar_color, avatar_url, status').single();
    
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

// --- NEW: Group Creation ---
exports.createGroup = async (req, res) => {
  const { name, memberIds } = req.body;
  
  try {
    // 1. Create the Group
    const { data: group, error: groupErr } = await supabase.from('groups')
      .insert([{ name, created_by: req.user.id }]).select().single();
    if (groupErr) throw groupErr;

    // 2. Add members (including the creator)
    const allMembers = [...new Set([...memberIds, req.user.id])].map(id => ({
      group_id: group.id, user_id: id
    }));
    
    const { error: membersErr } = await supabase.from('group_members').insert(allMembers);
    if (membersErr) throw membersErr;

    res.json({ ...group, isGroup: true });
  } catch (error) {
    console.error("❌ CREATE GROUP ERROR:", error.message);
    res.status(400).json({ error: error.message });
  }
};

// --- NEW: Fetch Groups ---
exports.getGroups = async (req, res) => {
  try {
    const { data, error } = await supabase.from('group_members')
      .select('groups (id, name, avatar_url)')
      .eq('user_id', req.user.id);
      
    if (error) throw error;

    // Safely format the data so the frontend doesn't crash
    const formattedGroups = data
      .map(d => d.groups)       // Extract group object
      .filter(g => g !== null)  // Remove nulls if a group was deleted
      .map(g => ({ ...g, isGroup: true })); // Add the isGroup flag
      
    res.json(formattedGroups);
  } catch (error) {
    console.error("❌ FETCH GROUPS ERROR:", error.message);
    res.status(400).json({ error: error.message });
  }
};