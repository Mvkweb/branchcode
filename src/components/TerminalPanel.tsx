import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Plus, Terminal as TerminalIcon } from 'lucide-react';
import { useTerminal } from '../hooks/useTerminal';
import './TerminalPanel.css';

export function TerminalPanel() {
  const {
    terminals,
    activeTerminalId,
    createTerminal,
    closeTerminal,
    setActiveTerminal,
  } = useTerminal();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isCreating, setIsCreating] = useState(false);

  const activeTerminal = terminals.find(t => t.id === activeTerminalId);

  const handleCreateTerminal = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createTerminal();
    } finally {
      setIsCreating(false);
    }
  }, [createTerminal, isCreating]);

  useEffect(() => {
    if (!activeTerminal || !containerRef.current) return;

    const container = activeTerminal.container;
    const term = activeTerminal.terminal;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(container);

    term.open(container);

    const cols = Math.max(2, Math.floor(containerRef.current.clientWidth / 9));
    const rows = Math.max(1, Math.floor(containerRef.current.clientHeight / 20));
    term.resize(cols, rows);

    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('resize_terminal', { 
        id: activeTerminal.id, 
        cols, 
        rows 
      }).catch(console.error);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const cols = Math.max(2, Math.floor(width / 9));
        const rows = Math.max(1, Math.floor(height / 20));
        term.resize(cols, rows);
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('resize_terminal', { 
            id: activeTerminal.id, 
            cols, 
            rows 
          }).catch(console.error);
        });
      }
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, [activeTerminal]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
      <div 
        className="flex items-center h-[36px] bg-[#0c0c0c] border-b border-white/[0.04] px-1"
      >
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto custom-scrollbar">
          {terminals.map((term) => (
            <div
              key={term.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] cursor-pointer transition-colors group min-w-[100px] max-w-[160px] ${
                activeTerminalId === term.id
                  ? 'bg-white/[0.08] text-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
              onClick={() => setActiveTerminal(term.id)}
              title={term.id}
            >
              <TerminalIcon size={12} className="flex-shrink-0" />
              <span className="text-[11px] truncate flex-1 font-mono">
                {term.id.replace('term-', 'Terminal ')}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(term.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
        
        <button
          onClick={handleCreateTerminal}
          disabled={isCreating}
          className="p-1.5 rounded-[6px] text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04] transition-colors ml-1"
          title="New Terminal (Ctrl+Shift+T)"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 relative" style={{ minHeight: '0' }}>
        {activeTerminal ? (
          <div className="absolute inset-0" style={{ minHeight: '0' }}>
            <div 
              ref={containerRef} 
              className="terminal-container w-full h-full"
              style={{ 
                backgroundColor: '#0a0a0a',
                minHeight: '0'
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-6">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4 text-neutral-400">
              <TerminalIcon size={24} />
            </div>
            <p className="text-[13px] font-medium text-neutral-300 mb-2">No Terminal Open</p>
            <p className="text-[11.5px] text-neutral-500 text-center leading-relaxed max-w-[220px]">
              Click the + button or double-click here to open a new terminal.
            </p>
            <button
              onClick={handleCreateTerminal}
              className="mt-4 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.05] rounded-[6px] text-[12px] text-neutral-300 transition-colors"
            >
              Open Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}