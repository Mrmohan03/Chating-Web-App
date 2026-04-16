const supabase = require('../config/supabase');
const onlineUsers = {};

module.exports = (io) => {
  io.on('connection', (socket) => {
    
    socket.on('user:join', async (userId) => {
      onlineUsers[String(userId)] = socket.id;
      await supabase.from('users').update({ status: 'online' }).eq('id', userId);
      io.emit('user:status', { userId, status: 'online' });
    });

    socket.on('message:send', async (data) => {
      // PRO FIX: Sanitize data!
      const dbPayload = {
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
          text: data.text || '',
          type: data.type || 'text',
          is_read: false,
          file_url: data.file_url || null,
          file_name: data.file_name || null,
          file_type: data.file_type || null,
          file_size: data.file_size || null
      };

      console.log("1. Attempting to save message to DB...");

      const { data: saved, error } = await supabase.from('messages').insert([dbPayload]).select().single();
      
      if (error) return console.error("❌ SUPABASE DB ERROR:", error.message);

      if (saved) {
        console.log("✅ Message saved to DB successfully!");
        saved.client_id = data.client_id;
        
        const target = onlineUsers[String(data.receiver_id)];
        if (target) {
          io.to(target).emit('message:receive', saved);
        }
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
};