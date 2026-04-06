import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitBranch,
  GitCommit,
  ChevronRight,
  Plus,
  Check,
  X,
  Loader2,
  FileEdit,
  FilePlus,
  FileX,
  ArrowLeftRight,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import type { GitStatus, GitFile, GitBranch as GitBranchType } from '../lib/tauri';

interface GitPanelProps {
  status: GitStatus | null;
  branches: GitBranchType[];
  currentBranch: string;
  loading: boolean;
  onRefresh: () => void;
  onStageFile: (path: string) => void;
  onUnstageFile: (path: string) => void;
  onStageAll: () => void;
  onCommit: (message: string) => void;
  onCheckoutBranch: (name: string) => void;
  onCreateBranch: (name: string) => void;
}

// Slightly muted but legible colors for dark mode
const statusIcons: Record<string, React.ReactNode> = {
  M: <FileEdit size={14} className="text-amber-400/80" />,
  A: <FilePlus size={14} className="text-emerald-400/80" />,
  D: <FileX size={14} className="text-rose-400/80" />,
  R: <ArrowLeftRight size={14} className="text-indigo-400/80" />,
  '?': <FilePlus size={14} className="text-neutral-500" />,
};

// Fast, snappy transition for UI elements
const fastTransition = { duration: 0.15, ease: "easeOut" };
const springTransition = { type: "spring", bounce: 0, duration: 0.3 };

