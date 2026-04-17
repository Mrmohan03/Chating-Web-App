const supabase = require('../config/supabase');
const onlineUsers = {};

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    socket.on('user:join', async (userId) => {
      onlineUsers[String(userId)] = socket.id;
      
      // Update DB status
      await supabase.from('users').update({ status: 'online' }).eq('id', userId);
      io.emit('user:status', { userId, status: 'online' });

      // PRO FEATURE: Join all Group Rooms this user is part of
      const { data: groups } = await supabase.from('group_members').select('group_id').eq('user_id', userId);
      groups?.forEach(g => socket.join(g.group_id)); // Subscribes to group channel
    });

    socket.on('message:send', async (data) => {
      const dbPayload = {
          sender_id: data.sender_id,
          receiver_id: data.receiver_id || null, // Null if it's a group
          group_id: data.group_id || null,       // Has value if it's a group
          text: data.text || '',
          type: data.type || 'text',
          is_read: false,
          file_url: data.file_url || null,
          file_name: data.file_name || null,
          file_type: data.file_type || null,
          file_size: data.file_size || null
      };

      const { data: saved, error } = await supabase.from('messages').insert([dbPayload]).select().single();
      if (error) return console.error("❌ DB ERROR:", error.message);

      if (saved) {
        console.log("✅ Message saved to DB successfully!");
        saved.client_id = data.client_id;
        
        // Fix: Use the exact 'sender_id' column to pull the user
        try {
            const { data: senderInfo, error: senderErr } = await supabase
              .from('users')
              .select('name, avatar_color')
              .eq('id', saved.sender_id)
              .single();
              
            if (!senderErr && senderInfo) {
                saved.sender = senderInfo;
            } else {
                saved.sender = { name: "User", avatar_color: "#00a884" };
            }
        } catch (e) {
            saved.sender = { name: "User", avatar_color: "#00a884" };
        }
        
        // Group Routing
        if (data.group_id) {
          io.to(data.group_id).emit('message:receive', saved);
          socket.emit('message:sent', saved);
        } 
        // Direct Message Routing
        else {
          const target = onlineUsers[String(data.receiver_id)];
          if (target) {
            io.to(target).emit('message:receive', saved);
          }
          socket.emit('message:sent', saved);
        }
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
};