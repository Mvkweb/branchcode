import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  Plus,
  Check,
  X,
  Loader2,
  FileEdit,
  FilePlus,
  FileX,
  ArrowLeftRight,
  AlertCircle,
  ListTodo,
  Undo2,
  ArrowRight,
  Upload,
  MoreHorizontal,
  CircleDot,
  Folder,
  SquareTerminal,
} from 'lucide-react';
import type { GitStatus, GitFile, GitBranch as GitBranchType } from '../lib/tauri';
import { DiffViewer } from './DiffViewer';
import { TerminalPanel } from './TerminalPanel';

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

// Minimalist status icons
const statusIcons: Record<string, React.ReactNode> = {
  M: <FileEdit size={13} className="text-amber-500/90" />,
  A: <FilePlus size={13} className="text-emerald-500/90" />,
  D: <FileX size={13} className="text-rose-500/90" />,
  R: <ArrowLeftRight size={13} className="text-indigo-500/90" />,
  '?': <FilePlus size={13} className="text-neutral-500" />,
};

// Smooth UI transitions
const fastTransition = { duration: 0.15 };
const springTransition = { type: 'spring', bounce: 0, duration: 0.3 } as const;

type DockTab = 'explorer' | 'todo' | 'git' | 'terminal';

const dockItems: { id: DockTab; icon: React.ReactNode; label: string }[] = [
  // Updated to IntelliJ-style Folder
  { id: 'explorer', icon: <Folder size={18} strokeWidth={1.75} />, label: 'File Tree' },
  { id: 'todo', icon: <ListTodo size={18} strokeWidth={1.75} />, label: 'Todo List' },
  { id: 'git', icon: <GitBranch size={18} strokeWidth={1.75} />, label: 'Source Control' },
  // Updated to IntelliJ-style Terminal Monitor
  { id: 'terminal', icon: <SquareTerminal size={18} strokeWidth={1.75} />, label: 'Terminal' },
];

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
        // Safe dynamic import for Tauri
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
  
  return (
    <div className="flex flex-col">
      <div
        className="flex items-center gap-2 px-3 py-[6px] hover:bg-white/[0.03] cursor-pointer transition-colors group"
        onClick={handleClick}
      >
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={fastTransition}
          className="text-neutral-500 flex-shrink-0"
        >
          <ChevronRight size={14} />
        </motion.div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[13px] text-neutral-300 font-mono tracking-tight truncate">
            {fileName}
          </span>
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
            className="overflow-hidden bg-transparent"
          >
            <div className="px-3 pb-3 pt-1">
              <div className="bg-[#0c0c0c] border border-white/5 rounded-md p-2 shadow-inner">
                {loadingDiff ? (
                  <div className="flex items-center gap-2 text-neutral-500 text-[11px] py-1">
                    <Loader2 size={12} className="animate-spin" />
                    Fetching diff...
                  </div>
                ) : diff ? (
                  <div className="-mx-2 -mb-2 mt-2 border-t border-white/5">
                    <DiffViewer diff={diff} maxLines={0} maxHeightClass="max-h-[300px]" />
                  </div>
                ) : (
                  <div className="text-[11px] text-neutral-600 py-1">
                    No displayable changes
                  </div>
                )}
                
                {/* Visual detail from screenshot */}
                <button className="mt-2 w-full flex items-center justify-center py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] rounded text-[11px] text-neutral-500 transition-colors">
                  <ChevronDown size={12} className="mr-1.5" />
                  4 unmodified lines
                </button>
              </div>
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
    <div className="border-t border-white/[0.04] p-3 space-y-2.5 bg-[#0a0a0a] relative z-20">
      {/* Revert / Stage Actions */}
      <div className="flex gap-2.5">
        <button
          disabled={disabled || committing}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-white/[0.04] rounded-[6px] text-[12px] font-medium text-neutral-300 hover:text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <Undo2 size={13} className="text-neutral-500" />
          Revert all
        </button>
        <button
          onClick={onStageAll}
          disabled={disabled || committing}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0b291a] hover:bg-[#0e3b25] border border-[#165032] rounded-[6px] text-[12px] font-medium text-[#4ade80] hover:text-[#86efac] transition-all disabled:opacity-40 disabled:pointer-events-none shadow-[0_0_12px_rgba(74,222,128,0.05)]"
        >
          <Plus size={13} strokeWidth={2.5} />
          Stage all
        </button>
      </div>

      {/* Commit Input */}
      <div className="relative flex items-center bg-[#141414] border border-white/[0.06] rounded-[6px] focus-within:border-white/20 focus-within:bg-[#1a1a1a] transition-all h-[36px] overflow-hidden">
        <div className="pl-3 pr-2 text-neutral-600 flex items-center">
          <ArrowRight size={13} strokeWidth={2} />
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a commit message ."
          disabled={disabled || committing}
          className="flex-1 bg-transparent text-[12px] text-neutral-200 placeholder-neutral-600 outline-none h-full"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleCommit();
            }
          }}
        />
        <div className="pr-1 flex items-center h-full py-1">
          <button
            onClick={handleCommit}
            disabled={disabled || !message.trim() || committing}
            className="flex items-center gap-1.5 px-3 h-full rounded text-[12px] font-medium text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {committing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Push
          </button>
        </div>
      </div>
    </div>
  );
}

