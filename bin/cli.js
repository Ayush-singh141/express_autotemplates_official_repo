#!/usr/bin/env node

const { Command } = require("commander");
const inquirer = require("inquirer");
const chalk = require("chalk");
const { spawn } = require("child_process");
const path = require("path");
const { generateProject } = require("../src/generator");

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error(chalk.red("💥 Unhandled promise rejection:"), err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error(chalk.red("💥 Uncaught exception:"), err);
  process.exit(1);
});

// ASCII Art Banner
const showBanner = () => {
  console.log(
    chalk.cyan(`╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  ███████╗██╗  ██╗██████╗ ██████╗ ███████╗███████╗███████╗     ║
║  ██╔════╝╚██╗██╔╝██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝     ║
║  █████╗   ╚███╔╝ ██████╔╝██████╔╝█████╗  ███████╗███████╗     ║
║  ██╔══╝   ██╔██╗ ██╔═══╝ ██╔══██╗██╔══╝  ╚════██║╚════██║     ║
║  ███████╗██╔╝ ██╗██║     ██║  ██║███████╗███████║███████║     ║
║  ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝     ║
║                                                               ║
║   █████╗ ██╗   ██╗████████╗ ██████╗ ████████╗███████╗███╗   ███╗║
║  ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗╚══██╔══╝██╔════╝████╗ ████║║
║  ███████║██║   ██║   ██║   ██║   ██║   ██║   █████╗  ██╔████╔██║║
║  ██╔══██║██║   ██║   ██║   ██║   ██║   ██║   ██╔══╝  ██║╚██╔╝██║║
║  ██║  ██║╚██████╔╝   ██║   ╚██████╔╝   ██║   ███████╗██║ ╚═╝ ██║║
║  ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝    ╚═╝   ╚══════╝╚═╝     ╚═╝║
║                                                               ║
║  ██████╗ ██╗      █████╗ ████████╗███████╗                   ║
║  ██╔══██╗██║     ██╔══██╗╚══██╔══╝██╔════╝                   ║
║  ██████╔╝██║     ███████║   ██║   █████╗                     ║
║  ██╔═══╝ ██║     ██╔══██║   ██║   ██╔══╝                     ║
║  ██║     ███████╗██║  ██║   ██║   ███████╗                   ║
║  ╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝`)
  );

  console.log(
    chalk.magenta.bold(
      "   🚀 Your automated Express backend template generator! ✨\n"
    )
  );
  console.log(
    chalk.gray("   Generate professional Express.js backends in seconds\n")
  );
};

// Loading animation
const showLoading = (message, duration = 2000) => {
  return new Promise((resolve) => {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write(
        `\r${chalk.cyan(frames[i])} ${chalk.white(message)}`
      );
      i = (i + 1) % frames.length;
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      process.stdout.write(`\r${chalk.green("✅")} ${chalk.white(message)}\n`);
      resolve();
    }, duration);
  });
};

// Install dependencies automatically
const installDependencies = (projectPath) => {
  return new Promise((resolve) => {
    console.log(chalk.cyan("📦 Installing dependencies automatically...\n"));

    // Show a simple progress indicator
    const progressFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let progressIndex = 0;
    let progressMessage = "Installing packages...";

    const progressInterval = setInterval(() => {
      process.stdout.write(
        `\r${chalk.cyan(progressFrames[progressIndex])} ${chalk.white(
          progressMessage
        )}`
      );
      progressIndex = (progressIndex + 1) % progressFrames.length;
    }, 100);

    // Determine the correct npm command for the platform
    const isWindows = process.platform === "win32";
    const npmCommand = isWindows ? "npm.cmd" : "npm";

    const npmInstall = spawn(npmCommand, ["install"], {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
      shell: isWindows,
    });

    // Handle stdout (but don't show it to keep output clean)
    npmInstall.stdout.on("data", (data) => {
      const output = data.toString();
      // Update progress message based on npm output
      if (output.includes("added")) {
        progressMessage = "Adding packages...";
      } else if (output.includes("found")) {
        progressMessage = "Resolving dependencies...";
      } else if (output.includes("audited")) {
        progressMessage = "Auditing packages...";
      }
    });

    // Handle stderr
    npmInstall.stderr.on("data", (data) => {
      // Only show critical errors, not warnings
      const errorOutput = data.toString();
      if (errorOutput.includes("ERROR") || errorOutput.includes("ENOENT")) {
        clearInterval(progressInterval);
        process.stdout.write(`\r${chalk.red("❌")} Installation error\n`);
        console.log(chalk.yellow(errorOutput));
      }
    });

    npmInstall.on("close", (code) => {
      clearInterval(progressInterval);

      if (code === 0) {
        process.stdout.write(
          `\r${chalk.green("✅")} Dependencies installed successfully!\n\n`
        );
      } else {
        process.stdout.write(
          `\r${chalk.yellow("⚠️")} Dependencies installation failed\n`
        );
        console.log(
          chalk.gray(
            "You can install them manually by running 'npm install' in your project directory\n"
          )
        );
      }
      resolve();
    });

    npmInstall.on("error", (error) => {
      clearInterval(progressInterval);
      process.stdout.write(
        `\r${chalk.yellow("⚠️")} Could not install dependencies automatically\n`
      );
      console.log(chalk.gray(`Error: ${error.message}`));
      console.log(
        chalk.gray(
          "You can install them manually by running 'npm install' in your project directory\n"
        )
      );
      resolve();
    });

    // Add timeout to prevent hanging
    setTimeout(() => {
      if (!npmInstall.killed) {
        clearInterval(progressInterval);
        process.stdout.write(`\r${chalk.yellow("⚠️")} Installation timeout\n`);
        console.log(
          chalk.gray(
            "Installation is taking too long, continuing without automatic installation"
          )
        );
        console.log(
          chalk.gray(
            "You can install dependencies manually with 'npm install'\n"
          )
        );
        npmInstall.kill();
        resolve();
      }
    }, 120000); // 2 minutes timeout
  });
};

