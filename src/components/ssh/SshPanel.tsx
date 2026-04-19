import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import {
  Plus,
  X,
  Loader2,
  Key,
  Lock,
  Pencil,
  Trash2,
  TerminalSquare,
  FolderOpen,
  Search,
  ChevronDown,
  Copy,
  Check,
  Tag as TagIcon,
  ArrowUpRight,
  MoreHorizontal,
  CornerDownLeft,
} from 'lucide-react';
import type { SshServerConfig, SshConnectionInfo, SshAuthMethod } from '../../lib/tauri';
import { OsIcon, OsPicker, type OsType } from './OsIcons';

const easeOut = [0.16, 1, 0.3, 1] as const;
const easeStandard = [0.4, 0, 0.2, 1] as const;

const sans = '"Geist", "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';
const mono = '"Geist Mono", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace';

/**
 * LinuxIcon — kept as a thin alias to <OsIcon os="linux" /> so any external
 * imports (e.g. GitPanel's dock) keep working without changes.
 */
export const LinuxIcon = ({ className = '', size = 24 }: { className?: string; size?: number }) => (
  <OsIcon os="linux" size={size} className={className} />
);

function uptimeStr(ms: number) {
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function StatusDot({
  state,
  size = 6,
}: {
  state: 'live' | 'connecting' | 'idle' | 'error';
  size?: number;
}) {
  const colors = {
    live: '#3aed8a',
    connecting: '#f5a623',
    idle: '#666',
    error: '#ff4d4f',
  };
  const c = colors[state];
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: c, boxShadow: state === 'live' ? `0 0 6px ${c}80` : 'none' }}
      />
      {state === 'live' && (
        <motion.span
          className="absolute rounded-full"
          style={{ inset: -3, border: `1px solid ${c}` }}
          initial={{ opacity: 0.6, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
    </span>
  );
}

function CopyChip({ value, children }: { value: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={handle}
      className="group/copy inline-flex items-center gap-1.5 text-[12px] text-[#a1a1a1] hover:text-white transition-colors duration-150 font-mono"
      style={{ fontFamily: mono }}
    >
      <span className="truncate">{children}</span>
      <span className="relative inline-flex w-3 h-3 items-center justify-center text-[#666] group-hover/copy:text-[#a1a1a1] transition-colors">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'check' : 'copy'}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.12 }}
            className="absolute"
          >
            {copied ? <Check size={10} strokeWidth={2.5} className="text-[#3aed8a]" /> : <Copy size={10} strokeWidth={2} />}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
  active,
  variant = 'default',
  size = 'md',
  className = '',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  type?: 'button' | 'submit';
}) {
  const sizing = size === 'sm' ? 'h-[26px] px-2.5 text-[11.5px]' : 'h-[28px] px-3 text-[12px]';
  const styles =
    variant === 'primary'
      ? 'bg-white text-black hover:bg-[#ededed] border border-white'
      : variant === 'danger'
        ? 'bg-transparent text-[#a1a1a1] hover:bg-[#1a0a0c] hover:text-[#ff6b6b] border border-[#262626] hover:border-[#3a1a1d]'
        : `bg-transparent ${active ? 'text-white border-[#404040]' : 'text-[#ededed] hover:text-white'} border border-[#262626] hover:border-[#404040] hover:bg-[#161616]`;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ duration: 0.08 }}
      className={`box-border inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium leading-none transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none ${sizing} ${styles} ${className}`}
      style={{ fontFamily: sans }}
    >
      {children}
    </motion.button>
  );
}

function Chip({
  children,
  tone = 'default',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warn';
  className?: string;
}) {
  const tones = {
    default: 'border-[#262626] text-[#a1a1a1] bg-transparent',
    success: 'border-[#0f3a23] text-[#3aed8a] bg-[#0a1a13]',
    warn: 'border-[#3a2a0f] text-[#f5a623] bg-[#1a1408]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 h-[18px] rounded-[4px] border text-[10.5px] font-medium ${tones[tone]} ${className}`}
      style={{ fontFamily: sans, letterSpacing: '0.01em' }}
    >
      {children}
    </span>
  );
}

