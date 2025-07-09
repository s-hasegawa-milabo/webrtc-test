const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    cb(null, uniqueId + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

const rooms = new Map();
const users = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId, userId) => {
    console.log(`User ${userId} joining room ${roomId}`);
    socket.join(roomId);
    users.set(socket.id, { userId, roomId });
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    // 既存のユーザーリストを新規ユーザーに送信
    const existingUsers = Array.from(rooms.get(roomId));
    console.log(`Existing users in room ${roomId}:`, existingUsers);
    socket.emit('existing-users', existingUsers);
    
    // 新規ユーザーをルームに追加
    rooms.get(roomId).add(userId);
    
    // 新規ユーザーを既存ユーザーに通知
    socket.to(roomId).emit('user-joined', userId);
    
    console.log(`Room ${roomId} now has users:`, Array.from(rooms.get(roomId)));
  });

  socket.on('send-message', (message, roomId) => {
    io.to(roomId).emit('receive-message', message);
  });

  socket.on('send-file-message', (fileMessage, roomId) => {
    io.to(roomId).emit('receive-message', fileMessage);
  });

  socket.on('video-toggle', (enabled, roomId) => {
    const userId = users.get(socket.id)?.userId;
    if (userId) {
      socket.to(roomId).emit('user-video-toggle', userId, enabled);
    }
  });

  socket.on('webrtc-offer', (offer, targetUserId) => {
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => users.get(s.id)?.userId === targetUserId);
    
    if (targetSocket) {
      targetSocket.emit('webrtc-offer', offer, users.get(socket.id)?.userId);
    }
  });

  socket.on('webrtc-answer', (answer, targetUserId) => {
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => users.get(s.id)?.userId === targetUserId);
    
    if (targetSocket) {
      targetSocket.emit('webrtc-answer', answer, users.get(socket.id)?.userId);
    }
  });

  socket.on('webrtc-ice-candidate', (candidate, targetUserId) => {
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => users.get(s.id)?.userId === targetUserId);
    
    if (targetSocket) {
      targetSocket.emit('webrtc-ice-candidate', candidate, users.get(socket.id)?.userId);
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const { userId, roomId } = user;
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(userId);
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
        }
      }
      socket.to(roomId).emit('user-left', userId);
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileInfo = {
    id: uuidv4(),
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  };
  
  res.json(fileInfo);
});

app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads', filename);
  res.download(filePath);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});