# Changelog

All notable changes to Gemini CLI Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.15](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.15) - 2026-01-17

### Added

- Add Gemini 3 Pro (#171) by @mike1858
- Add Gemini 3 Flash (#181) by @BreadCatV2
- Add JSON syntax highlighting to Raw Message JSON model (#183) by @mike1858
- Add Russian translations (#177) by @vanja-san

### Fixed

- Fix MCP servers page scrolling overflow (#173) by @mike1858
- Fix #175 (#182) by @mike1858

## [0.3.14](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.14) - 2025-11-23

### Changed

- Codesign the Windows executable (#166) by @signadou
- Fix release notes duplication (#167) by @signadou

## [0.3.13](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.13) - 2025-11-23

### Fixed

- Wrap long markdown/html so sidebar layout remains stable (#162) by @bl-ue
- Fix app display name translation key (#163) by @signadou

### Changed

- Add codesigning for macOS and Windows releases (#164) by @signadou

## [0.3.12](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.12) - 2025-11-04

### Changed

- Polish user experience (#159) by @bl-ue
- Update the macOS version in the CI (#161) by @signadou

## [0.3.11](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.11) - 2025-10-30

### Fixed

- Fix the Windows release workflow (#157) by @signadou

## [0.3.10](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.10) - 2025-10-22

### Changed

- Allow HTTP base URLs with warning instead of blocking (#154) by @bl-ue
- Delegate validation to underlying CLIs (#155) by @bl-ue

## [0.3.9](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.9) - 2025-10-22

### Added

- Add comprehensive support for LLxprt Code (#150) by @bl-ue

### Fixed

- Add YOLO mode for Qwen Code (in addition to Gemini CLI) (#151) by @bl-ue

## [0.3.8](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.8) - 2025-09-30

### Changed

- Update documentation and improve tests (#141) by @bl-ue
- Enhance the readme (#143) by @bl-ue
- Highlight command tools & simplify default renderer (#144) by @bl-ue
- Rebrand (#146) by @bl-ue

### Fixed

- Fix CI (#147) by @signadou

## [0.3.7](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.7) - 2025-09-13

### Added

- Enhance UI with multi-language settings and UI/build fixes (#134) by @alanpeng

### Fixed

- Prevent duplicate event listener setup with pending state tracking (#138) by @bl-ue
- Prevent duplicate tool calls and remove fixed height constraint (#139) by @bl-ue

## [0.3.6](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.6) - 2025-09-09

### Added

- Add search dialog and revamp results UI (#130) by @bl-ue
- Prevent missed stream output in web mode (#132) by @bl-ue
- Add AGENTS.md for Codex CLI (#129) by @bl-ue

### Fixed

- Show backend progress messages; fix listener lifecycle; seed initial progress (#131) by @bl-ue

## [0.3.5](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.5) - 2025-09-09

### Added

- Add message timing and witty loading phrases during message generation (#123) by @bl-ue

### Changed

- Move settings from sidebar to dedicated dialog (#126) by @bl-ue

### Fixed

- Restore right-docked directory panel (#127) by @bl-ue

## [0.3.4](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.4) - 2025-09-07

### Added

- Group historical thinking steps (#116) by @alanpeng
- Add interactive session initialization progress tracking (#120) by @bl-ue

### Changed

- Optimize the interactive experience of returning to the home page in the session window (#117) by @alanpeng

### Fixed

- Resolve CLI hang on Windows by correcting line endings (#119) by @alanpeng

## [0.3.3](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.3) - 2025-09-04

### Changed

- Simplify MCP permission interface and enhance option handling (#114) by @bl-ue

## [0.3.2](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.2) - 2025-09-03

### Changed

- Unify file viewer controls and enhance image/PDF handling (#112) by @bl-ue

### Fixed

- Improve image display with proper sizing and centering (#111) by @bl-ue
- Remove redundant file type handling for non-text files (#110) by @bl-ue

## [0.3.1](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.1) - 2025-09-03

### Added

- Add support for PDF, Excel, and image file viewing (#107) by @bl-ue

### Fixed

- Fixed the historical session loading problem and optimized the message box input prompt (#106) by @alanpeng

## [0.3.0](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.3.0) - 2025-09-02

### Added

- Persistently save chat session information (#98) by @alanpeng

### Fixed

- Add conditional compilation for Windows-specific flags (#102) by @bl-ue
- Remove timeout from JSON-RPC response reading (#101) by @bl-ue

## [0.2.1](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.2.1) - 2025-09-01

### Added

- Add file content viewer with syntax highlighting (#88) by @bl-ue
- Add file writing capability to directory tree (#93) by @bl-ue
- Add force text option for binary file viewing (#94) by @bl-ue

### Changed

- Improve command tool call display with compact approval UI (#87) by @bl-ue
- Streamline console output formatting (#85) by @bl-ue
- Streamline file content viewer interface (#89) by @bl-ue

### Fixed

- Preserve scroll position in code blocks during content streaming (#95) by @bl-ue

## [0.2.0](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.2.0) - 2025-08-28

### Added

- Add directory panel with toggle button (#42) by @bl-ue
- Add YOLO mode support across backend, server, and UI (#54) by @bl-ue
- Add git repository status endpoint and UI component (#45) by @bl-ue
- Add placeholder for new chats (#66) by @bl-ue
- Add support for MCP server calls (#75) by @bl-ue
- Implement menu shortcuts for the custom titlebar (#61) by @signadou
- Implement Shift+Enter (#73) by @signadou
- Implement error propagation (#33) by @mike1858
- Make @-mentioning recursive and more performant (#58) by @signadou
- Make the directory tree insert @-mentions (#60) by @signadou
- Enhance read many files handling and detection (#63) by @bl-ue

### Changed

- Hide console windows on Windows (#39) by @signadou
- Make the menus work on Linux and macOS (#41) by @signadou
- Improve and refactor API client drastically (#40) by @mike1858
- Make the chat area wider, refactor Markdown rendering, and improve the thinking UI (#46) by @signadou
- Enable the custom titlebar (without the window controls) in Web (#74) by @signadou
- Rewrite the diff viewer (#77) by @signadou
- Use full code blocks during streaming and improve their performance (#78) by @signadou
- Make @-mentioning use a total directory limit of 200 instead of a depth limit of 2 directories (#72) by @signadou
- Increase the delays and timeouts for sending and receiving JSON-RPC messages (#68) by @signadou

### Fixed

- Adjust backend display name for qwen backend (#43) by @bl-ue
- Prevent title bar from rendering on web (#56) by @bl-ue
- Fix the SPA handling in the server (#59) by @signadou
- Fix console windows appearing for Git commands (#69) by @signadou
- Prevent dual CLI execution when switching backends (#71) by @bl-ue
- Fix an issue where we registered duplicate event listeners when switching conversations (#76) by @signadou
- Fix unnecessary API calls for @-mentioning (#79) by @bl-ue
- Fix some layout issues and fix a translation (#65) by @signadou

## [0.1.0](https://github.com/Piebald-AI/gemini-cli-desktop/releases/tag/v0.1.0) - 2025-08-22

### Added

- Initial release
- Setup automatic building in CI (#32) by @signadou
- Improve README for new users (#30) by @Manamama-Gemini-Cloud-AI-01