function Input({
  label,
  hint,
  optional,
  trailing,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  optional?: boolean;
  trailing?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] font-medium text-[#ededed]" style={{ fontFamily: sans }}>
            {label}
            {optional && <span className="text-[#666] font-normal ml-1">Optional</span>}
          </label>
          {hint && <span className="text-[10.5px] text-[#666]">{hint}</span>}
        </div>
      )}
      <div
        className="flex items-center rounded-[6px] h-[32px] transition-colors duration-150"
        style={{ background: '#0a0a0a', border: `1px solid ${focused ? '#525252' : '#262626'}` }}
      >
        <input
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          className="flex-1 min-w-0 bg-transparent px-2.5 text-[12.5px] text-white placeholder-[#525252] outline-none h-full"
          style={{ fontFamily: props.type === 'password' || props.pattern ? mono : sans }}
        />
        {trailing && <div className="pr-1 flex items-center">{trailing}</div>}
      </div>
    </div>
  );
}

/* ── Trailing inline button used inside Input (e.g. file picker) ───────── */
function TrailingIconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={title}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.08 }}
      className="inline-flex items-center justify-center w-[24px] h-[24px] rounded-[4px] text-[#666] hover:text-white hover:bg-[#171717] transition-colors"
    >
      {children}
    </motion.button>
  );
}

/**
 * TagInput — Comma / Enter / Tab commits a chip, Backspace removes the last.
 */
