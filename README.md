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
<a href="#developing">Developing</a> ·
<a href="#contributing">Contributing</a>
</p>

## About

Branchcode is a desktop application for AI-assisted development. It combines a Rust
backend with a React frontend, packaged as a lightweight native binary via [Tauri v2](https://v2.tauri.app).

> **⚠️ Early Development**: This project is not production ready. It is under active
> development and requires significant testing. Currently tested primarily on Windows;
> Linux and macOS support has not been verified.

## Download

Download from [Releases](https://github.com/branchcode/branchcode/releases).

## Roadmap

| #  | Step                               | Status |
| :--| ---------------------------------- | :----: |
| 1  | Tauri v2 + React + Rust scaffold   |   ✅   |
| 2  | OpenCode server integration        |   ✅   |
| 3  | Git integration                    |   🔨   |
| 4  | Terminal (PTY + ghostty-web)      |   ✅   |
| 5  | Custom model endpoints             |   ❌   |
| 6  | File tree & project management     |   ❌   |
| 7  | Settings & preferences             |   ❌   |
| 8  | SSH tunneling (remote server coding)|   🔨   |
| 9  | Cross-platform testing (Linux/macOS)|   ⚠️   |

## Developing

### Prerequisites

- [Bun](https://bun.sh)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [OpenCode](https://opencode.ai) (must be installed and in PATH)

### Setup

```sh
bun install
bun run tauri dev
```

## Contributing

Contributions are welcome, but please keep the following in mind:

- This is pre-beta software — expect bugs, incomplete features, and breaking changes
- Large or drastic changes are not likely to be accepted until a stable beta release
- When in doubt, open an issue first to discuss proposed changes
- Test thoroughly on Windows before submitting; cross-platform compatibility needs work

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

Need to report a bug or request a feature? Use our [issue templates](./.github/ISSUE_TEMPLATE).

### Project Structure

```
branchcode/
├── src/
│   ├── components/      # UI components
│   ├── hooks/          # React hooks
│   ├── lib/            # Tauri API wrappers
│   ├── index.css
│   └── main.tsx
├── src-tauri/src/      # Rust backend
│   ├── git.rs          # Git operations
│   ├── opencode_client.rs  # OpenCode API client
│   ├── pty.rs          # Terminal PTY
│   └── server.rs       # OpenCode server
├── docs/
├── scripts/
├── .github/
└── package.json
```

## Acknowledgments

> Independent project, not affiliated with the OpenCode team.

- **OpenCode** — For the excellent API and extensible architecture
- **Ghostty-web** — Terminal emulator compiled to WASM
- **Tauri** — Desktop application framework

## License

MIT — See [LICENSE](./LICENSE)