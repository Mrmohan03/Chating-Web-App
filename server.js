require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Import Modules
const apiRoutes = require('./src/routes/api');
const setupSocket = require('./src/socket/index');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api', apiRoutes);

// Setup WebSockets
setupSocket(io);

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 ChatFlow online at http://localhost:${PORT}`);
});