<div align="center">
<img src="src-tauri/icons/128x128.png" alt="Logo" width="128">
<br>
Branchcode
</div>

<p align="center">
AI-native development environment built with Tauri.
<br />
<a href="#about">About</a> ·
<a href="#roadmap">Roadmap</a> ·
<a href="#developing">Developing</a>
</p>

## About

Branchcode is a desktop application for AI-assisted development. It combines a Rust
backend with a React frontend, packaged as a lightweight native binary via [Tauri v2](https://v2.tauri.app).

The frontend uses React 19 with Tailwind CSS v4 and TypeScript. The backend includes a
custom HTTP client for the OpenCode server API with SSE event streaming, and a native PTY
manager for integrated terminal support using ghostty-web.

### Key Features

- **OpenCode Integration**: Rust reworked SDK for OpenCode's HTTP API with SSE streaming
- **Native Terminal**: PTY-based terminal using [ghostty-web](https://github.com/ghostty-org/ghostty-web), a WASM-compiled terminal emulator.
- **Git Panel**: View status, diffs, branches, and commit changes
- **Chat Interface**: Streamed AI responses with tool call visualization

> **⚠️ Early Development**: This project is not production ready. It is under active
> development and requires significant testing. Currently tested primarily on Windows;
> Linux and macOS support has not been verified.

## Download

Download from [Releases](https://github.com/branchcode/branchcode/releases).

## Roadmap

| #  | Step                              | Status |
| :--| --------------------------------- | :----: |
| 1  | Tauri v2 + React + Rust scaffold |   ✅   |
| 2  | OpenCode server integration       |   ✅   |
| 3  | Git integration                  |   🔨   |
| 4  | Terminal (PTY + ghostty-web)     |   ✅   |
| 5  | AI agent integration              |   ❌   |
| 6  | File system management            |   ❌   |

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
├── src/
│   ├── components/
│   │   ├── App.tsx
│   │   ├── ChatMessages.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── DiffViewer.tsx
│   │   ├── FileDiff.tsx
│   │   ├── GitPanel.tsx
│   │   ├── Settings.tsx
│   │   ├── TerminalPanel.tsx
│   │   └── TerminalPanel.css
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useFileTree.ts
│   │   ├── useGit.ts
│   │   ├── useSessions.ts
│   │   ├── useTerminal.ts
│   │   └── useVirtualScroll.ts
│   ├── lib/
│   │   ├── messageCache.ts
│   │   └── tauri.ts
│   ├── index.css
│   └── main.tsx
├── src-tauri/src/
│   ├── git.rs              # Git operations
│   ├── lib.rs              # Main app & commands
│   ├── main.rs             # Entry point
│   ├── opencode_client.rs  # OpenCode API client
│   ├── pty.rs              # Terminal PTY
│   └── server.rs           # OpenCode server
├── docs/                   # Documentation
├── scripts/                # Build scripts
├── .github/                # CI/CD
├── package.json
└── README.md
```

## Contributing

Contributions are welcome, but please keep the following in mind:

- This is pre-beta software — expect bugs, incomplete features, and breaking changes
- Large or drastic changes are not likely to be accepted until a stable beta release
- When in doubt, open an issue first to discuss proposed changes
- Test thoroughly on Windows before submitting; cross-platform compatibility needs work

## License

MIT