# Changelog

All notable changes to Gemini CLI Desktop will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.14] - 2025-11-23

### Changed

- Codesign the Windows executable ([#166](https://github.com/Piebald-AI/gemini-cli-desktop/pull/166))
- Fix release notes duplication ([#167](https://github.com/Piebald-AI/gemini-cli-desktop/pull/167))

## [0.3.13] - 2025-11-23

### Fixed

- Wrap long markdown/html so sidebar layout remains stable ([#162](https://github.com/Piebald-AI/gemini-cli-desktop/pull/162))
- Fix app display name translation key ([#163](https://github.com/Piebald-AI/gemini-cli-desktop/pull/163))

### Changed

- Add codesigning for macOS and Windows releases ([#164](https://github.com/Piebald-AI/gemini-cli-desktop/pull/164))

## [0.3.12] - 2025-11-04

### Changed

- Polish user experience ([#159](https://github.com/Piebald-AI/gemini-cli-desktop/pull/159))
- Update the macOS version in the CI ([#161](https://github.com/Piebald-AI/gemini-cli-desktop/pull/161))

## [0.3.11] - 2025-10-30

### Fixed

- Fix the Windows release workflow ([#157](https://github.com/Piebald-AI/gemini-cli-desktop/pull/157))

## [0.3.10] - 2025-10-22

### Changed

- Allow HTTP base URLs with warning instead of blocking ([#154](https://github.com/Piebald-AI/gemini-cli-desktop/pull/154))
- Delegate validation to underlying CLIs ([#155](https://github.com/Piebald-AI/gemini-cli-desktop/pull/155))

## [0.3.9] - 2025-10-22

### Added

- Add comprehensive support for LLxprt Code ([#150](https://github.com/Piebald-AI/gemini-cli-desktop/pull/150))

### Fixed

- Add YOLO mode for Qwen Code (in addition to Gemini CLI) ([#151](https://github.com/Piebald-AI/gemini-cli-desktop/pull/151))

## [0.3.8] - 2025-09-30

### Changed

- Update documentation and improve tests ([#141](https://github.com/Piebald-AI/gemini-cli-desktop/pull/141))
- Enhance the readme ([#143](https://github.com/Piebald-AI/gemini-cli-desktop/pull/143))
- Highlight command tools & simplify default renderer ([#144](https://github.com/Piebald-AI/gemini-cli-desktop/pull/144))
- Rebrand ([#146](https://github.com/Piebald-AI/gemini-cli-desktop/pull/146))

### Fixed

- Fix CI ([#147](https://github.com/Piebald-AI/gemini-cli-desktop/pull/147))

## [0.3.7] - 2025-09-13

### Added

- Enhance UI with multi-language settings and UI/build fixes ([#134](https://github.com/Piebald-AI/gemini-desktop/pull/134))

### Fixed

- Prevent duplicate event listener setup with pending state tracking ([#138](https://github.com/Piebald-AI/gemini-desktop/pull/138))
- Prevent duplicate tool calls and remove fixed height constraint ([#139](https://github.com/Piebald-AI/gemini-desktop/pull/139))

## [0.3.6] - 2025-09-09

### Added

- Add search dialog and revamp results UI ([#130](https://github.com/Piebald-AI/gemini-desktop/pull/130))
- Prevent missed stream output in web mode ([#132](https://github.com/Piebald-AI/gemini-desktop/pull/132))
- Add AGENTS.md for Codex CLI ([#129](https://github.com/Piebald-AI/gemini-desktop/pull/129))

### Fixed

- Show backend progress messages; fix listener lifecycle; seed initial progress ([#131](https://github.com/Piebald-AI/gemini-desktop/pull/131))

## [0.3.5] - 2025-09-09

### Added

- Add message timing and witty loading phrases during message generation ([#123](https://github.com/Piebald-AI/gemini-desktop/pull/123))

### Changed

- Move settings from sidebar to dedicated dialog ([#126](https://github.com/Piebald-AI/gemini-desktop/pull/126))

### Fixed

- Restore right-docked directory panel ([#127](https://github.com/Piebald-AI/gemini-desktop/pull/127))

## [0.3.4] - 2025-09-07

### Added

- Group historical thinking steps ([#116](https://github.com/Piebald-AI/gemini-desktop/pull/116))
- Add interactive session initialization progress tracking ([#120](https://github.com/Piebald-AI/gemini-desktop/pull/120))

### Changed

- Optimize the interactive experience of returning to the home page in the session window ([#117](https://github.com/Piebald-AI/gemini-desktop/pull/117))

### Fixed

- Resolve CLI hang on Windows by correcting line endings ([#119](https://github.com/Piebald-AI/gemini-desktop/pull/119))

## [0.3.3] - 2025-09-04

### Changed

- Simplify MCP permission interface and enhance option handling ([#114](https://github.com/Piebald-AI/gemini-desktop/pull/114))

## [0.3.2] - 2025-09-03

### Changed

- Unify file viewer controls and enhance image/PDF handling ([#112](https://github.com/Piebald-AI/gemini-desktop/pull/112))

### Fixed

- Improve image display with proper sizing and centering ([#111](https://github.com/Piebald-AI/gemini-desktop/pull/111))
- Remove redundant file type handling for non-text files ([#110](https://github.com/Piebald-AI/gemini-desktop/pull/110))

## [0.3.1] - 2025-09-03

### Added

- Add support for PDF, Excel, and image file viewing ([#107](https://github.com/Piebald-AI/gemini-desktop/pull/107))

### Fixed

- Fixed the historical session loading problem and optimized the message box input prompt ([#106](https://github.com/Piebald-AI/gemini-desktop/pull/106))

## [0.3.0] - 2025-09-02

### Added

- Persistently save chat session information ([#98](https://github.com/Piebald-AI/gemini-desktop/pull/98))

### Fixed

- Add conditional compilation for Windows-specific flags ([#102](https://github.com/Piebald-AI/gemini-desktop/pull/102))
- Remove timeout from JSON-RPC response reading ([#101](https://github.com/Piebald-AI/gemini-desktop/pull/101))

## [0.2.1] - 2025-09-01

### Added

- Add file content viewer with syntax highlighting ([#88](https://github.com/Piebald-AI/gemini-desktop/pull/88))
- Add file writing capability to directory tree ([#93](https://github.com/Piebald-AI/gemini-desktop/pull/93))
- Add force text option for binary file viewing ([#94](https://github.com/Piebald-AI/gemini-desktop/pull/94))

### Changed

- Improve command tool call display with compact approval UI ([#87](https://github.com/Piebald-AI/gemini-desktop/pull/87))
- Streamline console output formatting ([#85](https://github.com/Piebald-AI/gemini-desktop/pull/85))
- Streamline file content viewer interface ([#89](https://github.com/Piebald-AI/gemini-desktop/pull/89))

### Fixed

- Preserve scroll position in code blocks during content streaming ([#95](https://github.com/Piebald-AI/gemini-desktop/pull/95))

## [0.2.0] - 2025-08-28

### Added

- Add directory panel with toggle button ([#42](https://github.com/Piebald-AI/gemini-desktop/pull/42))
- Add YOLO mode support across backend, server, and UI ([#54](https://github.com/Piebald-AI/gemini-desktop/pull/54))
- Add git repository status endpoint and UI component ([#45](https://github.com/Piebald-AI/gemini-desktop/pull/45))
- Add placeholder for new chats ([#66](https://github.com/Piebald-AI/gemini-desktop/pull/66))
- Add support for MCP server calls ([#75](https://github.com/Piebald-AI/gemini-desktop/pull/75))
- Implement menu shortcuts for the custom titlebar ([#61](https://github.com/Piebald-AI/gemini-desktop/pull/61))
- Implement Shift+Enter ([#73](https://github.com/Piebald-AI/gemini-desktop/pull/73))
- Implement error propagation ([#33](https://github.com/Piebald-AI/gemini-desktop/pull/33))
- Make @-mentioning recursive and more performant ([#58](https://github.com/Piebald-AI/gemini-desktop/pull/58))
- Make the directory tree insert @-mentions ([#60](https://github.com/Piebald-AI/gemini-desktop/pull/60))
- Enhance read many files handling and detection ([#63](https://github.com/Piebald-AI/gemini-desktop/pull/63))

### Changed

- Hide console windows on Windows ([#39](https://github.com/Piebald-AI/gemini-desktop/pull/39))
- Make the menus work on Linux and macOS ([#41](https://github.com/Piebald-AI/gemini-desktop/pull/41))
- Improve and refactor API client drastically ([#40](https://github.com/Piebald-AI/gemini-desktop/pull/40))
- Make the chat area wider, refactor Markdown rendering, and improve the thinking UI ([#46](https://github.com/Piebald-AI/gemini-desktop/pull/46))
- Enable the custom titlebar (without the window controls) in Web ([#74](https://github.com/Piebald-AI/gemini-desktop/pull/74))
- Rewrite the diff viewer ([#77](https://github.com/Piebald-AI/gemini-desktop/pull/77))
- Use full code blocks during streaming and improve their performance ([#78](https://github.com/Piebald-AI/gemini-desktop/pull/78))
- Make @-mentioning use a total directory limit of 200 instead of a depth limit of 2 directories ([#72](https://github.com/Piebald-AI/gemini-desktop/pull/72))
- Increase the delays and timeouts for sending and receiving JSON-RPC messages ([#68](https://github.com/Piebald-AI/gemini-desktop/pull/68))

### Fixed

- Adjust backend display name for qwen backend ([#43](https://github.com/Piebald-AI/gemini-desktop/pull/43))
- Prevent title bar from rendering on web ([#56](https://github.com/Piebald-AI/gemini-desktop/pull/56))
- Fix the SPA handling in the server ([#59](https://github.com/Piebald-AI/gemini-desktop/pull/59))
- Fix console windows appearing for Git commands ([#69](https://github.com/Piebald-AI/gemini-desktop/pull/69))
- Prevent dual CLI execution when switching backends ([#71](https://github.com/Piebald-AI/gemini-desktop/pull/71))
- Fix an issue where we registered duplicate event listeners when switching conversations ([#76](https://github.com/Piebald-AI/gemini-desktop/pull/76))
- Fix unnecessary API calls for @-mentioning ([#79](https://github.com/Piebald-AI/gemini-desktop/pull/79))
- Fix some layout issues and fix a translation ([#65](https://github.com/Piebald-AI/gemini-desktop/pull/65))

## [0.1.0] - 2025-08-22

### Added

- Initial release
- Setup automatic building in CI ([#32](https://github.com/Piebald-AI/gemini-desktop/pull/32))
- Improve README for new users ([#30](https://github.com/Piebald-AI/gemini-desktop/pull/30))
