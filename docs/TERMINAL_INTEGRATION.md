# Terminal Integration Plan for Branchcode

## CRITICAL BUG FIX DOCUMENTATION - READ BEFORE MODIFYING

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

2. **Missing Visibility Control for Inactive Tabs**
   - Problem: Used `display: none` (Tailwind `hidden`) for inactive terminals
   - Result: Canvas goes to 0x0 dimensions, renderer breaks permanently
   - Fix: Use `visibility: hidden` + `pointer-events: none` to keep dimensions alive

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

7. **PTY Size Desync (THE MAIN CULPRIT)**
   - Problem: Frontend calls `fitAddon.fit()` but doesn't resize the backend PTY
   - Result: Terminal cols/rows change in UI but shell thinks it's the old size
   - Symptoms: "typing not inline", cursor jumps, prompts wrap wrong, backspace broken
   - Fix: Whenever terminal container size changes, do BOTH:
     - `fitAddon.fit()` (frontend)
     - `resize_terminal` invoke (backend PTY)
   - NEVER resize while hidden (check clientWidth > 20 before resizing)

8. **Event Listeners Recreating on activeId Change**
   - Problem: useEffect for event listeners depended on `[activeId]`
   - Result: Listeners recreated on every tab switch, stale closures in exit handler
   - Fix: Use empty deps `[]` + keep activeId in a ref

9. **Using Polling Instead of Events**
   - Problem: Polling with setInterval causes 50ms delay and kills interactive TUIs
   - Result: BTOP, htop, and other full-screen TUI apps show escape codes when scrolling
   - Fix: Use event-based push model (pty:data events) instead of polling read_terminal

### How to Avoid This Bug

When modifying terminal code, follow these rules:

```typescript
// CORRECT: Each terminal creates its own container
const createTerminal = useCallback(async () => {
  const container = document.createElement('div'); // NEW container each time
  container.style.width = '100%';
  container.style.height = '100%';
  // ... create terminal
}, []);

// WRONG: Reuse same container or pass external container
const createTerminal = useCallback(async (sharedContainer) => {
  // This causes multiple terminals to fight for DOM space
}, []);
```

```tsx
// CORRECT: Use visibility:hidden for inactive terminals (NOT display:none)
return (
  <div 
    className={`absolute inset-0 ${
      active ? 'z-10' : 'invisible pointer-events-none z-0'
    }`} 
  />
);

// WRONG: Use hidden/display:none - breaks renderer when switching back
return <div className={`absolute inset-0 ${active ? 'block' : 'hidden'}`} />;
```

```typescript
// CORRECT: Spawn backend first, then create frontend
const id = await invoke<string>('spawn_terminal');
const term = new Terminal({...});
term.open(container);
// Now write to 'id', not a temp ID

// WRONG: Create frontend with temp ID, then swap after spawn
const tempId = 'temp-123';
terminalsRef.current.set(tempId, {...});
invoke('spawn_terminal', ...).then(realId => {
  // Race condition: output before this runs goes to tempId which doesn't exist!
});
```

```typescript
// CORRECT: Resize BOTH frontend AND backend together
const doResize = () => {
  term.fitAddon.fit();
  invoke('resize_terminal', {
    id: term.id,
    cols: term.terminal.cols,
    rows: term.terminal.rows,
  }).catch(() => {});
};

// WRONG: Only resize frontend, never touch backend
const doResize = () => {
  term.fitAddon.fit();  // This alone breaks everything!
};
```

```rust
// CORRECT: Set WT_SESSION for PowerShell
let mut cmd = CommandBuilder::new(shell());
cmd.env("WT_SESSION", "1");  // Tells pwsh it's a real terminal

// WRONG: Missing WT_SESSION
let mut cmd = CommandBuilder::new(shell());
// PowerShell won't enable ANSI properly
```

### Event-Based Push Model (Critical for Interactive TUIs)

