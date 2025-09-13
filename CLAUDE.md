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
- **Internationalization**: Full i18n support with language switching for English, Chinese Simplified, and Traditional Chinese
- **Custom title bar**: Enhanced desktop experience with native window controls
- **About dialog**: Integrated help and version information
- **Resizable sidebar**: Interactive sidebar with drag-to-resize functionality and persistent width settings
- **Cross-platform support**: Windows, macOS, and Linux compatibility
- **File viewing support**: PDF, Excel, image, and text file viewers with syntax highlighting
- **Advanced search**: Full-text search across chat history and projects
- **Settings management**: Comprehensive settings dialog with backend configuration

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
  - Robust JSON parsing with non-JSON line filtering
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
- **CLI Integration** (`cli/mod.rs`) - Command line interface management
  - Process spawning and lifecycle management
  - Output parsing and streaming
  - Cross-platform command execution
- **RPC Layer** (`rpc/mod.rs`) - Remote procedure call abstraction
  - Type-safe method definitions
  - Serialization/deserialization handling
  - Error propagation and handling

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
- **Menu system** (`menu.rs`) - Native application menus with i18n support
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
  - `SmartLogoCenter.tsx` - Centered logo variant
  - `DesktopText.tsx` - Desktop-specific text elements
- **`common/`** - Reusable UI components (27 components)
  - `AboutDialog.tsx` - Application information and version details
  - `CliWarnings.tsx` - CLI installation status and warnings
  - `CodeBlock.tsx` - Syntax-highlighted code display
  - `CodeMirrorViewer.tsx` - Advanced code editing and viewing
  - `DiffViewer.tsx` - Code difference visualization with word-level diffing
  - `DirectoryPanel.tsx` - Directory tree visualization
  - `DirectorySelectionDialog.tsx` - File system navigation
  - `ExcelViewer.tsx` - Spreadsheet file viewer
  - `FileContentViewer.tsx` - Generic file content display
  - `FilePickerDropdown.tsx` - File selection dropdown component
  - `GitInfo.tsx` - Git repository status display
  - `ImageViewer.tsx` - Image file display component
  - `InlineSessionProgress.tsx` - Session progress indicators
  - `LanguageSwitcher.tsx` - Language selection interface with flag icons
  - `MarkdownRenderer.tsx` - Rich text rendering with syntax highlighting
  - `MentionInput.tsx` - @-mention support for user input
  - `ModelContextProtocol.tsx` - MCP server integration components
  - `PDFViewer.tsx` - PDF document viewer
  - `RecursiveFilePickerDropdown.tsx` - Recursive file browser
  - `SearchInput.tsx` - Advanced search interface
  - `SearchResults.tsx` - Search result display and filtering
  - `SettingsDialog.tsx` - Application settings management
  - `ToolCallDisplay.tsx` - Tool execution visualization
  - `ToolCallsList.tsx` - Tool execution history
  - `ToolResultRenderer.tsx` - Tool output formatting
  - `UserAvatar.tsx` - User profile display
  - `I18nExample.tsx` - Translation demonstration component
- **`conversation/`** - Chat interface components
  - `ConversationList.tsx` - Message history and pagination
  - `ConversationSearchDialog.tsx` - Search dialog for conversations
  - `MessageInputBar.tsx` - Text input with mention support and Shift+Enter support
  - `MessageActions.tsx` - Message-level actions (copy, retry, etc.)
  - `MessageContent.tsx` - Message body rendering
  - `MessageHeader.tsx` - Message metadata display
  - `ThinkingBlock.tsx` - AI reasoning visualization
  - `RecentChats.tsx` - Session history sidebar
  - `NewChatPlaceholder.tsx` - Empty state for new conversations
  - `ProcessCard.tsx` - Active process status display
