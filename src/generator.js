const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const templates = {
  basic: require('./templates/basic'),
  chatapp: require('./templates/chatapp'),
  ecom: require('./templates/ecom'),
  blog: require('./templates/blog'),
  aichat: require('./templates/aichat')
};

// Validate project name
function validateProjectName(projectName) {
  const validNameRegex = /^[a-z0-9-_]+$/i;
  
  if (!projectName || projectName.trim().length === 0) {
    throw new Error('Project name cannot be empty');
  }
  
  if (projectName.length > 214) {
    throw new Error('Project name cannot be longer than 214 characters');
  }
  
  if (!validNameRegex.test(projectName)) {
    throw new Error('Project name can only contain letters, numbers, hyphens, and underscores');
  }
  
  if (projectName.startsWith('.') || projectName.startsWith('-')) {
    throw new Error('Project name cannot start with a dot or hyphen');
  }
  
  const reservedNames = ['node_modules', 'favicon.ico', 'package.json', 'package-lock.json'];
  if (reservedNames.includes(projectName.toLowerCase())) {
    throw new Error(`"${projectName}" is a reserved name and cannot be used`);
  }
}

async function generateProject(projectName, templateType) {
  try {
    // Validate inputs
    validateProjectName(projectName);
    
    const projectPath = path.join(process.cwd(), projectName);
    
    // Check if directory already exists
    if (await fs.pathExists(projectPath)) {
      throw new Error(`Directory "${projectName}" already exists`);
    }

    // Get template configuration
    const template = templates[templateType];
    if (!template) {
      throw new Error(`Template "${templateType}" not found`);
    }

    // Create project directory
    await fs.ensureDir(projectPath);

    // Generate files from template with enhanced feedback
    await template.generate(projectPath, projectName);
    
  } catch (error) {
    // Clean up on error
    const projectPath = path.join(process.cwd(), projectName);
    if (await fs.pathExists(projectPath)) {
      try {
        await fs.remove(projectPath);
        console.log(chalk.yellow('🧹 Cleaned up incomplete project directory'));
      } catch (cleanupError) {
        console.warn(chalk.yellow('⚠️  Warning: Could not clean up project directory'));
      }
    }
    throw error;
  }
}

module.exports = { generateProject };