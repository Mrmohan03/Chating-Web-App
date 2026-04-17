const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// Controllers
const authCtrl = require('../controllers/authController');
const chatCtrl = require('../controllers/chatController');

// Auth Routes
router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);

// Protected Chat Routes
router.get('/users', authMiddleware, chatCtrl.getUsers);
router.get('/contacts', authMiddleware, chatCtrl.getContacts);
router.post('/contacts', authMiddleware, chatCtrl.addContact);
router.get('/messages/:userId', authMiddleware, chatCtrl.getMessages);
router.get('/unread', authMiddleware, chatCtrl.getUnread);
router.post('/upload', authMiddleware, upload.single('file'), chatCtrl.uploadFile);


// Profile Routes
router.put('/profile', authMiddleware, chatCtrl.updateProfile);

// Group Routes
router.post('/groups', authMiddleware, chatCtrl.createGroup);
router.get('/groups', authMiddleware, chatCtrl.getGroups);

module.exports = router;