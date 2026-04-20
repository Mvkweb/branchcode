import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MoreHorizontal, 
  Play, 
  GitCommit, 
  ChevronDown, 
  TerminalSquare, 
  Copy, 
  Columns,
  Layout,
  FolderOpen
} from 'lucide-react';
import type { GitStatus } from '../lib/tauri';
import { DirectoryPickerModal } from './DirectoryPickerModal';

interface TopBarProps {
  title: string;
  folderName?: string;
  projectDir?: string;
  sshConnections?: any[];
  onTitleChange: (newTitle: string) => void;
  gitStatus: GitStatus | null;
}

export function TopBar({ 
  title, 
  folderName, 
  projectDir, 
  sshConnections = [], 
  onTitleChange, 
  gitStatus 
}: TopBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempTitle.trim() && tempTitle !== title) {
      onTitleChange(tempTitle.trim());
    } else {
      setTempTitle(title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setTempTitle(title);
      setIsEditing(false);
    }
  };

  let additions = 0;
  let deletions = 0;

  if (gitStatus) {
    const allFiles = [
      ...gitStatus.staged,
      ...gitStatus.modified,
      ...gitStatus.untracked,
    ];
    allFiles.forEach(f => {
      additions += f.additions || 0;
      deletions += f.deletions || 0;
    });
  }

  const iconBtnClass = "text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-all rounded-md p-1 flex items-center justify-center";
  const groupBtnClass = "flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] transition-colors cursor-pointer";

  return (
    <>
      <div className="flex-shrink-0 h-[44px] w-full flex items-center justify-between px-4 border-b border-white/5 bg-[#0e0e0e] z-20 select-none">
        
        {/* Left side: Title, Folder Name & Options */}
        <div className="flex items-center gap-3 flex-1 min-w-0 h-full">
          <div className="flex items-center gap-2 max-w-[60%]">
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div
                  key="input-container"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative flex items-center min-w-[150px]"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={tempTitle}
                    onChange={e => setTempTitle(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none outline-none text-[13px] text-neutral-100 font-medium w-full py-0.5 placeholder-neutral-600 m-0"
                    placeholder="Session Title..."
                  />
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    exit={{ scaleX: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ originX: 0 }}
                    className="absolute -bottom-[1px] left-0 right-0 h-[1px] bg-neutral-400/60"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="text-display"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 truncate py-0.5"
                >
                  <span 
                    onClick={() => setIsEditing(true)}
                    className="text-[13px] text-neutral-200 hover:text-neutral-100 transition-colors cursor-text font-medium truncate relative group"
                    title="Click to rename"
                  >
                    {title}
                    <div className="absolute -bottom-[1px] left-0 right-0 h-[1px] bg-white/10 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-200" />
                  </span>
                  {folderName && (
                    <span className="text-[13px] text-neutral-500 font-normal truncate cursor-default">
                      {folderName}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isEditing && (
            <button className="text-neutral-500 hover:text-neutral-300 transition-colors flex items-center justify-center ml-1">
              <MoreHorizontal size={16} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Right side: Tool actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button 
            onClick={() => setIsPickerOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] transition-colors cursor-pointer mr-1"
          >
            <FolderOpen size={14} className="text-neutral-400" />
            <span className="text-[12px] font-medium text-neutral-300">Open</span>
            <ChevronDown size={12} className="text-neutral-500" />
          </button>

          <button className={iconBtnClass} title="Run">
            <Play size={15} strokeWidth={2} />
          </button>

          <div className={groupBtnClass}>
            <Layout size={14} className="text-neutral-400" />
            <ChevronDown size={12} className="text-neutral-500" />
          </div>

          <div className={groupBtnClass}>
            <GitCommit size={14} className="text-neutral-400" />
            <span className="text-[12px] font-medium text-neutral-300">Commit</span>
            <ChevronDown size={12} className="text-neutral-500" />
          </div>

          <div className="w-[1px] h-[14px] bg-white/10 mx-0.5" />

          <button className={iconBtnClass}>
            <TerminalSquare size={15} strokeWidth={1.5} />
          </button>

          <button className={iconBtnClass}>
            <Copy size={15} strokeWidth={1.5} />
          </button>

          <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-white/5 bg-[#181818] hover:bg-[#202020] cursor-pointer transition-colors ml-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono tracking-wider font-semibold">
              <span className="text-[#4ade80]">+{additions}</span>
              <span className="text-[#f87171]">-{deletions}</span>
            </div>
            <Columns size={13} className="text-neutral-500" strokeWidth={2} />
          </div>
        </div>
      </div>

      <DirectoryPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        initialPath={projectDir}
        sshConnections={sshConnections}
        onSelect={(path, configId) => {
          console.log('Selected path:', path, 'on config:', configId);
        }}
      />
    </>
  );
}