function FileRow({
  file,
  isStaged,
  onAction,
}: {
  file: GitFile;
  isStaged: boolean;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);

  const handleClick = async () => {
    if (!expanded && !diff) {
      setLoadingDiff(true);
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<{ diff: string }>('get_git_diff', {
          filePath: file.path,
        });
        setDiff(result.diff);
      } catch (e) {
        console.error('Failed to load diff:', e);
      } finally {
        setLoadingDiff(false);
      }
    }
    setExpanded(!expanded);
  };

  const fileName = file.path.split('/').pop() || file.path;
  const dirPath = file.path.includes('/')
    ? file.path.slice(0, file.path.lastIndexOf('/'))
    : '';

  return (
    <div className="border-b border-white/[0.04] last:border-none">
      <div
        className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-white/[0.04] cursor-pointer transition-colors group"
        onClick={handleClick}
      >
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={fastTransition}
          className="text-neutral-500 group-hover:text-neutral-300 flex-shrink-0"
        >
          <ChevronRight size={14} />
        </motion.div>
        
        <div className="flex-shrink-0">{statusIcons[file.status] || statusIcons['?']}</div>
        
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className="text-[12px] font-medium text-neutral-300 truncate">{fileName}</span>
          {dirPath && (
            <span className="text-[11px] text-neutral-600 truncate">{dirPath}</span>
          )}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all duration-150 flex-shrink-0"
        >
          {isStaged ? (
            <X size={14} className="text-neutral-400 hover:text-rose-400" />
          ) : (
            <Plus size={14} className="text-neutral-400 hover:text-emerald-400" />
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springTransition}
            className="overflow-hidden bg-black/20"
          >
            <div className="px-3 pb-3 pt-1">
              <div className="bg-[#0c0c0c] border border-white/5 rounded-md p-2 shadow-inner">
                {loadingDiff ? (
                  <div className="flex items-center gap-2 text-neutral-500 text-[11px] py-1">
                    <Loader2 size={12} className="animate-spin" />
                    Fetching diff...
                  </div>
                ) : diff ? (
                  <pre className="text-[11px] leading-relaxed font-mono text-neutral-400 whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto custom-scrollbar">
                    {diff}
                  </pre>
                ) : (
                  <div className="text-[11px] text-neutral-600 py-1">
                    No displayable changes
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BranchSelector({
  currentBranch,
  branches,
  onCheckout,
  onCreate,
}: {
  currentBranch: string;
  branches: GitBranchType[];
  onCheckout: (name: string) => void;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const localBranches = branches.filter((b) => !b.is_remote);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.05] rounded-md hover:bg-white/[0.04] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-neutral-500 group-hover:text-neutral-400 transition-colors" />
          <span className="text-[12px] font-medium text-neutral-200 truncate">{currentBranch || 'main'}</span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={fastTransition}>
          <ChevronRight size={14} className="text-neutral-500 rotate-90" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={fastTransition}
            className="absolute top-full left-0 right-0 mt-1.5 bg-[#121212] border border-white/10 rounded-md shadow-2xl shadow-black z-50 overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
              {localBranches.map((branch) => (
                <button
                  key={branch.name}
                  onClick={() => {
                    onCheckout(branch.name);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left rounded transition-colors ${
                    branch.is_current ? 'bg-white/10 text-neutral-100' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                  }`}
                >
                  <GitBranch size={13} className={branch.is_current ? "text-neutral-300" : "text-neutral-500"} />
                  <span className="text-[12px]">{branch.name}</span>
                  {branch.is_current && (
                    <Check size={13} className="ml-auto text-emerald-500" />
                  )}
                </button>
              ))}
            </div>

            <div className="border-t border-white/[0.06] p-1 bg-black/20">
              {showCreate ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    placeholder="Branch name..."
                    autoFocus
                    className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[11px] text-neutral-200 placeholder-neutral-600 outline-none focus:border-white/20 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newBranch.trim()) {
                        onCreate(newBranch.trim());
                        setNewBranch('');
                        setShowCreate(false);
                      }
                      if (e.key === 'Escape') {
                        setShowCreate(false);
                        setNewBranch('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newBranch.trim()) {
                        onCreate(newBranch.trim());
                        setNewBranch('');
                        setShowCreate(false);
                      }
                    }}
                    className="px-2 bg-white/5 rounded hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <Plus size={13} className="text-neutral-300" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded transition-colors"
                >
                  <Plus size={12} />
                  Create Branch
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommitForm({
  onCommit,
  onStageAll,
  disabled,
}: {
  onCommit: (msg: string) => void;
  onStageAll: () => void;
  disabled: boolean;
}) {
  const [message, setMessage] = useState('');
  const [committing, setCommitting] = useState(false);

  const handleCommit = async () => {
    if (!message.trim() || committing) return;
    setCommitting(true);
    try {
      await onCommit(message.trim());
      setMessage('');
    } catch (e) {
      console.error('Commit failed:', e);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="border-t border-white/[0.04] p-3 space-y-2.5 bg-[#080808]">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Commit message..."
        disabled={disabled || committing}
        className="w-full bg-black/40 border border-white/[0.08] rounded-md px-3 py-1.5 text-[12px] text-neutral-200 placeholder-neutral-600 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all disabled:opacity-50"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommit();
          }
        }}
      />
      <div className="flex gap-2">
        <button
          onClick={onStageAll}
          disabled={disabled || committing}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-md text-[11px] font-medium text-neutral-400 hover:text-neutral-200 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus size={12} />
          Stage All
        </button>
        <button
          onClick={handleCommit}
          disabled={disabled || !message.trim() || committing}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-200 hover:bg-white rounded-md text-[11px] text-black font-medium transition-colors disabled:opacity-50 disabled:bg-white/10 disabled:text-neutral-500 disabled:pointer-events-none"
        >
          {committing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <GitCommit size={12} />
          )}
          Commit
        </button>
      </div>
    </div>
  );
}

export const GitPanel = memo(function GitPanel({
  status,
  branches,
  currentBranch,
  loading,
  onRefresh,
  onStageFile,
  onUnstageFile,
  onStageAll,
  onCommit,
  onCheckoutBranch,
  onCreateBranch,
}: GitPanelProps) {
  const [activeTab, setActiveTab] = useState<'changes' | 'branches'>('changes');

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4 bg-transparent">
        <AlertCircle size={28} className="mb-3 opacity-40" />
        <p className="text-[12px] font-medium text-neutral-300">No Git Repository</p>
        <p className="text-[11px] text-neutral-600 mt-1 text-center max-w-[200px]">Initialize git in your workspace to enable source control features.</p>
      </div>
    );
  }

  const totalChanges = status.staged.length + status.modified.length + status.untracked.length;

  return (
    <div className="flex flex-col h-full bg-transparent text-neutral-200 selection:bg-white/20">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-neutral-500" />
          <span className="text-[12px] font-semibold tracking-wide text-neutral-300 uppercase">Source Control</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <motion.div animate={{ rotate: loading ? 360 : 0 }} transition={loading ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }}>
             <LoaderCircle size={13} className="text-neutral-500" />
          </motion.div>
        </button>
      </div>

      {/* Branch & Tabs Section */}
      <div className="px-3 py-2 border-b border-white/[0.04] space-y-2">
        <BranchSelector
          currentBranch={currentBranch}
          branches={branches}
          onCheckout={onCheckoutBranch}
          onCreate={onCreateBranch}
        />

        {/* Segmented Control / Tabs */}
        <div className="flex p-0.5 bg-black/40 rounded-md border border-white/5 relative">
          <button
            onClick={() => setActiveTab('changes')}
            className={`relative flex-1 px-3 py-1 text-[11px] font-medium rounded transition-colors z-10 ${
              activeTab === 'changes' ? 'text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Changes <span className="ml-1 opacity-50">({totalChanges})</span>
            {activeTab === 'changes' && (
               <motion.div layoutId="tab-indicator" className="absolute inset-0 bg-[#222] rounded shadow-sm -z-10" transition={fastTransition} />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('branches')}
            className={`relative flex-1 px-3 py-1 text-[11px] font-medium rounded transition-colors z-10 ${
              activeTab === 'branches' ? 'text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Branches <span className="ml-1 opacity-50">({branches.filter((b) => !b.is_remote).length})</span>
            {activeTab === 'branches' && (
               <motion.div layoutId="tab-indicator" className="absolute inset-0 bg-[#222] rounded shadow-sm -z-10" transition={fastTransition} />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={fastTransition}
            className="h-full"
          >
            {activeTab === 'changes' ? (
              <div className="pb-2">
                
                {/* Staged */}
                {status.staged.length > 0 && (
                  <div className="mb-2">
                    <div className="sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10 px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/[0.04]">
                      <Check size={11} className="text-emerald-500/80" />
                      Staged Changes
                    </div>
                    {status.staged.map((file) => (
                      <FileRow key={`staged-${file.path}`} file={file} isStaged={true} onAction={() => onUnstageFile(file.path)} />
                    ))}
                  </div>
                )}

                {/* Modified */}
                {status.modified.length > 0 && (
                  <div className="mb-2">
                    <div className="sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10 px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/[0.04]">
                      <FileEdit size={11} className="text-amber-500/80" />
                      Working Changes
                    </div>
                    {status.modified.map((file) => (
                      <FileRow key={`modified-${file.path}`} file={file} isStaged={false} onAction={() => onStageFile(file.path)} />
                    ))}
                  </div>
                )}

                {/* Untracked */}
                {status.untracked.length > 0 && (
                  <div className="mb-2">
                    <div className="sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10 px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/[0.04]">
                      <FilePlus size={11} className="text-neutral-500" />
                      Untracked
                    </div>
                    {status.untracked.map((file) => (
                      <FileRow key={`untracked-${file.path}`} file={file} isStaged={false} onAction={() => onStageFile(file.path)} />
                    ))}
                  </div>
                )}

                {totalChanges === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-48 text-neutral-500">
                    <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-3">
                      <Check size={16} className="text-emerald-500/60" />
                    </div>
                    <p className="text-[12px] font-medium text-neutral-400">Working tree clean</p>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {branches
                  .filter((b) => !b.is_remote)
                  .map((branch) => (
                    <button
                      key={branch.name}
                      onClick={() => onCheckoutBranch(branch.name)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-left transition-colors group ${
                        branch.is_current ? 'bg-white/10 text-neutral-100' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200'
                      }`}
                    >
                      <GitBranch size={13} className={branch.is_current ? "text-neutral-300" : "text-neutral-600 group-hover:text-neutral-400 transition-colors"} />
                      <span className="text-[12px]">{branch.name}</span>
                      {branch.is_current && (
                        <Check size={13} className="ml-auto text-emerald-500/80" />
                      )}
                    </button>
                  ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sticky Commit Form */}
      <div className="mt-auto">
         <CommitForm onCommit={onCommit} onStageAll={onStageAll} disabled={totalChanges === 0} />
      </div>
    </div>
  );
});