# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Development Environment](#development-environment)
5. [Build System](#build-system)
6. [Testing Framework](#testing-framework)
7. [Security Model](#security-model)
8. [API Documentation](#api-documentation)
9. [Deployment](#deployment)
10. [Configuration](#configuration)
11. [Development Workflow](#development-workflow)

## Project Overview

Gemini Desktop is a powerful, cross-platform desktop and web application that provides a modern UI for **Gemini CLI** and **Qwen Code**. Built with Rust (Tauri) and React/TypeScript, it enables structured interaction with AI models through the Agent Communication Protocol (ACP).

### Key Features
- **Dual deployment modes**: Native desktop app and web application
- **Real-time communication**: WebSocket-based event system for live updates
- **Tool call confirmation**: User approval workflow for AI agent actions
- **Multi-backend support**: Gemini CLI and Qwen Code integration
- **Project management**: Session-based workspace management with chat history
- **Security-first design**: Comprehensive command filtering and permission system
- **Custom title bar**: Enhanced desktop experience with native window controls
- **About dialog**: Integrated help and version information
- **Resizable sidebar**: Interactive sidebar with drag-to-resize functionality and persistent width settings
- **Cross-platform support**: Windows, macOS, and Linux compatibility

## Architecture

### Rust Workspace Structure

The project is organized as a Rust workspace with three main crates:

#### **`crates/backend`** - Core Business Logic
- **ACP Protocol** (`acp/mod.rs`) - Complete Agent Communication Protocol implementation
  - JSON-RPC 2.0 based messaging
  - Session lifecycle management (initialize, authenticate, new session)
  - Tool call handling with user confirmation flow
  - Content blocks for text, images, audio, and resources
  - Comprehensive test suite with property-based testing
- **Session Management** (`session/mod.rs`) - CLI process orchestration
  - Gemini and Qwen backend support
  - Working directory context preservation
  - Process lifecycle management
  - Authentication handling (API keys, Vertex AI)
- **Event System** (`events/mod.rs`) - Real-time communication backbone
  - Event emission and broadcasting
  - WebSocket integration
  - Tool call confirmation workflow
- **Security** (`security/mod.rs`) - Command execution protection
  - Whitelist of 100+ safe commands
  - Blacklist of dangerous patterns and operations
  - Cross-platform command validation
- **File System** (`filesystem/mod.rs`) - Safe file operations
  - Directory validation and navigation
  - Home directory detection
  - Volume listing (Windows, macOS, Linux)
- **Projects** (`projects/mod.rs`) - Workspace management
  - Project discovery and metadata
  - Chat history and search functionality
  - SHA256-based project identification
- **Search** (`search/mod.rs`) - Full-text search capabilities
  - Chat content indexing
  - Filtering and ranking algorithms
  - Date range and project-based filtering

#### **`crates/server`** - Web Server Implementation
- **Rocket-based REST API** - HTTP endpoints for all backend functionality
- **WebSocket handlers** - Real-time event broadcasting to web clients
- **Static file serving** - Embedded frontend distribution
- **Connection management** - WebSocket lifecycle and error handling
- **Binary target**: `gemini-desktop-web`

#### **`crates/tauri-app`** - Desktop Application
- **Native wrapper** around the React frontend
- **Tauri commands** for system integration
- **Event emission** to frontend via Tauri's event system
- **Cross-platform capabilities** with minimal permissions
- **Binary target**: `gemini-desktop`

### Frontend Architecture

**React/TypeScript Single Page Application** (`frontend/`):

#### Component Organization
- **`branding/`** - Logo and wordmark components
  - `GeminiIcon.tsx` - Gemini brand icon component
  - `GeminiWordmark.tsx` - Gemini text branding
  - `QwenIcon.tsx` - Qwen brand icon component
  - `QwenWordmark.tsx` - Qwen text branding
  - `PiebaldLogo.tsx` - Piebald company branding
  - `SmartLogo.tsx` - Dynamic logo switching
  - `DesktopText.tsx` - Desktop-specific text elements
- **`common/`** - Reusable UI components
  - `ToolCallDisplay.tsx` - Tool execution visualization
  - `MarkdownRenderer.tsx` - Rich text rendering with syntax highlighting
  - `DiffViewer.tsx` - Code difference visualization with word-level diffing
  - `SearchInput.tsx` - Advanced search interface
  - `DirectorySelectionDialog.tsx` - File system navigation
  - `AboutDialog.tsx` - Application information and version details
  - `CliWarnings.tsx` - CLI installation status and warnings
  - `CodeBlock.tsx` - Syntax-highlighted code display
  - `MentionInput.tsx` - @-mention support for user input
  - `ModelContextProtocol.tsx` - MCP server integration components
  - `SearchResults.tsx` - Search result display and filtering
  - `ToolCallsList.tsx` - Tool execution history
  - `ToolResultRenderer.tsx` - Tool output formatting
  - `UserAvatar.tsx` - User profile display
- **`conversation/`** - Chat interface components
  - `ConversationList.tsx` - Message history and pagination
  - `MessageInputBar.tsx` - Text input with mention support
  - `MessageActions.tsx` - Message-level actions (copy, retry, etc.)
  - `MessageContent.tsx` - Message body rendering
  - `MessageHeader.tsx` - Message metadata display
  - `ThinkingBlock.tsx` - AI reasoning visualization
  - `RecentChats.tsx` - Session history sidebar
- **`layout/`** - Application structure
  - `AppHeader.tsx` - Top navigation bar
  - `AppSidebar.tsx` - Navigation and project selection with resizable functionality
  - `CustomTitleBar.tsx` - Native window controls for desktop
  - `PageLayout.tsx` - Responsive layout management
- **`mcp/`** - Model Context Protocol components
  - `AddMcpServerDialog.tsx` - Server configuration dialog
  - `DynamicList.tsx` - Dynamic list management
  - `McpServerCard.tsx` - Server status display
  - `McpServerSettings.tsx` - Server configuration interface
  - `PasteJsonDialog.tsx` - JSON configuration import
- **`renderers/`** - Tool-specific result renderers
  - `CommandRenderer.tsx` - Terminal output formatting
  - `DefaultRenderer.tsx` - Fallback renderer
  - `DirectoryRenderer.tsx` - Directory listing display
  - `EditRenderer.tsx` - File modification display
  - `FileRenderer.tsx` - File content display
  - `GrepGlobRenderer.tsx` - Search result formatting
  - `ReadFileRenderer.tsx` - Single file content display
  - `ReadManyFilesRenderer.tsx` - Multiple file content display
  - `SearchRenderer.tsx` - Advanced search results
  - `WebToolRenderer.tsx` - Web fetch result display
- **`theme/`** - Theme management
  - `simple-theme-toggle.tsx` - Light/dark mode switcher
  - `theme-provider.tsx` - Theme context provider
- **`ui/`** - shadcn/ui component library (New York variant)
  - Complete design system with consistent theming
  - Accessible components with proper ARIA support
  - Dark/light mode toggle support
  - Enhanced sidebar component with resize handle and drag-to-resize functionality

#### Context and State Management
- **`BackendContext.tsx`** - Primary communication layer
  - API abstraction (Tauri vs REST)
  - Event handling and state synchronization
  - Error boundary and retry logic
- **`ConversationContext.tsx`** - Chat state management
  - Message history and pagination
  - Tool call confirmation state
  - Real-time event integration

#### Custom Hooks
- **`useCliInstallation.ts`** - CLI availability detection
- **`useConversationEvents.ts`** - Real-time event handling
- **`useConversationManager.ts`** - Conversation state management
- **`useMessageHandler.ts`** - Message processing and display
- **`useProcessManager.ts`** - Session lifecycle management
- **`useResizable.ts`** - Sidebar resize functionality with mouse drag handling and localStorage persistence
- **`useToolCallConfirmation.ts`** - User approval workflow
- **`use-mobile.ts`** - Responsive design utilities

## Technology Stack

### Backend Technologies
- **Rust** (Editions 2024/2021) - Systems programming language
- **Tokio** - Async runtime with full feature set
- **Serde** - Serialization framework with derive macros
- **Rocket** - Web framework with JSON support
- **rocket-ws** - WebSocket support for Rocket
- **Tauri** - Desktop app framework
- **SHA2** - Cryptographic hashing for project identification
- **Chrono** - Date/time handling with serialization support

### Frontend Technologies
- **React 18.3** - Component-based UI framework
- **TypeScript 5.6** - Static type checking with strict mode
- **Vite 6.0** - Modern build tool with HMR
- **Tailwind CSS 4.1** - Utility-first CSS framework with @tailwindcss/vite plugin
- **shadcn/ui** - Component library with Radix UI primitives
- **Monaco Editor** - VS Code-like code editing capabilities
- **React Markdown** - Markdown rendering with syntax highlighting
- **React Router 7.7** - Client-side routing
- **React Mentions** - @-mention support in text inputs
- **React Syntax Highlighter** - Code syntax highlighting
- **Axios** - HTTP client with interceptors
- **Lucide React** - Icon library
- **KaTeX** - Math rendering support
- **Highlight.js** - Code syntax highlighting
- **Shiki** - Advanced syntax highlighting with VS Code themes
- **next-themes** - Theme management system
- **class-variance-authority** - CSS class variance utilities
- **Google Generative AI** - Direct Gemini API integration

### Development Tools
- **Just** - Task runner and build automation
- **pnpm** - Fast, disk space efficient package manager
- **ESLint** - Code linting with TypeScript support
- **Prettier** - Code formatting
- **cargo-nextest** - Improved Rust test runner
- **cargo-tarpaulin** - Code coverage analysis

## Development Environment

### Prerequisites
- **Rust** (latest stable) with Cargo
- **Node.js** 22.x or higher
- **pnpm** 10.13.1 or higher
- **Just** task runner
- **System dependencies** (varies by platform)

### Setup Commands

```bash
# Install all dependencies
just deps

# Desktop development (with hot reload)
just deps dev

# Web development (frontend + backend servers)
just deps dev-web
```

### Development Servers
- **Frontend**: `http://localhost:1420` (Vite dev server)
- **Backend API**: `http://localhost:1858` (Rocket server)
- **HMR WebSocket**: `ws://localhost:1421` (Hot Module Replacement)

### Environment Variables
- `GEMINI_DESKTOP_WEB="true"` - Enables web mode in frontend
- `TAURI_DEV_HOST` - Custom development host for Tauri
- `TAURI_APP_PATH` - Path to Tauri application (relative to frontend)
- `TAURI_FRONTEND_PATH` - Frontend directory path

## Build System

### Just Task Runner

The project uses **Just** as the primary task runner with the following commands:

```bash
# Core commands
just deps                    # Install dependencies
just build-all              # Build both desktop and web
just ci                     # Run CI checks (lint + format)

# Building
just build                  # Build desktop app
just build-web              # Build web server

# Development
just dev                    # Start desktop development
just dev-web                # Start web development (parallel)
just server-dev             # Backend server only
just frontend-dev-web       # Frontend only (web mode)

# Quality assurance
just lint                   # Development linting
just lint-ci                # CI linting (fail on warnings)
just fmt                    # Format code
just check-fmt              # Check formatting
just test [args]            # Run tests with optional arguments
```

### Build Configuration

#### Frontend Build (Vite)
- **TypeScript compilation** with strict mode
- **Tailwind CSS processing** with @tailwindcss/vite plugin
- **Bundle optimization** for production
- **Proxy setup** for API routes in development
- **Environment variable injection** (`GEMINI_DESKTOP_WEB` flag)
- **React plugin** with fast refresh support
- **Node.js compatibility** for server-side dependencies

#### Rust Build (Cargo)
- **Workspace compilation** with shared dependencies
- **Feature flags** for optional functionality (proptest)
- **Clippy linting** with pedantic rules
- **Release optimization** with LTO

#### Tauri Build
- **Frontend embedding** in desktop binary
- **Icon generation** for multiple platforms
- **Code signing** preparation (certificates required)
- **Installer generation** for distribution

## Testing Framework

### Backend Testing

#### Test Infrastructure
- **cargo-nextest** - Preferred test runner for better performance
- **tokio-test** - Async testing utilities
- **mockall** - Mock object generation
- **serial_test** - Test serialization for environment isolation
- **proptest** - Property-based testing (optional feature)
- **criterion** - Benchmarking framework

#### Test Utilities (`test_utils.rs`)
- **`EnvGuard`** - Thread-safe environment variable management
  - RAII-based cleanup ensuring test isolation
  - Restore original values after test completion
- **`TestDirManager`** - Unique temporary directory creation
  - Per-test isolation with automatic cleanup
  - Cross-platform path handling
- **Builder patterns** for test data creation
  - `ProjectListItem`, `RecentChat`, `JsonRpcRequest` builders
  - Fluent API for readable test setup

#### Coverage Requirements
- **95% coverage threshold** enforced via tarpaulin
- **HTML and XML output** for CI integration
- **Exclusions**: target/, tests/ directories
- **Timeout**: 120 seconds for complex integration tests

### Testing Commands

```bash
# Run all tests
just test
cargo nextest run

# Run with coverage
cargo tarpaulin

# Run specific test patterns
cargo nextest run test_acp
cargo nextest run --package backend

# Benchmarking
cargo bench
```

### Frontend Testing
- **ESLint** with TypeScript strict rules
- **Type checking** with `tsc --noEmit`
- **Format checking** with Prettier
- **Manual testing** via development servers

## Security Model

### Command Execution Security

The application implements a comprehensive security model for command execution:

#### Whitelist Approach (`security/mod.rs`)
**100+ Safe Commands** including:
- **File operations**: `ls`, `cat`, `head`, `tail`, `find`, `grep`
- **Version control**: `git status`, `git log`, `git diff`, `git show`
- **Development tools**: `cargo build`, `npm install`, `yarn add`
- **System info**: `echo`, `pwd`, `whoami`, `uname`, `date`
- **Text processing**: `sort`, `uniq`, `wc`, `awk`, `sed`

#### Blacklist Protection
**Dangerous Patterns Blocked**:
- **File system attacks**: `rm`, `del`, `format`, `dd`, `rmdir`
- **Network operations**: `curl`, `wget`, `nc`, `nmap`
- **System control**: `shutdown`, `reboot`, `systemctl`, `service`
- **Privilege escalation**: `sudo`, `su`, `passwd`, `chown`, `chmod`
- **Command injection**: `||`, `&&`, `|`, `;`, `` ` ``, `$()`
- **Code execution**: `eval`, `exec`, `source`, `python -c`

#### Security Features
- **Case-insensitive matching** for bypass prevention
- **Pattern-based detection** for complex injection attempts
- **Cross-platform compatibility** (Windows/Unix commands)
- **Process isolation** with controlled execution environment

### Tauri Security Model

#### Permission System
- **Minimal capabilities**: Only essential permissions granted
- **Core events**: Limited to application lifecycle
- **Dialog access**: File/directory selection only
- **Opener functionality**: External link handling
- **No global Tauri object** exposure

#### Content Security
- **CSP disabled** (relying on Tauri's security model)
- **No arbitrary code execution** in frontend
- **Sandboxed environment** for web content

## API Documentation

### ACP Protocol Implementation

The application implements the complete Agent Communication Protocol specification:

#### Core Methods

**Initialization**
```typescript
// Initialize session with client capabilities
method: "initialize"
params: {
  protocolVersion: 1,
  clientCapabilities: {
    fs: { readTextFile: boolean, writeTextFile: boolean }
  }
}
```

**Authentication**
```typescript
// Authenticate with chosen method
method: "authenticate"
params: {
  methodId: "gemini-api-key" | "vertex-ai"
}
```

**Session Management**
```typescript
// Create new session
method: "session/new"
params: {
  cwd: string,
  mcpServers: McpServer[]
}

// Send prompt to AI agent
method: "session/prompt"
params: {
  sessionId: string,
  prompt: ContentBlock[]
}
```

#### WebSocket Events

**Session Updates**
- `agent_message_chunk` - Streaming AI responses
- `agent_thought_chunk` - AI reasoning process
- `tool_call` - Tool execution requests
- `tool_call_update` - Execution progress updates

**Permission Requests**
- `session/request_permission` - User approval required
- Options: Allow Once, Allow Always, Reject Once, Reject Always

### REST API Endpoints

#### Session Management
- `POST /api/start-session` - Initialize new session
- `POST /api/send-message` - Send message to AI
- `GET /api/process-statuses` - List active sessions
- `POST /api/kill-process` - Terminate session

#### Tool Confirmation
- `POST /api/tool-confirmation` - Send user approval
- `POST /api/execute-command` - Execute approved command

#### Project Management
- `GET /api/projects` - List projects with pagination
- `GET /api/projects-enriched` - Detailed project metadata
- `GET /api/projects/{id}/discussions` - Chat history
- `POST /api/search-chats` - Full-text search

#### File System
- `POST /api/validate-directory` - Check directory validity
- `POST /api/list-directory` - Directory contents
- `GET /api/list-volumes` - Available drives/volumes
- `GET /api/get-home-directory` - User home path

#### Utilities
- `GET /api/check-cli-installed` - CLI availability check
- `POST /api/generate-title` - AI-generated chat titles

### Event System

#### Desktop Events (Tauri)
```typescript
// Listen for backend events
api.listen<EventPayload>("event_name", (event) => {
  console.log(event.payload);
});
```

#### Web Events (WebSocket)
```typescript
// WebSocket message format
{
  event: string,
  payload: any,
  sequence: number  // For ordering
}
```

## Deployment

### CI/CD Pipeline

#### Continuous Integration (`.github/workflows/ci.yml`)
**Triggers**: Push to main, pull requests
**Environment**:
- Ubuntu-latest
- Node.js 22.x with pnpm 10.13.1
- Rust stable toolchain
- Just task runner

**Steps**:
1. Checkout and setup dependencies
2. Install system dependencies
3. Run linting (fail on warnings)
4. Check code formatting
5. Execute test suite

#### Release Pipeline (`.github/workflows/release.yml`)
**Trigger**: Git tags matching `v*`
**Process**:
1. Automated Tauri build for multiple platforms
2. GitHub release creation
3. Auto-generated release notes
4. Binary asset upload

### Build Targets

#### Desktop Application
- **Single executable** with embedded frontend
- **Cross-platform** (Windows, macOS, Linux)
- **Code signing** support (certificates required)
- **Installer generation** for easy distribution
- **Auto-updater** integration ready

#### Web Application
- **Backend server** (`gemini-desktop-web`) with embedded frontend
- **Self-hosted** deployment option
- **Docker containerization** ready
- **Reverse proxy** compatible

### Distribution Methods

#### Current
- **GitHub Releases** - Primary distribution channel
- **Manual downloads** from releases page
- **Self-compilation** from source

#### Planned
- **Package managers** (Homebrew, winget, apt)
- **App stores** (Microsoft Store, Mac App Store)
- **Docker Hub** for web version

## Configuration

### Project Structure
```
gemini-desktop/
├── crates/                 # Rust workspace
│   ├── backend/           # Core business logic
│   ├── server/            # Web server implementation
│   └── tauri-app/         # Desktop application
├── frontend/              # React application
├── .github/workflows/     # CI/CD pipelines
├── assets/                # Project assets
├── justfile              # Task definitions
├── tarpaulin.toml        # Coverage configuration
└── CLAUDE.md             # This file
```

### Configuration Files

#### Rust Configuration
- `Cargo.toml` - Workspace definition and metadata
- `crates/*/Cargo.toml` - Individual crate configurations
- `tarpaulin.toml` - Code coverage settings

#### Frontend Configuration
- `frontend/package.json` - Dependencies and scripts
- `frontend/vite.config.ts` - Build tool configuration
- `frontend/tsconfig.json` - TypeScript settings
- `frontend/eslint.config.js` - Linting rules
- `frontend/components.json` - shadcn/ui configuration

#### Tauri Configuration
- `crates/tauri-app/tauri.conf.json` - App metadata and security
- `crates/tauri-app/capabilities/` - Permission definitions

### Runtime Configuration

#### Project Storage
- **Location**: `~/.gemini-desktop/projects/`
- **Format**: JSON files with SHA256-based naming
- **Content**: Project metadata, chat history, search indexes

#### Session Management
- **Working directories** preserved per session
- **Process isolation** with unique identifiers
- **Multi-backend support** with Gemini and Qwen configurations
- **Chat history** stored in structured format
- **Tool call logs** for debugging and replay
- **Custom title bar** for enhanced desktop experience

#### Authentication
- **API key storage** (encrypted/secure storage planned)
- **Multiple provider support** (Gemini, Vertex AI, Qwen)
- **Session-based authentication** for web mode
- **Unified backend configuration** with validation

## Development Workflow

### Code Style and Standards

#### Rust Code
- **Clippy pedantic lints** enabled for high code quality
- **cargo fmt** for consistent formatting
- **Edition 2024** features utilized (2021 for tauri-app crate)
- **Comprehensive error handling** with `thiserror`
- **Async/await patterns** throughout

#### TypeScript Code
- **Strict mode** enabled for maximum type safety
- **ESLint rules** with React and accessibility plugins
- **Prettier formatting** with consistent style
- **Import organization** with path aliases
- **Component composition** over inheritance

### Git Workflow

#### Branch Strategy
- **Main branch** for stable releases
- **Feature branches** for new development
- **Pull request** workflow with CI checks
- **Semantic versioning** for releases

#### Commit Standards
- **Conventional commits** format encouraged
- **Clear descriptions** of changes
- **Reference issues** when applicable
- **Breaking changes** clearly marked

### Testing Standards

#### Unit Tests
- **95% coverage requirement** strictly enforced
- **Isolated test cases** with proper setup/teardown
- **Mock external dependencies** for reliability
- **Property-based testing** for complex logic

#### Integration Tests
- **End-to-end scenarios** with real components
- **Error condition testing** for robustness
- **Performance benchmarks** for critical paths
- **Cross-platform validation** when possible

### Release Process

1. **Version bump** in relevant configuration files
2. **Update changelog** with new features and fixes
3. **Tag release** with semantic version
4. **Automated build** via GitHub Actions
5. **Release notes** generated automatically
6. **Binary distribution** via GitHub Releases

### Contributing Guidelines

#### Prerequisites
- Rust and Node.js development environment
- Familiarity with async programming
- Understanding of Tauri and React ecosystems

#### Development Setup
1. Clone repository and install dependencies
2. Set up development environment per instructions
3. Run test suite to verify setup
4. Start development servers for testing

#### Code Review Process
- All changes require pull request review
- CI checks must pass before merge
- Code coverage must not decrease
- Documentation updates for public APIs


## Complete Source Code Tree
```
gemini-desktop/
├── assets/
│   ├── qwen-desktop.png
│   └── screenshot.png
├── Cargo.lock
├── Cargo.toml
├── CLAUDE.md
├── LICENSE
├── README.md
├── crates/
│   ├── backend/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── acp/
│   │       │   └── mod.rs
│   │       ├── cli/
│   │       │   └── mod.rs
│   │       ├── events/
│   │       │   └── mod.rs
│   │       ├── filesystem/
│   │       │   └── mod.rs
│   │       ├── lib.rs
│   │       ├── projects/
│   │       │   └── mod.rs
│   │       ├── rpc/
│   │       │   └── mod.rs
│   │       ├── search/
│   │       │   └── mod.rs
│   │       ├── security/
│   │       │   └── mod.rs
│   │       ├── session/
│   │       │   └── mod.rs
│   │       ├── test_utils.rs
│   │       └── types/
│   │           └── mod.rs
│   ├── server/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       └── main.rs
│   └── tauri-app/
│       ├── build.rs
│       ├── Cargo.lock
│       ├── Cargo.toml
│       ├── capabilities/
│       │   └── default.json
│       ├── gen/
│       │   └── schemas/
│       │       ├── acl-manifests.json
│       │       ├── capabilities.json
│       │       ├── desktop-schema.json
│       │       └── windows-schema.json
│       ├── icons/
│       │   ├── 128x128.png
│       │   ├── 128x128@2x.png
│       │   ├── 32x32.png
│       │   ├── Square107x107Logo.png
│       │   ├── Square142x142Logo.png
│       │   ├── Square150x150Logo.png
│       │   ├── Square284x284Logo.png
│       │   ├── Square30x30Logo.png
│       │   ├── Square310x310Logo.png
│       │   ├── Square44x44Logo.png
│       │   ├── Square71x71Logo.png
│       │   ├── Square89x89Logo.png
│       │   ├── StoreLogo.png
│       │   ├── icon.icns
│       │   ├── icon.ico
│       │   └── icon.png
│       ├── src/
│       │   ├── commands/
│       │   │   └── mod.rs
│       │   ├── event_emitter.rs
│       │   ├── lib.rs
│       │   ├── main.rs
│       │   └── state.rs
│       └── tauri.conf.json
├── frontend/
│   ├── components.json
│   ├── dist/                    # Build output directory (generated)
│   ├── eslint.config.js
│   ├── index.html
│   ├── node_modules/            # Package dependencies
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── public/
│   │   ├── Piebald.svg
│   │   ├── tauri.svg
│   │   └── vite.svg
│   ├── src/
│   │   ├── App.tsx
│   │   ├── assets/
│   │   │   └── react.svg
│   │   ├── components/
│   │   │   ├── branding/
│   │   │   │   ├── DesktopText.tsx
│   │   │   │   ├── GeminiIcon.tsx
│   │   │   │   ├── GeminiWordmark.tsx
│   │   │   │   ├── PiebaldLogo.tsx
│   │   │   │   ├── QwenIcon.tsx
│   │   │   │   ├── QwenWordmark.tsx
│   │   │   │   ├── SmartLogo.tsx
│   │   │   │   └── SmartLogoCenter.tsx
│   │   │   ├── common/
│   │   │   │   ├── AboutDialog.tsx
│   │   │   │   ├── CliWarnings.tsx
│   │   │   │   ├── CodeBlock.tsx
│   │   │   │   ├── DiffViewer.tsx
│   │   │   │   ├── DirectorySelectionDialog.tsx
│   │   │   │   ├── MarkdownRenderer.tsx
│   │   │   │   ├── MentionInput.tsx
│   │   │   │   ├── ModelContextProtocol.tsx
│   │   │   │   ├── SearchInput.tsx
│   │   │   │   ├── SearchResults.tsx
│   │   │   │   ├── ToolCallDisplay.tsx
│   │   │   │   ├── ToolCallsList.tsx
│   │   │   │   ├── ToolResultRenderer.tsx
│   │   │   │   └── UserAvatar.tsx
│   │   │   ├── conversation/
│   │   │   │   ├── ConversationList.tsx
│   │   │   │   ├── MessageActions.tsx
│   │   │   │   ├── MessageContent.tsx
│   │   │   │   ├── MessageHeader.tsx
│   │   │   │   ├── MessageInputBar.tsx
│   │   │   │   ├── RecentChats.tsx
│   │   │   │   └── ThinkingBlock.tsx
│   │   │   ├── layout/
│   │   │   │   ├── AppHeader.tsx
│   │   │   │   ├── AppSidebar.tsx
│   │   │   │   ├── CustomTitleBar.tsx
│   │   │   │   └── PageLayout.tsx
│   │   │   ├── mcp/
│   │   │   │   ├── AddMcpServerDialog.tsx
│   │   │   │   ├── DynamicList.tsx
│   │   │   │   ├── McpServerCard.tsx
│   │   │   │   ├── McpServerSettings.tsx
│   │   │   │   └── PasteJsonDialog.tsx
│   │   │   ├── renderers/
│   │   │   │   ├── CommandRenderer.tsx
│   │   │   │   ├── DefaultRenderer.tsx
│   │   │   │   ├── DirectoryRenderer.tsx
│   │   │   │   ├── EditRenderer.tsx
│   │   │   │   ├── FileRenderer.tsx
│   │   │   │   ├── GrepGlobRenderer.tsx
│   │   │   │   ├── ReadFileRenderer.tsx
│   │   │   │   ├── ReadManyFilesRenderer.tsx
│   │   │   │   ├── SearchRenderer.tsx
│   │   │   │   └── WebToolRenderer.tsx
│   │   │   ├── theme/
│   │   │   │   ├── simple-theme-toggle.tsx
│   │   │   │   └── theme-provider.tsx
│   │   │   └── ui/
│   │   │       ├── alert.tsx
│   │   │       ├── avatar.tsx
│   │   │       ├── badge.tsx
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── checkbox.tsx
│   │   │       ├── code.tsx
│   │   │       ├── collapsible.tsx
│   │   │       ├── context-menu.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── dropdown-menu.tsx
│   │   │       ├── input.tsx
│   │   │       ├── label.tsx
│   │   │       ├── radio-group.tsx
│   │   │       ├── scroll-area.tsx
│   │   │       ├── select.tsx
│   │   │       ├── separator.tsx
│   │   │       ├── sheet.tsx
│   │   │       ├── sidebar.tsx
│   │   │       ├── skeleton.tsx
│   │   │       ├── table.tsx
│   │   │       ├── textarea.tsx
│   │   │       └── tooltip.tsx
│   │   ├── contexts/
│   │   │   ├── BackendContext.tsx
│   │   │   └── ConversationContext.tsx
│   │   ├── hooks/
│   │   │   ├── use-mobile.ts
│   │   │   ├── useCliInstallation.ts
│   │   │   ├── useConversationEvents.ts
│   │   │   ├── useConversationManager.ts
│   │   │   ├── useMessageHandler.ts
│   │   │   ├── useProcessManager.ts
│   │   │   ├── useResizable.ts
│   │   │   └── useToolCallConfirmation.ts
│   │   ├── index.css
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── utils.ts
│   │   │   └── webApi.ts
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── HomeDashboard.tsx
│   │   │   ├── McpServersPage.tsx
│   │   │   ├── ProjectDetail.tsx
│   │   │   └── Projects.tsx
│   │   ├── types/
│   │   │   ├── backend.ts
│   │   │   ├── index.ts
│   │   │   └── mcp.ts
│   │   ├── utils/
│   │   │   ├── backendDefaults.ts
│   │   │   ├── backendText.ts
│   │   │   ├── backendValidation.ts
│   │   │   ├── helpers.ts
│   │   │   ├── mcpValidation.ts
│   │   │   ├── toolCallParser.ts
│   │   │   ├── toolInputParser.ts
│   │   │   └── wordDiff.ts
│   │   └── vite-env.d.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── justfile
├── src-tauri/                      # Legacy Tauri directory (build artifacts)
│   └── target/
├── target/                         # Rust build artifacts
└── tarpaulin.toml
```

---

*This documentation is maintained alongside the codebase and should be updated when significant changes are made to the architecture, APIs, or development processes.*