// Success celebration
const showSuccess = (projectName) => {
  console.log(
    chalk.green(`
╔══════════════════════════════════════════════╗
║                                              ║
║    🎉 SUCCESS! Your project is ready! 🎉    ║
║                                              ║
║    Project: ${chalk.cyan.bold(projectName.padEnd(28))} ║
║                                              ║
╚══════════════════════════════════════════════╝
  `)
  );
};

const program = new Command();

program
  .name("express-autotemplates")
  .description(
    chalk.gray("🚀 Generate Express backend projects with various templates")
  )
  .version("1.0.0");

program
  .command("create [project-name]")
  .description(chalk.gray("Create a new Express backend project"))
  .action(async (projectName) => {
    try {
      // Show banner
      showBanner();

      // Get project name if not provided
      if (!projectName) {
        console.log(chalk.yellow("📝 Let's start by naming your project...\n"));

        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "projectName",
            message: chalk.cyan("🏷️  What is your project name?"),
            validate: (input) => {
              if (!input.trim()) {
                return chalk.red("❌ Project name is required");
              }
              if (input.length > 50) {
                return chalk.red(
                  "❌ Project name must be less than 50 characters"
                );
              }
              if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
                return chalk.red(
                  "❌ Project name can only contain letters, numbers, hyphens, and underscores"
                );
              }
              return true;
            },
            transformer: (input) => chalk.cyan.bold(input),
          },
        ]);
        projectName = answers.projectName;
      }

      console.log(
        chalk.green(
          `\n✨ Great choice! Creating "${chalk.bold(projectName)}"...\n`
        )
      );

      // Template selection with enhanced styling
      const templateChoices = [
        {
          name:
            chalk.cyan("🚀 Basic Backend") +
            chalk.gray(" - Simple Express server with organized structure"),
          value: "basic",
          short: "Basic Backend",
        },
        {
          name:
            chalk.blue("💬 Chat App Backend") +
            chalk.gray(" - Real-time chat with Socket.io"),
          value: "chatapp",
          short: "Chat App",
        },
        {
          name:
            chalk.green("🛒 E-commerce Backend") +
            chalk.gray(" - Product management, cart, orders"),
          value: "ecom",
          short: "E-commerce",
        },
        {
          name:
            chalk.magenta("📝 Blog Backend") +
            chalk.gray(" - Posts, comments, user management"),
          value: "blog",
          short: "Blog",
        },
        {
          name:
            chalk.magenta("🤖 AI Chat Backend") +
            chalk.gray(" - AI-powered chat application"),
          value: "aichat",
          short: "AI Chat",
        },
      ];

      console.log(chalk.yellow("🎨 Choose your backend template:\n"));

      const { template } = await inquirer.prompt([
        {
          type: "list",
          name: "template",
          message: chalk.cyan("🎯 Select a template:"),
          choices: templateChoices,
          pageSize: 10,
        },
      ]);

      // Show template info
      const templateInfo = {
        basic: { emoji: "🚀", name: "Basic Backend", color: "cyan" },
        chatapp: { emoji: "💬", name: "Chat App Backend", color: "blue" },
        ecom: { emoji: "🛒", name: "E-commerce Backend", color: "green" },
        blog: { emoji: "📝", name: "Blog Backend", color: "magenta" },
        aichat: { emoji: "🤖", name: "AI Chat Backend", color: "magenta" },
      };

      const info = templateInfo[template];
      console.log(
        chalk[info.color](`\n${info.emoji} Selected: ${info.name}\n`)
      );

      // Loading animation
      await showLoading("🏗️  Setting up project structure...", 1500);
      await showLoading("📦 Installing dependencies configuration...", 1000);
      await showLoading("🔧 Configuring middleware and security...", 1200);
      await showLoading("📝 Generating documentation...", 800);

      // Generate project
      await generateProject(projectName, template);

      // Automatically install dependencies
      const projectPath = path.join(process.cwd(), projectName);
      await installDependencies(projectPath);

      // Success message
      showSuccess(projectName);

      // Next steps with beautiful formatting (updated since dependencies are already installed)
      console.log(chalk.yellow.bold("🚀 Your project is ready! Next steps:\n"));

      const steps = [
        {
          icon: "📁",
          text: `cd ${projectName}`,
          desc: "Navigate to your project",
        },
        {
          icon: "🚀",
          text: "npm start",
          desc: "Start your development server",
        },
        {
          icon: "🌐",
          text: "Open http://localhost:3000",
          desc: "View your app in the browser",
        },
        {
          icon: "📝",
          text: "code .",
          desc: "Open in your favorite editor",
        },
      ];

      steps.forEach((step, index) => {
        console.log(
          chalk.cyan(`   ${index + 1}. ${step.icon} ${chalk.bold(step.text)}`)
        );
        console.log(chalk.gray(`      ${step.desc}\n`));
      });

      console.log(
        chalk.green.bold(
          "🎉 Happy coding! Your Express backend is ready to go! ✨\n"
        )
      );

      // Show helpful commands for the project directory
      console.log(chalk.cyan.bold("💡 Quick commands to get started:\n"));
      console.log(chalk.white(`   cd ${projectName} && npm start`));
      console.log(chalk.gray("   Start your server immediately\n"));

      console.log(chalk.white(`   cd ${projectName} && npm run dev`));
      console.log(chalk.gray("   Start with auto-reload for development\n"));

      // Footer
      console.log(
        chalk.gray(
          "───────────────────────────────────────────────────────────────"
        )
      );
      console.log(
        chalk.gray("💡 Need help? Check the README.md in your project folder")
      );
      console.log(chalk.gray("🐛 Found a bug? Report it on GitHub"));
      console.log(chalk.gray("⭐ Like Express Genie? Give us a star!"));
      console.log(
        chalk.gray(
          "───────────────────────────────────────────────────────────────\n"
        )
      );
    } catch (error) {
      console.log(chalk.red(`\n💥 Oops! Something went wrong:\n`));
      console.log(chalk.red(`   ❌ ${error.message}\n`));

      console.log(chalk.yellow("🔧 Troubleshooting tips:"));
      console.log(chalk.gray("   • Make sure you have Node.js 16+ installed"));
      console.log(chalk.gray("   • Check if the project name is valid"));
      console.log(
        chalk.gray("   • Ensure you have write permissions in this directory")
      );
      console.log(
        chalk.gray("   • Try running with administrator/sudo privileges\n")
      );

      process.exit(1);
    }
  });

// Add help command with styling
program
  .command("help")
  .description(chalk.gray("Show help information"))
  .action(() => {
    showBanner();
    console.log(chalk.yellow.bold("📚 Available Commands:\n"));

    console.log(chalk.cyan("   express-autotemplates create [project-name]"));
    console.log(chalk.gray("   Create a new Express backend project\n"));

    console.log(chalk.cyan("   express-autotemplates --version"));
    console.log(chalk.gray("   Show version information\n"));

    console.log(chalk.cyan("   express-autotemplates --help"));
    console.log(chalk.gray("   Show this help message\n"));

    console.log(chalk.yellow.bold("🎯 Examples:\n"));
    console.log(
      chalk.green("   express-autotemplates create my-awesome-backend")
    );
    console.log(chalk.green("   express-autotemplates create"));
    console.log(chalk.gray("   (will prompt for project name)\n"));
  });

program.parse();
