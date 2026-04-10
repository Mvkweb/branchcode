# Terminal Integration Plan for Branchcode

## ⚠️ CRITICAL BUG FIX DOCUMENTATION - READ BEFORE MODIFYING

### The Visual Bug (Text Overwrites/Cursor Jumps)

During implementation, a severe visual bug was discovered where:
- Text would overwrite itself while typing
- Cursor would jump around unexpectedly
- Input line would redraw messily
- PowerShell prompt would render incorrectly

**ROOT CAUSES (DO NOT REPLICATE):**

1. **Shared Container for Multiple Terminals**
   - Problem: All terminal instances were rendered into the SAME container div
   - Result: Multiple ghostty-web canvases drew on top of each other
   - Fix: Each terminal creates its own `document.createElement('div')` container

2. **Missing `hidden` Class for Inactive Tabs**
   - Problem: All terminal views were always visible (`block`), not hidden
   - Result: Inactive terminals still rendered, causing visual overlap
   - Fix: Use `${active ? 'block' : 'hidden'}` class for terminal visibility

3. **Temp ID Causing Byte Drop**
   - Problem: Used a temporary ID for the terminal until backend returned the real ID
   - Result: Initial PowerShell output (prompt, VT sequences) was dropped or misrouted
   - Fix: Spawn backend FIRST, then create frontend terminal with real ID (no temp ID)

4. **Container Movement During Measurement**
   - Problem: Container was moved to `document.body` and positioned offscreen for measurement
   - Result: This caused cols/rows desync between PTY and frontend, breaking line wrapping
   - Fix: Keep container in place, use FitAddon without DOM teleporting

