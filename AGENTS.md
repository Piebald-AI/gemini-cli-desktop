# Repository Guidelines

## Project Structure & Module Organization
- `crates/backend` (Rust): core logic, CLI/session orchestration; colocated unit tests in `src/**`.
- `crates/server` (Rust): web server binary `gemini-desktop-web` serving the web UI.
- `crates/tauri-app` (Rust): desktop app (`gemini-desktop`) built with Tauri.
- `frontend` (TypeScript/React/Vite/Tailwind): UI source; built assets are embedded/served.
- `assets/`: images and static assets (screenshots, icons).
- Top-level helpers: `justfile` (tasks), `tarpaulin.toml` (coverage), `installer.iss` (Windows installer).

## Build, Test, and Development Commands
- Install deps: `just deps` (runs `pnpm install` in `frontend`).
- Desktop dev: `just dev` (Tauri dev from `frontend/`).
- Web dev: `just dev-web` (runs Rust server + frontend dev with `GEMINI_DESKTOP_WEB=true`).
- Build desktop: `just build` (Tauri bundle).
- Build web: `just build-web` (builds frontend + `crates/server` release).
- Lint/format: `just lint`, `just fmt`, CI‑strict: `just lint-ci`, `just check-fmt`.
- Tests: `just test` or `cargo nextest run` (e.g., `just test -p backend`).

## Coding Style & Naming Conventions
- Rust: stable toolchain, `cargo fmt` and `cargo clippy` (pedantic/nursery enabled in `tauri-app`). 4‑space indent, snake_case for modules/functions, PascalCase for types.
- TypeScript/React: ESLint + Prettier enforced.
  - Prettier: 2‑space indent, semicolons, width 80 (`frontend/.prettierrc`).
  - Components: PascalCase files in `src/components/**`; hooks in `src/hooks` use `useSomething`.
- Keep modules focused; prefer small, composable functions. Avoid unrelated changes in a single PR.

## Testing Guidelines
- Frameworks: Rust unit/integration tests (tokio, mockall, serial_test). Frontend currently relies on type/lint checks.
- Run: `just test` or `cargo nextest run -p backend`.
- Coverage: `cargo tarpaulin -p backend` (threshold set to 95% in `tarpaulin.toml`; HTML at `target/tarpaulin/html/`).
- Conventions: colocate tests with code using `#[cfg(test)] mod tests { ... }`; name async tests with `#[tokio::test]`.

## Commit & Pull Request Guidelines
- Commit style: Conventional Commits with scopes (e.g., `feat(ui): ...`, `fix(backend): ...`, `refactor(...)`). Version bumps use `vX.Y.Z`.
- Before PR: run `just lint-ci` and `just check-fmt`; ensure tests pass and coverage holds.
- PR requirements:
  - Clear description and rationale; link related issues (e.g., `#123`).
  - Screenshots/GIFs for UI changes (`frontend/`), and notes for behavior changes.
  - Small, focused changes preferred; include migration notes if config or APIs change.

### Commit/PR message newlines (shell quoting)
- Plain quotes do not turn `\n` into newlines. Use one of:
  - Multiple `-m` flags for subject/body: `git commit -m "feat(scope): subject" -m "Body line 1\nBody line 2"` (note: `\n` inside a single `-m` is literal; use separate `-m` for paragraphs).
  - ANSI-C quoting to embed real newlines: `git commit -m $'feat(scope): subject\n\n- bullet 1\n- bullet 2'`.
  - `printf` substitution: `git commit -m "$(printf 'feat(scope): subject\n\n- bullet 1\n- bullet 2\n')"`.
  - From a file or heredoc: `git commit -F COMMIT_MSG.txt` or `git commit -F- <<'EOF' ... EOF`.
- For GitHub CLI PR bodies prefer real newlines:
  - `gh pr create --title '...' --body-file PR_BODY.md` or `gh pr edit <num> --body-file - <<'EOF' ... EOF`.
Once done creating the commit, run git log to verify that the commit was correctly formatted & parsed.  After you've made the PR, verify it as well. Then, delete `PR_BODY.md` and any other artifacts.  Do not niclude any notes for reviewers sections.

## Security & Configuration Tips
- Do not commit secrets or API keys. Prefer local OS keychain/env vars.
- Web dev/build sets `GEMINI_DESKTOP_WEB=true` (handled by `just`).
- Cross‑platform: verify changes build on Linux/macOS/Windows when touching Tauri/runtime code.
