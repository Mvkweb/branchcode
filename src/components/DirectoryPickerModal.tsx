import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Folder, ArrowLeft, CornerLeftUp, Loader2, Search, Globe, HardDrive, Check, CornerDownLeft, AlertCircle } from 'lucide-react';
import { listLocalDirectory, sshListDir, type SshConnectionInfo } from '../lib/tauri';

interface DirectoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string, configId?: string) => void;
  initialPath?: string;
  sshConnections?: SshConnectionInfo[];
}

interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
}

const easeOut = [0.16, 1, 0.3, 1] as const;

export function DirectoryPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialPath = '.',
  sshConnections = [],
}: DirectoryPickerModalProps) {
  const [activeConfigId, setActiveConfigId] = useState<string | undefined>(undefined);
  const [currentPath, setCurrentPath] = useState(initialPath || '.');
  const [inputValue, setInputValue] = useState(initialPath || '.');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeConnection = useMemo(() => 
    sshConnections.find(c => c.config_id === activeConfigId),
    [sshConnections, activeConfigId]
  );

  // ── Path Normalization ───────────────────────────────────────────────────────

  const normalizePath = (path: string, isSSH: boolean) => {
    let p = (path || '').trim();
    if (!isSSH) {
      // Remove leading slash if it looks like a Windows drive (e.g. /E:\ -> E:\)
      if (/^\/[A-Z]:/i.test(p)) p = p.substring(1);
      // Ensure Windows drive roots have a trailing slash for the backend
      if (/^[A-Z]:$/i.test(p)) p += '\\';
    }
    return p || (isSSH ? '/' : '.');
  };

  // ── Fetching Logic ───────────────────────────────────────────────────────────

  const fetchItems = useCallback(async (path: string, configId?: string) => {
    setLoading(true);
    setError(null);
    const isSSH = !!configId;
    const targetPath = normalizePath(path, isSSH);

    try {
      let results: FileItem[] = [];
      if (configId) {
        const sftpItems = await sshListDir(configId, targetPath);
        results = sftpItems
          .filter(i => i.is_dir)
          .map(i => ({ name: i.name, path: i.path, isDir: true }));
      } else {
        const localItems = await listLocalDirectory(targetPath) as any;
        console.log('DEBUG localItems for path:', targetPath, JSON.stringify(localItems).slice(0, 500));
        
        // Try multiple ways to find file entries
        let rawEntries: any[] = [];
        if (Array.isArray(localItems)) {
          rawEntries = localItems;
        } else if (localItems && typeof localItems === 'object') {
          rawEntries = localItems.children || 
                       localItems.entries || 
                       localItems.data?.children || 
                       localItems.data?.entries || 
                       localItems.files ||
                       Object.values(localItems).find(v => Array.isArray(v)) ||
                       Object.values(localItems);
        }

        results = (Array.isArray(rawEntries) ? rawEntries : [])
          .map((e: any): FileItem | null => {
            if (typeof e !== 'object' || !e) return null;
            const name = e.name || e.path?.split(/[\\/]/).pop() || '';
            const isDir = e.type === 'directory' || 
                         e.is_dir === true || 
                         e.isDir === true || 
                         !!e.children ||
                         (e.path && !e.path.includes('.')); 

            if (!isDir || !name || name === '.' || name === '..') return null;
            return { name, path: e.path || '', isDir: !!isDir };
          })
          .filter((i): i is FileItem => i !== null);
      }

      results.sort((a, b) => a.name.localeCompare(b.name));
      setItems(results);
      setSelectedIndex(0);
      setCurrentPath(targetPath);
      setInputValue(targetPath);
    } catch (err) {
      console.error('Directory Picker Error:', err);
      setError(String(err));
      setItems([]);
      setCurrentPath(targetPath);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleContextSwitch = (configId: string | undefined) => {
    setActiveConfigId(configId);
    const newPath = configId ? '/' : initialPath;
    fetchItems(newPath, configId);
  };

  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      if (!hasOpenedRef.current || items.length === 0) {
        hasOpenedRef.current = true;
        const path = initialPath || '.';
        setInputValue(path);
        fetchItems(path, activeConfigId);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      hasOpenedRef.current = false;
    }
  }, [isOpen, initialPath, fetchItems, activeConfigId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (listRef.current && items.length > 0) {
        const idx = selectedIndex;
        const targetEl = listRef.current.children[idx] as HTMLElement;
        if (targetEl) {
          targetEl.scrollIntoView({ block: 'nearest' });
        }
      }
    });
  }, [selectedIndex, items.length]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleItemSelect = (item: FileItem | '..') => {
    if (item === '..') {
      const isSSH = !!activeConfigId;
      const isWindows = !isSSH && (currentPath.includes('\\') || /^[A-Z]:/i.test(currentPath));
      const separator = isWindows ? '\\' : '/';
      const parts = currentPath.split(/[\\/]/).filter(Boolean);
      
      if (parts.length > 0) {
        parts.pop();
        let newPath = parts.join(separator);
        if (isWindows && newPath && /^[A-Z]:$/i.test(newPath)) {
          newPath += '\\';
        }
        const finalPath = newPath || (isSSH ? '/' : '.');
        fetchItems(finalPath, activeConfigId);
      }
    } else {
      fetchItems(item.path, activeConfigId);
    }
    inputRef.current?.focus();
  };

  const handleConfirm = () => {
    onSelect(inputValue, activeConfigId);
    onClose();
  };

  const filteredItems = useMemo(() => {
    const trimmed = inputValue.trim();
    
    if (!trimmed || trimmed === currentPath) {
      return items;
    }

    const hasOnlySearch = !trimmed.includes('\\') && !trimmed.includes('/');
    if (hasOnlySearch) {
      return items.filter(i => i.name.toLowerCase().includes(trimmed.toLowerCase()));
    }
    
    return items;
  }, [items, inputValue, currentPath]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const newIndex = Math.min(filteredItems.length, selectedIndex + step);
      setSelectedIndex(newIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const newIndex = Math.max(0, selectedIndex - step);
      setSelectedIndex(newIndex);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        handleItemSelect('..');
      } else if (selectedIndex > 0) {
        const item = filteredItems[selectedIndex - 1];
        if (item) handleItemSelect(item);
        else handleItemSelect('..');
      } else {
        handleItemSelect('..');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        handleConfirm();
      } else {
        const trimmed = inputValue.trim();
        const hasTrailingSlash = trimmed.endsWith('\\') || trimmed.endsWith('/');
        const looksLikePath = trimmed.includes('\\') || trimmed.includes('/') || /^[A-Z]:/i.test(trimmed);
        
        if (hasTrailingSlash && (looksLikePath || /^[A-Z]:$/i.test(trimmed))) {
          fetchItems(trimmed.slice(0, -1), activeConfigId);
        } else if (looksLikePath) {
          fetchItems(trimmed, activeConfigId);
        } else if (selectedIndex === 0) {
          handleItemSelect('..');
        } else if (selectedIndex > 0) {
          const item = filteredItems[selectedIndex - 1];
          if (item) handleItemSelect(item);
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="w-full max-w-[640px] bg-[#0d0d0d] border border-white/[0.08] rounded-[12px] flex flex-col overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Context Switcher */}
            <div className="flex items-center gap-1 px-3 pt-3 bg-[#0d0d0d]">
              <button
                onClick={() => handleContextSwitch(undefined)}
                className={`flex items-center gap-1.5 px-2.5 h-[26px] rounded-full text-[11px] font-medium transition-all ${
                  !activeConfigId 
                    ? 'bg-white/10 text-white border border-white/10' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <HardDrive size={12} />
                Local
              </button>
              {sshConnections.map(conn => (
                <button
                  key={conn.config_id}
                  onClick={() => handleContextSwitch(conn.config_id)}
                  className={`flex items-center gap-1.5 px-2.5 h-[26px] rounded-full text-[11px] font-medium transition-all ${
                    activeConfigId === conn.config_id 
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' 
                      : 'text-neutral-500 hover:text-neutral-300'
                }`}
                >
                  <Globe size={12} />
                  {conn.server_name}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="flex-1 flex items-center gap-3 px-3 h-[40px] bg-black/40 border border-white/[0.06] rounded-[8px] focus-within:border-white/20 transition-colors">
                <Search size={14} className="text-neutral-600" />
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-[14px] text-neutral-200 placeholder-neutral-700"
                  placeholder="Enter path or search..."
                  spellCheck={false}
                  autoComplete="off"
                />
                {loading && <Loader2 size={14} className="animate-spin text-neutral-500" />}
              </div>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2.5 px-4 h-[40px] bg-white text-black hover:bg-neutral-200 rounded-[8px] text-[14px] font-bold transition-all active:scale-[0.98] shadow-xl"
              >
                Open
                <div className="flex items-center gap-0.5 opacity-40 scale-110">
                  <span className="text-[12px] font-sans">⌘</span>
                  <CornerDownLeft size={10} strokeWidth={3} />
                </div>
              </button>
            </div>

            {/* List area */}
            <div className="flex-1 flex flex-col min-h-[320px] max-h-[45vh] bg-[#0a0a0a]">
              <div className="px-5 py-2.5 text-[10px] font-bold text-neutral-600 tracking-widest uppercase flex items-center justify-between border-b border-white/[0.03]">
                <span>Directories in {activeConnection ? activeConnection.server_name : 'Local'}</span>
                {activeConfigId && <span className="text-teal-500/40 font-mono text-[9px] border border-teal-500/20 px-1 rounded-sm">SSH</span>}
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto px-2 pb-3 custom-scrollbar">
                {error && (
                  <div className="m-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] font-medium leading-relaxed">{error}</span>
                  </div>
                )}

                <div
                  onMouseEnter={() => setSelectedIndex(0)}
                  onClick={() => handleItemSelect('..')}
                  className={`flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-all duration-75 mt-1 ${
                    selectedIndex === 0 
                      ? 'bg-white/[0.06] text-white' 
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <CornerLeftUp size={14} strokeWidth={2.5} />
                  <span className="text-[13px] font-medium">..</span>
                </div>

                {filteredItems.map((item, idx) => {
                  const index = idx + 1;
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={item.path}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => handleItemSelect(item)}
                      className={`flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition-all duration-75 ${
                        isSelected 
                          ? 'bg-white/[0.08] text-white shadow-sm' 
                          : 'text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200'
                      }`}
                    >
                      <div className={`flex items-center justify-center w-5 h-5 ${isSelected ? 'text-white' : 'text-neutral-600'}`}>
                        <Folder size={15} fill={isSelected ? 'currentColor' : 'none'} />
                      </div>
                      <span className={`text-[13px] truncate flex-1 ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                        {item.name}
                      </span>
                    </div>
                  );
                })}

                {!loading && filteredItems.length === 0 && !error && (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-600">
                    <Folder size={32} strokeWidth={1} className="opacity-10 mb-2" />
                    <p className="text-[12px] opacity-60">No directories found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.05] flex items-center gap-6 text-[10px] font-medium text-neutral-500 bg-[#0d0d0d]">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans">Tab</kbd>
                <span>Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans">Enter</kbd>
                <span>Browse</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-sans">⌘↵</kbd>
                <span>Open Path</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