5. **Missing `WT_SESSION` Environment Variable**
   - Problem: PowerShell didn't know it was running in a real terminal
   - Result: PSReadLine (PowerShell's line editing) behaved incorrectly
   - Fix: Set `WT_SESSION=1` environment variable when spawning shell

6. **Pixel Dimension Mismatch**
   - Problem: PTY resize used wrong pixel calculations (or 0,0)
   - Result: Backend thought terminal was different size than frontend
   - Fix: Use `pixel_width: cols * 9, pixel_height: rows * 17` (9px wide, 17px tall per cell)

### How to Avoid This Bug

When modifying terminal code, follow these rules:

```typescript
// ✅ CORRECT: Each terminal creates its own container
const createTerminal = useCallback(async () => {
  const container = document.createElement('div'); // NEW container each time
  container.style.width = '100%';
  container.style.height = '100%';
  // ... create terminal
}, []);

// ❌ WRONG: Reuse same container or pass external container
const createTerminal = useCallback(async (sharedContainer) => {
  // This causes multiple terminals to fight for DOM space
}, []);
```

```tsx
// ✅ CORRECT: Hide inactive terminals
return <div className={`absolute inset-0 ${active ? 'block' : 'hidden'}`} />;

// ❌ WRONG: Always show all terminals
return <div className="absolute inset-0" />;
```

```typescript
// ✅ CORRECT: Spawn backend first, then create frontend
const id = await invoke<string>('spawn_terminal', { cols, rows });
const term = new Terminal({...});
term.open(container);
// Now write to 'id', not a temp ID

// ❌ WRONG: Create frontend with temp ID, then swap after spawn
const tempId = 'temp-123';
terminalsRef.current.set(tempId, {...});
invoke('spawn_terminal', ...).then(realId => {
  // Race condition: output before this runs goes to tempId which doesn't exist!
});
```

```rust
// ✅ CORRECT: Set WT_SESSION for PowerShell
let mut cmd = CommandBuilder::new(shell());
cmd.env("WT_SESSION", "1");  // Tells pwsh it's a real terminal

// ❌ WRONG: Missing WT_SESSION
let mut cmd = CommandBuilder::new(shell());
// PowerShell won't enable ANSI properly
```

```rust
// ✅ CORRECT: Use proper pixel dimensions
PtySize {
    rows,
    cols,
    pixel_width: cols * 9,
    pixel_height: rows * 17,
}

// ❌ WRONG: Zero pixels or mismatched calculations
PtySize {
    rows,
    cols,
    pixel_width: 0,  // Let OS decide (sometimes wrong)
    pixel_height: 0,
}
```

### Additional Configuration Notes

1. **convertEol: false**
   - PowerShell sends `\r` (carriage return) for newlines, not `\n`
   - Setting `convertEol: false` prevents ghostty-web from incorrectly interpreting `\r` as newline
   - This keeps the cursor in the correct position for PowerShell's line editing

2. **windowsMode option (if available)**
   - Some terminal emulators have a `windowsMode` option specifically for Windows console behavior
   - If ghostty-web types expose this, enable it for better PowerShell compatibility
   - Currently not in ghostty-web types, so use `convertEol: false` as workaround

3. **Shell Detection Priority**
   - On Windows, prefer PowerShell 7 (pwsh.exe) → PowerShell 5 (powershell.exe) → cmd.exe
   - PowerShell has better ANSI support than cmd.exe
   - Setting `TERM=xterm-256color` helps the shell know terminal capabilities

4. **Streaming TextDecoder**
   - When receiving PTY output, use `TextDecoder` with `stream: true`
   - This handles UTF-8 sequences that may be split across multiple packets
   - Create one decoder per terminal and reuse it

5. **Push Model (No Polling)**
   - Use Tauri events (`pty:data`) to push output from backend to frontend
   - This uses ~0% CPU when idle (vs polling which uses constant CPU)
   - Backend spawns a reader thread that emits events on data availability

6. **Watchdog for External Kill Detection**
   - Spawn a background thread that checks `child.try_wait()` every ~150ms
   - If shell is killed externally (e.g., user closes PowerShell window), emit `pty:exit`
   - This allows the UI to close automatically when the last process dies

---

## Architecture

Add a high-performance integrated terminal to Branchcode using:
- **Backend**: Rust with `portable-pty` crate
- **Frontend**: React with `ghostty-web` terminal emulator
- **Platform**: Cross-platform (Windows, Linux, macOS)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │   GitPanel.tsx  │  │     TerminalPanel.tsx            │  │
│  │  (bottom area)  │  │  - Tab bar (double-click to add)│  │
│  │                 │  │  - ghostty-web instances        │  │
│  └────────┬────────┘  └──────────────┬────────────────────┘  │
│           │                         │                       │
│           └────────────┬────────────┘                       │
│                        ▼                                    │
│              Tauri invoke() / events                        │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Rust Backend                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    PtyManager                         │  │
│  │  - HashMap<terminal_id, PtyHandle>                   │  │
│  │  - Shell detection (pwsh → powershell → cmd)        │  │
│  │  - Spawn, read, write, resize, close                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │                                    │
│                        ▼                                    │
│              portable-pty (ConPTY on Windows)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Rust Backend

### 1.1 Dependencies (`src-tauri/Cargo.toml`)

```toml
[dependencies]
portable-pty = "0.8"
anyhow = "1"
```

### 1.2 PTY Module (`src-tauri/src/pty.rs`)

**Structures:**
- `PtyManager` - Manages multiple terminal sessions
- `PtyHandle` - Holds master pty and writer

**Shell Detection (Windows):**
1. Check `pwsh.exe` (PowerShell 7)
2. Fall back to `powershell.exe` (Windows PowerShell 5.1)
3. Fall back to `cmd.exe` via `COMSPEC`

**Shell Detection (Unix):**
1. Use `$SHELL` environment variable
2. Fall back to `/bin/bash`

**Public Functions:**
- `PtyManager::new() -> PtyManager`
- `PtyManager::spawn(&mut self) -> Result<String>` - Spawns new shell, returns ID
- `PtyManager::write(&mut self, id: &str, data: &str) -> Result<()>`
- `PtyManager::read(&mut self, id: &str) -> Result<Option<String>>` - Non-blocking read
- `PtyManager::resize(&mut self, id: &str, cols: u16, rows: u16) -> Result<()>`
- `PtyManager::close(&mut self, id: &str) -> Result<()>`

### 1.3 Tauri Commands (`src-tauri/src/lib.rs`)

```rust
#[command]
fn spawn_terminal(state: State<'_, PtyState>) -> Result<String, String>

#[command]
fn write_terminal(id: String, data: String, state: State<'_, PtyState>) -> Result<(), String>

#[command]
fn read_terminal(id: String, state: State<'_, PtyState>) -> Result<Option<String>, String>

#[command]
fn resize_terminal(id: String, cols: u16, rows: u16, state: State<'_, PtyState>) -> Result<(), String>

#[command]
fn close_terminal(id: String, state: State<'_, PtyState>) -> Result<(), String>
```

**State Management:**
- Add `pty: std::sync::Mutex<PtyManager>` to `AppState`
- Initialize in `run()` with `app.manage(PtyManager::new())`

---

## Phase 2: React Frontend

### 2.1 Dependencies

```bash
bun add ghostty-web
```

### 2.2 Terminal Hook (`src/hooks/useTerminal.ts`)

**State:**
```typescript
interface TerminalInstance {
  id: string;
  terminal: Terminal; // ghostty-web instance
  containerRef: React.RefObject<HTMLDivElement>;
}

interface UseTerminalState {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
}
```

**Functions:**
- `init()` - Initialize ghostty-web WASM
- `createTerminal()` - Spawn new PTY via Tauri, create ghostty instance
- `writeToTerminal(id, data)` - Send keystrokes to PTY
- `closeTerminal(id)` - Clean up and close PTY
- `resizeTerminal(id, cols, rows)` - Notify PTY of resize

**Read Loop:**
- Poll `read_terminal` every ~16ms (60fps)
- Write received data to ghostty instance via `.write()`
- Use RAF for batching if needed

### 2.3 Terminal Panel Component (`src/components/TerminalPanel.tsx`)

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ [Tab 1 ×] [Tab 2 ×] [Tab 3 ×] [+]                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    ghostty-web                           │
│                   (terminal area)                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Tab bar with close buttons on each tab
- Double-click on tab bar creates new terminal
- Click + button to create new terminal
- Hover tooltip showing shell type
- Active tab indicator
- Keyboard shortcuts (Ctrl+T for new tab, Ctrl+W to close)

**Theme (matching Branchcode):**
- Background: `#0a0a0a`
- Foreground: `#a9b1d6`
- Cursor: `#c0caf5`
- Font: JetBrains Mono, 13px
- Selection background: `rgba(119, 136, 153, 0.3)`

### 2.4 GitPanel Integration (`src/components/GitPanel.tsx`)

**When `activeDockTab === 'terminal'`:**
1. Hide the commit form area
2. Show `TerminalPanel` in the left panel (full height minus header)
3. Keep the right dock sidebar with terminal icon active
4. Terminal replaces git view content

**Code Flow:**
```tsx
{activeDockTab === 'terminal' ? (
  <TerminalPanel />
) : activeDockTab === 'git' ? (
  // existing git content
) : ...}
```

---

## Phase 3: Resize Handling

### 3.1 Frontend Resize Observer

In `TerminalPanel.tsx`:
```typescript
useEffect(() => {
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      // Calculate cols/rows based on font size
      const cols = Math.floor(width / charWidth);
      const rows = Math.floor(height / lineHeight);
      // Call resize_terminal for active terminal
    }
  });
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);
```

### 3.2 Backend Resize

In `pty.rs`:
```rust
fn resize(handle: &mut PtyHandle, cols: u16, rows: u16) -> Result<()> {
    handle.master.resize(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;
    Ok(())
}
```

---

## Phase 4: Shell Auto-Detection Details

### Windows Priority Order

| Priority | Shell | Path Check |
|----------|-------|------------|
| 1 | PowerShell 7 (pwsh) | PATH lookup |
| 2 | Windows PowerShell (powershell) | PATH lookup |
| 3 | cmd.exe | COMSPEC env var |

### Unix Priority Order

| Priority | Shell | Fallback |
|----------|-------|----------|
| 1 | $SHELL env var | /bin/bash |
| 2 | /bin/sh | - |

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/Cargo.toml` | MODIFY | Add `portable-pty`, `anyhow` |
| `src-tauri/src/pty.rs` | CREATE | PTY manager module |
| `src-tauri/src/lib.rs` | MODIFY | Add PTY commands + state |
| `package.json` | MODIFY | Add `ghostty-web` |
| `src/hooks/useTerminal.ts` | CREATE | Terminal state hook |
| `src/components/TerminalPanel.tsx` | CREATE | Terminal UI component |
| `src/components/GitPanel.tsx` | MODIFY | Integrate terminal tab |

---

## Performance Considerations

1. **Non-blocking reads**: Backend returns immediately if no data
2. **Polling interval**: 10-16ms for responsive output
3. **Multiple terminals**: Each has independent read loop
4. **Cleanup**: Proper disposal on unmount/close to prevent leaks
5. **Theme matching**: Use Branchcode colors to avoid visual jarring

---

## Future Enhancements (Not in Scope)

- Terminal session persistence
- Multiple split panes
- SSH support
- OSC protocol (working directory reporting)
- AI agent integration
- Search in terminal
- Copy/paste improvements

---

## References

- OpenChamber terminal implementation: `packages/ui/src/components/terminal/`
- ghostty-web: https://github.com/coder/ghostty-web
- portable-pty: https://docs.rs/portable-pty/