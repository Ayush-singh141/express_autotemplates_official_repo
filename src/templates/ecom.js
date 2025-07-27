const fs = require('fs-extra');
const path = require('path');

const packageJson = (projectName) => ({
  name: projectName,
  version: "1.0.0",
  description: "E-commerce backend with product management",
  main: "server.js",
  scripts: {
    start: "node server.js",
    dev: "nodemon server.js",
    test: "echo \"Error: no test specified\" && exit 1"
  },
  keywords: ["express", "ecommerce", "mongodb", "jwt", "api"],
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
    multer: "^2.0.2",
    helmet: "^8.1.0",
    morgan: "^1.10.0",
    compression: "^1.7.4",
    validator: "^13.15.15",
    stripe: "^18.3.0",
    nodemailer: "^7.0.5",
    "express-rate-limit": "^8.0.1",
    "express-validator": "^7.2.1"
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

// Static files
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'E-commerce Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      payments: '/api/payments'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

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
  console.log(\`🚀 E-commerce server running on port \${PORT}\`);
  console.log(\`📍 Environment: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`🌐 URL: http://localhost:\${PORT}\`);
});`;

const userModel = `const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
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

const productModel = `const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String
}, { timestamps: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  comparePrice: { type: Number, min: 0 },
  category: { type: String, required: true },
  subcategory: String,
  brand: String,
  sku: { type: String, unique: true },
  stock: { type: Number, required: true, default: 0, min: 0 },
  images: [String],
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'inactive', 'out_of_stock'], default: 'active' },
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  tags: [String],
  reviews: [reviewSchema],
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  seoTitle: String,
  seoDescription: String
}, { timestamps: true });

// Calculate average rating when reviews are added
productSchema.methods.calculateAverageRating = function() {
  if (this.reviews.length === 0) {
    this.ratings.average = 0;
    this.ratings.count = 0;
  } else {
    const sum = this.reviews.reduce((acc, review) => acc + review.rating, 0);
    this.ratings.average = sum / this.reviews.length;
    this.ratings.count = this.reviews.length;
  }
};

module.exports = mongoose.model('Product', productSchema);`;

const envFile = `PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ecommerce
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CLIENT_URL=http://localhost:3000`;

const readmeFile = (projectName) => `# ${projectName}

Professional e-commerce backend with complete product management, user authentication, shopping cart, order processing, and Stripe payments.

## Features
- 🔐 User authentication with JWT (user/admin roles)
- 📦 Complete product management with image uploads
- 🛒 Shopping cart with real-time calculations
- 📋 Order processing with status tracking
- 💳 Stripe payment integration
- ⭐ Product reviews and ratings system
- 🔍 Product search and filtering
- 📊 Pagination for all listings
- 🛡️ Security middleware (Helmet, Rate limiting)
- 📧 Email notifications ready (Nodemailer)
- 📈 Request logging with Morgan
- ✅ Input validation with express-validator

## Prerequisites
- MongoDB installed and running
- Node.js (v14 or higher)
- Stripe account for payments

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Update the \`.env\` file with your configuration:
\`\`\`env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/ecommerce
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
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
    "name": "John Doe",
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

### Products
- \`GET /api/products?page=1&limit=10&category=electronics&search=phone\` - Get products with filtering
- \`GET /api/products/:id\` - Get single product with reviews
- \`POST /api/products\` - Create product (admin, with image upload)
- \`PUT /api/products/:id\` - Update product (admin)
- \`DELETE /api/products/:id\` - Delete product (admin)
- \`POST /api/products/:id/reviews\` - Add product review (authenticated)

### Shopping Cart
- \`GET /api/cart\` - Get user's cart
- \`POST /api/cart/add\` - Add item to cart
  \`\`\`json
  {
    "productId": "product-id-here",
    "quantity": 2
  }
  \`\`\`
- \`PUT /api/cart/update\` - Update cart item quantity
- \`DELETE /api/cart/remove/:productId\` - Remove item from cart
- \`DELETE /api/cart/clear\` - Clear entire cart

### Orders
- \`GET /api/orders?page=1&limit=10\` - Get user orders with pagination
- \`GET /api/orders/:id\` - Get single order details
- \`POST /api/orders\` - Create new order
  \`\`\`json
  {
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "paymentMethod": "stripe"
  }
  \`\`\`

### Admin Orders
- \`GET /api/orders/admin/all?status=pending\` - Get all orders (admin)
- \`PUT /api/orders/:id/status\` - Update order status (admin)
  \`\`\`json
  {
    "orderStatus": "shipped",
    "trackingNumber": "1Z999AA1234567890"
  }
  \`\`\`

### Payments (Stripe)
- \`POST /api/payments/create-intent\` - Create payment intent
- \`POST /api/payments/confirm\` - Confirm payment
- \`POST /api/payments/webhook\` - Stripe webhook endpoint

## Database Schema

### User
- name, email (unique), password (hashed)
- role (user/admin)
- address (street, city, state, zipCode, country)

### Product
- name, description, price, comparePrice
- category, subcategory, brand, sku (unique)
- stock, images[], featured, status
- weight, dimensions, tags[], reviews[]
- ratings (average, count)
- SEO fields (seoTitle, seoDescription)

### Cart
- user (reference), items[]
- totalAmount (auto-calculated)

### Order
- user, orderNumber (auto-generated)
- items[], shippingAddress, paymentMethod
- paymentStatus, orderStatus, totals
- stripePaymentIntentId, trackingNumber

## Usage Examples

### Create Product (Admin):
\`\`\`javascript
const formData = new FormData();
formData.append('name', 'iPhone 15');
formData.append('description', 'Latest iPhone model');
formData.append('price', '999');
formData.append('category', 'Electronics');
formData.append('stock', '50');
formData.append('images', imageFile1);
formData.append('images', imageFile2);

fetch('/api/products', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
\`\`\`

### Process Order with Stripe:
\`\`\`javascript
// 1. Create order
const order = await fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ shippingAddress, paymentMethod: 'stripe' })
});

// 2. Create payment intent
const { clientSecret } = await fetch('/api/payments/create-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({ orderId: order.id })
});

// 3. Use Stripe.js to complete payment
const { error } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: { card: cardElement }
});
\`\`\`

## Security Features
- Password hashing with bcrypt
- JWT token authentication
- Role-based authorization
- Input validation and sanitization
- Rate limiting (100 requests per 15 minutes)
- CORS protection
- Helmet security headers
- File upload restrictions

## File Upload
- Images stored in \`/uploads\` directory
- 5MB file size limit
- Only image files allowed
- Multiple images per product supported

Server runs on http://localhost:3000
`;

async function generate(projectPath, projectName) {
  // Create main files
  await fs.writeJson(path.join(projectPath, 'package.json'), packageJson(projectName), { spaces: 2 });
  await fs.writeFile(path.join(projectPath, 'server.js'), serverJs);
  await fs.writeFile(path.join(projectPath, '.env'), envFile);
  await fs.writeFile(path.join(projectPath, 'README.md'), readmeFile(projectName));
  await fs.writeFile(path.join(projectPath, '.gitignore'), 'node_modules/\n.env\n*.log\nuploads/\n');

  // Create directories
  await fs.ensureDir(path.join(projectPath, 'models'));
  await fs.ensureDir(path.join(projectPath, 'routes'));
  await fs.ensureDir(path.join(projectPath, 'middleware'));
  await fs.ensureDir(path.join(projectPath, 'uploads'));

  // Create models
  await fs.writeFile(path.join(projectPath, 'models/User.js'), userModel);
  await fs.writeFile(path.join(projectPath, 'models/Product.js'), productModel);
  
  // Additional models
  const cartModel = `const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }
});

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema],
  totalAmount: { type: Number, default: 0 }
}, { timestamps: true });

cartSchema.methods.calculateTotal = function() {
  this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
};

module.exports = mongoose.model('Cart', cartSchema);`;

  const orderModel = `const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  image: String
});

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  orderNumber: { type: String, unique: true },
  items: [orderItemSchema],
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  orderStatus: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: { type: Number, required: true },
  stripePaymentIntentId: String,
  trackingNumber: String,
  notes: String
}, { timestamps: true });

orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);`;

  await fs.writeFile(path.join(projectPath, 'models/Cart.js'), cartModel);
  await fs.writeFile(path.join(projectPath, 'models/Order.js'), orderModel);

  // Create basic route files (simplified for brevity)
  const authRoute = `const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/auth.js'), authRoute);
  
  // Create auth middleware
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

const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

module.exports = { auth, adminAuth };`;

  await fs.writeFile(path.join(projectPath, 'middleware/auth.js'), authMiddleware);

  // Complete product routes
  const productRoutes = `const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Multer configuration for image uploads
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

// Get all products with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { status: 'active' };
    
    if (req.query.category) filter.category = req.query.category;
    if (req.query.brand) filter.brand = req.query.brand;
    if (req.query.featured) filter.featured = req.query.featured === 'true';
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.json({
      products,
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

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('reviews.user', 'name');
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create product (admin only)
router.post('/', 
  auth, 
  adminAuth, 
  upload.array('images', 5),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('category').notEmpty().withMessage('Category is required'),
    body('stock').isNumeric().withMessage('Stock must be a number')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const productData = req.body;
      if (req.files) {
        productData.images = req.files.map(file => file.filename);
      }

      const product = new Product(productData);
      await product.save();
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Update product (admin only)
router.put('/:id', auth, adminAuth, upload.array('images', 5), async (req, res) => {
  try {
    const updateData = req.body;
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map(file => file.filename);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete product (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add product review
router.post('/:id/reviews', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if user already reviewed
    const existingReview = product.reviews.find(r => r.user.toString() === req.user._id.toString());
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    product.reviews.push({
      user: req.user._id,
      rating,
      comment
    });

    product.calculateAverageRating();
    await product.save();

    res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;`;

  // Complete cart routes
  const cartRoutes = `const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get user cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
      await cart.save();
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add item to cart
router.post('/add', auth, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: product.price
      });
    }

    cart.calculateTotal();
    await cart.save();
    await cart.populate('items.product');

    res.json(cart);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update cart item
router.put('/update', auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found in cart' });
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter(item => item.product.toString() !== productId);
    } else {
      item.quantity = quantity;
    }

    cart.calculateTotal();
    await cart.save();
    await cart.populate('items.product');

    res.json(cart);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove item from cart
router.delete('/remove/:productId', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.product.toString() !== req.params.productId);
    cart.calculateTotal();
    await cart.save();

    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear cart
router.delete('/clear', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = [];
      cart.totalAmount = 0;
      await cart.save();
    }
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;`;

  // Complete order routes
  const orderRoutes = `const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');
const router = express.Router();

// Get user orders
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ user: req.user._id });

    res.json({
      orders,
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

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create order
router.post('/', auth, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check stock availability
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({ 
          error: \`Insufficient stock for \${item.product.name}\` 
        });
      }
    }

    // Calculate totals
    const subtotal = cart.totalAmount;
    const tax = subtotal * 0.1; // 10% tax
    const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
    const total = subtotal + tax + shipping;

    // Create order
    const order = new Order({
      user: req.user._id,
      items: cart.items.map(item => ({
        product: item.product._id,
        name: item.product.name,
        price: item.price,
        quantity: item.quantity,
        image: item.product.images[0]
      })),
      shippingAddress,
      paymentMethod,
      subtotal,
      tax,
      shipping,
      total
    });

    await order.save();

    // Update product stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: -item.quantity }
      });
    }

    // Clear cart
    cart.items = [];
    cart.totalAmount = 0;
    await cart.save();

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Get all orders
router.get('/admin/all', auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.orderStatus = req.query.status;

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
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

// Admin: Update order status
router.put('/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { orderStatus, trackingNumber } = req.body;
    
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus, trackingNumber },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;`;

  // Payment routes
  const paymentRoutes = `const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Create payment intent
router.post('/create-intent', auth, async (req, res) => {
  try {
    const { orderId } = req.body;
    
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        orderId: order._id.toString(),
        userId: req.user._id.toString()
      }
    });

    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Confirm payment
router.post('/confirm', auth, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      const order = await Order.findById(paymentIntent.metadata.orderId);
      if (order) {
        order.paymentStatus = 'paid';
        order.orderStatus = 'processing';
        await order.save();
      }
      
      res.json({ success: true, order });
    } else {
      res.status(400).json({ error: 'Payment not successful' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('Webhook signature verification failed.', err.message);
    return res.status(400).send(\`Webhook Error: \${err.message}\`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    
    const order = await Order.findById(paymentIntent.metadata.orderId);
    if (order) {
      order.paymentStatus = 'paid';
      order.orderStatus = 'processing';
      await order.save();
    }
  }

  res.json({ received: true });
});

module.exports = router;`;

  await fs.writeFile(path.join(projectPath, 'routes/products.js'), productRoutes);
  await fs.writeFile(path.join(projectPath, 'routes/cart.js'), cartRoutes);
  await fs.writeFile(path.join(projectPath, 'routes/orders.js'), orderRoutes);
  await fs.writeFile(path.join(projectPath, 'routes/payments.js'), paymentRoutes);
}

module.exports = { generate };