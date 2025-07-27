# Express AutoTemplates 🚀

A powerful CLI tool to generate Express.js backend projects with various pre-configured templates.

## Installation

Install globally via npm:

```bash
npm install -g express-autotemplates
```

Or use with npx (no installation required):

```bash
npx express-autotemplates create my-project
```

## Usage

Create a new Express backend project:

```bash
express-autotemplates create my-project
```

Or simply:

```bash
express-autotemplates create
```

The CLI will prompt you to:
1. Enter a project name (if not provided)
2. Choose from available templates

## Available Templates

### 🚀 Basic Backend
- Simple Express server with essential middleware
- CORS enabled
- Environment variables support
- Basic error handling
- Health check endpoint

### 💬 Chat App Backend
- Real-time messaging with Socket.io
- MongoDB integration
- Room-based chat system
- Message history persistence
- WebSocket connection handling

### 🛒 E-commerce Backend
- Product management system
- User authentication (JWT)
- Shopping cart functionality
- Order processing
- File upload support
- Admin/user role management

### 📝 Blog Backend
- Post creation and management
- Comment system with nested replies
- User authentication
- Like system for posts and comments
- SEO-friendly slugs
- Draft/published status

### 🤖 AI Chat Backend
- OpenAI GPT integration
- Real-time AI conversations
- Chat session management
- Message history
- Both REST API and WebSocket support

## Quick Start

1. **Create a project:**
   ```bash
   express-autotemplates create my-awesome-backend
   ```

2. **Navigate to project:**
   ```bash
   cd my-awesome-backend
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Project Structure

Each generated project includes:
- `server.js` - Main application file
- `package.json` - Dependencies and scripts
- `.env` - Environment variables
- `README.md` - Project-specific documentation
- `.gitignore` - Git ignore rules
- Template-specific folders (models, routes, middleware)

## Requirements

- Node.js (v14 or higher)
- MongoDB (for templates that require database)
- OpenAI API key (for AI chat template)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

---

Made with ❤️ for the Express.js community