const fs = require('fs-extra');
const path = require('path');

const packageJson = (projectName) => ({
  name: projectName,
  version: "1.0.0",
  description: "Real-time chat application backend",
  main: "server.js",
  scripts: {
    start: "node server.js",
    dev: "nodemon server.js",
    test: "echo \"Error: no test specified\" && exit 1"
  },
  keywords: ["express", "socket.io", "chat", "realtime", "mongodb"],
  author: "",
  license: "MIT",
  engines: {
    node: ">=16.0.0"
  },
  dependencies: {
    express: "^4.21.2",
    "socket.io": "^4.8.1",
    cors: "^2.8.5",
    dotenv: "^17.2.1",
    mongoose: "^8.16.5",
    helmet: "^8.1.0",
    morgan: "^1.10.0",
    compression: "^1.7.4",
    bcryptjs: "^3.0.2",
    jsonwebtoken: "^9.0.2",
    validator: "^13.15.15"
  },
  devDependencies: {
    nodemon: "^3.1.10"
  }
});

const serverJs = `const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, validate: [validator.isEmail, 'Invalid email'] },
  password: { type: String, required: true, minlength: 6 },
  avatar: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);

// Room Schema
const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  isPrivate: { type: Boolean, default: false },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  edited: { type: Boolean, default: false },
  editedAt: Date
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

// Auth middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chat App Backend Running!',
    version: '1.0.0',
    endpoints: ['/api/auth/register', '/api/auth/login', '/api/rooms', '/api/messages']
  });
});

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = new User({ username, email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret');
    res.status(201).json({ 
      token, 
      user: { id: user._id, username: user.username, email: user.email } 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.isOnline = true;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret');
    res.json({ 
      token, 
      user: { id: user._id, username: user.username, email: user.email } 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Room routes
app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find({ 
      $or: [{ isPrivate: false }, { members: req.user._id }] 
    }).populate('admin', 'username');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    const room = new Room({
      name,
      description,
      isPrivate: isPrivate || false,
      admin: req.user._id,
      members: [req.user._id]
    });
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Message routes
app.get('/api/messages/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    
    const room = await Room.findById(roomId);
    if (!room || (room.isPrivate && !room.members.includes(req.user._id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({ room: roomId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io connection handling
const connectedUsers = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error('Authentication error'));
    }
    
    socket.userId = user._id.toString();
    socket.username = user.username;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(\`✅ User connected: \${socket.username} (\${socket.id})\`);
  
  connectedUsers.set(socket.userId, {
    socketId: socket.id,
    username: socket.username,
    joinedAt: new Date()
  });

  socket.on('join-room', async (roomId) => {
    try {
      const room = await Room.findById(roomId);
      if (!room || (room.isPrivate && !room.members.includes(socket.userId))) {
        socket.emit('error', { message: 'Access denied to room' });
        return;
      }
      
      socket.join(roomId);
      socket.currentRoom = roomId;
      
      socket.to(roomId).emit('user-joined', {
        username: socket.username,
        message: \`\${socket.username} joined the room\`
      });
      
      console.log(\`👥 \${socket.username} joined room: \${room.name}\`);
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('send-message', async (data) => {
    try {
      const { content, roomId } = data;
      
      if (!content || !roomId) {
        socket.emit('error', { message: 'Message content and room ID required' });
        return;
      }

      const room = await Room.findById(roomId);
      if (!room || (room.isPrivate && !room.members.includes(socket.userId))) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const message = new Message({
        content,
        sender: socket.userId,
        room: roomId
      });
      
      await message.save();
      await message.populate('sender', 'username avatar');
      
      io.to(roomId).emit('receive-message', {
        id: message._id,
        content: message.content,
        sender: message.sender,
        timestamp: message.createdAt,
        messageType: message.messageType
      });
      
    } catch (error) {
      console.error('❌ Error saving message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user-typing', {
      username: socket.username,
      isTyping: data.isTyping
    });
  });

  socket.on('disconnect', async () => {
    console.log(\`❌ User disconnected: \${socket.username}\`);
    
    connectedUsers.delete(socket.userId);
    
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('user-left', {
        username: socket.username,
        message: \`\${socket.username} left the room\`
      });
    }

    // Update user offline status
    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
  });
});

server.listen(PORT, () => {
  console.log(\`🚀 Chat server running on port \${PORT}\`);
  console.log(\`📍 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🌐 URL: http://localhost:\${PORT}\`);
});`;

const envFile = `PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/chatapp
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=http://localhost:3000`;

