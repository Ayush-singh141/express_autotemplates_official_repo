const fs = require('fs-extra');
const path = require('path');

const packageJson = (projectName) => ({
  name: projectName,
  version: "1.0.0",
  description: "Blog backend with posts and comments",
  main: "server.js",
  scripts: {
    start: "node server.js",
    dev: "nodemon server.js",
    test: "echo \"Error: no test specified\" && exit 1"
  },
  keywords: ["express", "blog", "mongodb", "jwt", "api"],
  author: "",
  license: "MIT",
  engines: {
    node: ">=16.0.0"
  },
  dependencies: {
    express: "^4.21.2",
    mongoose: "^8.16.5",
    bcryptjs: "^3.0.2",
    jsonwebtoken: "^9.0.2",
    cors: "^2.8.5",
    dotenv: "^17.2.1",
    slugify: "^1.6.6",
    helmet: "^8.1.0",
    morgan: "^1.10.0",
    compression: "^1.7.4",
    validator: "^13.15.15",
    multer: "^2.0.2",
    "express-rate-limit": "^8.0.1",
    "express-validator": "^7.2.1",
    nodemailer: "^7.0.5"
  },
  devDependencies: {
    nodemon: "^3.1.10"
  }
});

const serverJs = `const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
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
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/blog')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Blog Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      posts: '/api/posts',
      comments: '/api/comments'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

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

app.listen(PORT, () => {
  console.log(\`🚀 Blog server running on port \${PORT}\`);
  console.log(\`📍 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🌐 URL: http://localhost:\${PORT}\`);
});`;

const userModel = `const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: String,
  lastName: String,
  bio: String,
  avatar: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
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

const postModel = `const mongoose = require('mongoose');
const slugify = require('slugify');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true },
  content: { type: String, required: true },
  excerpt: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tags: [String],
  category: String,
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  featuredImage: String,
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  publishedAt: Date
}, { timestamps: true });

postSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);`;

const commentModel = `const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['approved', 'pending', 'spam'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);`;

const envFile = `PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/blog
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CLIENT_URL=http://localhost:3000`;

