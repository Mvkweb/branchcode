import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Loader2,
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
  Key,
  Lock,
  Pencil,
  Trash2,
  TerminalSquare,
  Wifi,
  WifiOff,
  FolderOpen,
  Circle,
} from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { homeDir, join } from '@tauri-apps/api/path';
import type { GitStatus, GitFile, GitBranch as GitBranchType } from '../lib/tauri';
import { type SshServerConfig, type SshConnectionInfo } from '../lib/tauri';
import { FileExplorer } from './FileExplorer';
import { DiffViewer } from './DiffViewer';

// ── Types ──────────────────────────────────────────────────────────────────────

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

type DockTab = 'explorer' | 'todo' | 'git' | 'terminal' | 'ssh';
type SshAuthMethod =
  | { type: 'password'; password: string }
  | { type: 'key'; path: string; passphrase?: string };

// ── Constants ──────────────────────────────────────────────────────────────────

const ease = [0.32, 0.72, 0, 1] as const;
const spring = { type: 'spring', stiffness: 520, damping: 38 } as const;

// macOS-style font stack
const fontStack = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

const dockItems: { id: DockTab; icon: React.ReactNode; label: string; separator?: boolean }[] = [
  { id: 'explorer', icon: <Folder size={14} strokeWidth={1.6} />, label: 'Files' },
  { id: 'todo', icon: <ListTodo size={14} strokeWidth={1.6} />, label: 'Tasks' },
  { id: 'git', icon: <GitBranch size={14} strokeWidth={1.6} />, label: 'Source Control' },
  { id: 'terminal', icon: <SquareTerminal size={14} strokeWidth={1.6} />, label: 'Terminal' },
  { id: 'ssh', icon: <Server size={14} strokeWidth={1.6} />, label: 'Remote', separator: true },
];

// ── File Row ───────────────────────────────────────────────────────────────────

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
  const [hovered, setHovered] = useState(false);

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
  const folder = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';

  return (
    <div className="flex flex-col">
      <div
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex items-center gap-[6px] px-3 h-[26px] hover:bg-white/[0.025] cursor-default transition-colors duration-100 group"
      >
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.13, ease }}
          className="text-white/30 group-hover:text-white/55 flex-shrink-0 transition-colors"
        >
          <ChevronRight size={10} strokeWidth={2.25} />
        </motion.div>

        {/* Status dot */}
        <Circle
          size={6}
          strokeWidth={0}
          fill={isStaged ? '#3b82f6' : '#a3a3a3'}
          className="flex-shrink-0 opacity-80"
        />

        <div className="flex-1 min-w-0 flex items-baseline gap-[6px] overflow-hidden">
          <span className="text-[12px] text-white/80 truncate" style={{ fontFamily: fontStack }}>
            {fileName}
          </span>
          {folder && (
            <span className="text-[10.5px] text-white/30 font-mono truncate min-w-0">
              {folder}
            </span>
          )}
        </div>

        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.85 }}
          transition={{ duration: 0.12, ease }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="p-[3px] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] rounded-[4px] flex-shrink-0"
        >
          {isStaged ? (
            <X size={11} className="text-white/55 hover:text-rose-400" strokeWidth={2} />
          ) : (
            <Plus size={11} className="text-white/55 hover:text-[#60a5fa]" strokeWidth={2} />
          )}
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-0.5">
              <div
                className="rounded-[5px] overflow-hidden"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.015)',
                }}
              >
                {loadingDiff ? (
                  <div className="flex items-center gap-2 text-white/40 text-[11px] px-3 py-2.5">
                    <Loader2 size={11} className="animate-spin" />
                    Fetching diff…
                  </div>
                ) : diff ? (
                  <DiffViewer diff={diff} maxLines={0} maxHeightClass="max-h-[280px]" />
                ) : (
                  <div className="text-[11px] text-white/30 px-3 py-2.5">
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

// ── Commit Form ────────────────────────────────────────────────────────────────

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
  const [focused, setFocused] = useState(false);

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
    <div
      className="p-2.5 space-y-2 relative z-20"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 100%)',
      }}
    >
      <div className="flex gap-1.5">
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={disabled || committing}
          className="flex-1 flex items-center justify-center gap-1.5 h-[28px] rounded-[5px] text-[11.5px] font-medium text-white/55 hover:text-white/85 transition-all disabled:opacity-30 disabled:pointer-events-none"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Undo2 size={11} className="text-white/40" strokeWidth={1.75} />
          Discard
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onStageAll}
          disabled={disabled || committing}
          className="flex-1 flex items-center justify-center gap-1.5 h-[28px] rounded-[5px] text-[11.5px] font-medium text-[#60a5fa] hover:text-[#93c5fd] transition-all disabled:opacity-30 disabled:pointer-events-none"
          style={{
            background: 'rgba(59,130,246,0.08)',
            border: '1px solid rgba(59,130,246,0.18)',
          }}
        >
          <Plus size={11} strokeWidth={2.25} />
          Stage all
        </motion.button>
      </div>

      <div
        className="relative flex items-center rounded-[5px] h-[32px] overflow-hidden transition-all duration-150"
        style={{
          background: focused ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)',
          border: focused ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.05)',
          boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.08)' : 'none',
        }}
      >
        <div className="pl-2.5 pr-1.5 text-white/30 flex items-center">
          <ArrowRight size={11} strokeWidth={2} />
        </div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Commit message"
          disabled={disabled || committing}
          className="flex-1 bg-transparent text-[12px] text-white/85 placeholder-white/30 outline-none h-full"
          style={{ fontFamily: fontStack }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleCommit();
            }
          }}
        />
        <div className="pr-1 flex items-center h-full py-1">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleCommit}
            disabled={disabled || !message.trim() || committing}
            className="flex items-center gap-1 px-2.5 h-full rounded-[4px] text-[11.5px] font-medium text-white/60 hover:text-white/95 hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            {committing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={10.5} strokeWidth={2} />}
            Commit
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Tab Placeholder ────────────────────────────────────────────────────────────