const readmeFile = (projectName) => `# ${projectName}

Professional real-time chat application backend with user authentication, room management, and Socket.io.

## Features
- 🔐 User authentication with JWT
- 💬 Real-time messaging with Socket.io
- 🏠 Room-based chat system (public/private rooms)
- 📝 Message history with pagination
- 👥 User online/offline status
- ⚡ Typing indicators
- 🔒 Secure password hashing
- 📊 Message validation and error handling
- 🛡️ Security middleware (Helmet, CORS)
- 📈 Request logging with Morgan

## Prerequisites
- MongoDB installed and running locally
- Node.js (v14 or higher)

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Make sure MongoDB is running on your system

3. Update the \`.env\` file with your configuration:
\`\`\`env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/chatapp
\`\`\`

4. Start the server:
\`\`\`bash
npm start
\`\`\`

For development with auto-reload:
\`\`\`bash
npm run dev
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/auth/register\` - Register new user
  \`\`\`json
  {
    "username": "john_doe",
    "email": "john@example.com",
    "password": "password123"
  }
  \`\`\`

- \`POST /api/auth/login\` - Login user
  \`\`\`json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  \`\`\`

### Rooms
- \`GET /api/rooms\` - Get available rooms (requires auth)
- \`POST /api/rooms\` - Create new room (requires auth)
  \`\`\`json
  {
    "name": "General Chat",
    "description": "General discussion room",
    "isPrivate": false
  }
  \`\`\`

### Messages
- \`GET /api/messages/:roomId?page=1&limit=50\` - Get room messages (requires auth)

## Socket Events

### Authentication
Connect with JWT token:
\`\`\`javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
\`\`\`

### Client to Server Events:
- \`join-room\` - Join a chat room
  \`\`\`javascript
  socket.emit('join-room', roomId);
  \`\`\`

- \`send-message\` - Send message to room
  \`\`\`javascript
  socket.emit('send-message', {
    content: 'Hello everyone!',
    roomId: 'room-id-here'
  });
  \`\`\`

- \`typing\` - Send typing indicator
  \`\`\`javascript
  socket.emit('typing', {
    roomId: 'room-id-here',
    isTyping: true
  });
  \`\`\`

### Server to Client Events:
- \`receive-message\` - New message received
- \`user-joined\` - User joined room
- \`user-left\` - User left room
- \`user-typing\` - User typing indicator
- \`error\` - Error message

## Usage Example

### Frontend Integration:
\`\`\`javascript
// Connect to server
const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('token') }
});

// Join a room
socket.emit('join-room', roomId);

// Send message
socket.emit('send-message', {
  content: 'Hello!',
  roomId: roomId
});

// Listen for messages
socket.on('receive-message', (message) => {
  console.log('New message:', message);
});

// Handle typing
socket.on('user-typing', (data) => {
  console.log(\`\${data.username} is typing...\`);
});
\`\`\`

## Database Schema

### User
- username (unique)
- email (unique, validated)
- password (hashed)
- avatar
- isOnline
- lastSeen

### Room
- name (unique)
- description
- isPrivate
- members (User references)
- admin (User reference)

### Message
- content
- sender (User reference)
- room (Room reference)
- messageType (text/image/file)
- edited
- editedAt

## Security Features
- Password hashing with bcrypt
- JWT token authentication
- Input validation
- Rate limiting ready
- CORS protection
- Helmet security headers

Server runs on http://localhost:3000
`;