const readmeFile = (projectName) => `# ${projectName}

Professional blog backend with complete post management, nested comments, user authentication, and admin features.

## Features
- 🔐 User authentication with JWT (user/admin roles)
- 📝 Complete blog post CRUD with draft/published status
- 💬 Nested comment system with moderation
- 🖼️ Featured image uploads for posts
- ⭐ Like system for posts and comments
- 🔍 Advanced search and filtering
- 📊 Pagination for all listings
- 🏷️ Post categories and tags system
- 👀 Post view tracking
- 🛡️ Security middleware (Helmet, Rate limiting)
- 📧 Email notifications ready (Nodemailer)
- 📈 Request logging with Morgan
- ✅ Input validation with express-validator
- 🌐 SEO-friendly URL slugs

## Prerequisites
- MongoDB installed and running
- Node.js (v14 or higher)

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Update the \`.env\` file with your configuration:
\`\`\`env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/blog
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
\`\`\`

3. Start the server:
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
- \`PUT /api/auth/profile\` - Update user profile (authenticated)

### Posts
- \`GET /api/posts?page=1&limit=10&category=tech&search=javascript\` - Get published posts with filtering
- \`GET /api/posts/:slug\` - Get single post by slug (increments view count)
- \`GET /api/posts/user/my-posts?status=draft\` - Get user's own posts (authenticated)
- \`POST /api/posts\` - Create new post with image upload (authenticated)
  \`\`\`javascript
  // Form data with file upload
  const formData = new FormData();
  formData.append('title', 'My Blog Post');
  formData.append('content', 'Post content here...');
  formData.append('excerpt', 'Short description');
  formData.append('category', 'Technology');
  formData.append('tags', 'javascript,nodejs,express');
  formData.append('status', 'published');
  formData.append('featuredImage', imageFile);
  \`\`\`

- \`PUT /api/posts/:id\` - Update post (author/admin)
- \`DELETE /api/posts/:id\` - Delete post (author/admin)
- \`POST /api/posts/:id/like\` - Like/unlike post (authenticated)

### Comments
- \`GET /api/comments/post/:postId?page=1&limit=20\` - Get comments for post with replies
- \`POST /api/comments\` - Create comment or reply (authenticated)
  \`\`\`json
  {
    "content": "Great post!",
    "post": "post-id-here",
    "parentComment": "parent-comment-id-for-replies"
  }
  \`\`\`

- \`PUT /api/comments/:id\` - Update comment (author/admin)
- \`DELETE /api/comments/:id\` - Delete comment and replies (author/admin)
- \`POST /api/comments/:id/like\` - Like/unlike comment (authenticated)

### Admin Comment Management
- \`GET /api/comments/admin/pending\` - Get pending comments (admin)
- \`PUT /api/comments/:id/approve\` - Approve comment (admin)

## Database Schema

### User
- username (unique), email (unique), password (hashed)
- firstName, lastName, bio, avatar
- role (user/admin)

### Post
- title, slug (auto-generated), content, excerpt
- author (User reference), tags[], category
- status (draft/published), featuredImage
- views, likes[] (User references)
- publishedAt (auto-set when published)

### Comment
- content, author (User reference)
- post (Post reference), parentComment (Comment reference)
- likes[] (User references)
- status (approved/pending/spam)

## Usage Examples

### Create Blog Post:
\`\`\`javascript
const formData = new FormData();
formData.append('title', 'Getting Started with Node.js');
formData.append('content', 'Node.js is a powerful runtime...');
formData.append('excerpt', 'Learn the basics of Node.js');
formData.append('category', 'Programming');
formData.append('tags', 'nodejs,javascript,backend');
formData.append('status', 'published');
formData.append('featuredImage', imageFile);

fetch('/api/posts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
\`\`\`

### Add Nested Comment:
\`\`\`javascript
// Reply to a comment
fetch('/api/comments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    content: 'Thanks for the explanation!',
    post: 'post-id-here',
    parentComment: 'parent-comment-id'
  })
});
\`\`\`

### Search Posts:
\`\`\`javascript
// Search posts by title/content
fetch('/api/posts?search=javascript&category=programming&page=1&limit=5')
  .then(res => res.json())
  .then(data => {
    console.log('Posts:', data.posts);
    console.log('Pagination:', data.pagination);
  });
\`\`\`

## Security Features
- Password hashing with bcrypt
- JWT token authentication
- Role-based authorization (user/admin)
- Input validation and sanitization
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- File upload restrictions (images only, 5MB limit)

## File Upload
- Featured images stored in \`/uploads\` directory
- 5MB file size limit
- Only image files allowed
- Automatic filename generation to prevent conflicts

## Comment Moderation
- Comments require approval by default (except admin)
- Nested reply system
- Admin can approve/reject comments
- Spam detection ready

## SEO Features
- Auto-generated slugs from post titles
- View count tracking
- Meta descriptions and titles ready
- Clean URLs for posts

Server runs on http://localhost:3000
`;

