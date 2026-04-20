import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CornerLeftUp,
  Loader2,
  Search,
  HardDrive,
  AlertCircle,
  Command
} from 'lucide-react';
import { listLocalDirectory, sshListDir, type SshConnectionInfo } from '../lib/tauri';
import { OsIcon } from './ssh/OsIcons';

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
const easeSnap = [0.32, 0.72, 0, 1] as const;

const Kbd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <kbd
    className={`
      inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5
      rounded-[4px]
      bg-gradient-to-b from-white/[0.08] to-white/[0.02]
      border border-white/[0.08] border-b-white/[0.16]
      shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_1px_2px_0_rgba(0,0,0,0.4)]
      font-sans text-[10px] font-medium text-neutral-300
      ${className}
    `}
  >
    {children}
  </kbd>
);

const DirectoryIcon: React.FC<{ selected?: boolean; className?: string }> = ({
  selected = false,
  className = '',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    className={`${selected ? 'text-[#F1E8D8]' : 'text-[#AA9A7B]'} transition-all duration-200 ${className}`}
    aria-hidden="true"
  >
    <path
      fill="currentColor"
      opacity={selected ? 0.95 : 0.45}
      d="M22 14v-2.202c0-2.632 0-3.949-.77-4.804a3 3 0 0 0-.224-.225C20.151 6 18.834 6 16.202 6h-.374c-1.153 0-1.73 0-2.268-.153a4 4 0 0 1-.848-.352C12.224 5.224 11.816 4.815 11 4l-.55-.55c-.274-.274-.41-.41-.554-.53a4 4 0 0 0-2.18-.903C7.53 2 7.336 2 6.95 2c-.883 0-1.324 0-1.692.07A4 4 0 0 0 2.07 5.257C2 5.626 2 6.068 2 6.95V14c0 3.771 0 5.657 1.172 6.828S6.229 22 10 22h4c3.771 0 5.657 0 6.828-1.172S22 17.771 22 14"
    />
    <path
      fill="currentColor"
      d="M9.25 13a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1-.75-.75"
    />
  </svg>
);

function getLinuxVisuals(conn: SshConnectionInfo) {
  const raw = [
    (conn as any)?.os,
    (conn as any)?.distro,
    (conn as any)?.distribution,
    (conn as any)?.platform,
    (conn as any)?.server_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (raw.includes('ubuntu')) return { osName: 'ubuntu', tint: '#E95420' };
  if (raw.includes('debian')) return { osName: 'debian', tint: '#D70A53' };
  if (raw.includes('arch')) return { osName: 'arch', tint: '#1793D1' };
  if (raw.includes('fedora')) return { osName: 'fedora', tint: '#51A2DA' };
  if (raw.includes('centos') || raw.includes('rhel') || raw.includes('rocky') || raw.includes('alma')) return { osName: 'linux', tint: '#8B5CF6' };
  if (raw.includes('opensuse') || raw.includes('suse')) return { osName: 'linux', tint: '#73BA25' };
  if (raw.includes('alpine')) return { osName: 'linux', tint: '#2D9CDB' };
  if (raw.includes('nixos')) return { osName: 'linux', tint: '#7EBAE4' };

  return { osName: 'linux', tint: '#D5D9E0' };
}

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
  const prevInputLength = useRef(inputValue.length);

  const activeConnection = useMemo(
    () => sshConnections.find(c => c.config_id === activeConfigId),
    [sshConnections, activeConfigId]
  );

  const normalizePath = (path: string, isSSH: boolean) => {
    let p = (path || '').trim();
    if (!isSSH) {
      if (/^\/[A-Z]:/i.test(p)) p = p.substring(1);
      if (/^[A-Z]:$/i.test(p)) p += '\\';
    }
    return p || (isSSH ? '/' : '.');
  };

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

        let rawEntries: any[] = [];
        if (Array.isArray(localItems)) {
          rawEntries = localItems;
        } else if (localItems && typeof localItems === 'object') {
          rawEntries =
            localItems.children ||
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
            const isDir =
              e.type === 'directory' || e.is_dir === true || e.isDir === true ||
              !!e.children || (e.path && !e.path.includes('.'));

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
      setInputValue(targetPath);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleContextSwitch = (configId: string | undefined) => {
    if (configId === activeConfigId) return;
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
        prevInputLength.current = path.length;
        fetchItems(path, activeConfigId);
        
        // Auto-select text for rapid path replacement
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }, 50);
      }
    } else {
      hasOpenedRef.current = false;
    }
  }, [isOpen, initialPath, fetchItems, activeConfigId, items.length]);

  // Keep selected item in view
  useEffect(() => {
    if (!listRef.current) return;
    const targetEl = listRef.current.querySelector(
      `[data-select-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (targetEl) {
      targetEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, items.length]);

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

  const { filteredItems, searchTerm } = useMemo(() => {
    const trimmed = inputValue;
    if (!trimmed || trimmed === currentPath) return { filteredItems: items, searchTerm: '' };

    let search = '';
    const normalizedTrimmed = trimmed.replace(/\\/g, '/').toLowerCase();
    const normalizedCurrent = currentPath.replace(/\\/g, '/').toLowerCase();

    if (normalizedTrimmed.startsWith(normalizedCurrent) && trimmed.length >= currentPath.length) {
      search = trimmed.slice(currentPath.length);
      if (search.startsWith('\\') || search.startsWith('/')) search = search.slice(1);
    } else if (!trimmed.includes('\\') && !trimmed.includes('/')) {
      search = trimmed;
    }

    if (search) {
      return {
        filteredItems: items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())),
        searchTerm: search,
      };
    }
    return { filteredItems: items, searchTerm: '' };
  }, [items, inputValue, currentPath]);

  // Auto-fetch on trailing slash addition
  useEffect(() => {
    const trimmed = inputValue;
    const isAdding = trimmed.length > prevInputLength.current;
    prevInputLength.current = trimmed.length;

    if (isAdding && trimmed !== currentPath && (trimmed.endsWith('\\') || trimmed.endsWith('/'))) {
      const looksLikePath = trimmed.includes('\\') || trimmed.includes('/') || /^[A-Z]:/i.test(trimmed);
      if (looksLikePath || /^[A-Z]:\\$/i.test(trimmed)) {
        fetchItems(trimmed, activeConfigId);
      }
    }
  }, [inputValue, currentPath, fetchItems, activeConfigId]);

  useEffect(() => {
    if (searchTerm && filteredItems.length > 0) setSelectedIndex(1);
    else if (searchTerm && filteredItems.length === 0) setSelectedIndex(0);
  }, [searchTerm, filteredItems.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(filteredItems.length, selectedIndex + (e.shiftKey ? 10 : 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(0, selectedIndex - (e.shiftKey ? 10 : 1)));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) handleItemSelect('..');
      else if (selectedIndex > 0 && filteredItems[selectedIndex - 1]) handleItemSelect(filteredItems[selectedIndex - 1]);
      else handleItemSelect('..');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) {
        handleConfirm();
      } else {
        const trimmed = inputValue.trim();
        if (selectedIndex > 0 && filteredItems[selectedIndex - 1]) {
          handleItemSelect(filteredItems[selectedIndex - 1]);
          return;
        } else if (selectedIndex === 0 && !searchTerm && trimmed === currentPath) {
          handleItemSelect('..');
          return;
        }

        const hasTrailingSlash = trimmed.endsWith('\\') || trimmed.endsWith('/');
        const looksLikePath = trimmed.includes('\\') || trimmed.includes('/') || /^[A-Z]:/i.test(trimmed);

        if (hasTrailingSlash && (looksLikePath || /^[A-Z]:$/i.test(trimmed))) fetchItems(trimmed.slice(0, -1), activeConfigId);
        else if (looksLikePath) fetchItems(trimmed, activeConfigId);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const listKey = `${activeConfigId || 'local'}::${currentPath}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: easeOut }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] bg-black/50 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, y: -4, filter: 'blur(4px)' }}
            transition={{ duration: 0.22, ease: easeSnap }}
            className="
              relative w-full max-w-[640px] overflow-hidden rounded-[14px]
              border border-white/[0.08] bg-[#0A0A0A]
              shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_48px_-12px_rgba(0,0,0,0.8),0_12px_24px_-8px_rgba(0,0,0,0.6)]
            "
            onClick={e => e.stopPropagation()}
          >
            {/* Ambient top highlight */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.05] bg-[#000000]">
              <div className="flex p-1 bg-white/[0.04] border border-white/[0.04] rounded-[8px] relative shadow-[0_1px_2px_rgba(0,0,0,0.5)_inset]">
                <button
                  onClick={() => handleContextSwitch(undefined)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-medium transition-colors duration-150 z-10 ${
                    !activeConfigId ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {!activeConfigId && (
                    <motion.div
                      layoutId="active-tab"
                      className="
                        absolute inset-0 rounded-[5px]
                        bg-gradient-to-b from-white/[0.1] to-white/[0.05]
                        border border-white/[0.06] border-t-white/[0.12]
                        shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_2px_4px_rgba(0,0,0,0.4)]
                      "
                      transition={{ type: 'spring', bounce: 0.16, duration: 0.4 }}
                    />
                  )}
                  <HardDrive size={13} className="relative z-10 opacity-80" />
                  <span className="relative z-10">Local</span>
                </button>

                {sshConnections.map(conn => {
                  const isActive = activeConfigId === conn.config_id;
                  const linux = getLinuxVisuals(conn);

                  return (
                    <button
                      key={conn.config_id}
                      onClick={() => handleContextSwitch(conn.config_id)}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-medium transition-colors duration-150 z-10 ${
                        isActive ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-tab"
                          className="
                            absolute inset-0 rounded-[5px]
                            bg-gradient-to-b from-white/[0.1] to-white/[0.05]
                            border border-white/[0.06] border-t-white/[0.12]
                            shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_2px_4px_rgba(0,0,0,0.4)]
                          "
                          transition={{ type: 'spring', bounce: 0.16, duration: 0.4 }}
                        />
                      )}

                      <div className="relative z-10 flex items-center justify-center">
                        <OsIcon 
                          os={linux.osName as any} 
                          size={13} 
                          className="transition-all duration-200"
                          style={{ 
                            color: linux.tint, 
                            opacity: isActive ? 1 : 0.7,
                            filter: isActive ? `drop-shadow(0 0 6px ${linux.tint}40)` : 'none'
                          }} 
                        />
                      </div>

                      <span className="relative z-10">{conn.server_name}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {activeConnection && (
                  <motion.div
                    key={activeConnection.config_id}
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 4 }}
                    transition={{ duration: 0.14 }}
                    className="flex items-center gap-1.5 rounded-[6px] border border-emerald-500/[0.14] bg-emerald-500/[0.06] px-2 py-1"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-300/90">
                      SSH
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Container */}
            <div className="p-3 border-b border-white/[0.05] bg-[#0A0A0A]">
              <div
                className="
                  group flex items-center gap-2.5 px-3 py-2.5
                  bg-[#000000] border border-white/[0.06] 
                  focus-within:border-white/[0.15] focus-within:bg-[#050505]
                  rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.5)_inset]
                  transition-all duration-200
                "
              >
                <div className="flex shrink-0 items-center justify-center text-neutral-500 group-focus-within:text-neutral-400 transition-colors">
                  {loading ? (
                    <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                  ) : (
                    <Search size={16} strokeWidth={2.5} />
                  )}
                </div>

                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="
                    flex-1 bg-transparent border-none outline-none
                    text-[14px] font-medium tracking-tight text-neutral-100
                    placeholder:text-neutral-600
                  "
                  placeholder="Search directories or enter path..."
                  spellCheck={false}
                  autoComplete="off"
                />

                <motion.button
                  onClick={handleConfirm}
                  whileTap={{ scale: 0.96 }}
                  className="
                    flex items-center gap-1.5 rounded-[6px] px-2.5 py-1
                    bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.04]
                    text-[11px] font-semibold text-white
                    transition-colors duration-150 shrink-0
                  "
                >
                  <span className="opacity-90">Open</span>
                  <Command size={10} className="opacity-50" />
                  <span className="font-sans text-[10px] font-medium opacity-50 -ml-0.5">↵</span>
                </motion.button>
              </div>
            </div>

            {/* List area */}
            <div className="flex flex-col min-h-[300px] max-h-[45vh] bg-[#0A0A0A]">
              <div className="px-4 py-2 flex items-center justify-between">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={listKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                      {activeConnection ? activeConnection.server_name : 'Local Machine'}
                    </span>
                    <span className="text-[10px] text-neutral-700">•</span>
                    <span className="text-[10px] font-medium text-neutral-500">
                      {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                    </span>
                    {searchTerm && (
                      <>
                        <span className="text-[10px] text-neutral-700">•</span>
                        <span className="text-[10px] font-medium text-neutral-400">
                          “{searchTerm}”
                        </span>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div ref={listRef} className="relative flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-1 my-1 flex items-start gap-3 rounded-[8px] border border-red-500/[0.15] bg-red-500/[0.08] p-3 text-red-400">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span className="text-[12px] font-medium leading-relaxed">{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Parent */}
                <div
                  data-select-index={0}
                  onMouseEnter={() => setSelectedIndex(0)}
                  onClick={() => handleItemSelect('..')}
                  className={`
                    relative mx-1 mt-0.5 mb-1 flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 scroll-my-1
                    transition-colors duration-100
                    ${selectedIndex === 0 ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'}
                  `}
                >
                  {selectedIndex === 0 && (
                    <motion.div
                      layoutId="row-highlight"
                      className="
                        absolute inset-0 rounded-[8px]
                        bg-white/[0.06] border border-white/[0.04]
                        shadow-[0_1px_2px_rgba(0,0,0,0.2)]
                      "
                      transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                    />
                  )}
                  <CornerLeftUp
                    size={15}
                    strokeWidth={2.5}
                    className={`relative z-10 ${selectedIndex === 0 ? 'text-white' : 'text-neutral-500'}`}
                  />
                  <span className="relative z-10 text-[13px] font-medium">..</span>
                  <span className="relative z-10 ml-auto text-[10px] font-medium text-neutral-600">parent</span>
                </div>

                {/* Items (Instant render, no stagger for immediate search feel) */}
                {filteredItems.map((item, idx) => {
                  const index = idx + 1;
                  const isSelected = selectedIndex === index;

                  return (
                    <div
                      key={item.path}
                      data-select-index={index}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => handleItemSelect(item)}
                      className={`
                        relative mx-1 flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 scroll-my-1
                        ${isSelected ? 'text-white' : 'text-neutral-300'}
                      `}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="row-highlight"
                          className="
                            absolute inset-0 rounded-[8px]
                            bg-white/[0.06] border border-white/[0.04]
                            shadow-[0_1px_2px_rgba(0,0,0,0.2)]
                          "
                          transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                        />
                      )}

                      <DirectoryIcon selected={isSelected} className="relative z-10 shrink-0" />

                      <span className={`relative z-10 flex-1 truncate text-[13px] ${isSelected ? 'font-medium' : ''}`}>
                        {item.name}
                      </span>
                    </div>
                  );
                })}

                {!loading && filteredItems.length === 0 && !error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className="flex flex-col items-center justify-center py-16 text-neutral-500"
                  >
                    <div className="relative mb-3">
                      <DirectoryIcon className="h-8 w-8 opacity-20" />
                      <div className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#0A0A0A] bg-neutral-800">
                        <Search size={9} strokeWidth={3} className="text-neutral-400" />
                      </div>
                    </div>
                    <p className="text-[13px] font-medium">No results</p>
                    {searchTerm && (
                      <p className="mt-1 text-[11px] text-neutral-600">Try a different search term</p>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#000000] px-4 py-2.5 text-[11px] font-medium text-neutral-500">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <span className="ml-0.5">Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Kbd>⇥</Kbd>
                  <span>Complete</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Kbd>↵</Kbd>
                  <span>Browse</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Kbd>esc</Kbd>
                <span>Close</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}