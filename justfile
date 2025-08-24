export TAURI_APP_PATH := "../crates/tauri-app"  # Relative to `frontend`.
export TAURI_FRONTEND_PATH := "frontend"

set windows-shell := ["powershell"]

default:
  just --list

build-all: build build-web
ci: lint-ci check-fmt

deps:
    cd frontend ; pnpm install

lint:
    cd frontend ; pnpm lint
    cargo clippy

lint-ci:
    cd frontend ; pnpm lint:ci
    cargo clippy -- -D warnings

fmt:
    cd frontend ; pnpm format
    cargo fmt

check-fmt:
    cd frontend ; pnpm format:check
    cargo fmt --check

test *args:
    cargo nextest run {{args}}

### DESKTOP

[group('desktop')]
[working-directory("frontend")]
dev:
    pnpm tauri dev

[group('desktop')]
[working-directory("frontend")]
build *args:
    pnpm tauri build {{args}}

### WEB

[group('web')]
[parallel]
dev-web: server-dev frontend-dev-web

[group('web')]
[working-directory("crates/server")]
server-dev:
    cargo run

[group('web')]
[working-directory("frontend")]
frontend-dev-web $GEMINI_DESKTOP_WEB="true":
    pnpm dev

[group('web')]
build-web $GEMINI_DESKTOP_WEB="true":
    cd frontend ; pnpm build
    cd crates/server ; cargo build --release
