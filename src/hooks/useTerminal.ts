import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { init, Terminal, FitAddon } from 'ghostty-web';

export interface TerminalInstance {
  id: string;
  label: string;
  terminal: Terminal;
  container: HTMLDivElement;
  fitAddon: FitAddon;
}

export function useTerminal() {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  
  const terminalsRef = useRef<TerminalInstance[]>([]);
  const isInitializedRef = useRef(false);
  const closeTerminalRef = useRef<(_: string) => Promise<void>>(async () => {});

  useEffect(() => {
    terminalsRef.current = terminals;
  }, [terminals]);

  const closeTerminal = useCallback(async (id: string) => {
    try {
      if (id.startsWith('ssh-shell-')) {
        await invoke('ssh_close_shell', { shellId: id });
      } else {
        await invoke('close_terminal', { id });
      }
    } catch {}

    const term = terminalsRef.current.find(t => t.id === id);
    if (term) {
      try { term.terminal.dispose(); } catch {}
      try { term.container.remove(); } catch {}
    }

    setTerminals(prev => prev.filter(t => t.id !== id));
    if (activeTerminalId === id) {
      const remaining = terminalsRef.current.filter(t => t.id !== id);
      setActiveTerminalId(remaining.length > 0 ? remaining[0]?.id ?? null : null);
    }
  }, [activeTerminalId]);

  useEffect(() => {
    closeTerminalRef.current = closeTerminal;
  }, [closeTerminal]);

  const initTerminal = useCallback(async () => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;
    await init();

    const handleData = (e: { payload: { id: string, data: number[] } }) => {
      const t = terminalsRef.current.find(term => term.id === e.payload.id);
      if (!t) return;
      const dec = new TextDecoder('utf-8', { fatal: false });
      const text = dec.decode(new Uint8Array(e.payload.data), { stream: true });
      if (text) t.terminal.write(text);
    };

    const handleExit = (e: { payload: { id: string } }) => {
      closeTerminalRef.current(e.payload.id);
    };

    const unData = listen<{id: string, data: number[]}>('pty:data', handleData);
    const unExit = listen<{id: string}>('pty:exit', handleExit);
    
    // Listen for SSH terminal events
    const unDataSSH = listen<{id: string, data: number[]}>('ssh:data', handleData);
    const unExitSSH = listen<{id: string}>('ssh:exit', handleExit);

    return () => {
      unData.then(f => f());
      unExit.then(f => f());
      unDataSSH.then(f => f());
      unExitSSH.then(f => f());
    };
  }, []);

  const createTerminal = useCallback(async (opts?: { type: 'local' } | { type: 'ssh', configId: string, serverName: string }) => {
    await initTerminal();

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';

    const term = new Terminal({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      theme: { background: '#0d0d0d', foreground: '#e4e4e7' },
      cursorBlink: true,
      cursorStyle: 'bar',
      convertEol: false,
      scrollback: 10000,
    } as any);

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    const type = opts?.type || 'local';
    let id: string;
    let label: string;

    if (type === 'local') {
      label = 'Local';
      id = await invoke<string>('spawn_terminal');
      term.onData((data: string) => {
        invoke('write_terminal', { id, data }).catch(() => {});
      });
    } else {
      label = `SSH: ${opts.serverName}`;
      id = await invoke<string>('ssh_spawn_shell', { configId: opts.configId });
      term.onData((data: string) => {
        invoke('ssh_write_shell', { shellId: id, data }).catch(() => {});
      });
    }

    const newInstance: TerminalInstance = {
      id,
      label,
      terminal: term,
      container,
      fitAddon,
    };

    setTerminals(prev => [...prev, newInstance]);
    setActiveTerminalId(id);

    return id;
  }, [initTerminal]);

  const setActiveTerminal = useCallback((id: string) => {
    setActiveTerminalId(id);
  }, []);

  useEffect(() => {
    return () => {
      terminalsRef.current.forEach(t => {
        try { t.terminal.dispose(); } catch {}
        try { t.container.remove(); } catch {}
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