- **`layout/`** - Application structure
  - `AppHeader.tsx` - Top navigation bar
  - `AppSidebar.tsx` - Navigation and project selection with resizable functionality
  - `CustomTitleBar.tsx` - Native window controls for desktop and web
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
  - Additional components: `command.tsx`, `sonner.tsx` (toast notifications), `collapsible.tsx`

#### Context and State Management
- **`BackendContext.tsx`** - Primary communication layer
  - API abstraction (Tauri vs REST)
  - Event handling and state synchronization
  - Error boundary and retry logic
- **`ConversationContext.tsx`** - Chat state management
  - Message history and pagination
  - Tool call confirmation state
  - Real-time event integration
- **`LanguageContext.tsx`** - Internationalization management
  - Current language state and persistence
  - Language switching functionality
  - Browser language detection integration

#### API Layer (`lib/`)
- **`api.ts`** - Unified API interface with TypeScript proxy
  - Single API interface for both desktop (Tauri) and web (REST) modes
  - Runtime environment detection with `__WEB__` flag
  - Type-safe method invocation with generic type system
  - Comprehensive API method definitions for all backend operations
- **`webApi.ts`** - Web-specific REST API implementation
  - Axios-based HTTP client with 30-second timeout
  - Complete REST endpoint implementations mirroring Tauri commands
  - WebSocket management for real-time events
  - Connection handling with automatic reconnection logic
  - Type definitions for all data structures

#### Custom Hooks
- **`useCliInstallation.ts`** - CLI availability detection
- **`useConversationEvents.ts`** - Real-time event handling
- **`useConversationManager.ts`** - Conversation state management
- **`useFileSystemNavigation.ts`** - File system navigation utilities
- **`useMessageHandler.ts`** - Message processing and display
- **`useMessageTimer.ts`** - Message timing utilities
- **`useProcessManager.ts`** - Session lifecycle management
- **`useProcessTimer.ts`** - Process timing utilities
- **`useRecursiveFileSearch.ts`** - Recursive file search functionality
- **`useResizable.ts`** - Sidebar resize functionality with mouse drag handling
- **`useSessionProgress.ts`** - Session progress tracking
- **`useTauriMenu.ts`** - Tauri menu integration
- **`useTauriRustMenu.ts`** - Rust-based Tauri menu utilities
- **`useToolCallConfirmation.ts`** - User approval workflow
- **`useWittyLoadingPhrase.ts`** - Loading phrase generation
- **`use-mobile.ts`** - Responsive design utilities

#### Internationalization (`i18n/`)
- **`config.ts`** - i18next configuration and setup
- **`index.ts`** - Main i18n initialization
- **`types.ts`** - TypeScript definitions for translations
- **`locales/`** - Translation files
  - `en/translation.json` - English translations
  - `zh-CN/translation.json` - Simplified Chinese translations
  - `zh-TW/translation.json` - Traditional Chinese translations

#### Utilities and Helpers
- **`utils/backendDefaults.ts`** - Default backend configuration values
- **`utils/backendText.ts`** - Backend-specific text and messaging
- **`utils/backendValidation.ts`** - Backend configuration validation
- **`utils/download.ts`** - File download utilities
- **`utils/fileSystemHelpers.ts`** - File system utility functions
- **`utils/helpers.ts`** - General utility functions
- **`utils/loadingPhrases.ts`** - Loading phrase generation
- **`utils/mcpValidation.ts`** - Model Context Protocol validation
- **`utils/menuConfig.ts`** - Menu configuration utilities
- **`utils/syntaxHighlighter.ts`** - Syntax highlighting configuration
- **`utils/toolCallParser.ts`** - Tool call parsing and validation
- **`utils/toolInputParser.ts`** - Tool input formatting and validation

## Technology Stack

### Backend Technologies
- **Rust** (Edition 2024) - Systems programming language
- **Tokio** - Async runtime with full feature set
- **Serde** - Serialization framework with derive macros
- **Rocket** - Web framework with JSON support
- **rocket-ws** - WebSocket support for Rocket
- **Tauri** - Desktop app framework (v2.8.0)
- **SHA2** - Cryptographic hashing for project identification
- **Chrono** - Date/time handling with serialization support
- **Anyhow** - Error handling and propagation
- **Regex** - Pattern matching and text processing
- **Ignore** - File system pattern matching
- **Base64** - Encoding/decoding utilities

