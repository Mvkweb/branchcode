import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Zap,
  Folder,
  SquareTerminal,
  Bug,
  Image as ImageIcon,
  ChevronDown,
  FolderOpen,
  GitBranch,
  PanelLeft,
  FolderPlus,
  CircleDashed,
  Trash2,
  FileText,
  Loader2,
  Check,
  Shield,
  Layers,
  ArrowUp,
  Square,
} from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useSessions } from '../hooks/useSessions';
import { useFileTree } from '../hooks/useFileTree';
import { ChatMessages } from './ChatMessages';
import { getConfig, setModel, getModelInfo, type ConfigInfo } from '../lib/tauri';

// ── Logo ──

const ClonkLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M10 2H6C3.79086 2 2 3.79086 2 6V10C2 10.5523 2.44772 11 3 11H10C10.5523 11 11 10.5523 11 10V3C11 2.44772 10.5523 2 10 2Z" />
    <path d="M21 2H14C13.4477 2 13 2.44772 13 3V10C13 10.5523 13.4477 11 14 11H21C21.5523 11 22 10.5523 22 10V6C22 3.79086 20.2091 2 18 2H21Z" />
    <path d="M11 14H3C2.44772 14 2 14.4477 2 15V18C2 20.2091 3.79086 22 6 22H10C10.5523 22 11 21.5523 11 21V14Z" />
    <path d="M22 14H14C13.4477 14 13 14.4477 13 15V21C13 21.5523 13.4477 22 14 22H18C20.2091 22 22 20.2091 22 18V14Z" />
  </svg>
);

const ModelSvgIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" fill="none" className={className}>
    <path d="M320 224V352H192V224H320Z" fill="#8A8A8A"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z" fill="white"/>
  </svg>
);

// ── Context Ring ──

