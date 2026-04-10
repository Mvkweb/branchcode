import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { init, Terminal, FitAddon } from 'ghostty-web';

export interface TerminalInstance {
  id: string;
  terminal: Terminal;
  container: HTMLDivElement;
  fitAddon: FitAddon;
}

export function useTerminal() {
  const terminalsRef = useRef<Map<string, TerminalInstance>>(new Map());
  const decodersRef = useRef<Map<string, TextDecoder>>(new Map());
  const [ids, setIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    init();
    const unData = listen<{id: string, data: number[]}>('pty:data', e => {
      const t = terminalsRef.current.get(e.payload.id);
      if (!t) return;
      let dec = decodersRef.current.get(e.payload.id);
      if (!dec) { dec = new TextDecoder('utf-8', {fatal:false}); decodersRef.current.set(e.payload.id, dec); }
      t.terminal.write(dec.decode(new Uint8Array(e.payload.data), {stream:true}));
    });
    const unExit = listen<{id: string}>('pty:exit', e => closeTerminal(e.payload.id));
    return () => { unData.then(f => f()); unExit.then(f => f()); };
  }, []);

  const createTerminal = useCallback(async () => {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    
    const term = new Terminal({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      theme: { background: '#0d0d0d', foreground: '#e4e4e7' },
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: false,
      scrollback: 10000,
    } as any);
    
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    
    const cols = Math.max(term.cols, 80);
    const rows = Math.max(term.rows, 24);
    const id = await invoke<string>('spawn_terminal', { cols, rows });
    
    term.onData(d => invoke('write_terminal', { id, data: d }).catch(() => {}));
    
    terminalsRef.current.set(id, { id, terminal: term, container, fitAddon: fit });
    setIds(p => [...p, id]);
    setActiveId(id);
    
    return id;
  }, []);

  const closeTerminal = useCallback(async (id: string) => {
    await invoke('close_terminal', { id }).catch(() => {});
    terminalsRef.current.get(id)?.terminal.dispose();
    terminalsRef.current.delete(id);
    decodersRef.current.delete(id);
    setIds(p => { const n = p.filter(x => x !== id); if (activeId === id) setActiveId(n[0] ?? null); return n; });
  }, [activeId]);

  return {
    terminals: ids.map(id => terminalsRef.current.get(id)!).filter(Boolean),
    activeTerminalId: activeId,
    createTerminal,
    closeTerminal,
    setActiveTerminal: setActiveId,
  };
}