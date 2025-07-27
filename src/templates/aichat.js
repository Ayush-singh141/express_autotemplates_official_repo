const fs = require('fs-extra');
const path = require('path');

const packageJson = (projectName) => ({
  name: projectName,
  version: "1.0.0",
  description: "AI-powered chat backend",
  main: "server.js",
  scripts: {
    start: "node server.js",
    dev: "nodemon server.js",
    test: "echo \"Error: no test specified\" && exit 1"
  },
  keywords: ["express", "ai", "chat", "openai", "socket.io", "mongodb"],
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
    axios: "^1.11.0",
    openai: "^5.10.2",
    helmet: "^8.1.0",
    morgan: "^1.10.0",
    compression: "^1.7.4",
    bcryptjs: "^3.0.2",
    jsonwebtoken: "^9.0.2",
    validator: "^13.15.15",
    "express-rate-limit": "^8.0.1",
    "express-validator": "^7.2.1"
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
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { body, validationResult } = require('express-validator');
const OpenAI = require('openai');
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20 // limit chat requests to 20 per minute
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Security middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(limiter);

// CORS middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichat')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, validate: [validator.isEmail, 'Invalid email'] },
  password: { type: String, required: true, minlength: 6 },
  firstName: String,
  lastName: String,
  avatar: String,
  preferences: {
    model: { type: String, default: 'gpt-3.5-turbo' },
    temperature: { type: Number, default: 0.7, min: 0, max: 2 },
    maxTokens: { type: Number, default: 500, min: 1, max: 2000 }
  },
  usage: {
    totalMessages: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    lastUsed: Date
  }
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

// Chat Schema
const chatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    tokens: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  model: { type: String, default: 'gpt-3.5-turbo' },
  totalTokens: { type: Number, default: 0 },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

const Chat = mongoose.model('Chat', chatSchema);

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
    message: 'AI Chat Backend Running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      chat: '/api/chat',
      chats: '/api/chats'
    }
  });
});