### Frontend Technologies
- **React** (19.1.1) - Component-based UI framework
- **TypeScript** (5.9.2) - Static type checking with strict mode
- **Vite** (7.1.3) - Modern build tool with HMR
- **Tailwind CSS** (4.1.12) - Utility-first CSS framework with @tailwindcss/vite plugin
- **shadcn/ui** - Component library with Radix UI primitives
- **CodeMirror** - Advanced code editing and syntax highlighting
- **Monaco Editor** - VS Code-like code editing capabilities
- **React Markdown** (10.1.0) - Markdown rendering with syntax highlighting
- **React Router DOM** (7.8.1) - Client-side routing
- **React Mentions** (4.4.10) - @-mention support in text inputs
- **React Syntax Highlighter** (15.6.1) - Code syntax highlighting
- **Axios** (1.11.0) - HTTP client with automatic error handling
- **Lucide React** (0.540.0) - Icon library
- **KaTeX** (0.16.22) - Math rendering support
- **Highlight.js** (11.11.1) - Code syntax highlighting
- **Shiki** (3.10.0) - Advanced syntax highlighting with VS Code themes
- **next-themes** (0.4.6) - Theme management system
- **class-variance-authority** (0.7.1) - CSS class variance utilities
- **Google Generative AI** (0.24.1) - Direct Gemini API integration
- **react-i18next** (15.6.1) - Internationalization framework with hooks and components
- **i18next** (25.3.6) - Core internationalization library
- **i18next-browser-languagedetector** (8.2.0) - Browser language detection
- **pdfjs-dist** (5.3.93) - PDF viewing capabilities
- **react-pdf** (10.1.0) - React PDF viewer component
- **xlsx** (0.18.5) - Excel file processing
- **sonner** (2.0.7) - Toast notifications

### Development Tools
- **Just** - Task runner and build automation
- **pnpm** (10.13.1+) - Fast, disk space efficient package manager
- **ESLint** (9.33.0) - Code linting with TypeScript support
- **Prettier** (3.6.2) - Code formatting
- **cargo-nextest** - Improved Rust test runner
- **cargo-tarpaulin** (0.31) - Code coverage analysis

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
- **mockall** (0.13) - Mock object generation
- **serial_test** (3.0) - Test serialization for environment isolation
- **proptest** - Property-based testing (optional feature)
- **criterion** (0.5) - Benchmarking framework

#### Test Utilities (`test_utils.rs`)
- **`EnvGuard`** - Thread-safe environment variable management
- **`TestDirManager`** - Unique temporary directory creation
- **Builder patterns** for test data creation

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
// Initialize session
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

### Unified API Interface (`api.ts`)

The application uses a sophisticated proxy-based API system that automatically routes calls to either Tauri commands (desktop) or REST endpoints (web):

```typescript
export interface API {
  // CLI and session management
  check_cli_installed(): Promise<boolean>;
  start_session(params: SessionParams): Promise<void>;
  send_message(params: MessageParams): Promise<void>;
  get_process_statuses(): Promise<ProcessStatus[]>;
  kill_process(params: { conversationId: string }): Promise<void>;

  // Tool call confirmation
  send_tool_call_confirmation_response(params: ConfirmationParams): Promise<void>;
  execute_confirmed_command(params: { command: string }): Promise<string>;

  // Project and chat management
  get_recent_chats(): Promise<RecentChat[]>;
  search_chats(params: SearchParams): Promise<SearchResult[]>;
  list_projects(params?: PaginationParams): Promise<ProjectsResponse>;
  get_project_discussions(params: { projectId: string }): Promise<Discussion[]>;
  list_enriched_projects(): Promise<EnrichedProject[]>;
  get_project(params: ProjectParams): Promise<EnrichedProject>;

  // File system operations
  validate_directory(params: { path: string }): Promise<boolean>;
  is_home_directory(params: { path: string }): Promise<boolean>;
  get_home_directory(): Promise<string>;
  get_parent_directory(params: { path: string }): Promise<string | null>;
  list_directory_contents(params: { path: string }): Promise<DirEntry[]>;
  list_files_recursive(params: { path: string }): Promise<DirEntry[]>;
  list_volumes(): Promise<DirEntry[]>;
  
  // Git operations
  get_git_info(params: { path: string }): Promise<GitInfo | null>;

  // Utilities
  generate_conversation_title(params: TitleParams): Promise<string>;
}
```

