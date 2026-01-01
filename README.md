<div>
<div align="right">
<a href="https://piebald.ai"><img width="200" top="20" align="right" src="https://github.com/Piebald-AI/.github/raw/main/Wordmark.svg"></a>
</div>

<div align="left">

### Check out Piebald
We've released **Piebald**, the ultimate agentic AI developer experience. \
Download it and try it out for free!  **https://piebald.ai/**

<a href="https://piebald.ai/discord"><img src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=flat&logo=discord&logoColor=white" alt="Join our Discord"></a>
<a href="https://x.com/PiebaldAI"><img src="https://img.shields.io/badge/Follow%20%40PiebaldAI-000000?style=flat&logo=x&logoColor=white" alt="X"></a>

<sub>[**Scroll down for Gemini CLI Desktop.**](#gemini-cli-desktop) :point_down:</sub>

</div>
</div>

<div align="left">
<a href="https://piebald.ai">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://piebald.ai/screenshot-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://piebald.ai/screenshot-light.png">
  <img alt="hero" width="800" src="https://piebald.ai/screenshot-light.png">
</picture>
</a>
</div>

# Gemini CLI Desktop

[![CI](https://github.com/Piebald-AI/gemini-cli-desktop/workflows/CI/badge.svg)](https://github.com/Piebald-AI/gemini-cli-desktop/actions)
[![Release & Publish](https://github.com/Piebald-AI/gemini-cli-desktop/workflows/Release%20%26%20Publish/badge.svg)](https://github.com/Piebald-AI/gemini-cli-desktop/actions)
[![GitHub all releases](https://img.shields.io/github/downloads/Piebald-AI/gemini-cli-desktop/total)](https://github.com/Piebald-AI/gemini-cli-desktop/releases)
[![GitHub release](https://img.shields.io/github/v/release/Piebald-AI/gemini-cli-desktop)](https://github.com/Piebald-AI/gemini-cli-desktop/releases)
[![Mentioned in Awesome Gemini CLI](https://awesome.re/mentioned-badge.svg)](https://github.com/Piebald-AI/awesome-gemini-cli)

[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/Piebald-AI/gemini-cli-desktop/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-FFC131)](https://tauri.app/)

A powerful **desktop** and **web** interface for **Gemini CLI** and **Qwen Code** with visual tool confirmation, real-time thought processes, code diff viewing, chat history management & search, a file tree browser, and file @-mentions. Built with Rust and React for performance and reliability. From the team behind [<img src="https://github.com/Piebald-AI/piebald/raw/main/assets/logo.svg" width="15"> **Piebald.**](https://piebald.ai/)

Use with **Gemini CLI:**

<img alt="Screenshot of Gemini CLI Desktop" src="./assets/screenshot.png" width="600">

Use with **Qwen Code:**

<img alt="Screenshot of Gemini CLI Desktop for Qwen Code" src="./assets/qwen-desktop.png" width="600">

## Quick Start

**Download pre-built releases:** [GitHub Releases](https://github.com/Piebald-AI/gemini-cli-desktop/releases)

**Available builds:**

- Windows (x64)
- macOS (Intel & Apple Silicon)
- Linux (x64 AppImage)

## Features

- **Multi-model support** - Gemini 2.5 Pro/Flash, Qwen Code, custom OpenAI providers
- **Visual tool confirmation** - Review and approve AI actions before execution
- **Real-time thought process** - Watch AI reasoning unfold
- **Code diff viewer** - Clear visualization of proposed changes
- **Chat history & search** - Automatic saving with full-text search
- **Cross-platform** - Desktop app and web interface
- **File @-mentions** - Reference files directly in conversations
- **MCP server integration** - Model Context Protocol support
- **Multi-language UI** - English, Chinese (Simplified & Traditional)

## Development & Building

### Prerequisites & Dependencies

**Install the `just` task runner:**

- **macOS/Linux:** `cargo install just` or `asdf plugin add just && asdf install just latest`
- **Ubuntu:** `snap install --edge --classic just`
- **Windows:** `winget install --id Casey.Just`

**Linux system dependencies (Ubuntu/Debian):**

```bash
sudo apt install libgdk-pixbuf-2.0-dev libpango1.0-dev \
  libjavascriptcoregtk-4.1-dev libatk1.0-dev libsoup-3.0-dev \
  libwebkit2gtk-4.1-dev librsvg2-dev
```

### Development Workflow

```bash
# Install dependencies and start desktop development with hot reload.
just deps dev

# Start web development with separate backend (port 1858) and frontend (port 1420) servers
just deps dev-web

# Build both desktop app installer (AppImage, DMG, MSI) and web server binaries for production.
just build-all

# Run the full test suite with nextest.
just test

# Run code linting and formatting checks (ESLint + Clippy).
just lint
```

**Note:** For the web version, development uses two separate ports: 1420 for the frontend and 1858 for the Rust + Rocket backend. In production, the backend server also hosts the static frontend files, so only port 1858 is used.

### Build from Source

**Prerequisites:**

- [Rust](https://rust-lang.org)
- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io)
- [just](https://just.systems)

**Build & Run:**

```bash
git clone https://github.com/Piebald-AI/gemini-cli-desktop
cd gemini-cli-desktop
just deps build-all

# Desktop app
./target/release/gemini-cli-desktop

# Web server (access at http://localhost:1858)
./target/release/gemini-cli-desktop-web
```

### Release Process

Releases are automatically built and published via GitHub Actions when version tags are pushed.

## Architecture

- **Backend:** Rust with Tauri for desktop, Rocket for web server
- **Frontend:** React + TypeScript with Tailwind CSS
- **Protocols:** Agent Communication Protocol (ACP), WebSocket events
- **Security:** Command filtering, tool confirmation workflows

## Roadmap

- Token/cost tracking
- Multi-modal support (images, audio)
- Extension system
- LLxprt integration

## Contributing

Contributions are welcome! Please see the [contributing guide](CONTRIBUTING.md) for more details.

## License

[MIT](./LICENSE)

Copyright © 2025 [Piebald LLC.](https://piebald.ai)
