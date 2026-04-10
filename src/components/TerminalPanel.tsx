import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Plus, Terminal as TerminalIcon } from 'lucide-react';
import { useTerminal } from '../hooks/useTerminal';
import './TerminalPanel.css';

// ── INTERNAL COMPONENT: Keeps each terminal alive in the DOM ──
function TerminalInstance({ 
  terminal, 
  isActive 
}: { 
  terminal: { id: string; terminal: any; container: HTMLDivElement; fitAddon: any }; 
  isActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = terminal.container;
    const term = terminal.terminal;

    if (!containerRef.current.contains(container)) {
      containerRef.current.appendChild(container);
    }

    if (!term.element) {
      term.options.theme = {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#0a0a0a',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#0a0a0a',
      };
      term.options.cursorBlink = true;
      term.options.cursorStyle = 'block';
      
      term.open(container);
      
      // Fit terminal to container after opening
      const fitAddon = terminal.fitAddon;
      if (fitAddon?.fit) {
        try { fitAddon.fit(); } catch (e) {}
      }
    }

    const resize = () => {
      if (!isActive || !containerRef.current || !terminal.fitAddon) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (width === 0 || height === 0) return;

      try {
        terminal.fitAddon.fit();
        
        // Get the new dimensions after fit
        const cols = terminal.terminal.cols;
        const rows = terminal.terminal.rows;

        // Debounce backend resize to prevent PowerShell from spamming prompts during drag
        if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
        
        resizeTimeout.current = setTimeout(() => {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('resize_terminal', { id: terminal.id, cols, rows }).catch(() => {});
          });
        }, 200); // Wait 200ms after resizing stops before telling backend
        
      } catch (e) {}
    };

    if (isActive) {
      setTimeout(() => requestAnimationFrame(resize), 10);
    }

    const resizeObserver = new ResizeObserver(() => {
      // Debounce ResizeObserver to prevent rapid firing during drag
      if (resizeTimeout.current) return;
      resizeTimeout.current = setTimeout(() => {
        if (isActive) requestAnimationFrame(resize);
        resizeTimeout.current = null;
      }, 50);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
    };
  }, [terminal, isActive]);

  return (
    <div 
      ref={containerRef} 
      className={`terminal-container absolute inset-0 ${isActive ? 'block' : 'hidden'}`}
    />
  );
}

// ── MAIN PANEL ──
export function TerminalPanel({ 
  onClose,
  autoCreate = true 
}: { 
  onClose?: () => void;
  autoCreate?: boolean;
}) {
  // Use refs to access latest state in callback without triggering re-renders
  const terminalsRef = useRef<string[]>([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  
  const {
    terminals,
    activeTerminalId,
    createTerminal,
    closeTerminal,
    setActiveTerminal,
  } = useTerminal((id: string) => {
    // Called when terminal process dies externally - just close the terminal
    closeTerminal(id);
  });
  
  // Keep ref updated with latest terminals
  useEffect(() => {
    terminalsRef.current = terminals.map(t => t.id);
  }, [terminals]);

  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTerminal = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createTerminal();
    } finally {
      setIsCreating(false);
    }
  }, [createTerminal, isCreating]);

  // Close UI when last terminal is closed
  const handleCloseTerminal = useCallback(async (id: string) => {
    const wasOnlyOne = terminals.length === 1;
    await closeTerminal(id);
    if (wasOnlyOne && onClose) {
      onClose();
    }
  }, [closeTerminal, terminals.length, onClose]);

  // Auto-create terminal on first open (when terminals is empty)
  const hasTriedToCreate = useRef(false);
  
  // Use ref to hold latest createTerminal to avoid stale closure in useEffect
  const createTerminalRef = useRef(createTerminal);
  createTerminalRef.current = createTerminal;
  
  useEffect(() => {
    if (!autoCreate || hasTriedToCreate.current) return;
    hasTriedToCreate.current = true;
    createTerminalRef.current();
  }, [autoCreate]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] font-sans">
      
      <div className="flex items-center h-[38px] bg-[#0c0c0c] border-b border-white/[0.04] px-2 select-none flex-shrink-0">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto custom-scrollbar h-full pt-[4px]">
          {terminals.map((term) => {
            const isActive = activeTerminalId === term.id;
            return (
              <div
                key={term.id}
                onClick={() => setActiveTerminal(term.id)}
                className={`group relative flex items-center gap-2 px-3 ml-1 h-full max-w-[200px] min-w-[130px] rounded-t-[6px] cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-[#0a0a0a] text-neutral-200' 
                    : 'bg-transparent text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-300'
                }`}
              >
                <TerminalIcon size={12} className="flex-shrink-0" />
                <span className="text-[11px] font-medium font-mono truncate flex-1">
                  {term.id.replace('term-', 'Terminal ')}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTerminal(term.id);
                  }}
                  className={`flex-shrink-0 p-0.5 rounded-md hover:bg-white/10 transition-all ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Close Terminal"
                >
                  <X size={12} />
                </button>

                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-neutral-600 rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1 pl-2 border-l border-white/[0.04] ml-2">
          <button 
            onClick={handleCreateTerminal} 
            disabled={isCreating} 
            className="p-1.5 text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06] rounded-md transition-colors" 
            title="New Terminal"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-[#0a0a0a] overflow-hidden">
        {terminals.map(term => (
          <TerminalInstance 
            key={term.id} 
            terminal={term} 
            isActive={activeTerminalId === term.id} 
          />
        ))}
      </div>

    </div>
  );
}