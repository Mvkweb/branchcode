import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { init, Terminal, FitAddon } from 'ghostty-web';

export interface TerminalInstance {
  id: string;
  terminal: Terminal;
  container: HTMLDivElement;
}

interface UseTerminalReturn {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  isInitialized: boolean;
  createTerminal: () => Promise<void>;
  closeTerminal: (id: string) => Promise<void>;
  setActiveTerminal: (id: string) => void;
}

export function useTerminal(): UseTerminalReturn {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const pollIntervalsRef = useRef<Map<string, number>>(new Map());
  const isInitializedRef = useRef(false);
  const terminalsRef = useRef<TerminalInstance[]>([]);

  useEffect(() => {
    terminalsRef.current = terminals;
  }, [terminals]);

  const initTerminal = useCallback(async () => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    await init();
    setIsInitialized(true);
    console.log('[Terminal] ghostty-web initialized with init()');
  }, []);

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
    }
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
        fontWeight: '400',
        lineHeight: 1.2,
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
      };

      setTerminals(prev => [...prev, newInstance]);
      setActiveTerminalId(id);

      const intervalId = window.setInterval(() => {
        pollRead(id);
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
    isInitialized,
    createTerminal,
    closeTerminal,
    setActiveTerminal,
  };
}