async function generate(projectPath, projectName) {
  // Create folder structure
  await fs.ensureDir(path.join(projectPath, "models"));
  await fs.ensureDir(path.join(projectPath, "routes"));
  await fs.ensureDir(path.join(projectPath, "middleware"));
  await fs.ensureDir(path.join(projectPath, "controllers"));
  await fs.ensureDir(path.join(projectPath, "config"));
  await fs.ensureDir(path.join(projectPath, "utils"));

  // Create package.json
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson(projectName), { spaces: 2 });

  // Create main server file
  const mainServerJs = `const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const connectDB = require('./config/database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');

app.get('/', (req, res) => {
  res.json({ 
    message: 'Chat App Backend Running!',
    version: '1.0.0',
    endpoints: ['/api/auth/register', '/api/auth/login', '/api/rooms', '/api/messages']
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);

// Socket.io setup
require('./utils/socketHandler')(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(\`🚀 Chat server running on port \${PORT}\`);
  console.log(\`📍 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🌐 URL: http://localhost:\${PORT}\`);
});`;

  await fs.writeFile(path.join(projectPath, 'server.js'), mainServerJs);

  // Create database config
  const databaseConfig = `const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;`;

  await fs.writeFile(path.join(projectPath, 'config/database.js'), databaseConfig);

  // Create User model
  const userModel = `const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, validate: [validator.isEmail, 'Invalid email'] },
  password: { type: String, required: true, minlength: 6 },
  avatar: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);`;

  await fs.writeFile(path.join(projectPath, 'models/User.js'), userModel);

  // Create Room model
  const roomModel = `const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  isPrivate: { type: Boolean, default: false },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);`;

  await fs.writeFile(path.join(projectPath, 'models/Room.js'), roomModel);

  // Create Message model
  const messageModel = `const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  edited: { type: Boolean, default: false },
  editedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);`;

  await fs.writeFile(path.join(projectPath, 'models/Message.js'), messageModel);

  // Create auth middleware
  const authMiddleware = `const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticateToken };`;

  await fs.writeFile(path.join(projectPath, 'middleware/auth.js'), authMiddleware);

  // Create auth controller
  const authController = `const jwt = require('jsonwebtoken');
const User = require('../models/User');

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const user = new User({ username, email, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret');
    res.status(201).json({ 
      token, 
      user: { id: user._id, username: user.username, email: user.email } 
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(400).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.isOnline = true;
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret');
    res.json({ 
      token, 
      user: { id: user._id, username: user.username, email: user.email } 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = { register, login };`;

  await fs.writeFile(path.join(projectPath, 'controllers/authController.js'), authController);

  // Create room controller
  const roomController = `const Room = require('../models/Room');

const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ 
      $or: [{ isPrivate: false }, { members: req.user._id }] 
    }).populate('admin', 'username');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createRoom = async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    const room = new Room({
      name,
      description,
      isPrivate: isPrivate || false,
      admin: req.user._id,
      members: [req.user._id]
    });
    await room.save();
    res.status(201).json(room);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = { getRooms, createRoom };`;

  await fs.writeFile(path.join(projectPath, 'controllers/roomController.js'), roomController);

  // Create message controller
  const messageController = `const Message = require('../models/Message');
const Room = require('../models/Room');

const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    
    const room = await Room.findById(roomId);
    if (!room || (room.isPrivate && !room.members.includes(req.user._id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({ room: roomId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getMessages };`;

  await fs.writeFile(path.join(projectPath, 'controllers/messageController.js'), messageController);

  // Create auth routes
  const authRoutes = `const express = require('express');
const { register, login } = require('../controllers/authController');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/auth.js'), authRoutes);

  // Create room routes
  const roomRoutes = `const express = require('express');
const { getRooms, createRoom } = require('../controllers/roomController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, getRooms);
router.post('/', authenticateToken, createRoom);

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/rooms.js'), roomRoutes);

  // Create message routes
  const messageRoutes = `const express = require('express');
const { getMessages } = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/:roomId', authenticateToken, getMessages);

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/messages.js'), messageRoutes);

  // Create socket handler
  const socketHandler = `const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');

const connectedUsers = new Map();

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      const user = await User.findById(decoded.userId);
      if (!user) {
        return next(new Error('Authentication error'));
      }
      
      socket.userId = user._id.toString();
      socket.username = user.username;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(\`✅ User connected: \${socket.username} (\${socket.id})\`);
    
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      username: socket.username,
      joinedAt: new Date()
    });

    socket.on('join-room', async (roomId) => {
      try {
        const room = await Room.findById(roomId);
        if (!room || (room.isPrivate && !room.members.includes(socket.userId))) {
          socket.emit('error', { message: 'Access denied to room' });
          return;
        }
        
        socket.join(roomId);
        socket.currentRoom = roomId;
        
        socket.to(roomId).emit('user-joined', {
          username: socket.username,
          message: \`\${socket.username} joined the room\`
        });
        
        console.log(\`👥 \${socket.username} joined room: \${room.name}\`);
      } catch (error) {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('send-message', async (data) => {
      try {
        const { content, roomId } = data;
        
        if (!content || !roomId) {
          socket.emit('error', { message: 'Message content and room ID required' });
          return;
        }

        const room = await Room.findById(roomId);
        if (!room || (room.isPrivate && !room.members.includes(socket.userId))) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        const message = new Message({
          content,
          sender: socket.userId,
          room: roomId
        });
        
        await message.save();
        await message.populate('sender', 'username avatar');
        
        io.to(roomId).emit('receive-message', {
          id: message._id,
          content: message.content,
          sender: message.sender,
          timestamp: message.createdAt,
          messageType: message.messageType
        });
        
      } catch (error) {
        console.error('❌ Error saving message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing', (data) => {
      socket.to(data.roomId).emit('user-typing', {
        username: socket.username,
        isTyping: data.isTyping
      });
    });

    socket.on('disconnect', async () => {
      console.log(\`❌ User disconnected: \${socket.username}\`);
      
      connectedUsers.delete(socket.userId);
      
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('user-left', {
          username: socket.username,
          message: \`\${socket.username} left the room\`
        });
      }

      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    });
  });
};`;

  await fs.writeFile(path.join(projectPath, 'utils/socketHandler.js'), socketHandler);

  // Create other files
  await fs.writeFile(path.join(projectPath, '.env'), envFile);
  await fs.writeFile(path.join(projectPath, 'README.md'), readmeFile(projectName));
  await fs.writeFile(path.join(projectPath, '.gitignore'), 'node_modules/\n.env\n*.log\n');
}

module.exports = { generate };