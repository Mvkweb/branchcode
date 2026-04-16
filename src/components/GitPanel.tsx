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
  Server,
  Globe,
  Key,
  Lock,
  Pencil,
  Trash2,
  MonitorSmartphone,
  TerminalSquare,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { GitStatus, GitFile, GitBranch as GitBranchType, SshServerConfig, SshConnectionInfo, SshAuthMethod } from '../lib/tauri';
import { DiffViewer } from './DiffViewer';

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
  // SSH props
  sshServers?: SshServerConfig[];
  sshConnections?: SshConnectionInfo[];
  sshConnecting?: string | null;
  sshError?: string | null;
  onSshSaveServer?: (config: SshServerConfig) => void;
  onSshDeleteServer?: (id: string) => void;
  onSshConnect?: (configId: string) => void;
  onSshDisconnect?: (configId: string) => void;
  onSshSpawnTerminal?: (configId: string, serverName: string) => void;
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

type DockTab = 'explorer' | 'todo' | 'git' | 'terminal' | 'ssh';

const dockItems: { id: DockTab; icon: React.ReactNode; label: string; separator?: boolean }[] = [
  { id: 'explorer', icon: <Folder size={18} strokeWidth={1.75} />, label: 'File Tree' },
  { id: 'todo', icon: <ListTodo size={18} strokeWidth={1.75} />, label: 'Todo List' },
  { id: 'git', icon: <GitBranch size={18} strokeWidth={1.75} />, label: 'Source Control' },
  { id: 'terminal', icon: <SquareTerminal size={18} strokeWidth={1.75} />, label: 'Terminal' },
  { id: 'ssh', icon: <Server size={18} strokeWidth={1.75} />, label: 'Remote Servers', separator: true },
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

// ── SSH Server Form ────────────────────────────────────────────────────────────

function SshServerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SshServerConfig;
  onSave: (config: SshServerConfig) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(initial?.port ?? 22);
  const [username, setUsername] = useState(initial?.username ?? '');
  const [authType, setAuthType] = useState<'password' | 'key'>(
    initial?.auth_method?.type === 'key' ? 'key' : 'password'
  );
  const [password, setPassword] = useState(
    initial?.auth_method?.type === 'password' ? initial.auth_method.password : ''
  );
  const [keyPath, setKeyPath] = useState(
    initial?.auth_method?.type === 'key' ? initial.auth_method.path : '~/.ssh/id_rsa'
  );
  const [passphrase, setPassphrase] = useState(
    initial?.auth_method?.type === 'key' ? (initial.auth_method.passphrase ?? '') : ''
  );
  const [defaultDir, setDefaultDir] = useState(initial?.default_directory ?? '');

  const isValid = name.trim() && host.trim() && username.trim();

  const handleSave = () => {
    if (!isValid) return;
    const auth_method: SshAuthMethod = authType === 'password'
      ? { type: 'password', password }
      : { type: 'key', path: keyPath, passphrase: passphrase || undefined };

    onSave({
      id: initial?.id ?? '',
      name: name.trim(),
      host: host.trim(),
      port,
      username: username.trim(),
      auth_method,
      default_directory: defaultDir.trim() || undefined,
    });
  };

  const inputCx = "w-full h-[32px] bg-[#141414] border border-white/[0.06] rounded-[6px] px-3 text-[12px] text-neutral-200 placeholder-neutral-600 outline-none focus:border-white/20 focus:bg-[#1a1a1a] transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18 }}
      className="p-4 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[12px] font-semibold text-neutral-200">
          {initial ? 'Edit Server' : 'New Server'}
        </h3>
        <button onClick={onCancel} className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="text-[11px] text-neutral-500 mb-1 block">Name</label>
          <input className={inputCx} value={name} onChange={e => setName(e.target.value)} placeholder="My Server" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[11px] text-neutral-500 mb-1 block">Host</label>
            <input className={inputCx} value={host} onChange={e => setHost(e.target.value)} placeholder="192.168.1.10" />
          </div>
          <div className="w-[72px]">
            <label className="text-[11px] text-neutral-500 mb-1 block">Port</label>
            <input className={inputCx} type="number" value={port} onChange={e => setPort(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-neutral-500 mb-1 block">Username</label>
          <input className={inputCx} value={username} onChange={e => setUsername(e.target.value)} placeholder="root" />
        </div>

        {/* Auth type selector */}
        <div>
          <label className="text-[11px] text-neutral-500 mb-1.5 block">Authentication</label>
          <div className="flex p-[2px] bg-[#111] rounded-[6px] border border-white/[0.04]">
            <button
              onClick={() => setAuthType('key')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-[4px] transition-colors ${
                authType === 'key' ? 'text-neutral-100 bg-[#222] border border-white/[0.04]' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Key size={11} /> SSH Key
            </button>
            <button
              onClick={() => setAuthType('password')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-[4px] transition-colors ${
                authType === 'password' ? 'text-neutral-100 bg-[#222] border border-white/[0.04]' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Lock size={11} /> Password
            </button>
          </div>
        </div>

        {authType === 'password' ? (
          <div>
            <label className="text-[11px] text-neutral-500 mb-1 block">Password</label>
            <input className={inputCx} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        ) : (
          <>
            <div>
              <label className="text-[11px] text-neutral-500 mb-1 block">Key Path</label>
              <input className={inputCx} value={keyPath} onChange={e => setKeyPath(e.target.value)} placeholder="~/.ssh/id_rsa" />
            </div>
            <div>
              <label className="text-[11px] text-neutral-500 mb-1 block">Passphrase <span className="text-neutral-600">(optional)</span></label>
              <input className={inputCx} type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="••••••••" />
            </div>
          </>
        )}

        <div>
          <label className="text-[11px] text-neutral-500 mb-1 block">Default Directory <span className="text-neutral-600">(optional)</span></label>
          <input className={inputCx} value={defaultDir} onChange={e => setDefaultDir(e.target.value)} placeholder="/home/user/projects" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-white/[0.04] rounded-[6px] text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="flex-1 px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/25 rounded-[6px] text-[12px] font-medium text-teal-300 hover:text-teal-200 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          {initial ? 'Save' : 'Save & Connect'}
        </button>
      </div>
    </motion.div>
  );
}

// ── SSH Server Card ────────────────────────────────────────────────────────────

function SshServerCard({
  config,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onTerminal,
}: {
  config: SshServerConfig;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTerminal: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      className={`mx-3 mb-2 rounded-[8px] border transition-colors ${
        isConnected
          ? 'border-teal-500/20 bg-teal-500/[0.04]'
          : 'border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg ${
          isConnected ? 'bg-teal-500/15 text-teal-400' : 'bg-white/[0.04] text-neutral-500'
        }`}>
          <MonitorSmartphone size={16} />
          {isConnected && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-[9px] w-[9px] items-center justify-center rounded-full bg-[#0a0a0a]">
              <span className="h-[6px] w-[6px] rounded-full bg-teal-400 animate-pulse" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-medium text-neutral-200 truncate">{config.name}</span>
            {isConnected && (
              <span className="text-[9px] font-semibold tracking-wider px-1.5 py-[1px] rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/20 uppercase">
                live
              </span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 font-mono truncate mt-0.5">
            {config.username}@{config.host}:{config.port}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 px-2 pb-2">
        {isConnected ? (
          <>
            <button
              onClick={onTerminal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11px] font-medium text-teal-300/80 hover:text-teal-200 hover:bg-teal-500/10 transition-colors"
            >
              <TerminalSquare size={12} /> Terminal
            </button>
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11px] font-medium text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <WifiOff size={12} /> Disconnect
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11px] font-medium text-teal-400/70 hover:text-teal-300 hover:bg-teal-500/10 transition-colors disabled:opacity-40"
            >
              {isConnecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
            <button onClick={onEdit} className="p-1 text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.06] rounded transition-colors">
              <Pencil size={12} />
            </button>
            <button onClick={onDelete} className="p-1 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── SSH Panel ──────────────────────────────────────────────────────────────────

function SshPanel({
  servers = [],
  connections = [],
  connecting,
  error,
  onSaveServer,
  onDeleteServer,
  onConnect,
  onDisconnect,
  onSpawnTerminal,
}: {
  servers: SshServerConfig[];
  connections: SshConnectionInfo[];
  connecting?: string | null;
  error?: string | null;
  onSaveServer?: (config: SshServerConfig) => void;
  onDeleteServer?: (id: string) => void;
  onConnect?: (configId: string) => void;
  onDisconnect?: (configId: string) => void;
  onSpawnTerminal?: (configId: string, serverName: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState<SshServerConfig | undefined>();

  const isConnected = (configId: string) =>
    connections.some(c => c.config_id === configId);

  const handleSave = (config: SshServerConfig) => {
    onSaveServer?.(config);
    setShowForm(false);
    setEditingServer(undefined);
    // Auto-connect on new server
    if (!config.id && onConnect) {
      // The backend will assign an ID, so we need to wait for servers to refresh
    }
  };

  const handleEdit = (config: SshServerConfig) => {
    setEditingServer(config);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Server size={14} className="text-teal-400/60" />
          <span className="text-[12.5px] font-medium text-neutral-300 tracking-wide">Remote Servers</span>
          {connections.length > 0 && (
            <span className="text-[10px] font-mono text-teal-400/70 bg-teal-500/10 px-1.5 py-[1px] rounded-full">
              {connections.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingServer(undefined); }}
          className={`p-1 rounded-[5px] transition-all ${
            showForm
              ? 'text-teal-400 bg-teal-500/15 rotate-45'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.06]'
          }`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-red-500/10 border border-red-500/20">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-red-300">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <AnimatePresence mode="wait">
        {showForm && (
          <SshServerForm
            key={editingServer?.id ?? 'new'}
            initial={editingServer}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingServer(undefined); }}
          />
        )}
      </AnimatePresence>

      {/* Server List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pt-2">
        <AnimatePresence mode="popLayout">
          {servers.length === 0 && !showForm ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full px-6 pb-10"
            >
              <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
                <Server size={22} className="text-neutral-600" />
              </div>
              <p className="text-[13px] font-medium text-neutral-300">No servers configured</p>
              <p className="text-[11.5px] text-neutral-500 mt-1.5 text-center leading-relaxed max-w-[200px]">
                Add a remote server to connect and develop via SSH.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-5 flex items-center gap-1.5 px-4 py-2 rounded-[7px] border border-teal-500/22 bg-teal-500/8 text-[12px] font-medium text-teal-400/75 hover:border-teal-500/35 hover:bg-teal-500/14 hover:text-teal-300 transition-colors"
              >
                <Plus size={14} />
                Add Server
              </button>
            </motion.div>
          ) : (
            servers.map(server => (
              <SshServerCard
                key={server.id}
                config={server}
                isConnected={isConnected(server.id)}
                isConnecting={connecting === server.id}
                onConnect={() => onConnect?.(server.id)}
                onDisconnect={() => onDisconnect?.(server.id)}
                onEdit={() => handleEdit(server)}
                onDelete={() => onDeleteServer?.(server.id)}
                onTerminal={() => onSpawnTerminal?.(server.id, server.name)}
              />
            ))
          )}
        </AnimatePresence>
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
  sshServers = [],
  sshConnections = [],
  sshConnecting,
  sshError,
  onSshSaveServer,
  onSshDeleteServer,
  onSshConnect,
  onSshDisconnect,
  onSshSpawnTerminal,
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
        ) : activeDockTab === 'ssh' ? (
          <SshPanel
            servers={sshServers}
            connections={sshConnections}
            connecting={sshConnecting}
            error={sshError}
            onSaveServer={onSshSaveServer}
            onDeleteServer={onSshDeleteServer}
            onConnect={onSshConnect}
            onDisconnect={onSshDisconnect}
            onSpawnTerminal={onSshSpawnTerminal}
          />
        ) : activeDockTab === 'explorer' ? (
          <TabPlaceholder icon={<Folder size={24} />} title="IDE File Explorer" />
        ) : activeDockTab === 'todo' ? (
          <TabPlaceholder icon={<ListTodo size={24} />} title="Project Tasks" />
        ) : activeDockTab === 'terminal' ? (
          <TabPlaceholder icon={<SquareTerminal size={24} />} title="Use main terminal" />
        ) : (
          <TabPlaceholder icon={<SquareTerminal size={24} />} title="Terminal & Console" />
        )}
      </div>

      {/* ── Right Navigation Dock ── */}
      <div className="w-[48px] flex-shrink-0 flex flex-col items-center py-3 gap-3 bg-[#0c0c0c] relative z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.3)] border-l border-white/[0.02]">
        {dockItems.map((item) => (
          <div key={item.id} className="flex flex-col items-center">
            {item.separator && (
              <div className="w-5 h-px bg-white/[0.06] mb-3" />
            )}
            <button
              onClick={() => setActiveDockTab(item.id)}
              title={item.label}
              className={`relative w-[34px] h-[34px] flex items-center justify-center rounded-[8px] transition-all duration-200 group ${
                activeDockTab === item.id
                  ? item.id === 'ssh'
                    ? 'text-teal-400 bg-teal-500/[0.12] shadow-inner shadow-teal-500/5'
                    : 'text-neutral-200 bg-white/[0.08] shadow-inner shadow-white/5'
                  : item.id === 'ssh'
                    ? 'text-teal-500/50 hover:text-teal-400 hover:bg-teal-500/[0.06]'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.04]'
              }`}
            >
              {item.icon}
              {/* Connection indicator dot */}
              {item.id === 'ssh' && sshConnections.length > 0 && activeDockTab !== 'ssh' && (
                <span className="absolute top-1 right-1 w-[6px] h-[6px] rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.5)]" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});