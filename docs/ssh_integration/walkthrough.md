# SSH Remote Development Integration

This document serves as a comprehensive walkthrough and post-mortem outlining the SSH Remote Access integration architecture within BranchCode. The implementation spans native pure-Rust backend capabilities synchronized seamlessly with React functional components on the frontend.

## 1. Backend Infrastructure
Instead of relying on OS-level C/CMake build environments (like `libssh2`), we utilized pure-Rust implementations.
* **Dependencies**: `russh` v0.46, `russh-keys`, and `russh-sftp` were utilized for entirely cross-platform compilation capabilities void of native bindings.
* **Core Systems**: `ssh_client.rs` was instated. The main implementation is encapsulated within the singleton `SshManager` which governs generic SSH lifecycle tasks including configuration persistence, thread coordination, secure password and key-pair (public-key bindings using `Arc<key::KeyPair>`) based authentication semantics, and explicit resource allocations.
* **Tauri Exposures**: The backend handles all states using global Tauri contexts (`SshState` mutexes) exposing 15 remote operations.
* **Caveats Resolved**: Alignment with `russh 0.46.0` trait constraints (handling string interpolations around `CryptoVec::from(data.to_vec())` to cast raw memory buffer shells respectively) was extensively managed.

## 2. Frontend Connectivity
* **The useSsh Hook**: Actively maintains remote server states synced against the backend. It tracks instances across: `servers[]`, `connections[]`, and manages polling mechanisms to ensure UI parity on SSH drop-outs.
* **Data Typings**: TypeScript bindings (`tauri.ts`) seamlessly define shapes for `SshConnectionInfo` and `SshServerConfig` facilitating robust frontend rendering of state components.
* **GitPanel Sub-Layer**: The left `GitPanel` dock was retrofitted to house dynamic SSH components. It manages the custom "Add/Edit" authentication payload modal, handling custom credential passing efficiently (tracking both passphrase strings and active paths). 

## 3. Mixed File Tree Architecture
To allow transparent integration navigating both remote and local files, a mixed directory tree was orchestrated:
* **Separation of Concerns**: We constructed `useRemoteFileTree.ts` which uniquely pipes `sftp_list_dir` payload buffers parsed natively through Tauri.
* **User Interface**: `App.tsx` conditionally isolates files logically. Local resources retain standard representations, while all remote assets are uniquely tracked under distinct headers stamped visually utilizing **Globe** icons, reinforcing navigation locality visually off-hand.

## 4. Left Sidebar Structural Revamp
To make way for extended project hierarchies:
* **The ProjectFolder Component**: We eliminated the flat mapping structure for conversations. The `ProjectFolder` allows hierarchical nesting under distinct umbrellas.
* Local workspace conversations naturally collapse under independent project folders, minimizing vertical bloat constraints.
* Remote assets scale seamlessly rendering distinct `ProjectFolder` entries marked heavily via teal accent server indicators, actively tracing heartbeat connectivity dots organically inline.

## 5. Terminal Multiplexing Architecture
Binding remote shells into our global ecosystem was natively implemented:
* **Custom Event Emisisons**: Within `App.tsx`, invoking terminal requests on any active backend node safely binds and triggers decoupled custom `spawn-ssh-terminal` window broadcasts natively tracked contextually through `TerminalPanel`.
* **State Execution**: `useTerminal.ts` was fundamentally decoupled. It now binds natively against `type: 'ssh'` conditional parameters spawning `ssh_spawn_shell` backend abstractions.
* **Socket Emulation**: Rather than relying strictly over abstract PTY shells, PTY capabilities are artificially requested via native SFTP `xterm-256color` multiplex layers rendering completely via real-time WebSocket-like `ssh:data` and `ssh:exit` Tauri event emitters.
* **Distinguishing GUI Traits**: Remote tabs are explicitly prefixed uniformly with **`SSH: [Server Name]`** keeping workflows visually discrete from native local environments.

## Future Recommendations
* **Reverse Port Forwarding**: Currently, OpenCode servers are localized. Port Forwarding logic bridging localized proxies towards standard OpenCode HTTP nodes remotely can seamlessly bridge remote agents logically.
* **Keep-Alives**: Consider instituting KeepAlive routines natively via custom Tauri background worker intervals maintaining arbitrary TTL connections passively preventing premature drop-outs natively alongside typical background SSH behavior.