function TabPlaceholder({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full text-neutral-500 p-6"
    >
      <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4 text-neutral-400">
        {icon}
      </div>
      <p className="text-[13px] font-medium text-neutral-200">{title}</p>
      <p className="text-[11.5px] text-neutral-500 mt-1.5 text-center leading-relaxed max-w-[220px]">
        This module is actively being developed.
      </p>
    </motion.div>
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
}: GitPanelProps) {
  const [activeDockTab, setActiveDockTab] = useState<DockTab>('git');
  const [activeGitTab, setActiveGitTab] = useState<'unstaged' | 'staged'>('unstaged');

  const unstagedChanges = status ? status.modified.length + status.untracked.length : 0;
  const stagedChanges = status ? status.staged.length : 0;
  const totalChanges = unstagedChanges + stagedChanges;

  return (
    <div className="flex h-full w-full bg-[#0a0a0a]">
      {/* ── Main Left Panel Content ── */}
      <div className="flex-1 flex flex-col min-w-0 text-neutral-200 selection:bg-white/20 border-r border-white/[0.04]">
        
        {activeDockTab === 'git' ? (
          !status ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 p-4">
              <AlertCircle size={28} className="mb-3 opacity-40" />
              <p className="text-[12px] font-medium text-neutral-300">No Git Repository</p>
              <p className="text-[11px] text-neutral-600 mt-1 text-center max-w-[200px]">
                Initialize git in your workspace to enable source control features.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1">
                    <MoreHorizontal size={14} />
                  </button>
                  <button
                    className="flex items-center gap-2 text-neutral-300 hover:text-white transition-colors"
                    onClick={onRefresh}
                  >
                    <span className="text-[12.5px] font-medium tracking-wide">Uncommitted changes</span>
                    {loading ? (
                      <Loader2 size={13} className="text-neutral-500 animate-spin" />
                    ) : (
                      <ChevronDown size={14} className="text-neutral-500" />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-white/[0.03] border border-white/[0.05] text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200 transition-colors cursor-pointer group">
                  <GitBranch size={12} className="text-neutral-500 group-hover:text-neutral-400" />
                  <span className="text-[11px] font-mono tracking-wide">{currentBranch || 'master'}</span>
                </div>
              </div>

              {/* Segmented Control / Tabs */}
              <div className="px-3 pt-3 pb-2">
                <div className="flex p-[3px] bg-[#111] rounded-[8px] border border-white/[0.04] relative shadow-inner">
                  <button
                    onClick={() => setActiveGitTab('unstaged')}
                    className={`relative flex-1 px-3 py-1.5 text-[12px] font-medium rounded-[5px] transition-colors z-10 ${
                      activeGitTab === 'unstaged'
                        ? 'text-neutral-100'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Unstaged <span className="ml-1 opacity-50 font-mono text-[11px]">{unstagedChanges}</span>
                    {activeGitTab === 'unstaged' && (
                      <motion.div
                        layoutId="git-tab-indicator"
                        className="absolute inset-0 bg-[#222] border border-white/[0.04] rounded-[5px] shadow-sm -z-10"
                        transition={fastTransition}
                      />
                    )}
                  </button>

                  <button
                    onClick={() => setActiveGitTab('staged')}
                    className={`relative flex-1 px-3 py-1.5 text-[12px] font-medium rounded-[5px] transition-colors z-10 ${
                      activeGitTab === 'staged'
                        ? 'text-neutral-100'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Staged
                    {activeGitTab === 'staged' && (
                      <motion.div
                        layoutId="git-tab-indicator"
                        className="absolute inset-0 bg-[#222] border border-white/[0.04] rounded-[5px] shadow-sm -z-10"
                        transition={fastTransition}
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Content List */}
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeGitTab}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={fastTransition}
                    className="flex-1"
                  >
                    {activeGitTab === 'unstaged' ? (
                      <div className="pb-4">
                        {(status.modified.length > 0 || status.untracked.length > 0) ? (
                          <>
                            {status.modified.map((file) => (
                              <FileRow
                                key={`modified-${file.path}`}
                                file={file}
                                isStaged={false}
                                onAction={() => onStageFile(file.path)}
                              />
                            ))}
                            {status.untracked.map((file) => (
                              <FileRow
                                key={`untracked-${file.path}`}
                                file={file}
                                isStaged={false}
                                onAction={() => onStageFile(file.path)}
                              />
                            ))}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
                            <p className="text-[12px] font-medium text-neutral-400">
                              No unstaged changes
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pb-4">
                        {status.staged.length > 0 ? (
                          status.staged.map((file) => (
                            <FileRow
                              key={`staged-${file.path}`}
                              file={file}
                              isStaged={true}
                              onAction={() => onUnstageFile(file.path)}
                            />
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
                            <p className="text-[12px] font-medium text-neutral-400">
                              No staged changes
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Screenshot Detail: Recent Commits Section */}
                    {activeGitTab === 'unstaged' && (
                      <div className="mt-auto pt-6 px-4 pb-4">
                        <h4 className="text-[10px] font-semibold text-neutral-600 uppercase tracking-widest mb-4">
                          Recent Commits
                        </h4>
                        <div className="flex items-start gap-3">
                          <div className="mt-[3px] p-0.5 rounded-full bg-white/[0.03] border border-white/[0.05]">
                            <CircleDot size={12} className="text-neutral-400" />
                          </div>
                          <div>
                            <p className="text-[12.5px] font-medium text-neutral-300">Initial commit from Clarrk</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-mono text-neutral-500">R1x1604</span>
                              <span className="text-[11px] text-neutral-600">11 ago</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Commit Form Block */}
              <div className="mt-auto flex-shrink-0">
                <CommitForm
                  onCommit={onCommit}
                  onStageAll={onStageAll}
                  disabled={totalChanges === 0}
                />
              </div>
            </>
          )
        ) : activeDockTab === 'explorer' ? (
          <TabPlaceholder icon={<Folder size={24} />} title="IDE File Explorer" />
        ) : activeDockTab === 'todo' ? (
          <TabPlaceholder icon={<ListTodo size={24} />} title="Project Tasks" />
        ) : activeDockTab === 'terminal' ? (
          <TerminalPanel autoCreate={false} />
        ) : (
          <TabPlaceholder icon={<SquareTerminal size={24} />} title="Terminal & Console" />
        )}
      </div>

      {/* ── Right Navigation Dock ── */}
      <div className="w-[48px] flex-shrink-0 flex flex-col items-center py-3 gap-3 bg-[#0c0c0c] relative z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.3)] border-l border-white/[0.02]">
        {dockItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveDockTab(item.id)}
            title={item.label}
            className={`relative w-[34px] h-[34px] flex items-center justify-center rounded-[8px] transition-all duration-200 group ${
              activeDockTab === item.id
                ? 'text-neutral-200 bg-white/[0.08] shadow-inner shadow-white/5'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
            }`}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
});