// Authentication routes
app.post('/api/auth/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    const user = new User({ username, email, password, firstName, lastName });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        preferences: user.preferences,
        usage: user.usage
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/auth/preferences', authenticateToken, async (req, res) => {
  try {
    const { model, temperature, maxTokens } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        $set: {
          'preferences.model': model || 'gpt-3.5-turbo',
          'preferences.temperature': temperature || 0.7,
          'preferences.maxTokens': maxTokens || 500
        }
      },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Enhanced chat endpoint with authentication
app.post('/api/chat', chatLimiter, authenticateToken, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'Message and sessionId are required' });
    }

    // Find or create chat session
    let chat = await Chat.findOne({ sessionId, user: req.user._id });
    if (!chat) {
      chat = new Chat({
        sessionId,
        user: req.user._id,
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        messages: [],
        model: req.user.preferences.model
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    chat.messages.push(userMessage);

    // Prepare messages for OpenAI
    const systemMessage = { role: 'system', content: 'You are a helpful AI assistant.' };
    const conversationMessages = chat.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get AI response using user preferences
    const completion = await openai.chat.completions.create({
      model: req.user.preferences.model,
      messages: [systemMessage, ...conversationMessages],
      max_tokens: req.user.preferences.maxTokens,
      temperature: req.user.preferences.temperature
    });

    const aiResponse = completion.choices[0].message.content;
    const tokensUsed = completion.usage.total_tokens;

    // Add AI response
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      tokens: tokensUsed,
      timestamp: new Date()
    };
    chat.messages.push(assistantMessage);
    chat.totalTokens += tokensUsed;

    await chat.save();

    // Update user usage statistics
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        'usage.totalMessages': 1,
        'usage.totalTokens': tokensUsed
      },
      $set: {
        'usage.lastUsed': new Date()
      }
    });

    res.json({
      response: aiResponse,
      sessionId: chat.sessionId,
      tokensUsed,
      model: req.user.preferences.model
    });

  } catch (error) {
    console.error('Chat error:', error);
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ error: 'OpenAI API quota exceeded' });
    }
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Get chat session (authenticated)
app.get('/api/chat/:sessionId', authenticateToken, async (req, res) => {
  try {
    const chat = await Chat.findOne({ 
      sessionId: req.params.sessionId, 
      user: req.user._id 
    }).populate('user', 'username firstName lastName');
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all user's chat sessions
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.archived !== undefined) {
      filter.isArchived = req.query.archived === 'true';
    }

    const chats = await Chat.find(filter)
      .select('sessionId title totalTokens model createdAt updatedAt isArchived')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Chat.countDocuments(filter);

    res.json({
      chats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update chat title
app.put('/api/chat/:sessionId/title', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const chat = await Chat.findOneAndUpdate(
      { sessionId: req.params.sessionId, user: req.user._id },
      { title: title.trim() },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Archive/unarchive chat
app.put('/api/chat/:sessionId/archive', authenticateToken, async (req, res) => {
  try {
    const { isArchived } = req.body;

    const chat = await Chat.findOneAndUpdate(
      { sessionId: req.params.sessionId, user: req.user._id },
      { isArchived: isArchived === true },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete chat session
app.delete('/api/chat/:sessionId', authenticateToken, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      sessionId: req.params.sessionId,
      user: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json({ message: 'Chat session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user usage statistics
app.get('/api/usage', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('usage');
    const totalChats = await Chat.countDocuments({ user: req.user._id });
    const archivedChats = await Chat.countDocuments({ user: req.user._id, isArchived: true });

    res.json({
      ...user.usage,
      totalChats,
      archivedChats,
      activeChats: totalChats - archivedChats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    console.log(\`User joined session: \${sessionId}\`);
  });

  socket.on('send-message', async (data) => {
    try {
      const { message, sessionId, userId } = data;
      
      // Emit user message immediately
      io.to(sessionId).emit('user-message', {
        content: message,
        timestamp: new Date()
      });

      // Process with AI
      let chat = await Chat.findOne({ sessionId });
      if (!chat) {
        chat = new Chat({
          sessionId,
          userId,
          messages: [],
          title: message.substring(0, 50) + '...'
        });
      }

      chat.messages.push({ role: 'user', content: message });

      const messages = [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        ...chat.messages.map(msg => ({ role: msg.role, content: msg.content }))
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });

      const aiResponse = completion.choices[0].message.content;
      chat.messages.push({ role: 'assistant', content: aiResponse });
      await chat.save();

      // Emit AI response
      io.to(sessionId).emit('ai-response', {
        content: aiResponse,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Socket chat error:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(\`AI Chat server running on port \${PORT}\`);
});`;

const envFile = `PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/aichat
OPENAI_API_KEY=your-openai-api-key-here
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=http://localhost:3000`;

const readmeFile = (projectName) => `# ${projectName}

Professional AI-powered chat backend with user authentication, customizable AI models, usage tracking, and real-time messaging.

## Features
- 🤖 OpenAI GPT integration (GPT-3.5-turbo, GPT-4 support)
- 🔐 User authentication with JWT
- 💬 Real-time messaging with Socket.io
- 📊 Chat session management with archiving
- 🎛️ Customizable AI preferences (model, temperature, max tokens)
- 📈 Usage tracking and statistics
- 🛡️ Security middleware (Helmet, Rate limiting)
- 📝 Message history persistence
- 🔄 RESTful API and WebSocket support
- 📱 Pagination for chat listings
- 🏷️ Chat title management
- 📋 Token usage monitoring

## Prerequisites
- MongoDB installed and running
- OpenAI API key
- Node.js (v14 or higher)

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Get your OpenAI API key from https://platform.openai.com/

3. Update the \`.env\` file with your configuration:
\`\`\`env
OPENAI_API_KEY=your-actual-api-key-here
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/aichat
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
    "username": "johndoe",
    "email": "john@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }
  \`\`\`

- \`POST /api/auth/login\` - Login user
  \`\`\`json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  \`\`\`

- \`GET /api/auth/profile\` - Get user profile (authenticated)
- \`PUT /api/auth/preferences\` - Update AI preferences (authenticated)
  \`\`\`json
  {
    "model": "gpt-4",
    "temperature": 0.8,
    "maxTokens": 1000
  }
  \`\`\`

### Chat Management
- \`POST /api/chat\` - Send message and get AI response (authenticated, rate limited)
  \`\`\`json
  {
    "message": "Hello, AI!",
    "sessionId": "unique-session-id"
  }
  \`\`\`

- \`GET /api/chat/:sessionId\` - Get chat session history (authenticated)
- \`GET /api/chats?page=1&limit=20&archived=false\` - Get user's chat sessions (authenticated)
- \`PUT /api/chat/:sessionId/title\` - Update chat title (authenticated)
- \`PUT /api/chat/:sessionId/archive\` - Archive/unarchive chat (authenticated)
- \`DELETE /api/chat/:sessionId\` - Delete chat session (authenticated)

### Usage Statistics
- \`GET /api/usage\` - Get user usage statistics (authenticated)

### WebSocket Events

#### Client to Server:
- \`join-session\` - Join a chat session
- \`send-message\` - Send message to AI

#### Server to Client:
- \`user-message\` - User message confirmation
- \`ai-response\` - AI response
- \`error\` - Error message

## Usage Examples

### User Registration and Chat:
\`\`\`javascript
// Register user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'johndoe',
    email: 'john@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe'
  })
});

const { token } = await registerResponse.json();

// Send chat message
const chatResponse = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    message: 'Explain quantum computing',
    sessionId: 'session-' + Date.now()
  })
});

const { response, tokensUsed, model } = await chatResponse.json();
console.log('AI Response:', response);
console.log('Tokens used:', tokensUsed);
\`\`\`

### Update AI Preferences:
\`\`\`javascript
await fetch('/api/auth/preferences', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    model: 'gpt-4',
    temperature: 0.8,
    maxTokens: 1000
  })
});
\`\`\`

### Get Chat History:
\`\`\`javascript
const chatsResponse = await fetch('/api/chats?page=1&limit=10', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

const { chats, pagination } = await chatsResponse.json();
console.log('User chats:', chats);
console.log('Pagination:', pagination);
\`\`\`

### WebSocket Real-time Chat:
\`\`\`javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

socket.emit('join-session', 'session-id');

socket.emit('send-message', {
  message: 'Hello AI!',
  sessionId: 'session-id',
  userId: 'user-id'
});

socket.on('ai-response', (data) => {
  console.log('AI Response:', data.content);
});
\`\`\`

## Database Schema

### User
- username (unique), email (unique), password (hashed)
- firstName, lastName, avatar
- preferences (model, temperature, maxTokens)
- usage (totalMessages, totalTokens, lastUsed)

### Chat
- sessionId (unique), user (reference), title
- messages[] (role, content, tokens, timestamp)
- model, totalTokens, isArchived

## Security Features
- Password hashing with bcrypt
- JWT token authentication
- Rate limiting (100 requests/15min, 20 chat requests/min)
- Input validation with express-validator
- CORS protection
- Helmet security headers
- Request logging with Morgan

## AI Model Support
- GPT-3.5-turbo (default)
- GPT-4 (configurable)
- Custom temperature settings (0-2)
- Adjustable max tokens (1-2000)
- Token usage tracking

## Rate Limiting
- General API: 100 requests per 15 minutes
- Chat endpoint: 20 requests per minute
- Per-user token usage tracking

## Usage Monitoring
- Track total messages sent
- Monitor token consumption
- Last usage timestamps
- Chat session statistics
- Archive management

## Error Handling
- OpenAI API quota exceeded detection
- Invalid token handling
- Rate limit notifications
- Comprehensive error messages

Server runs on http://localhost:3000

## Important Notes
- Keep your OpenAI API key secure and never commit it to version control
- Monitor your OpenAI usage to avoid unexpected charges
- Default model is gpt-3.5-turbo, but users can upgrade to gpt-4
- Rate limiting helps prevent API abuse and cost overruns
- All chat data is stored securely with user authentication
`;

async function generate(projectPath, projectName) {
  // Create folder structure
  await fs.ensureDir(path.join(projectPath, "models"));
  await fs.ensureDir(path.join(projectPath, "routes"));
  await fs.ensureDir(path.join(projectPath, "middleware"));
  await fs.ensureDir(path.join(projectPath, "controllers"));
  await fs.ensureDir(path.join(projectPath, "config"));
  await fs.ensureDir(path.join(projectPath, "utils"));
  await fs.ensureDir(path.join(projectPath, "services"));

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
const rateLimit = require('express-rate-limit');
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20 // limit chat requests to 20 per minute
});

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(limiter);

// CORS middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const usageRoutes = require('./routes/usage');

app.get('/', (req, res) => {
  res.json({ 
    message: 'AI Chat Backend Running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      chat: '/api/chat',
      chats: '/api/chats'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/usage', usageRoutes);

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
  console.log(\`🚀 AI Chat server running on port \${PORT}\`);
  console.log(\`📍 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🌐 URL: http://localhost:\${PORT}\`);
});`;

  await fs.writeFile(path.join(projectPath, 'server.js'), mainServerJs);

  // Create database config
  const databaseConfig = `const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aichat');
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
  firstName: String,
  lastName: String,
  avatar: String,
  preferences: {
    model: { type: String, default: 'gpt-3.5-turbo' },
    temperature: { type: Number, default: 0.7, min: 0, max: 2 },
    maxTokens: { type: Number, default: 500, min: 1, max: 2000 }
  },
  usage: {
    totalMessages: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    lastUsed: Date
  }
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

  // Create Chat model
  const chatModel = `const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    tokens: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  model: { type: String, default: 'gpt-3.5-turbo' },
  totalTokens: { type: Number, default: 0 },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);`;

  await fs.writeFile(path.join(projectPath, 'models/Chat.js'), chatModel);

  // Create OpenAI service
  const openaiService = `const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const generateChatResponse = async (messages, model = 'gpt-3.5-turbo', temperature = 0.7, maxTokens = 500) => {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    });

    return {
      response: completion.choices[0].message.content,
      tokensUsed: completion.usage.total_tokens
    };
  } catch (error) {
    throw error;
  }
};

module.exports = { generateChatResponse };`;

  await fs.writeFile(path.join(projectPath, 'services/openaiService.js'), openaiService);

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
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    const user = new User({ username, email, password, firstName, lastName });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        preferences: user.preferences,
        usage: user.usage
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updatePreferences = async (req, res) => {
  try {
    const { model, temperature, maxTokens } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        $set: {
          'preferences.model': model || 'gpt-3.5-turbo',
          'preferences.temperature': temperature || 0.7,
          'preferences.maxTokens': maxTokens || 500
        }
      },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = { register, login, getProfile, updatePreferences };`;

  await fs.writeFile(path.join(projectPath, 'controllers/authController.js'), authController);

  // Create chat controller
  const chatController = `const Chat = require('../models/Chat');
const User = require('../models/User');
const { generateChatResponse } = require('../services/openaiService');

const sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'Message and sessionId are required' });
    }

    // Find or create chat session
    let chat = await Chat.findOne({ sessionId, user: req.user._id });
    if (!chat) {
      chat = new Chat({
        sessionId,
        user: req.user._id,
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        messages: [],
        model: req.user.preferences.model
      });
    }

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    chat.messages.push(userMessage);

    // Prepare messages for OpenAI
    const systemMessage = { role: 'system', content: 'You are a helpful AI assistant.' };
    const conversationMessages = chat.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get AI response using user preferences
    const { response: aiResponse, tokensUsed } = await generateChatResponse(
      [systemMessage, ...conversationMessages],
      req.user.preferences.model,
      req.user.preferences.temperature,
      req.user.preferences.maxTokens
    );

    // Add AI response
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse,
      tokens: tokensUsed,
      timestamp: new Date()
    };
    chat.messages.push(assistantMessage);
    chat.totalTokens += tokensUsed;

    await chat.save();

    // Update user usage statistics
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        'usage.totalMessages': 1,
        'usage.totalTokens': tokensUsed
      },
      $set: {
        'usage.lastUsed': new Date()
      }
    });

    res.json({
      response: aiResponse,
      sessionId: chat.sessionId,
      tokensUsed,
      model: req.user.preferences.model
    });

  } catch (error) {
    console.error('Chat error:', error);
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ error: 'OpenAI API quota exceeded' });
    }
    res.status(500).json({ error: 'Failed to process chat message' });
  }
};

const getChatSession = async (req, res) => {
  try {
    const chat = await Chat.findOne({ 
      sessionId: req.params.sessionId, 
      user: req.user._id 
    }).populate('user', 'username firstName lastName');
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserChats = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.archived !== undefined) {
      filter.isArchived = req.query.archived === 'true';
    }

    const chats = await Chat.find(filter)
      .select('sessionId title totalTokens model createdAt updatedAt isArchived')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Chat.countDocuments(filter);

    res.json({
      chats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateChatTitle = async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const chat = await Chat.findOneAndUpdate(
      { sessionId: req.params.sessionId, user: req.user._id },
      { title: title.trim() },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const archiveChat = async (req, res) => {
  try {
    const { isArchived } = req.body;

    const chat = await Chat.findOneAndUpdate(
      { sessionId: req.params.sessionId, user: req.user._id },
      { isArchived: isArchived === true },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({
      sessionId: req.params.sessionId,
      user: req.user._id
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json({ message: 'Chat session deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  sendMessage, 
  getChatSession, 
  getUserChats, 
  updateChatTitle, 
  archiveChat, 
  deleteChat 
};`;

  await fs.writeFile(path.join(projectPath, 'controllers/chatController.js'), chatController);

  // Create usage controller
  const usageController = `const User = require('../models/User');
const Chat = require('../models/Chat');

const getUserUsage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('usage');
    const totalChats = await Chat.countDocuments({ user: req.user._id });
    const archivedChats = await Chat.countDocuments({ user: req.user._id, isArchived: true });

    res.json({
      ...user.usage,
      totalChats,
      archivedChats,
      activeChats: totalChats - archivedChats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getUserUsage };`;

  await fs.writeFile(path.join(projectPath, 'controllers/usageController.js'), usageController);

  // Create auth routes
  const authRoutes = `const express = require('express');
const { body } = require('express-validator');
const { register, login, getProfile, updatePreferences } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], register);

router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], login);

router.get('/profile', authenticateToken, getProfile);
router.put('/preferences', authenticateToken, updatePreferences);

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/auth.js'), authRoutes);

  // Create chat routes
  const chatRoutes = `const express = require('express');
const { 
  sendMessage, 
  getChatSession, 
  getUserChats, 
  updateChatTitle, 
  archiveChat, 
  deleteChat 
} = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.post('/', authenticateToken, sendMessage);
router.get('/:sessionId', authenticateToken, getChatSession);
router.get('/', authenticateToken, getUserChats);
router.put('/:sessionId/title', authenticateToken, updateChatTitle);
router.put('/:sessionId/archive', authenticateToken, archiveChat);
router.delete('/:sessionId', authenticateToken, deleteChat);

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/chat.js'), chatRoutes);

  // Create usage routes
  const usageRoutes = `const express = require('express');
const { getUserUsage } = require('../controllers/usageController');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, getUserUsage);

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/usage.js'), usageRoutes);

  // Create socket handler
  const socketHandler = `const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const { generateChatResponse } = require('../services/openaiService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-session', (sessionId) => {
      socket.join(sessionId);
      console.log(\`User joined session: \${sessionId}\`);
    });

    socket.on('send-message', async (data) => {
      try {
        const { message, sessionId, userId } = data;
        
        // Emit user message immediately
        io.to(sessionId).emit('user-message', {
          content: message,
          timestamp: new Date()
        });

        // Process with AI
        let chat = await Chat.findOne({ sessionId });
        if (!chat) {
          chat = new Chat({
            sessionId,
            userId,
            messages: [],
            title: message.substring(0, 50) + '...'
          });
        }

        chat.messages.push({ role: 'user', content: message });

        const messages = [
          { role: 'system', content: 'You are a helpful AI assistant.' },
          ...chat.messages.map(msg => ({ role: msg.role, content: msg.content }))
        ];

        const { response: aiResponse } = await generateChatResponse(messages);
        chat.messages.push({ role: 'assistant', content: aiResponse });
        await chat.save();

        // Emit AI response
        io.to(sessionId).emit('ai-response', {
          content: aiResponse,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Socket chat error:', error);
        socket.emit('error', { message: 'Failed to process message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
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