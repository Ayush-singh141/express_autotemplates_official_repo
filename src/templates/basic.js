const fs = require("fs-extra");
const path = require("path");

const packageJson = (projectName) => ({
  name: projectName,
  version: "1.0.0",
  description: "Basic Express backend",
  main: "index.js",
  scripts: {
    start: "node index.js",
    dev: "nodemon index.js",
    test: 'echo "Error: no test specified" && exit 1',
  },
  keywords: ["express", "backend", "api"],
  author: "",
  license: "MIT",
  engines: {
    node: ">=16.0.0",
  },
  dependencies: {
    express: "^4.21.2",
    cors: "^2.8.5",
    dotenv: "^17.2.1",
    helmet: "^8.1.0",
    morgan: "^1.10.0",
    compression: "^1.7.4",
  },
  devDependencies: {
    nodemon: "^3.1.10",
  },
});

const serverJs = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Request logging
app.use(morgan('dev'));

// Compression
app.use(compression());

// CORS
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Static files
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to your Express Backend!',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Add your routes here
// app.get('/api/users', (req, res) => {
//   res.json({ message: 'Users endpoint' });
// });

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log(\`🌐 Visit: http://localhost:\${PORT}\`);
});`;

const envFile = `PORT=3000
NODE_ENV=development
CORS_ORIGIN=*`;

const readmeFile = (projectName) => `# ${projectName}

Professional Express backend with organized folder structure and essential features.

## 🚀 Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start the server:**
   \`\`\`bash
   npm start
   \`\`\`

3. **For development (auto-restart):**
   \`\`\`bash
   npm run dev
   \`\`\`

4. **Visit your app:**
   Open http://localhost:3000 in your browser

## 📁 Project Structure

\`\`\`
${projectName}/
├── config/
│   └── db.js          # Database configuration
├── controllers/       # Route controllers
│   └── healthController.js
├── models/            # Data models
│   └── README.md      # Model examples
├── routes/            # API routes
│   └── health.js      # Health check routes
├── middlewares/       # Custom middleware
│   └── auth.js        # Authentication middleware
├── utils/             # Utility functions
│   ├── logger.js      # Logging utility
│   └── response.js    # Response helpers
├── public/            # Static files (HTML, CSS, images)
│   └── index.html     # Welcome page
├── .env              # Environment variables
├── .gitignore        # Git ignore rules
├── index.js          # Main app file (entry point)
├── package.json      # Dependencies and scripts
└── README.md         # This file
\`\`\`

## 🛠️ How to Add New Features

### 1. Create a Controller
Create a new file in \`controllers/\`:

\`\`\`javascript
// controllers/userController.js
const { sendSuccess, sendError } = require('../utils/response');

const getUsers = (req, res) => {
  // Your logic here
  const users = [{ id: 1, name: 'John Doe' }];
  sendSuccess(res, users, 'Users retrieved successfully');
};

const createUser = (req, res) => {
  const { name, email } = req.body;
  // Your logic here
  sendSuccess(res, { id: 1, name, email }, 'User created successfully', 201);
};

module.exports = {
  getUsers,
  createUser
};
\`\`\`

### 2. Create Routes
Create a new file in \`routes/\`:

\`\`\`javascript
// routes/users.js
const express = require('express');
const { getUsers, createUser } = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

router.get('/', getUsers);
router.post('/', authenticateToken, createUser);

module.exports = router;
\`\`\`

### 3. Register Routes
Add to \`index.js\`:

\`\`\`javascript
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);
\`\`\`

## 📡 Built-in Endpoints

- \`GET /\` - Welcome message and server info
- \`GET /api/health\` - Server health check
- \`GET /api/health/info\` - Detailed server information

## 🔧 Environment Variables

Edit the \`.env\` file to configure your app:

\`\`\`env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
MONGO_URI=mongodb://localhost:27017/your-app-name
\`\`\`

## 📦 What's Included

- ✅ **Express.js** - Web framework
- ✅ **CORS** - Cross-origin requests
- ✅ **Helmet** - Security headers
- ✅ **Morgan** - Request logging
- ✅ **Compression** - Response compression
- ✅ **Organized Structure** - MVC pattern
- ✅ **Utility Functions** - Logger and response helpers
- ✅ **Middleware Support** - Authentication ready
- ✅ **Static Files** - Serve HTML, CSS, JS
- ✅ **Environment Variables** - Configuration
- ✅ **Error Handling** - Graceful error responses

## 🗂️ Folder Descriptions

- **config/** - Configuration files (database, app settings)
- **controllers/** - Business logic and request handlers
- **models/** - Data models and database schemas
- **routes/** - API route definitions
- **middlewares/** - Custom middleware functions
- **utils/** - Helper functions and utilities
- **public/** - Static files (HTML, CSS, JS, images)

## 🎯 Next Steps

1. **Add your models** in \`models/\` folder
2. **Create controllers** for your business logic
3. **Define routes** in \`routes/\` folder
4. **Add middleware** for authentication, validation, etc.
5. **Use utilities** for consistent logging and responses
6. **Deploy** to your favorite hosting platform

## 📚 Learn More

- [Express.js Documentation](https://expressjs.com/)
- [Node.js Documentation](https://nodejs.org/)
- [MongoDB with Mongoose](https://mongoosejs.com/)

Happy coding! 🎉
`;

async function generate(projectPath, projectName) {
  // Create basic folder structure
  await fs.ensureDir(path.join(projectPath, "config"));
  await fs.ensureDir(path.join(projectPath, "controllers"));
  await fs.ensureDir(path.join(projectPath, "models"));
  await fs.ensureDir(path.join(projectPath, "routes"));
  await fs.ensureDir(path.join(projectPath, "middlewares"));
  await fs.ensureDir(path.join(projectPath, "utils"));
  await fs.ensureDir(path.join(projectPath, "public"));

  // Create package.json
  await fs.writeJson(
    path.join(projectPath, "package.json"),
    packageJson(projectName),
    { spaces: 2 }
  );

  // Create main index.js (entry point)
  const indexJs = `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Request logging
app.use(morgan('dev'));

// Compression
app.use(compression());

// CORS
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Static files
app.use(express.static('public'));

// Import routes
const healthRoutes = require('./routes/health');

// Use routes
app.use('/api/health', healthRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to your Express Backend!',
    version: '1.0.0',
    status: 'running'
  });
});

// Add your routes here
// const userRoutes = require('./routes/users');
// app.use('/api/users', userRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log(\`🌐 Visit: http://localhost:\${PORT}\`);
});`;

  await fs.writeFile(path.join(projectPath, "index.js"), indexJs);

  // Create config/db.js
  const dbConfig = `// Database configuration
const dbConfig = {
  // MongoDB connection string
  mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/your-app-name',
  
  // Database options
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
};

module.exports = dbConfig;`;

  await fs.writeFile(path.join(projectPath, "config/db.js"), dbConfig);

  // Create controllers/healthController.js
  const healthController = `// Health check controller
const getHealth = (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
};

const getInfo = (req, res) => {
  res.json({
    name: 'Express Backend',
    version: '1.0.0',
    node_version: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || 'development'
  });
};

module.exports = {
  getHealth,
  getInfo
};`;

  await fs.writeFile(path.join(projectPath, "controllers/healthController.js"), healthController);

  // Create routes/health.js
  const healthRoutes = `const express = require('express');
const { getHealth, getInfo } = require('../controllers/healthController');

const router = express.Router();

// GET /api/health
router.get('/', getHealth);

// GET /api/health/info
router.get('/info', getInfo);

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, "routes/health.js"), healthRoutes);

  // Create middlewares/auth.js (example middleware)
  const authMiddleware = `// Authentication middleware example
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Add your token verification logic here
  // For example, JWT verification
  
  // For now, just pass through
  next();
};

module.exports = {
  authenticateToken
};`;

  await fs.writeFile(path.join(projectPath, "middlewares/auth.js"), authMiddleware);

  // Create utils/logger.js
  const logger = `// Logger utility
const logger = {
  info: (message, ...args) => {
    console.log(\`[\${new Date().toISOString()}] INFO: \${message}\`, ...args);
  },
  
  error: (message, ...args) => {
    console.error(\`[\${new Date().toISOString()}] ERROR: \${message}\`, ...args);
  },
  
  warn: (message, ...args) => {
    console.warn(\`[\${new Date().toISOString()}] WARN: \${message}\`, ...args);
  },
  
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(\`[\${new Date().toISOString()}] DEBUG: \${message}\`, ...args);
    }
  }
};

module.exports = logger;`;

  await fs.writeFile(path.join(projectPath, "utils/logger.js"), logger);

  // Create utils/response.js
  const responseUtils = `// Response utility functions
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const sendError = (res, error, statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    error: typeof error === 'string' ? error : error.message
  });
};

const sendPaginatedResponse = (res, data, page, limit, total) => {
  res.json({
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginatedResponse
};`;

  await fs.writeFile(path.join(projectPath, "utils/response.js"), responseUtils);

  // Create models/README.md (placeholder for models)
  const modelsReadme = `# Models

This folder contains your data models.

## Examples:

### User Model (if using MongoDB with Mongoose):
\`\`\`javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
\`\`\`

### Product Model:
\`\`\`javascript
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  category: String
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
\`\`\`
`;

  await fs.writeFile(path.join(projectPath, "models/README.md"), modelsReadme);

  // Create simple welcome page
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        h1 { 
            color: #333; 
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .endpoint {
            background: #f8f9fa;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            border-left: 4px solid #007bff;
            transition: transform 0.2s;
        }
        .endpoint:hover {
            transform: translateX(5px);
        }
        .method {
            font-weight: bold;
            color: #007bff;
            font-family: 'Courier New', monospace;
            background: #e3f2fd;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 8px;
        }
        .description {
            color: #555;
        }
        .quick-start {
            background: #e8f5e8;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
            margin: 20px 0;
        }
        code {
            background: #f1f3f4;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            border: 1px solid #e9ecef;
        }
        .status {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ${projectName}</h1>
        <div class="subtitle">Your Express backend is running successfully! <span class="status">ONLINE</span></div>
        
        <h2>📡 Available Endpoints</h2>
        
        <div class="endpoint">
            <div class="method">GET /</div>
            <div class="description">Welcome message and server info</div>
        </div>
        
        <div class="endpoint">
            <div class="method">GET /api/health</div>
            <div class="description">Health check endpoint - returns server status</div>
        </div>
        
        <div class="quick-start">
            <h3>🚀 Quick Start Guide</h3>
            <ol>
                <li>Open <code>index.js</code> to add your routes</li>
                <li>Create controllers in <code>controllers/</code> folder</li>
                <li>Add route files in <code>routes/</code> folder</li>
                <li>Add static files to <code>public/</code> folder</li>
            </ol>
        </div>
        
        <h3>💡 Add Your First Route</h3>
        <p>Create a new controller and route:</p>
        <pre><code>// controllers/userController.js
const getUsers = (req, res) => {
  res.json({ 
    message: 'Hello World!',
    users: [{ id: 1, name: 'John Doe' }]
  });
};

module.exports = { getUsers };</code></pre>
        
        <h3>📁 Project Structure</h3>
        <ul>
            <li><code>index.js</code> - Main application file (entry point)</li>
            <li><code>controllers/</code> - Business logic handlers</li>
            <li><code>routes/</code> - API route definitions</li>
            <li><code>middlewares/</code> - Custom middleware</li>
            <li><code>utils/</code> - Helper functions</li>
            <li><code>models/</code> - Data models</li>
            <li><code>config/</code> - Configuration files</li>
            <li><code>public/</code> - Static files</li>
        </ul>
    </div>
</body>
</html>`;

  await fs.writeFile(path.join(projectPath, "public/index.html"), indexHtml);

  // Create .env
  await fs.writeFile(path.join(projectPath, ".env"), envFile);

  // Create README.md (using the comprehensive readmeFile function)
  await fs.writeFile(path.join(projectPath, "README.md"), readmeFile(projectName));

  // Create .gitignore
  const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory
coverage/

# Dependency directories
node_modules/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Output of 'npm pack'
*.tgz

# dotenv environment variables file
.env.test

# OS generated files
.DS_Store
.DS_Store?
._*
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~
`;
  await fs.writeFile(path.join(projectPath, ".gitignore"), gitignoreContent);
}

module.exports = { generate };