function TagInput({
  label,
  optional,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  optional?: boolean;
  hint?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const t = raw.trim().replace(/,/g, '');
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.includes(',')) {
      const parts = v.split(',');
      const last = parts.pop() ?? '';
      parts.forEach(commit);
      setInput(last);
    } else {
      setInput(v);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) {
        commit(input);
        setInput('');
      }
    } else if (e.key === 'Tab' && input.trim()) {
      e.preventDefault();
      commit(input);
      setInput('');
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] font-medium text-[#ededed]" style={{ fontFamily: sans }}>
            {label}
            {optional && <span className="text-[#666] font-normal ml-1">Optional</span>}
          </label>
          {hint && <span className="text-[10.5px] text-[#666]">{hint}</span>}
        </div>
      )}
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1 rounded-[6px] min-h-[32px] px-1.5 py-[3px] transition-colors cursor-text"
        style={{ background: '#0a0a0a', border: `1px solid ${focused ? '#525252' : '#262626'}` }}
      >
        <AnimatePresence initial={false}>
          {value.map((tag) => (
            <motion.span
              key={tag}
              layout
              initial={{ opacity: 0, scale: 0.7, y: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: -2 }}
              transition={{ duration: 0.15, ease: easeStandard }}
              className="inline-flex items-center gap-1 h-[20px] pl-1.5 pr-0.5 rounded-[4px] text-[11px] font-medium text-[#ededed] bg-[#171717] border border-[#262626]"
              style={{ fontFamily: sans }}
            >
              <span className="leading-none">{tag}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-[3px] text-[#666] hover:text-white hover:bg-[#262626] transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X size={9} strokeWidth={2.5} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          ref={inputRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            if (input.trim()) {
              commit(input);
              setInput('');
            }
            setFocused(false);
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[60px] bg-transparent text-[12.5px] text-white placeholder-[#525252] outline-none h-[20px]"
          style={{ fontFamily: sans }}
        />
      </div>
    </div>
  );
}

/* ── Tauri-aware file picker for SSH key path ──────────────────────────── */
async function pickPrivateKeyFile(): Promise<string | null> {
  try {
    const mod = await import('@tauri-apps/plugin-dialog');
    const selected = await mod.open({
      multiple: false,
      directory: false,
      title: 'Select SSH private key',
      filters: [
        { name: 'SSH keys', extensions: ['pem', 'key', 'ppk', 'pub'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (typeof selected === 'string') return selected;
    return null;
  } catch (e) {
    console.error('File picker unavailable:', e);
    return null;
  }
}

async function pickDirectory(): Promise<string | null> {
  try {
    const mod = await import('@tauri-apps/plugin-dialog');
    const selected = await mod.open({
      multiple: false,
      directory: true,
      title: 'Select working directory',
    });
    if (typeof selected === 'string') return selected;
    return null;
  } catch (e) {
    console.error('Directory picker unavailable:', e);
    return null;
  }
}

function ServerForm({
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
    initial?.auth_method?.type === 'key' ? initial.auth_method.path : '~/.ssh/id_ed25519'
  );
  const [passphrase, setPassphrase] = useState(
    initial?.auth_method?.type === 'key' ? (initial.auth_method.passphrase ?? '') : ''
  );
  const [defaultDir, setDefaultDir] = useState(initial?.default_directory ?? '');
  const [group, setGroup] = useState(initial?.group ?? '');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [os, setOs] = useState<OsType>((initial?.os as OsType) ?? 'linux');

  const isValid = name.trim() && host.trim() && username.trim();

  const handleBrowseKey = async () => {
    const picked = await pickPrivateKeyFile();
    if (picked) setKeyPath(picked);
  };

  const handleBrowseDir = async () => {
    const picked = await pickDirectory();
    if (picked) setDefaultDir(picked);
  };

  const handleSave = () => {
    if (!isValid) return;
    const auth_method: SshAuthMethod =
      authType === 'password'
        ? { type: 'password', password }
        : { type: 'key', path: keyPath, passphrase: passphrase || undefined };

    onSave({
      id: initial?.id ?? `srv_${Date.now().toString(36)}`,
      name: name.trim(),
      host: host.trim(),
      port,
      username: username.trim(),
      auth_method,
      default_directory: defaultDir.trim() || undefined,
      group: group.trim() || undefined,
      tags,
      os,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: easeOut }}
      className="overflow-hidden"
    >
      <div
        className="mx-3 mt-3 rounded-[8px]"
        style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}
      >
        <div className="flex items-center justify-between gap-2 px-3 h-[40px] border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2 min-w-0">
            {/* OS picker — click the icon to choose */}
            <OsPicker value={os} onChange={setOs} size={26} />
            <span
              className="text-[12px] font-semibold text-white truncate"
              style={{ fontFamily: sans, letterSpacing: '-0.01em' }}
            >
              {initial ? 'Edit connection' : 'New connection'}
            </span>
            <span className="text-[11px] text-[#666] flex-shrink-0">·</span>
            <span className="text-[11px] text-[#666] flex-shrink-0">SSH</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 -mr-1 text-[#666] hover:text-white hover:bg-[#171717] rounded-[4px] transition-colors flex-shrink-0"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>

        <div className="p-3 space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="eu-prod-bastion" />

          <div className="grid grid-cols-[1fr_84px] gap-2">
            <Input label="Host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="bastion.example.com" />
            <Input
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

          <Input label="User" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="deploy" />

          <div className="space-y-1.5">
            <label className="text-[11.5px] font-medium text-[#ededed]" style={{ fontFamily: sans }}>
              Authentication
            </label>
            <div
              className="grid grid-cols-2 p-[3px] rounded-[6px] relative"
              style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}
            >
              {(['key', 'password'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setAuthType(type)}
                  className={`relative h-[24px] flex items-center justify-center gap-1.5 text-[11.5px] font-medium rounded-[4px] transition-colors duration-150 ${
                    authType === type ? 'text-white' : 'text-[#888] hover:text-[#ededed]'
                  }`}
                  style={{ fontFamily: sans }}
                >
                  {authType === type && (
                    <motion.div
                      layoutId="auth-tab"
                      className="absolute inset-0 rounded-[4px]"
                      style={{ background: '#1f1f1f' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {type === 'key' ? <Key size={10.5} strokeWidth={2} /> : <Lock size={10.5} strokeWidth={2} />}
                    {type === 'key' ? 'SSH Key' : 'Password'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={authType}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: easeStandard }}
              className="space-y-3"
            >
              {authType === 'password' ? (
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              ) : (
                <>
                  <Input
                    label="Private key path"
                    value={keyPath}
                    onChange={(e) => setKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_ed25519"
                    trailing={
                      <TrailingIconButton onClick={handleBrowseKey} title="Browse for key file…">
                        <FolderOpen size={11} strokeWidth={2} />
                      </TrailingIconButton>
                    }
                  />
                  <Input
                    label="Passphrase"
                    optional
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="••••••••"
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-2">
            <Input label="Group" optional value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Production" />
            <TagInput label="Tags" optional value={tags} onChange={setTags} placeholder="db, eu-west" />
          </div>

          <Input
            label="Working directory"
            optional
            value={defaultDir}
            onChange={(e) => setDefaultDir(e.target.value)}
            placeholder="/srv/app"
            trailing={
              <TrailingIconButton onClick={handleBrowseDir} title="Browse for directory…">
                <FolderOpen size={11} strokeWidth={2} />
              </TrailingIconButton>
            }
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-3 h-[44px] border-t border-[#1f1f1f]">
          <span className="text-[11px] text-[#666] flex items-center gap-1.5 min-w-0 truncate" style={{ fontFamily: sans }}>
            <CornerDownLeft size={10} strokeWidth={2} className="flex-shrink-0" />
            <span className="truncate">Press Enter to save</span>
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <GhostButton onClick={onCancel}>Cancel</GhostButton>
            <GhostButton onClick={handleSave} disabled={!isValid} variant="primary">
              {initial ? 'Save changes' : 'Create'}
            </GhostButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ServerRow({
  config,
  connection,
  isConnecting,
  expanded,
  onToggle,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onTerminal,
}: {
  config: SshServerConfig;
  connection?: SshConnectionInfo;
  isConnecting: boolean;
  expanded: boolean;
  onToggle: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTerminal: () => void;
}) {
  const isLive = !!connection;
  const state: 'live' | 'connecting' | 'idle' = isConnecting ? 'connecting' : isLive ? 'live' : 'idle';

  const [, force] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  const auth = config.auth_method;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="border-b border-[#1a1a1a] last:border-b-0"
    >
      <div
        onClick={onToggle}
        className="group flex items-center gap-3 px-3 h-[52px] cursor-pointer hover:bg-[#0e0e0e] transition-colors duration-150"
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-[6px] flex-shrink-0"
          style={{
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
            color: isLive ? '#ededed' : '#888',
          }}
        >
          {/* Per-server OS icon, falls back to Tux for unknown values */}
          <OsIcon os={config.os} size={15} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[13px] font-medium text-white truncate"
              style={{ fontFamily: sans, letterSpacing: '-0.005em' }}
            >
              {config.name}
            </span>
            <StatusDot state={state} />
            {isLive && connection?.latency_ms !== undefined && (
              <span className="text-[10.5px] text-[#888] tabular-nums" style={{ fontFamily: mono }}>
                {connection.latency_ms}ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11.5px] text-[#888] truncate" style={{ fontFamily: mono }}>
              {config.username}@{config.host}
              <span className="text-[#525252]">:{config.port}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isLive && (
            <span className="text-[11px] text-[#888] tabular-nums hidden sm:inline" style={{ fontFamily: mono }}>
              {uptimeStr(connection!.connected_at)}
            </span>
          )}
          {config.tags && config.tags.length > 0 && !isLive && (
            <div className="hidden sm:flex items-center gap-1">
              {config.tags.slice(0, 2).map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          )}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: easeStandard }}
            className="text-[#525252] group-hover:text-[#a1a1a1] transition-colors"
          >
            <ChevronDown size={13} strokeWidth={2} />
          </motion.div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              <div
                className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2.5 rounded-[6px]"
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}
              >
                <MetaItem label="Endpoint">
                  <CopyChip value={`${config.username}@${config.host}:${config.port}`}>
                    {config.host}:{config.port}
                  </CopyChip>
                </MetaItem>
                <MetaItem label="Auth">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#ededed]" style={{ fontFamily: sans }}>
                    {auth.type === 'key' ? (
                      <>
                        <Key size={10.5} strokeWidth={2} className="text-[#888]" />
                        <span className="font-mono text-[11px] truncate" style={{ fontFamily: mono }}>
                          {auth.path.split('/').pop()}
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock size={10.5} strokeWidth={2} className="text-[#888]" />
                        Password
                      </>
                    )}
                  </span>
                </MetaItem>
                {connection ? (
                  <>
                    <MetaItem label="Latency">
                      <span
                        className="text-[12px] tabular-nums"
                        style={{
                          fontFamily: mono,
                          color:
                            (connection.latency_ms ?? 0) < 60
                              ? '#3aed8a'
                              : (connection.latency_ms ?? 0) < 150
                                ? '#f5a623'
                                : '#ff6b6b',
                        }}
                      >
                        {connection.latency_ms ?? '—'}ms
                      </span>
                    </MetaItem>
                    <MetaItem label="Uptime">
                      <span className="text-[12px] text-[#ededed] tabular-nums" style={{ fontFamily: mono }}>
                        {uptimeStr(connection.connected_at)}
                      </span>
                    </MetaItem>
                  </>
                ) : (
                  <>
                    <MetaItem label="Working dir">
                      <span className="text-[12px] text-[#ededed] truncate" style={{ fontFamily: mono }}>
                        {config.default_directory || '~'}
                      </span>
                    </MetaItem>
                    <MetaItem label="Status">
                      <span className="text-[12px] text-[#888]" style={{ fontFamily: sans }}>
                        Disconnected
                      </span>
                    </MetaItem>
                  </>
                )}
              </div>

              {config.tags && config.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <TagIcon size={10} strokeWidth={2} className="text-[#525252]" />
                  {config.tags.map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isLive ? (
                    <>
                      <GhostButton onClick={onTerminal}>
                        <TerminalSquare size={11} strokeWidth={2} />
                        Open terminal
                        <ArrowUpRight size={10} strokeWidth={2} className="text-[#888] ml-0.5" />
                      </GhostButton>
                      <GhostButton onClick={onDisconnect} variant="danger">
                        Disconnect
                      </GhostButton>
                    </>
                  ) : (
                    <GhostButton onClick={onConnect} variant="primary" disabled={isConnecting}>
                      {isConnecting ? (
                        <>
                          <Loader2 size={11} className="animate-spin" />
                          Connecting
                        </>
                      ) : (
                        <>Connect</>
                      )}
                    </GhostButton>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  <IconBtn label="Edit" onClick={onEdit}>
                    <Pencil size={11} strokeWidth={2} />
                  </IconBtn>
                  <IconBtn label="Delete" onClick={onDelete} danger>
                    <Trash2 size={11} strokeWidth={2} />
                  </IconBtn>
                  <IconBtn label="More">
                    <MoreHorizontal size={12} strokeWidth={2} />
                  </IconBtn>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div
        className="text-[10px] uppercase tracking-[0.06em] text-[#666] mb-0.5"
        style={{ fontFamily: sans, fontWeight: 500 }}
      >
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      title={label}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.08 }}
      className={`w-[26px] h-[26px] flex items-center justify-center rounded-[4px] transition-colors duration-150 ${
        danger
          ? 'text-[#666] hover:text-[#ff6b6b] hover:bg-[#1a0a0c]'
          : 'text-[#666] hover:text-white hover:bg-[#171717]'
      }`}
    >
      {children}
    </motion.button>
  );
}

function GroupHeader({
  title,
  total,
  live,
  collapsed,
  onToggle,
}: {
  title: string;
  total: number;
  live: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 h-[28px] hover:bg-[#0e0e0e] transition-colors duration-150 group"
      style={{ background: '#0a0a0a' }}
    >
      <motion.div
        animate={{ rotate: collapsed ? -90 : 0 }}
        transition={{ duration: 0.18, ease: easeStandard }}
        className="text-[#525252] group-hover:text-[#a1a1a1]"
      >
        <ChevronDown size={11} strokeWidth={2.5} />
      </motion.div>
      <span
        className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-[#888] group-hover:text-[#ededed] transition-colors"
        style={{ fontFamily: sans }}
      >
        {title}
      </span>
      <span className="text-[10.5px] text-[#525252] tabular-nums" style={{ fontFamily: mono }}>
        {total}
      </span>
      {live > 0 && (
        <span className="ml-auto inline-flex items-center gap-1.5 pr-0.5">
          <StatusDot state="live" size={5} />
          <span className="text-[10.5px] text-[#3aed8a] tabular-nums" style={{ fontFamily: mono }}>
            {live}
          </span>
        </span>
      )}
    </button>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.18, ease: easeStandard }}
      className="overflow-hidden"
    >
      <div
        className="mx-3 mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-[6px]"
        style={{ background: '#170b0d', border: '1px solid #3a1a1d' }}
      >
        <span
          className="mt-[3px] w-1.5 h-1.5 rounded-full bg-[#ff4d4f] flex-shrink-0"
          style={{ boxShadow: '0 0 6px #ff4d4f80' }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-[#fda4a4]" style={{ fontFamily: sans }}>
            Connection failed
          </div>
          <div className="text-[11.5px] text-[#a1a1a1] mt-0.5 truncate" style={{ fontFamily: mono }}>
            {message}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-[#888] hover:text-white transition-colors p-0.5 -m-0.5 flex-shrink-0"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
}

type Filter = 'all' | 'live' | 'idle';

export function SshPanel({
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
  const [editing, setEditing] = useState<SshServerConfig | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const connByConfig = useMemo(() => {
    const m = new Map<string, SshConnectionInfo>();
    connections.forEach((c) => m.set(c.config_id, c));
    return m;
  }, [connections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return servers.filter((s) => {
      const live = connByConfig.has(s.id);
      if (filter === 'live' && !live) return false;
      if (filter === 'idle' && live) return false;
      if (!q) return true;
      return [s.name, s.host, s.username, s.group ?? '', ...(s.tags ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [servers, filter, query, connByConfig]);

  const groups = useMemo(() => {
    const map = new Map<string, SshServerConfig[]>();
    filtered.forEach((s) => {
      const g = s.group?.trim() || 'Ungrouped';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 'Ungrouped') return 1;
      if (b[0] === 'Ungrouped') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  };

  const handleSave = (config: SshServerConfig) => {
    onSaveServer?.(config);
    setShowForm(false);
    setEditing(undefined);
  };

  const handleEdit = (config: SshServerConfig) => {
    setEditing(config);
    setShowForm(true);
  };

  const liveCount = connections.length;
  const totalCount = servers.length;

  return (
    <div
      className="flex flex-col h-full text-[#ededed] ssh-scroll overflow-hidden"
      style={{ background: '#0a0a0a', fontFamily: sans }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 h-[44px] flex-shrink-0 min-w-0"
        style={{ borderBottom: '1px solid #1a1a1a' }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <OsIcon os="linux" size={13} className="text-[#888] flex-shrink-0" />
          <span
            className="text-[12.5px] font-semibold text-white truncate"
            style={{ fontFamily: sans, letterSpacing: '-0.01em' }}
          >
            Connections
          </span>
          <span className="text-[11px] text-[#666] tabular-nums flex-shrink-0" style={{ fontFamily: mono }}>
            {totalCount}
          </span>
          {liveCount > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 ml-1 flex-shrink-0"
            >
              <StatusDot state="live" size={5} />
              <span className="text-[11px] text-[#3aed8a] tabular-nums" style={{ fontFamily: mono }}>
                {liveCount} live
              </span>
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <GhostButton
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setShowForm((v) => !v);
            }}
            active={showForm}
          >
            <Plus size={11} strokeWidth={2.25} />
            New
          </GhostButton>
        </div>
      </div>

      <div
        className="flex items-center gap-2 px-3 h-[40px] flex-shrink-0 min-w-0"
        style={{ borderBottom: '1px solid #1a1a1a' }}
      >
        <div
          className="flex items-center flex-1 min-w-0 h-[26px] rounded-[6px] gap-2 px-2 transition-colors"
          style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}
        >
          <Search size={11} strokeWidth={2} className="text-[#666] flex-shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="flex-1 min-w-0 bg-transparent text-[12px] text-white placeholder-[#525252] outline-none"
            style={{ fontFamily: sans }}
          />
          <span
            className="text-[10px] text-[#525252] px-1.5 h-[16px] hidden md:inline-flex items-center rounded-[3px] border border-[#262626] tabular-nums flex-shrink-0"
            style={{ fontFamily: mono }}
          >
            ⌘K
          </span>
        </div>

        <LayoutGroup id="filter">
          <div
            className="flex p-[2px] rounded-[6px] relative h-[26px] flex-shrink-0"
            style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}
          >
            {(['all', 'live', 'idle'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`relative px-2 text-[11px] font-medium rounded-[4px] transition-colors duration-150 capitalize whitespace-nowrap ${
                  filter === f ? 'text-white' : 'text-[#888] hover:text-[#ededed]'
                }`}
                style={{ fontFamily: sans }}
              >
                {filter === f && (
                  <motion.div
                    layoutId="filter-pill"
                    className="absolute inset-0 rounded-[4px]"
                    style={{ background: '#1f1f1f' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10">{f}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <AnimatePresence>{error && <ErrorBanner message={error} onDismiss={() => {}} />}</AnimatePresence>

      <AnimatePresence mode="wait">
        {showForm && (
          <ServerForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditing(undefined);
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto ssh-scroll">
        {servers.length === 0 ? (
          <EmptyState onAdd={() => setShowForm(true)} />
        ) : filtered.length === 0 ? (
          <NoResults
            query={query}
            onClear={() => {
              setQuery('');
              setFilter('all');
            }}
          />
        ) : (
          <div>
            {groups.map(([groupName, items]) => {
              const collapsed = collapsedGroups.has(groupName);
              const liveInGroup = items.filter((s) => connByConfig.has(s.id)).length;
              return (
                <div key={groupName}>
                  <GroupHeader
                    title={groupName}
                    total={items.length}
                    live={liveInGroup}
                    collapsed={collapsed}
                    onToggle={() => toggleGroup(groupName)}
                  />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: easeOut }}
                        className="overflow-hidden"
                      >
                        {items.map((server) => (
                          <ServerRow
                            key={server.id}
                            config={server}
                            connection={connByConfig.get(server.id)}
                            isConnecting={connecting === server.id}
                            expanded={expandedId === server.id}
                            onToggle={() => setExpandedId((id) => (id === server.id ? null : server.id))}
                            onConnect={() => onConnect?.(server.id)}
                            onDisconnect={() => onDisconnect?.(server.id)}
                            onEdit={() => handleEdit(server)}
                            onDelete={() => onDeleteServer?.(server.id)}
                            onTerminal={() => onSpawnTerminal?.(server.id, server.name)}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-between px-3 h-[28px] flex-shrink-0 text-[10.5px] gap-2 min-w-0"
        style={{ borderTop: '1px solid #1a1a1a', background: '#0a0a0a', color: '#666' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 flex-shrink-0">
            <StatusDot state="live" size={4} />
            <span style={{ fontFamily: sans }}>ssh-agent</span>
          </span>
          <span className="text-[#333] flex-shrink-0">·</span>
          <span style={{ fontFamily: mono }} className="truncate">OpenSSH 9.6</span>
        </div>
        <span style={{ fontFamily: mono }} className="text-[#525252] flex-shrink-0">
          v0.4.2
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <div
        className="relative w-12 h-12 rounded-[10px] flex items-center justify-center mb-4"
        style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}
      >
        <OsIcon os="linux" size={20} className="text-[#888]" />
        <motion.span
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
          style={{ background: '#3aed8a', boxShadow: '0 0 6px #3aed8a80' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <h3
        className="text-[13px] font-semibold text-white"
        style={{ fontFamily: sans, letterSpacing: '-0.01em' }}
      >
        No connections yet
      </h3>
      <p
        className="text-[12px] text-[#888] mt-1.5 text-center max-w-[240px] leading-relaxed"
        style={{ fontFamily: sans }}
      >
        Add a remote machine to develop, deploy, and stream logs over SSH.
      </p>
      <div className="flex items-center gap-2 mt-5">
        <GhostButton variant="primary" onClick={onAdd}>
          <Plus size={11} strokeWidth={2.25} />
          New connection
        </GhostButton>
        <GhostButton>
          Documentation
          <ArrowUpRight size={10} strokeWidth={2} className="text-[#888]" />
        </GhostButton>
      </div>
    </div>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12">
      <div
        className="w-9 h-9 rounded-[8px] flex items-center justify-center mb-3"
        style={{ background: '#0a0a0a', border: '1px solid #1f1f1f' }}
      >
        <Search size={13} strokeWidth={2} className="text-[#666]" />
      </div>
      <p className="text-[12.5px] font-medium text-white" style={{ fontFamily: sans }}>
        No matches
      </p>
      <p className="text-[11.5px] text-[#888] mt-1 text-center" style={{ fontFamily: sans }}>
        {query ? (
          <>
            Nothing matches{' '}
            <span className="text-[#ededed]" style={{ fontFamily: mono }}>
              "{query}"
            </span>
          </>
        ) : (
          'No connections in this filter'
        )}
      </p>
      <button
        onClick={onClear}
        className="mt-3 text-[11.5px] text-[#888] hover:text-white transition-colors underline-offset-2 hover:underline"
        style={{ fontFamily: sans }}
      >
        Clear filters
      </button>
    </div>
  );
}