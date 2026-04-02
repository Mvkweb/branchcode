<div align="center">
<img src="src-tauri/icons/128x128.png" alt="Logo" width="128">
<br>
Branchcode
</div>

<p align="center">
AI-native development environment built with Tauri.
<br />
Rust backend. Web frontend. Native performance.
<br />
<a href="#about">About</a>
·
<a href="#download">Download</a>
·
<a href="#roadmap-and-status">Roadmap</a>
·
<a href="#developing">Developing</a>
</p>

## About

Branchcode is a desktop application for AI-assisted development. It combines a
Rust backend with a React frontend, packaged as a lightweight native binary via
[Tauri v2](https://v2.tauri.app).

The goal is a fast, native, feature-rich development environment where AI and
coding feel natural together. Not a wrapper around a browser — a real desktop app.

## Download

Download from [Releases](https://github.com/branchcode/branchcode/releases).

## Roadmap and Status

Branchcode is in early development and actively being built.

The high-level plan for the project, in order:

|  #  | Step                                            | Status |
| :-: | ----------------------------------------------- | :----: |
|  1  | Tauri v2 project scaffold                       |   ✅   |
|  2  | React frontend setup                            |   ✅   |
|  3  | Rust backend command structure                   |   ✅   |
|  4  | Core UI layout and components                   |   🔨   |
|  5  | Frontend-backend IPC integration                |   🔨   |
|  6  | Terminal integration                            |   ❌   |
|  7  | OpenCode AI agent integration                   |   ❌   |
|  8  | Custom OpenAPI endpoints for AI models          |   ❌   |
|  9  | File system and project management              |   ❌   |
| 10  | Editor integration                              |   ❌   |

Additional details for each step:

#### Tauri v2 Project Scaffold

The project is bootstrapped with Tauri v2, using a Rust backend and a React
frontend. The project structure is intentionally simple and idiomatic: the
frontend lives in `src/`, the backend in `src-tauri/`.

#### React Frontend Setup

The frontend uses React 19 with Tailwind CSS v4, Vite for bundling, and
TypeScript with strict mode enabled. Animations are handled by the `motion`
library. The UI follows a dark, native-feeling aesthetic.

#### Rust Backend Command Structure

The Rust backend exposes commands to the frontend via Tauri's `invoke` system.
Commands live in `src-tauri/src/commands.rs` and are registered in `lib.rs`.
This pattern keeps the backend modular and easy to extend.

#### Core UI Layout and Components

The main application window uses a sidebar + main content layout inspired by
modern development tools. The window uses custom decorations (no native title
bar) for a consistent look and feel.

#### Frontend-Backend IPC Integration

Commands are called from the frontend using `@tauri-apps/api/core`:

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('greet', { name: 'World' });
```

```rust
#[tauri::command]
fn greet(name: &str) -> GreetResponse {
    GreetResponse {
        message: format!("Hello, {}!", name),
    }
}
```

#### Terminal Integration

A built-in terminal emulator for running shell commands without leaving the app.
Renders a PTY-based terminal in the frontend, powered by the Rust backend for
native performance. Supports multiple tabs, split panes, and persists sessions
across app restarts.

#### OpenCode AI Agent Integration

Integration with [OpenCode](https://opencode.ai), the open source AI coding
agent. OpenCode is provider-agnostic (works with Claude, OpenAI, Google, or
local models), has built-in LSP support, and supports two agent modes:

- **build** — full-access agent for development work
- **plan** — read-only agent for analysis and code exploration

Branchcode will embed OpenCode as a first-class feature, giving users AI
assistance directly in the app without switching to a terminal.

#### Custom OpenAPI Endpoints for AI Models

A configurable endpoint system for connecting to any AI provider. Users can
add custom OpenAPI-compatible endpoints for models like Claude, GPT, Gemini,
or self-hosted models. This keeps Branchcode provider-agnostic — you bring
your own API keys and endpoints.

#### File System and Project Management

Native file system access via Tauri commands for opening, creating, and managing
projects on disk. Supports tree view navigation, file watching, and project
templates.

#### Editor Integration

Integration with code editors for seamless AI-assisted editing. Support for
LSP-based completions, inline suggestions, and diff-based edits.

## Developing

### Prerequisites

- [Bun](https://bun.sh)
- [Rust](https://www.rust-lang.org/tools/install) (stable)

### Setup

```sh
bun install
bun run tauri dev
```

### Project Structure

```
branchcode/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── lib/                # Tauri API wrappers
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/                # Commands and app setup
│   ├── Cargo.toml
│   └── tauri.conf.json
├── scripts/                # Install scripts
├── .github/workflows/      # CI/CD
└── package.json
```

## License

MIT