Using Tauri events instead of polling is essential for interactive applications like BTOP, htop, etc.

**Rust Backend (pty.rs):**
```rust
pub fn spawn(&mut self, app: AppHandle) -> Result<String> {
    // ... setup PTY ...
    
    let reader = pair.master.try_clone_reader()?;
    
    // Thread emits events on data, no polling needed
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 { break; }
            // Emit event directly - frontend receives immediately
            let _ = app.emit("pty:data", PtyData { id: id.clone(), data: buf[..n].to_vec() });
        }
        let _ = app.emit("pty:exit", PtyExit { id });
    });
    
    Ok(return_id)
}
```

**React Frontend (useTerminal.ts):**
```typescript
// Use listen() to receive events, NOT setInterval polling
const initTerminal = useCallback(async () => {
    await init();

    const unData = listen<{id: string, data: number[]}>('pty:data', e => {
      const t = terminalsRef.current.find(term => term.id === e.payload.id);
      if (!t) return;
      const dec = new TextDecoder('utf-8', { fatal: false });
      const text = dec.decode(new Uint8Array(e.payload.data), { stream: true });
      if (text) t.terminal.write(text);
    });

    const unExit = listen<{id: string}>('pty:exit', e => {
      closeTerminalRef.current(e.payload.id);
    });

    return () => {
      unData.then(f => f());
      unExit.then(f => f());
    };
}, []);
```

### Additional Configuration Notes

1. **convertEol: false**
   - PowerShell sends `\r` (carriage return) for newlines, not `\n`
   - Setting `convertEol: false` prevents ghostty-web from incorrectly interpreting `\r` as newline
   - This keeps the cursor in the correct position for PowerShell's line editing

2. **Shell Detection Priority**
   - On Windows, prefer PowerShell 7 (pwsh.exe) → PowerShell 5 (powershell.exe) → cmd.exe
   - PowerShell has better ANSI support than cmd.exe
   - Setting `TERM=xterm-256color` helps the shell know terminal capabilities

3. **Streaming TextDecoder**
   - When receiving PTY output, use `TextDecoder` with `stream: true`
   - This handles UTF-8 sequences that may be split across multiple packets
   - Create one decoder per terminal and reuse it

4. **Watchdog for External Kill Detection**
   - Spawn a background thread that checks `child.try_wait()` every ~150ms
   - If shell is killed externally (e.g., user closes PowerShell window), emit `pty:exit`
   - This allows the UI to close automatically when the last process dies

5. **ResizeObserver with Debouncing**
   - Use ResizeObserver to detect container size changes
   - Debounce with setTimeout(50ms) to avoid rapid-fire resizes during drag
   - Always call resize_terminal after fitAddon.fit()

---

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
│  │  - Shell detection (pwsh → powershell → cmd)         │  │
│  │  - Spawn, read, write, resize, close                 │  │
│  │  - Event emission for push-based output              │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │                                    │
│                        ▼                                    │
│              portable-pty (ConPTY on Windows)              │
└─────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src-tauri/Cargo.toml` | MODIFY | Add `portable-pty`, `anyhow`, `serde` |
| `src-tauri/src/pty.rs` | CREATE | PTY manager with event emission |
| `src-tauri/src/lib.rs` | MODIFY | Add PTY commands + state |
| `package.json` | MODIFY | Add `ghostty-web` |
| `src/hooks/useTerminal.ts` | CREATE | Terminal state hook with event listeners |
| `src/components/TerminalPanel.tsx` | CREATE | Terminal UI with ResizeObserver |
| `src/components/GitPanel.tsx` | MODIFY | Integrate terminal tab |

---

## References

- OpenCode terminal implementation: https://github.com/anomalyco/opencode/blob/dev/packages/app/src/components/terminal.tsx
- ghostty-web: https://github.com/coder/ghostty-web
- portable-pty: https://docs.rs/portable-pty/