import { useEffect, useRef } from 'react';
import { X, Plus, Terminal as TerminalIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTerminal, type TerminalInstance } from '../hooks/useTerminal';

function TerminalView({ term, active }: { term: TerminalInstance; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const resizeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!ref.current || !term.container) return;
    if (!ref.current.contains(term.container)) {
      ref.current.appendChild(term.container);
    }
  }, [term.container]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    const doResize = () => {
      if (!ref.current || ref.current.clientWidth === 0) return;
      try {
        term.fitAddon.fit();
        invoke('resize_terminal', {
          id: term.id,
          cols: term.terminal.cols,
          rows: term.terminal.rows,
        }).catch(() => {});
      } catch {}
    };

    doResize();

    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
      resizeTimeout.current = setTimeout(doResize, 50);
    });

    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
    };
  }, [active, term.id]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={`absolute inset-0 ${active ? 'block' : 'hidden'}`}
    />
  );
}

export function TerminalPanel({ onClose, isOpen }: { onClose?: () => void; isOpen: boolean }) {
  const { terminals, activeTerminalId, createTerminal, closeTerminal, setActiveTerminal } = useTerminal();

  useEffect(() => {
    if (isOpen && terminals.length === 0) {
      createTerminal();
    }
  }, [isOpen, terminals.length, createTerminal]);

  const handleClose = async (id: string) => {
    const wasLast = terminals.length === 1;
    await closeTerminal(id);
    if (wasLast) onClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex h-[38px] bg-[#0c0c0c] border-b border-white/5 px-2 select-none">
        <div className="flex gap-1 flex-1 overflow-x-auto h-full pt-1">
          {terminals.map(t => {
            const isActive = activeTerminalId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setActiveTerminal(t.id)}
                className={`group flex items-center gap-2 px-3 h-[30px] rounded-t-md cursor-pointer ${
                  isActive ? 'bg-[#0a0a0a] text-white' : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-300'
                }`}
              >
                <TerminalIcon size={12} />
                <span className="text-xs font-mono">{t.id}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleClose(t.id); }}
                  className={`p-0.5 rounded hover:bg-white/10 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={() => createTerminal()} className="p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-white/5 rounded">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden">
        {terminals.map(t => (
          <TerminalView key={t.id} term={t} active={activeTerminalId === t.id} />
        ))}
      </div>
    </div>
  );
}