async function generate(projectPath, projectName) {
  // Create main files
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson(projectName), { spaces: 2 });
  await fs.writeFile(path.join(projectPath, 'server.js'), serverJs);
  await fs.writeFile(path.join(projectPath, '.env'), envFile);
  await fs.writeFile(path.join(projectPath, 'README.md'), readmeFile(projectName));
  await fs.writeFile(path.join(projectPath, '.gitignore'), 'node_modules/\n.env\n*.log\n');

  // Create directories
  await fs.ensureDir(path.join(projectPath, 'models'));
  await fs.ensureDir(path.join(projectPath, 'routes'));
  await fs.ensureDir(path.join(projectPath, 'middleware'));

  // Create models
  await fs.writeFile(path.join(projectPath, 'models/User.js'), userModel);
  await fs.writeFile(path.join(projectPath, 'models/Post.js'), postModel);
  await fs.writeFile(path.join(projectPath, 'models/Comment.js'), commentModel);

  // Create basic auth middleware
  const authMiddleware = `const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = auth;`;

  await fs.writeFile(path.join(projectPath, 'middleware/auth.js'), authMiddleware);

  // Complete auth routes
  const authRoutes = `const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Register user
router.post('/register', [
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

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login user
router.post('/login', [
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

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, [
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = req.body;
    delete updates.password; // Don't allow password updates through this route
    
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;`;

  // Complete post routes
  const postRoutes = `const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const router = express.Router();

// Multer configuration for featured images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get all published posts with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { status: 'published' };
    
    if (req.query.category) filter.category = req.query.category;
    if (req.query.tag) filter.tags = { $in: [req.query.tag] };
    if (req.query.author) filter.author = req.query.author;
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { content: { $regex: req.query.search, $options: 'i' } },
        { excerpt: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const posts = await Post.find(filter)
      .populate('author', 'username firstName lastName avatar')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-content'); // Don't send full content in list view

    const total = await Post.countDocuments(filter);

    res.json({
      posts,
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

// Get single post by slug
router.get('/:slug', async (req, res) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, status: 'published' })
      .populate('author', 'username firstName lastName avatar bio');
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Increment view count
    post.views += 1;
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's own posts (including drafts)
router.get('/user/my-posts', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { author: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(filter);

    res.json({
      posts,
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

// Create new post
router.post('/', auth, upload.single('featuredImage'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('content').notEmpty().withMessage('Content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const postData = {
      ...req.body,
      author: req.user._id
    };

    if (req.file) {
      postData.featuredImage = req.file.filename;
    }

    if (postData.tags && typeof postData.tags === 'string') {
      postData.tags = postData.tags.split(',').map(tag => tag.trim());
    }

    const post = new Post(postData);
    await post.save();
    await post.populate('author', 'username firstName lastName');

    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update post
router.put('/:id', auth, upload.single('featuredImage'), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user is author or admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updateData = req.body;
    
    if (req.file) {
      updateData.featuredImage = req.file.filename;
    }

    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(tag => tag.trim());
    }

    const updatedPost = await Post.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('author', 'username firstName lastName');

    res.json(updatedPost);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user is author or admin
    if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like/unlike post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userLikedIndex = post.likes.indexOf(req.user._id);
    
    if (userLikedIndex > -1) {
      // Unlike
      post.likes.splice(userLikedIndex, 1);
    } else {
      // Like
      post.likes.push(req.user._id);
    }

    await post.save();
    
    res.json({ 
      liked: userLikedIndex === -1,
      likesCount: post.likes.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;`;

  // Complete comment routes
  const commentRoutes = `const express = require('express');
const { body, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const router = express.Router();

// Get comments for a post
router.get('/post/:postId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ 
      post: req.params.postId, 
      status: 'approved',
      parentComment: null // Only top-level comments
    })
      .populate('author', 'username firstName lastName avatar')
      .populate({
        path: 'post',
        select: 'title slug'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get replies for each comment
    for (let comment of comments) {
      const replies = await Comment.find({ 
        parentComment: comment._id,
        status: 'approved'
      })
        .populate('author', 'username firstName lastName avatar')
        .sort({ createdAt: 1 });
      
      comment._doc.replies = replies;
    }

    const total = await Comment.countDocuments({ 
      post: req.params.postId, 
      status: 'approved',
      parentComment: null
    });

    res.json({
      comments,
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

// Create comment
router.post('/', auth, [
  body('content').notEmpty().withMessage('Comment content is required'),
  body('post').notEmpty().withMessage('Post ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, post, parentComment } = req.body;

    // Verify post exists
    const postExists = await Post.findById(post);
    if (!postExists) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // If replying to a comment, verify parent comment exists
    if (parentComment) {
      const parentExists = await Comment.findById(parentComment);
      if (!parentExists) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    const comment = new Comment({
      content,
      author: req.user._id,
      post,
      parentComment: parentComment || null,
      status: req.user.role === 'admin' ? 'approved' : 'pending'
    });

    await comment.save();
    await comment.populate('author', 'username firstName lastName avatar');

    res.status(201).json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update comment
router.put('/:id', auth, [
  body('content').notEmpty().withMessage('Comment content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user is author or admin
    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    comment.content = req.body.content;
    await comment.save();
    await comment.populate('author', 'username firstName lastName avatar');

    res.json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete comment
router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user is author or admin
    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete comment and its replies
    await Comment.deleteMany({ 
      $or: [
        { _id: req.params.id },
        { parentComment: req.params.id }
      ]
    });

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like/unlike comment
router.post('/:id/like', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const userLikedIndex = comment.likes.indexOf(req.user._id);
    
    if (userLikedIndex > -1) {
      // Unlike
      comment.likes.splice(userLikedIndex, 1);
    } else {
      // Like
      comment.likes.push(req.user._id);
    }

    await comment.save();
    
    res.json({ 
      liked: userLikedIndex === -1,
      likesCount: comment.likes.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Approve comment
router.put('/:id/approve', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    ).populate('author', 'username firstName lastName avatar');

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get pending comments
router.get('/admin/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const comments = await Comment.find({ status: 'pending' })
      .populate('author', 'username firstName lastName avatar')
      .populate('post', 'title slug')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/auth.js'), authRoutes);
  await fs.writeFile(path.join(projectPath, 'routes/posts.js'), postRoutes);
  await fs.writeFile(path.join(projectPath, 'routes/comments.js'), commentRoutes);

  // Create uploads directory
  await fs.ensureDir(path.join(projectPath, 'uploads'));
}

module.exports = { generate };