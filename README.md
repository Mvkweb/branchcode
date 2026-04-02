<div align="center">
<img src="src-tauri/icons/128x128.png" alt="Logo" width="128">
<br>
Branchcode
</div>

<p align="center">
AI-native development environment built with Tauri.
<br />
<a href="#about">About</a>
·
<a href="#download">Download</a>
·
<a href="#developing">Developing</a>
</p>

## About

Branchcode is a desktop application for AI-assisted development. It combines a
Rust backend with a React frontend, packaged as a lightweight native binary via
[Tauri v2](https://v2.tauri.app).

Built with [bun](https://bun.sh) for the frontend and [opencode](https://github.com/anomalyco/opencode) for AI assistance during development.

## Download

Download from [Releases](https://github.com/branchcode/branchcode/releases).

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
├── src/                  # React frontend
│   ├── components/       # UI components
│   ├── lib/              # Tauri API wrappers
│   └── main.tsx          # Entry point
├── src-tauri/            # Rust backend
│   ├── src/              # Commands and app setup
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## License

MIT