function TabPlaceholder({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center h-full text-white/30 p-6"
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center mb-3 text-white/40"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {icon}
      </div>
      <p className="text-[12px] font-medium text-white/65" style={{ fontFamily: fontStack }}>{title}</p>
      <p className="text-[11px] text-white/35 mt-1 text-center leading-relaxed max-w-[200px]">
        This module is under active development.
      </p>
    </motion.div>
  );
}

// ── Input Helper ───────────────────────────────────────────────────────────────

function FormInput({
  label,
  optional,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; optional?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="text-[10.5px] text-white/45 mb-1 block" style={{ fontFamily: fontStack }}>
        {label} {optional && <span className="text-white/25">(optional)</span>}
      </label>
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full h-[30px] rounded-[5px] px-2.5 text-[12px] text-white/90 placeholder-white/25 outline-none transition-all"
        style={{
          background: focused ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.025)',
          border: focused ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
          boxShadow: focused ? '0 0 0 3px rgba(59,130,246,0.08)' : 'none',
          fontFamily: fontStack,
        }}
      />
    </div>
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
    const auth_method: SshAuthMethod =
      authType === 'password'
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

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease }}
      className="overflow-hidden"
    >
      <div
        className="m-2.5 p-3 space-y-2.5 rounded-[7px]"
        style={{
          background: 'rgba(255,255,255,0.018)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[11.5px] font-semibold text-white/85" style={{ fontFamily: fontStack }}>
            {initial ? 'Edit Server' : 'New Server'}
          </h3>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onCancel}
            className="p-1 text-white/40 hover:text-white/85 hover:bg-white/[0.05] rounded-[4px] transition-colors"
          >
            <X size={12} />
          </motion.button>
        </div>

        <div className="space-y-2">
          <FormInput label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Production Server" />
          <div className="flex gap-2">
            <div className="flex-1">
              <FormInput label="Host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.10" />
            </div>
            <div className="w-[68px]">
              <FormInput
                label="Port"
                type="text"
                pattern="[0-9]*"
                value={port}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  setPort(raw ? Number(raw) : 22);
                }}
              />
            </div>
          </div>
          <FormInput label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" />

          {/* Auth segmented control */}
          <div>
            <label className="text-[10.5px] text-white/45 mb-1 block" style={{ fontFamily: fontStack }}>
              Authentication
            </label>
            <div
              className="flex p-[2px] rounded-[5px] relative"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {(['key', 'password'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setAuthType(type)}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 h-[24px] text-[11px] font-medium rounded-[3px] transition-colors ${
                    authType === type ? 'text-white/95' : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {authType === type && (
                    <motion.div
                      layoutId="ssh-auth-tab"
                      className="absolute inset-0 rounded-[3px]"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                      transition={spring}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {type === 'key' ? <Key size={10} strokeWidth={2} /> : <Lock size={10} strokeWidth={2} />}
                    {type === 'key' ? 'SSH Key' : 'Password'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {authType === 'password' ? (
            <FormInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          ) : (
            <>
              <div>
                <label className="text-[10.5px] text-white/45 mb-1 block" style={{ fontFamily: fontStack }}>
                  Key Path
                </label>
                <div className="flex gap-1.5 items-center">
                  <input
                    value={keyPath}
                    onChange={(e) => setKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                    className="flex-1 h-[30px] rounded-[5px] px-2.5 text-[12px] text-white/90 placeholder-white/25 outline-none transition-all focus:bg-white/[0.04]"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontFamily: fontStack,
                    }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      let defaultPath: string | undefined;
                      try {
                        const home = await homeDir();
                        defaultPath = await join(home, '.ssh');
                      } catch (e) {
                        console.error('Failed to get default SSH path', e);
                      }
                      const selected = await openDialog({
                        multiple: false,
                        title: 'Select SSH Private Key',
                        defaultPath,
                      });
                      if (selected && typeof selected === 'string') setKeyPath(selected);
                    }}
                    className="h-[30px] w-[30px] flex items-center justify-center rounded-[5px] text-white/55 hover:text-white/90 transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <FolderOpen size={12} />
                  </motion.button>
                </div>
              </div>
              <FormInput
                label="Passphrase"
                optional
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="••••••••"
              />
            </>
          )}

          <FormInput
            label="Default Directory"
            optional
            value={defaultDir}
            onChange={(e) => setDefaultDir(e.target.value)}
            placeholder="/home/user/projects"
          />
        </div>

        <div className="flex gap-1.5 pt-1">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onCancel}
            className="flex-1 h-[28px] rounded-[5px] text-[11.5px] font-medium text-white/60 hover:text-white/90 transition-colors"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            Cancel
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 h-[28px] rounded-[5px] text-[11.5px] font-semibold text-[#60a5fa] hover:text-[#93c5fd] transition-all disabled:opacity-30 disabled:pointer-events-none"
            style={{
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.22)',
            }}
          >
            {initial ? 'Save' : 'Save & Connect'}
          </motion.button>
        </div>
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
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="mx-2.5 mb-1.5 rounded-[7px] overflow-hidden transition-all duration-150"
      style={{
        background: isConnected
          ? 'linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.025) 100%)'
          : hovered
            ? 'rgba(255,255,255,0.025)'
            : 'rgba(255,255,255,0.012)',
        border: isConnected
          ? '1px solid rgba(59,130,246,0.22)'
          : '1px solid rgba(255,255,255,0.05)',
        boxShadow: isConnected
          ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 0 rgba(59,130,246,0)'
          : 'inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex items-center gap-2.5 px-2.5 pt-2.5 pb-1.5">
        <div
          className="relative flex items-center justify-center w-[30px] h-[30px] rounded-[6px] flex-shrink-0"
          style={{
            background: isConnected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
            border: isConnected ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.05)',
            color: isConnected ? '#60a5fa' : 'rgba(255,255,255,0.5)',
          }}
        >
          <Server size={13} strokeWidth={1.75} />
          {isConnected && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-0.5 -right-0.5 flex h-[9px] w-[9px] items-center justify-center rounded-full bg-[#0d0d0d]"
            >
              <span className="relative h-[6px] w-[6px] rounded-full bg-[#3b82f6]">
                <span className="absolute inset-0 rounded-full bg-[#3b82f6] animate-ping opacity-60" />
              </span>
            </motion.span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-white/90 truncate" style={{ fontFamily: fontStack }}>
              {config.name}
            </span>
            {isConnected && (
              <span
                className="text-[8.5px] font-semibold tracking-wider px-1.5 py-[1px] rounded-[3px] uppercase"
                style={{
                  background: 'rgba(59,130,246,0.14)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.22)',
                }}
              >
                Live
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-white/40 font-mono truncate mt-[1px]">
            {config.username}@{config.host}:{config.port}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        {isConnected ? (
          <>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onTerminal}
              className="flex items-center gap-1 px-2 h-[24px] rounded-[4px] text-[10.5px] font-medium text-[#60a5fa] hover:text-[#93c5fd] hover:bg-[#3b82f6]/[0.12] transition-colors"
            >
              <TerminalSquare size={10} strokeWidth={1.75} /> Terminal
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onDisconnect}
              className="flex items-center gap-1 px-2 h-[24px] rounded-[4px] text-[10.5px] font-medium text-white/45 hover:text-rose-400 hover:bg-rose-500/[0.08] transition-colors"
            >
              <WifiOff size={10} strokeWidth={1.75} /> Disconnect
            </motion.button>
          </>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-1 px-2 h-[24px] rounded-[4px] text-[10.5px] font-medium text-[#60a5fa] hover:text-[#93c5fd] hover:bg-[#3b82f6]/[0.1] transition-colors disabled:opacity-50"
            >
              {isConnecting ? <Loader2 size={10} className="animate-spin" /> : <Wifi size={10} strokeWidth={1.75} />}
              {isConnecting ? 'Connecting…' : 'Connect'}
            </motion.button>
            <div className="ml-auto flex items-center gap-0.5">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onEdit}
                className="p-1.5 text-white/35 hover:text-white/85 hover:bg-white/[0.06] rounded-[4px] transition-colors"
              >
                <Pencil size={10} strokeWidth={1.75} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onDelete}
                className="p-1.5 text-white/35 hover:text-rose-400 hover:bg-rose-500/[0.08] rounded-[4px] transition-colors"
              >
                <Trash2 size={10} strokeWidth={1.75} />
              </motion.button>
            </div>
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

  const isConnected = (configId: string) => connections.some((c) => c.config_id === configId);

  const handleSave = (config: SshServerConfig) => {
    onSaveServer?.(config);
    setShowForm(false);
    setEditingServer(undefined);
  };

  const handleEdit = (config: SshServerConfig) => {
    setEditingServer(config);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 h-[34px] flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center gap-2">
          <Server size={11.5} strokeWidth={1.75} className="text-[#60a5fa]/80" />
          <span className="text-[10.5px] font-semibold tracking-[0.7px] text-white/55 uppercase" style={{ fontFamily: fontStack }}>
            Remote Servers
          </span>
          {connections.length > 0 && (
            <motion.span
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[9px] font-semibold tracking-wider text-[#60a5fa] px-1.5 py-[1px] rounded-[3px] uppercase"
              style={{
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              {connections.length} live
            </motion.span>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: showForm ? 45 : 0 }}
          transition={{ duration: 0.18, ease }}
          onClick={() => {
            setShowForm(!showForm);
            setEditingServer(undefined);
          }}
          className={`p-1 rounded-[4px] transition-colors ${
            showForm
              ? 'text-[#60a5fa] bg-[#3b82f6]/[0.14]'
              : 'text-white/45 hover:text-white/85 hover:bg-white/[0.06]'
          }`}
        >
          <Plus size={12} strokeWidth={2} />
        </motion.button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div
              className="mx-2.5 mt-2 flex items-center gap-2 px-2.5 py-2 rounded-[5px]"
              style={{
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.2)',
              }}
            >
              <AlertCircle size={11} className="text-rose-400 flex-shrink-0" />
              <span className="text-[11px] text-rose-300/95">{error}</span>
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
            onCancel={() => {
              setShowForm(false);
              setEditingServer(undefined);
            }}
          />
        )}
      </AnimatePresence>

      {/* Server List */}
      <div className="flex-1 overflow-y-auto pt-2">
        <AnimatePresence mode="popLayout">
          {servers.length === 0 && !showForm ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full px-6 pb-10"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Server size={18} className="text-white/30" strokeWidth={1.5} />
              </div>
              <p className="text-[12.5px] font-medium text-white/75" style={{ fontFamily: fontStack }}>
                No servers configured
              </p>
              <p className="text-[11px] text-white/40 mt-1 text-center leading-relaxed max-w-[200px]">
                Add a remote machine to develop, deploy, and connect via SSH.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -1 }}
                onClick={() => setShowForm(true)}
                className="mt-4 flex items-center gap-1.5 px-3 h-[28px] rounded-[5px] text-[11.5px] font-medium text-[#60a5fa] hover:text-[#93c5fd] transition-all"
                style={{
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.22)',
                }}
              >
                <Plus size={11} strokeWidth={2.25} />
                Add Server
              </motion.button>
            </motion.div>
          ) : (
            servers.map((server) => (
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

// ── Dock Button ────────────────────────────────────────────────────────────────

function DockButton({
  item,
  isActive,
  onClick,
  hasIndicator,
}: {
  item: (typeof dockItems)[number];
  isActive: boolean;
  onClick: () => void;
  hasIndicator?: boolean;
}) {
  const isSsh = item.id === 'ssh';
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item.label}
      whileTap={{ scale: 0.88 }}
      transition={{ duration: 0.1 }}
      className={`relative w-[26px] h-[26px] flex items-center justify-center rounded-[5px] transition-colors duration-150 ${
        isActive
          ? isSsh ? 'text-[#60a5fa]' : 'text-white/95'
          : isSsh ? 'text-[#60a5fa]/50 hover:text-[#93c5fd]' : 'text-white/40 hover:text-white/85'
      }`}
    >
      {/* Active background */}
      {isActive && (
        <motion.div
          layoutId="dock-active-bg"
          className="absolute inset-0 rounded-[5px]"
          style={{
            background: isSsh
              ? 'rgba(59,130,246,0.1)'
              : 'rgba(255,255,255,0.06)',
            border: isSsh
              ? '1px solid rgba(59,130,246,0.18)'
              : '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
          transition={spring}
        />
      )}

      {/* Hover glow (subtle) */}
      {!isActive && hovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 rounded-[5px]"
          style={{ background: 'rgba(255,255,255,0.04)' }}
        />
      )}

      {/* Active left rail */}
      {isActive && (
        <motion.div
          layoutId="dock-active-rail"
          className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-[2px] h-[12px] rounded-r-full"
          style={{
            background: isSsh ? '#3b82f6' : '#ffffff',
            boxShadow: isSsh ? '0 0 6px rgba(59,130,246,0.5)' : '0 0 4px rgba(255,255,255,0.2)',
          }}
          transition={spring}
        />
      )}

      <motion.span
        animate={{ scale: hovered && !isActive ? 1.08 : 1 }}
        transition={{ duration: 0.12 }}
        className="relative z-10"
      >
        {item.icon}
      </motion.span>

      {/* Indicator dot */}
      {hasIndicator && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={spring}
          className="absolute top-[2px] right-[2px] w-[5px] h-[5px] rounded-full bg-[#3b82f6] z-20"
          style={{ boxShadow: '0 0 5px rgba(59,130,246,0.7)' }}
        />
      )}
    </motion.button>
  );
}

// ── Git Panel ──────────────────────────────────────────────────────────────────

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
    <div className="flex h-full w-full bg-[#0d0d0d]" style={{ fontFamily: fontStack }}>
      {/* ── Main Panel ── */}
      <div
        className="flex-1 flex flex-col min-w-0 text-white/85 selection:bg-[#3b82f6]/30"
        style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        {activeDockTab === 'git' ? (
          !status ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40 p-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <AlertCircle size={18} className="opacity-60" strokeWidth={1.75} />
              </div>
              <p className="text-[12.5px] font-medium text-white/75">No Git repository</p>
              <p className="text-[11px] text-white/40 mt-1 text-center max-w-[200px] leading-relaxed">
                Initialize git in your workspace to enable source control.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                className="flex items-center justify-between px-3 h-[34px] flex-shrink-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
                }}
              >
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    className="text-white/40 hover:text-white/85 hover:bg-white/[0.05] transition-colors p-1 rounded-[4px]"
                  >
                    <MoreHorizontal size={12} />
                  </motion.button>
                  <button
                    onClick={onRefresh}
                    className="flex items-center gap-1.5 text-white/75 hover:text-white/95 transition-colors group"
                  >
                    <span className="text-[10.5px] font-semibold tracking-[0.7px] uppercase">
                      Changes
                    </span>
                    {loading ? (
                      <Loader2 size={11} className="text-white/40 animate-spin" />
                    ) : (
                      <ChevronDown size={11} className="text-white/40 group-hover:text-white/70 transition-colors" />
                    )}
                  </button>
                </div>
                <motion.div
                  whileHover={{ y: -0.5 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-2 h-[22px] rounded-[5px] text-white/65 hover:text-white/95 transition-colors cursor-pointer group"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <GitBranch size={10} className="text-white/45 group-hover:text-white/70 transition-colors" strokeWidth={2} />
                  <span className="text-[10.5px] font-mono tracking-tight">
                    {currentBranch || 'main'}
                  </span>
                </motion.div>
              </div>

              {/* Segmented tabs */}
              <div className="px-2.5 pt-2.5 pb-1.5">
                <div
                  className="flex p-[2px] rounded-[6px] relative"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {(['unstaged', 'staged'] as const).map((tab) => {
                    const count = tab === 'unstaged' ? unstagedChanges : stagedChanges;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveGitTab(tab)}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 h-[24px] text-[11px] font-medium rounded-[4px] transition-colors capitalize z-10 ${
                          activeGitTab === tab ? 'text-white/95' : 'text-white/45 hover:text-white/70'
                        }`}
                      >
                        {activeGitTab === tab && (
                          <motion.div
                            layoutId="git-tab-indicator"
                            className="absolute inset-0 rounded-[4px] -z-10"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                            }}
                            transition={spring}
                          />
                        )}
                        <span>{tab}</span>
                        {count > 0 && (
                          <span
                            className={`text-[10px] font-mono leading-none px-1 py-[2px] rounded-[3px] transition-all ${
                              activeGitTab === tab ? 'text-white/85 bg-white/[0.08]' : 'text-white/40 bg-white/[0.04]'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeGitTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease }}
                    className="flex-1 flex flex-col"
                  >
                    {activeGitTab === 'unstaged' ? (
                      <div className="pb-3">
                        {status.modified.length > 0 || status.untracked.length > 0 ? (
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
                          <div className="flex flex-col items-center justify-center py-10 text-white/35">
                            <p className="text-[11.5px] text-white/55">No unstaged changes</p>
                            <p className="text-[10.5px] text-white/30 mt-1">Your working tree is clean</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pb-3">
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
                          <div className="flex flex-col items-center justify-center py-10 text-white/35">
                            <p className="text-[11.5px] text-white/55">No staged changes</p>
                            <p className="text-[10.5px] text-white/30 mt-1">Stage files to commit</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeGitTab === 'unstaged' && (
                      <div className="mt-auto px-3 pb-3 pt-4">
                        <div
                          className="rounded-[6px] p-2.5"
                          style={{
                            background: 'rgba(255,255,255,0.015)',
                            border: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <h4 className="text-[9.5px] font-semibold text-white/40 uppercase tracking-[0.7px] mb-2.5">
                            Recent commit
                          </h4>
                          <div className="flex items-start gap-2.5">
                            <div className="mt-[2px] text-white/55">
                              <CircleDot size={11} strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11.5px] font-medium text-white/85 truncate">
                                Initial commit
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-white/40">a1b2c3d</span>
                                <span className="text-[10px] text-white/30">2h ago</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Commit Form */}
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
          <FileExplorer />
        ) : activeDockTab === 'todo' ? (
          <TabPlaceholder icon={<ListTodo size={18} strokeWidth={1.6} />} title="Project Tasks" />
        ) : (
          <TabPlaceholder icon={<SquareTerminal size={18} strokeWidth={1.6} />} title="Use main terminal" />
        )}
      </div>

      {/* ── Right Navigation Dock ── */}
      <div
        className="w-[36px] flex-shrink-0 flex flex-col items-center py-2 gap-[3px] relative z-10"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.012) 0%, rgba(0,0,0,0.15) 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {dockItems.map((item) => (
          <div key={item.id} className="flex flex-col items-center w-full">
            {item.separator && (
              <div className="w-3 h-px bg-white/[0.06] my-1.5" />
            )}
            <DockButton
              item={item}
              isActive={activeDockTab === item.id}
              onClick={() => setActiveDockTab(item.id)}
              hasIndicator={
                item.id === 'ssh' &&
                sshConnections.length > 0 &&
                activeDockTab !== item.id
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
});