function ContextRing({ percent }: { percent: number }) {
  const size = 16;
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="transform -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#1e1e1e"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#737373"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Context Usage ──

function ContextUsage({
  percent,
  tokens,
  spent,
}: {
  percent: number;
  tokens: string;
  spent: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ContextRing percent={percent} />
        <span>{percent}%</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="absolute bottom-full right-0 mb-2 w-[170px] rounded-xl border border-[#262626] bg-[#111] shadow-2xl shadow-black/50 px-3 py-2.5 z-50"
          >
            <div className="text-[12px] font-semibold text-neutral-100">Context</div>
            <div className="mt-1.5 space-y-0.5 text-[13px] leading-5">
              <div className="text-neutral-300 tabular-nums">
                {tokens} <span className="text-neutral-500">tokens</span>
              </div>
              <div className="text-neutral-500 tabular-nums">{percent}% used</div>
              <div className="text-neutral-500 tabular-nums">{spent} spent</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Constants ──

const FREE_MODELS = [
  { id: 'opencode/mimo-v2-pro-free', label: 'MiMo V2 Pro', desc: 'Xiaomi' },
  { id: 'opencode/mimo-v2-omni-free', label: 'MiMo V2 Omni', desc: 'Multimodal' },
  { id: 'opencode/big-pickle', label: 'Big Pickle', desc: 'Stealth' },
  { id: 'opencode/qwen3.6-plus-free', label: 'Qwen3.6 Plus', desc: 'Alibaba' },
  { id: 'opencode/nemotron-3-super-free', label: 'Nemotron 3 Super', desc: 'NVIDIA' },
  { id: 'opencode/minimax-m2.5-free', label: 'MiniMax M2.5', desc: 'MiniMax' },
];

function getModelLabel(id?: string | null) {
  if (!id) return null;
  const found = FREE_MODELS.find((m) => m.id === id);
  return found ? found.label : id.split('/').pop() || id;
}

// ── Sidebar Item ──

function SidebarItem({
  icon,
  label,
  active,
  bg,
  onClick,
  onDelete,
}: {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  bg?: string;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] transition-colors group
        ${active ? (bg || 'text-neutral-200 font-medium') : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-neutral-200'}
        ${bg && active ? bg : ''}`}
    >
      {icon ? (
        <span className="text-neutral-500 flex-shrink-0">{icon}</span>
      ) : (
        <span className="w-3.5 flex-shrink-0" />
      )}
      <span className="truncate flex-1">{label}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all flex-shrink-0"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

// ── Suggestion Card ──

function SuggestionCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-[#111] border border-[#1e1e1e] hover:border-[#333] rounded-xl p-4 cursor-pointer transition-all hover:bg-[#161616] flex items-center gap-4 text-left w-full"
    >
      <div
        className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-neutral-200 truncate">{title}</h3>
        <p className="text-[13px] text-neutral-500 truncate mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ── Model Dropdown (for chat toolbar) ──

function ModelDropdown({
  config,
  onChanged,
}: {
  config: ConfigInfo | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = async (id: string) => {
    setSaving(id);
    try {
      await setModel(id);
      onChanged();
      setOpen(false);
    } catch {
      /* */
    }
    setSaving(null);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 p-1 rounded-lg transition-colors ${
          open ? 'bg-[#222]' : 'hover:bg-[#222]'
        }`}
      >
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center overflow-hidden">
          <ModelSvgIcon className="w-6 h-6" />
        </div>
        <ChevronDown size={14} className="text-neutral-500" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ transformOrigin: 'bottom left' }}
            className="absolute bottom-full mb-2 left-0 w-[260px] bg-[#111] border border-[#262626] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 flex flex-col p-1.5"
          >
            {/* Provider Section */}
            <div className="flex flex-col gap-0.5">
              <button className="w-full flex items-center justify-between px-2 py-2 rounded-lg bg-[#1a1a1a] text-neutral-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center overflow-hidden">
                    <ModelSvgIcon className="w-7 h-7" />
                  </div>
                  <span className="text-[14px] font-medium text-neutral-100">Opencode</span>
                </div>
                <Check size={16} className="text-neutral-300" />
              </button>
            </div>

            <div className="h-px bg-[#262626] mx-2 my-2" />

            {/* Model Section */}
            <div className="px-2 py-1 text-[12px] font-medium text-neutral-500 mb-1">Model</div>
            <div className="flex flex-col gap-0.5 max-h-[240px] overflow-y-auto custom-scrollbar">
              {FREE_MODELS.map((m) => {
                const active = config?.model === m.id;
                const isSaving = saving === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => pick(m.id)}
                    disabled={!!saving}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors
                      ${active ? 'bg-[#1a1a1a] text-neutral-200' : 'text-neutral-300 hover:bg-[#1a1a1a] hover:text-neutral-200'}
                      ${saving && !isSaving ? 'opacity-40' : ''}`}
                  >
                    <span className="text-[14px] truncate">{m.label}</span>
                    {isSaving && <Loader2 size={16} className="animate-spin text-neutral-400" />}
                    {active && !isSaving && <Check size={16} className="text-neutral-300" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Inline Model Picker (for landing page) ──

function InlineModelPicker({
  config,
  onChanged,
}: {
  config: ConfigInfo | null;
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const pick = async (id: string) => {
    setSaving(id);
    try {
      await setModel(id);
      onChanged();
    } catch {
      /* */
    }
    setSaving(null);
  };

  const currentModel = config?.model;

  return (
    <div className="w-full mb-8">
      <div className="text-[11px] font-semibold text-neutral-500 tracking-wider mb-3">
        {currentModel ? 'MODEL' : 'SELECT A MODEL'}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FREE_MODELS.map((m) => {
          const active = currentModel === m.id;
          const isSaving = saving === m.id;
          return (
            <button
              key={m.id}
              onClick={() => pick(m.id)}
              disabled={!!saving}
              className={`relative text-left px-3 py-2.5 rounded-xl border transition-all ${
                active
                  ? 'border-[#333] bg-[#161616]'
                  : 'border-[#1a1a1a] bg-[#0e0e0e] hover:border-[#2a2a2a] hover:bg-[#131313]'
              } ${saving && !isSaving ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-neutral-200 truncate">
                  {m.label}
                </span>
                {isSaving && <Loader2 size={12} className="animate-spin text-neutral-400 flex-shrink-0" />}
                {active && !isSaving && <Check size={12} className="text-neutral-400 flex-shrink-0" />}
              </div>
              <div className="text-[11px] text-neutral-600 mt-0.5">{m.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Working Indicator ──

function WorkingIndicator({ elapsed }: { elapsed: number }) {
  return (
    <div className="flex items-center justify-center gap-2 text-[12px] text-neutral-500 py-3">
      <div className="flex gap-[3px] items-end h-3">
        <div className="w-[3px] h-2 bg-neutral-600 rounded-full animate-pulse" />
        <div
          className="w-[3px] h-3 bg-neutral-600 rounded-full animate-pulse"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="w-[3px] h-2 bg-neutral-600 rounded-full animate-pulse"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span>Working on it</span>
      <span className="text-neutral-600 tabular-nums">{elapsed.toFixed(1)}s</span>
    </div>
  );
}

// ── Main App ──

export default function App() {
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [input, setInput] = useState('');
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [showFileTree, setShowFileTree] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isVisible = isPinned || isHovered;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomTextareaRef = useRef<HTMLTextAreaElement>(null);
  const suppressAutoLoadSessionRef = useRef<string | null>(null);

  const { messages, isStreaming, status, send, loadMessages, clearMessages, getSessionUsage } = useChat();
  const { sessions, activeSessionId, createSession, deleteSession, selectSession, loadSessions } =
    useSessions();
  const { files, loadDirectory } = useFileTree();
  const [contextLimit, setContextLimit] = useState(200000);

  const loadConfig = useCallback(() => {
    getConfig().then(setConfig).catch(console.error);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config?.model) {
      const parts = config.model.split('/');
      const providerId = parts.length > 1 ? parts[0]! : 'opencode';
      const modelId = parts.length > 1 ? parts[1]! : parts[0]!;
      getModelInfo(providerId, modelId)
        .then((info) => {
          const limit = info.limit?.context;
          if (limit && limit > 0) setContextLimit(limit);
        })
        .catch(console.error);
    }
  }, [config?.model]);

  useEffect(() => {
    if (config?.project_dir) loadDirectory(config.project_dir);
  }, [config?.project_dir, loadDirectory]);

  useEffect(() => {
    if (!activeSessionId) return;

    if (suppressAutoLoadSessionRef.current === activeSessionId) {
      suppressAutoLoadSessionRef.current = null;
      return;
    }

    clearMessages();
    loadMessages(activeSessionId);
  }, [activeSessionId, clearMessages, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    const ta = textareaRef.current || bottomTextareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Elapsed timer for streaming
  useEffect(() => {
    if (!isStreaming) {
      setElapsed(0);
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !config?.model) return;

    let sessionId = activeSessionId;

    if (!sessionId) {
      const session = await createSession(text.slice(0, 50));
      if (!session) return;

      sessionId = session.id;
      suppressAutoLoadSessionRef.current = sessionId;
    }

    await send(sessionId, text, 'general');
    setInput('');
    await loadSessions();
  }, [input, isStreaming, config?.model, activeSessionId, createSession, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = async () => {
    await createSession();
    clearMessages();
  };

  const hasMessages = messages.length > 0;
  const canSend = !!input.trim() && !isStreaming && !!config?.model;
  const usage = getSessionUsage();
  const usagePercent = contextLimit > 0 ? Math.min(999, Math.round((usage.totalTokens / contextLimit) * 100)) : 0;
  const costStr = `$${usage.cost.toFixed(4)}`;
  const tokenStr = usage.totalTokens.toLocaleString();

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] font-sans text-white overflow-hidden relative">
      {/* Window Controls */}
      <div className="absolute top-0 left-0 h-12 flex items-center px-4 gap-2 z-40 pointer-events-none">
        <div className="w-3 h-3 rounded-full bg-[#ff5f56] pointer-events-auto cursor-pointer" />
        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] pointer-events-auto cursor-pointer" />
        <div className="w-3 h-3 rounded-full bg-[#27c93f] pointer-events-auto cursor-pointer" />
      </div>

      {/* Hover Trigger */}
      {!isPinned && (
        <div
          className="absolute left-0 top-0 bottom-0 w-8 z-20 cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

      {/* Spacer */}
      <motion.div
        initial={false}
        animate={{ width: isPinned ? 260 : 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
        className="flex-shrink-0 h-full"
      />

      {/* ── Sidebar ── */}
      <motion.div
        initial={false}
        animate={{ x: isVisible ? 0 : -260 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
        onMouseLeave={() => {
          if (!isPinned) setIsHovered(false);
        }}
        className="absolute left-0 top-0 bottom-0 w-[260px] bg-[#0f0f0f] border-r border-[#1a1a1a] flex flex-col z-30"
      >
        <div className="h-12 flex items-center px-4 justify-end">
          <button
            onClick={() => {
              setIsPinned(!isPinned);
              setIsHovered(false);
            }}
            className={`transition-colors ${
              isPinned
                ? 'text-neutral-500 hover:text-neutral-300'
                : 'text-neutral-200 hover:text-white'
            }`}
          >
            <PanelLeft size={16} />
          </button>
        </div>

        <div className="px-4 py-2">
          <ClonkLogo className="w-7 h-7 text-white" />
        </div>

        <div className="px-4 py-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] rounded-lg text-sm text-neutral-200 transition-colors shadow-sm"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        <div className="px-4 py-2">
          <button className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
            <Zap size={16} />
            Skills
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar mt-4">
          <div className="px-4 mb-6">
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 mb-2 tracking-wider">
              CHATS
              <button
                onClick={handleNewChat}
                className="hover:text-neutral-300 transition-colors"
              >
                <FolderPlus size={14} />
              </button>
            </div>
            <div className="space-y-0.5">
              {sessions.map((session) => (
                <SidebarItem
                  key={session.id}
                  icon={<Folder size={14} />}
                  label={session.title || 'Untitled'}
                  active={session.id === activeSessionId}
                  onClick={() => selectSession(session.id)}
                  onDelete={() => deleteSession(session.id)}
                />
              ))}
              {sessions.length === 0 && (
                <div className="text-[12px] text-neutral-600 px-2 py-1">No chats yet</div>
              )}
            </div>
          </div>

          <div className="px-4 mb-6">
            <button
              onClick={() => setShowFileTree(!showFileTree)}
              className="flex items-center w-full justify-between text-[11px] font-semibold text-neutral-500 mb-2 tracking-wider hover:text-neutral-300 transition-colors"
            >
              <div className="flex items-center gap-2">
                <SquareTerminal size={12} />
                FILES
              </div>
              <ChevronDown
                size={12}
                className={`transition-transform ${showFileTree ? 'rotate-180' : ''}`}
              />
            </button>
            {showFileTree && (
              <div className="space-y-0.5">
                {Object.entries(files).map(([name, info]) => {
                  const entry = info as Record<string, unknown>;
                  const isDir = entry.type === 'directory';
                  return (
                    <SidebarItem
                      key={name}
                      icon={isDir ? <Folder size={14} /> : <FileText size={14} />}
                      label={name}
                      onClick={() => {
                        if (isDir && entry.path) loadDirectory(entry.path as string);
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto p-4 space-y-4 border-t border-[#1a1a1a]">
          {config && (
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Model</span>
              <span className="text-neutral-400 truncate max-w-[120px]">
                {getModelLabel(config.model) || 'None'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <button className="flex items-center gap-2 hover:text-neutral-300 transition-colors">
              <div className="w-2 h-2 rounded-full bg-neutral-600" />
              What's new
            </button>
            <span className="text-neutral-600">v0.1.50</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer group hover:bg-[#1a1a1a] p-1.5 -ml-1.5 rounded-lg transition-colors">
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Paulius&backgroundColor=b6e3f4"
                alt="Paulius"
                className="w-6 h-6 rounded-full bg-neutral-800"
              />
              <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                Paulius
              </span>
            </div>
            <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
              <Bug size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0a]">
        {!hasMessages ? (
          <>
            {/* ── Landing ── */}
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
                backgroundSize: '32px 32px',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/60 to-[#0a0a0a] pointer-events-none" />

            <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full px-8 z-10 -mt-8">
              <div className="flex flex-col items-center mb-8">
                <div className="mb-5 opacity-80">
                  <ClonkLogo className="w-14 h-14 text-neutral-400" />
                </div>
                <h1 className="text-[44px] font-medium text-neutral-100 tracking-tight">
                  Let's clonk
                </h1>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mb-8">
                <button
                  onClick={handleNewChat}
                  className="bg-transparent hover:bg-[#1a1a1a] border border-[#333] rounded-full py-2.5 px-5 flex items-center gap-2 text-sm text-neutral-200 transition-colors"
                >
                  <Plus size={16} />
                  New Project
                </button>
                <button className="bg-transparent hover:bg-[#1a1a1a] border border-transparent hover:border-[#333] rounded-full py-2.5 px-5 flex items-center gap-2 text-sm text-neutral-400 transition-colors">
                  <FolderOpen size={16} />
                  Existing Project
                </button>
              </div>

              {/* Inline Model Picker */}
              <InlineModelPicker config={config} onChanged={loadConfig} />

              {/* Input */}
              <div className="w-full bg-[#111] border border-[#282828] rounded-2xl p-5 shadow-2xl shadow-black/30 focus-within:border-[#444] transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isStreaming || !config?.model}
                  className="w-full bg-transparent text-neutral-200 placeholder-neutral-600 resize-none outline-none text-[15px] min-h-[100px] disabled:opacity-50"
                  placeholder={
                    config?.model
                      ? 'Describe what you want to build...'
                      : 'Select a model above to start...'
                  }
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1.5 rounded-lg hover:bg-[#222]">
                      <ImageIcon size={18} />
                    </button>
                    <ModelDropdown config={config} onChanged={loadConfig} />
                    <div className="h-4 w-px bg-[#282828] mx-1" />
                    <button className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 rounded-lg hover:bg-[#222]">
                      <CircleDashed size={16} className="text-[#e0443e]" />
                      MCP Servers
                      <ChevronDown size={14} className="opacity-50" />
                    </button>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      canSend
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-[#222] text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Suggestions */}
              <div className="w-full grid grid-cols-2 gap-4 mt-6">
                <SuggestionCard
                  icon={
                    <div className="w-4 h-4 border-2 border-current rounded-full border-t-transparent animate-spin" />
                  }
                  iconBg="bg-[#1a2b4c]"
                  iconColor="text-[#4a8cff]"
                  title="3D Solar System"
                  description="Build an interactive Three.js solar ..."
                  onClick={() => setInput('Build an interactive 3D solar system with Three.js')}
                />
                <SuggestionCard
                  icon={<PanelLeft size={16} />}
                  iconBg="bg-[#2563eb]"
                  iconColor="text-white"
                  title="Kanban SaaS Landing Page"
                  description="Modern landing page for a kanban..."
                  onClick={() => setInput('Build a modern kanban SaaS landing page')}
                />
              </div>
            </div>

            <div className="absolute bottom-6 right-6 flex gap-6 z-10">
              <button className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                <FolderOpen size={16} />
                New Project
              </button>
              <button className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                <GitBranch size={16} />
                Clone Repository
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Chat ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-[780px] mx-auto w-full py-6 px-5 space-y-5">
                {messages.map((msg) => (
                  <ChatMessages key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Working status */}
            {isStreaming && <WorkingIndicator elapsed={elapsed} />}

            {/* Chat Input */}
            <div className="border-t border-[#161616] bg-[#0a0a0a] flex-shrink-0">
              <div className="max-w-[780px] mx-auto p-4">
                <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-3 focus-within:border-[#444] transition-colors shadow-2xl">
                  <textarea
                    ref={bottomTextareaRef}
                    className="w-full bg-transparent border-none outline-none text-neutral-200 placeholder-neutral-600 text-[15px] resize-none leading-relaxed min-h-[44px] max-h-[300px] py-1 px-1"
                    placeholder='Type your message... "@" to target files, skills, or MCP servers'
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming}
                    rows={1}
                  />

                  <div className="flex items-center justify-between mt-2 pl-1">
                    <div className="flex items-center gap-2.5">
                      <ModelDropdown config={config} onChanged={loadConfig} />
                      <button className="flex items-center gap-1 text-[13px] text-neutral-400 hover:text-neutral-200 transition-colors p-1 rounded-md hover:bg-[#222]">
                        <Zap size={14} />
                        Low
                        <ChevronDown size={12} className="opacity-50" />
                      </button>
                      <div className="h-3 w-px bg-[#2a2a2a]" />
                      <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 rounded-md hover:bg-[#222]">
                        <Plus size={16} />
                      </button>
                      <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 rounded-md hover:bg-[#222]">
                        <ImageIcon size={16} />
                      </button>
                      <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 rounded-md hover:bg-[#222]">
                        <Bug size={16} />
                      </button>
                      <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 rounded-md hover:bg-[#222]">
                        <Layers size={16} />
                      </button>
                      <div className="h-3 w-px bg-[#2a2a2a]" />
                      <button className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1a] hover:bg-[#222] border border-[#2a2a2a] rounded-lg transition-colors group">
                        <div className="w-2.5 h-2.5 bg-[#ff5f56] rounded-[3px] group-hover:shadow-[0_0_8px_rgba(255,95,86,0.4)] transition-shadow" />
                        <span className="text-[12px] font-medium text-neutral-200">Clonk</span>
                      </button>
                    </div>

                    <button
                      onClick={handleSend}
                      className={`w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 transition-colors ${
                        isStreaming
                          ? 'bg-white hover:bg-neutral-200 text-black'
                          : canSend
                            ? 'bg-white hover:bg-neutral-200 text-black'
                            : 'bg-[#222] text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      {isStreaming ? (
                        <Square size={12} fill="currentColor" />
                      ) : (
                        <ArrowUp size={16} strokeWidth={2.5} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer bar */}
                <div className="flex items-center justify-between mt-3 px-2">
                  <div className="flex items-center gap-4 text-[11px] text-neutral-500">
                    <button className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors">
                      <GitBranch size={12} />
                      master
                      <ChevronDown size={10} className="opacity-50" />
                    </button>
                    <button className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors">
                      <Shield size={12} />
                      Full Access
                      <ChevronDown size={10} className="opacity-50" />
                    </button>
                  </div>
                  <ContextUsage percent={usagePercent} tokens={tokenStr} spent={costStr} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}