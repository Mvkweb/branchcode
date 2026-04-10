import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { init, Terminal, FitAddon } from 'ghostty-web';

export interface TerminalInstance {
  id: string;
  terminal: Terminal;
  container: HTMLDivElement;
  fitAddon: any;
}

interface UseTerminalReturn {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  createTerminal: () => Promise<void>;
  closeTerminal: (id: string) => Promise<void>;
  setActiveTerminal: (id: string) => void;
  onTerminalExit?: (id: string) => void;
}

export function useTerminal(onTerminalExit?: (id: string) => void): UseTerminalReturn {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const pollIntervalsRef = useRef<Map<string, number>>(new Map());
  const isInitializedRef = useRef(false);
  const terminalsRef = useRef<TerminalInstance[]>([]);
  
  // Store latest callback in ref to avoid stale closure
  const onTerminalExitRef = useRef(onTerminalExit);
  onTerminalExitRef.current = onTerminalExit;

  useEffect(() => {
    terminalsRef.current = terminals;
  }, [terminals]);

  const pollRead = useCallback(async (terminalId: string) => {
    try {
      const output = await invoke<string | null>('read_terminal', { id: terminalId });
      if (output) {
        const term = terminalsRef.current.find(t => t.id === terminalId);
        if (term) {
          term.terminal.write(output);
        }
      }
    } catch (e) {
      // Ignore errors - will check is_alive separately
    }
  }, []);

  const initTerminal = useCallback(async () => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    await init();
    console.log('[Terminal] ghostty-web initialized');
  }, []);

  const createTerminal = useCallback(async () => {
    await initTerminal();

    try {
      console.log('[Terminal] Spawning terminal in backend...');
      const id = await invoke<string>('spawn_terminal');
      if (!id) {
        console.error('[Terminal] ERROR: No terminal ID returned!');
        return;
      }
      console.log('[Terminal] Terminal ID:', id);

      const container = document.createElement('div');
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minWidth = '80px';
      container.style.minHeight = '24px';
      container.style.display = 'block';

      console.log('[Terminal] Creating Terminal instance...');

      const term = new Terminal({
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Consolas, "Cascadia Code", "Fira Code", monospace',
        theme: {
          background: '#0d0d0d',
          foreground: '#e4e4e7',
          cursor: '#a1a1aa',
          cursorAccent: '#09090b',
          black: '#09090b',
          red: '#ef4444',
          green: '#22c55e',
          yellow: '#eab308',
          blue: '#3b82f6',
          magenta: '#a855f7',
          cyan: '#06b6d4',
          white: '#e4e4e7',
          brightBlack: '#71717a',
          brightRed: '#f87171',
          brightGreen: '#4ade80',
          brightYellow: '#facc15',
          brightBlue: '#60a5fa',
          brightMagenta: '#c084fc',
          brightCyan: '#22d3ee',
          brightWhite: '#fafafa',
        },
        cursorBlink: true,
        cursorStyle: 'bar',
      });
      console.log('[Terminal] Terminal instance created');

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.onData((data: string) => {
        console.log('[Terminal] onData:', JSON.stringify(data).substring(0, 100));
        invoke('write_terminal', { id, data }).catch(console.error);
      });

      const newInstance: TerminalInstance = {
        id,
        terminal: term,
        container,
        fitAddon,
      };

      setTerminals(prev => [...prev, newInstance]);
      setActiveTerminalId(id);

      const intervalId = window.setInterval(async () => {
        pollRead(id);
        
        // Check if terminal process is still alive
        try {
          const isAlive = await invoke<boolean>('is_terminal_alive', { id });
          if (!isAlive) {
            console.log('[Terminal] Process exited for', id);
            // Clear the interval first
            const intervalIdToClear = pollIntervalsRef.current.get(id);
            if (intervalIdToClear) {
              clearInterval(intervalIdToClear);
              pollIntervalsRef.current.delete(id);
            }
            // Then call exit handler
            if (onTerminalExitRef.current) {
              onTerminalExitRef.current(id);
            }
          }
        } catch (e) {
          // If we can't check (process might be dead), trigger exit
          console.log('[Terminal] is_terminal_alive error, assuming dead:', e);
          const intervalIdToClear = pollIntervalsRef.current.get(id);
          if (intervalIdToClear) {
            clearInterval(intervalIdToClear);
            pollIntervalsRef.current.delete(id);
          }
          if (onTerminalExitRef.current) {
            onTerminalExitRef.current(id);
          }
        }
      }, 50);
      pollIntervalsRef.current.set(id, intervalId);

      console.log('[Terminal] Terminal created successfully, waiting for render...');
    } catch (e) {
      console.error('[Terminal] Failed to create terminal:', e);
    }
  }, [initTerminal, pollRead]);

  const closeTerminal = useCallback(async (id: string) => {
    try {
      await invoke('close_terminal', { id });
    } catch (e) {
      console.error('[Terminal] Failed to close terminal:', e);
    }

    const intervalId = pollIntervalsRef.current.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      pollIntervalsRef.current.delete(id);
    }

    const term = terminalsRef.current.find(t => t.id === id);
    if (term) {
      try {
        term.terminal.dispose();
      } catch (e) {
        console.error('[Terminal] Error disposing terminal:', e);
      }
      try {
        term.container.remove();
      } catch (e) {
      }
    }

    setTerminals(prev => prev.filter(t => t.id !== id));

    if (activeTerminalId === id) {
      const remaining = terminalsRef.current.filter(t => t.id !== id);
      setActiveTerminalId(remaining.length > 0 ? remaining[0]?.id ?? null : null);
    }
  }, [activeTerminalId]);

  const setActiveTerminal = useCallback((id: string) => {
    setActiveTerminalId(id);
  }, []);

  useEffect(() => {
    return () => {
      pollIntervalsRef.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      terminalsRef.current.forEach(t => {
        try {
          t.terminal.dispose();
        } catch (e) {
        }
        try {
          t.container.remove();
        } catch (e) {
        }
      });
    };
  }, []);

  return {
    terminals,
    activeTerminalId,
    createTerminal,
    closeTerminal,
    setActiveTerminal,
  };
}