### REST API Endpoints (Web Mode)

**Session Management**
- `POST /api/start-session` - Initialize new session
- `POST /api/send-message` - Send message to AI
- `GET /api/process-statuses` - List active sessions
- `POST /api/kill-process` - Terminate session

**Tool Confirmation**
- `POST /api/tool-confirmation` - Send user approval
- `POST /api/execute-command` - Execute approved command

**Project Management**
- `GET /api/projects` - List projects with pagination
- `GET /api/projects-enriched` - Detailed project metadata
- `GET /api/projects/{id}/discussions` - Chat history
- `GET /api/recent-chats` - Fetch recent chat sessions
- `POST /api/search-chats` - Full-text search across chats

**File System**
- `POST /api/validate-directory` - Check directory validity
- `POST /api/is-home-directory` - Check if path is home directory
- `GET /api/get-home-directory` - User home path
- `POST /api/get-parent-directory` - Get parent directory path
- `POST /api/list-directory` - Directory contents
- `GET /api/list-volumes` - Available drives/volumes

**Utilities**
- `GET /api/check-cli-installed` - CLI availability check
- `POST /api/generate-title` - AI-generated chat titles

### WebSocket Integration (`webApi.ts`)
- **Real-time events**: WebSocket connection at `/api/ws`
- **Automatic reconnection**: Exponential backoff with max 5 attempts
- **Event management**: Type-safe event listener system
- **Connection lifecycle**: Promise-based connection readiness

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
- **Full internationalization** with language detection and persistence

#### Authentication
- **API key storage** (encrypted/secure storage planned)
- **Multiple provider support** (Gemini, Vertex AI, Qwen)
- **Session-based authentication** for web mode
- **Unified backend configuration** with validation

#### Internationalization
- **Language support**: English, Simplified Chinese, Traditional Chinese
- **Browser language detection** with automatic fallback
- **Persistent language preferences** stored in localStorage
- **Component-level translations** using react-i18next hooks
- **Translation interpolation** for dynamic content
- **Pluralization support** for count-based translations

## Development Workflow

### Code Style and Standards

#### Rust Code
- **Clippy pedantic lints** enabled for high code quality
- **cargo fmt** for consistent formatting
- **Edition 2024** features utilized (2021 for tauri-app crate)
- **Comprehensive error handling** with `anyhow`
- **Async/await patterns** throughout

#### Windows-Specific Command Execution
- **IMPORTANT**: When executing commands on Windows that spawn `cmd.exe`:
  - **Always use `creation_flags`** to hide console windows
  - For `tokio::process::Command`: Use `.creation_flags(0x08000000)` (`CREATE_NO_WINDOW`)
  - For `std::process::Command`: Add `use std::os::windows::process::CommandExt;` and use `.creation_flags(0x08000000)` (`CREATE_NO_WINDOW`)
  - This prevents console windows from flashing on screen during command execution
  - Example:
    ```rust
    #[cfg(windows)]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    ```
  - This applies to ALL commands that might spawn console windows

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

---

*This documentation is maintained alongside the codebase and should be updated when significant changes are made to the architecture, APIs, or development processes.*