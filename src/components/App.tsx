import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Zap,
  Folder,
  SquareTerminal,
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
  Star,
  Search,
  Server,
  Globe,
} from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useSessions } from '../hooks/useSessions';
import { useFileTree } from '../hooks/useFileTree';
import { useRemoteFileTree } from '../hooks/useRemoteFileTree';
import { useGit } from '../hooks/useGit';
import { useSsh } from '../hooks/useSsh';
import { SettingsModal } from './Settings';
import UpdateModal from './UpdateModal';
import { ChatMessages, MessagePlaceholder } from './ChatMessages';
import { GitPanel } from './GitPanel';
import { TerminalPanel } from './TerminalPanel';
import { TopBar } from './TopBar';
import { useVirtualMessages } from '../hooks/useVirtualScroll';
import { getConfig, setModel, getModelInfo, getProviders, getAvailableModels, sshListServers, type ConfigInfo, type ProviderInfo, type SshServerConfig } from '../lib/tauri';
import { DirectoryPickerModal, type SessionSource } from './DirectoryPickerModal';

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

const McpIcon = ({ className, size = 16 }: { className?: string; size?: number }) => (
  <svg fill="currentColor" fillRule="evenodd" style={{ flex: 'none', lineHeight: 1 }} viewBox="0 0 24 24" className={className} width={size} height={size}>
    <title>ModelContextProtocol</title>
    <path d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z" />
    <path d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z" />
  </svg>
);

const PlanIcon = ({ className, size = 16 }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="5" width="6" height="6" rx="1" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </svg>
);

const BuildIcon = ({ className, size = 16 }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 12l-8.5 8.5c-.8.8-2.1.8-2.8 0-.8-.8-.8-2.1 0-2.8L12 9" />
    <path d="M17.6 4.4L15 7l-2.6-2.6a2.1 2.1 0 0 1 0-3 2.1 2.1 0 0 1 3 0l2.2 2.2a2.1 2.1 0 0 1 0 3z" />
    <path d="m15 7 2.6 2.6" />
  </svg>
);

function ModeSelector({ mode, onChange }: { mode: 'plan' | 'build', onChange: (mode: 'plan' | 'build') => void }) {
  const [hovered, setHovered] = useState(false);

  const showPlan = hovered || mode === 'plan';
  const showBuild = hovered || mode === 'build';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#444] rounded-lg transition-colors overflow-hidden h-[26px] shadow-sm select-none"
    >
      <motion.button
        initial={false}
        animate={{
          width: showPlan ? 60 : 0,
          opacity: showPlan ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        onClick={() => onChange('plan')}
        className={`relative flex items-center justify-center h-full transition-colors overflow-hidden ${
          mode === 'plan' 
            ? (hovered ? 'bg-[#2a2a2a] text-white' : 'text-neutral-200') 
            : 'text-neutral-500 hover:text-white hover:bg-[#252525]'
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 w-[60px]">
          <PlanIcon size={13} className={`flex-shrink-0 transition-colors ${mode === 'plan' && !hovered ? 'text-neutral-400' : ''}`} />
          <span className="text-[12px] font-medium">Plan</span>
        </div>
      </motion.button>

      <motion.button
        initial={false}
        animate={{
          width: showBuild ? 62 : 0,
          opacity: showBuild ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        onClick={() => onChange('build')}
        className={`relative flex items-center justify-center h-full transition-colors overflow-hidden ${
          mode === 'build' 
            ? (hovered ? 'bg-[#2a2a2a] text-white' : 'text-neutral-200') 
            : 'text-neutral-500 hover:text-white hover:bg-[#252525]'
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 w-[62px]">
          <BuildIcon size={13} className={`flex-shrink-0 transition-colors ${mode === 'build' && !hovered ? 'text-neutral-400' : ''}`} />
          <span className="text-[12px] font-medium">Build</span>
        </div>
      </motion.button>
    </div>
  );
}

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

function ContextUsage({
  percent,
  tokens,
  spent,
}: {
  percent: number;
  tokens: string;
  spent: string;
}) {
  const[open, setOpen] = useState(false);

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

let providersCache: { all: ProviderInfo[] } | null = null;

function getModelLabel(id?: string | null) {
  if (!id) return null;
  if (providersCache) {
    for (const p of providersCache.all) {
      if (p.models && p.models[id]) return p.models[id].name || id;
    }
  }
  return id.split('/').pop() || id;
}

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

function ProjectFolder({ 
  name, 
  icon, 
  children, 
  defaultOpen = false 
}: { 
  name: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  defaultOpen?: boolean; 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors group rounded-lg hover:bg-[#1a1a1a]"
      >
        <div className="flex items-center gap-2 overflow-hidden truncate">
          <div className="flex items-center justify-center w-4 h-4 text-neutral-500 group-hover:text-neutral-300">
            {icon}
          </div>
          <span className="flex-1 text-left truncate font-medium">{name}</span>
        </div>
        <ChevronDown size={12} className={`transition-transform duration-200 text-neutral-500 ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-6 pr-1 py-1 space-y-0.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

function ModelDropdown({
  config,
  providers,
  availableModels,
  onChanged,
}: {
  config: ConfigInfo | null;
  providers: ProviderInfo[];
  availableModels?: string[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const flattenedModels = useMemo(() => {
    const list: { id: string; label: string; desc: string; context: string; priceIn: string; priceOut: string; isFree: boolean }[] =[];
    const freeSet = new Set(availableModels ||[]);
    providers.forEach(p => {
      Object.entries(p.models || {}).forEach(([mId, m]) => {
        const bareId = mId.includes('/') ? mId.split('/')[1]! : mId;
        const isFree = freeSet.size > 0 
          ? freeSet.has(bareId) 
          : ((m.cost?.input === 0 && m.cost?.output === 0) || mId.endsWith('-free'));
        const priceIn = m.cost?.input !== undefined ? `$${m.cost.input}` : '$0.00';
        const priceOut = m.cost?.output !== undefined ? `$${m.cost.output}` : '$0.00';
        const context = m.limit?.context ? `${Math.floor(m.limit.context / 1000)}K` : '128K';
        
        list.push({
          id: mId,
          label: m.name || mId,
          desc: p.name || p.id,
          context,
          priceIn,
          priceOut,
          isFree,
        });
      });
    });
    return list;
  }, [providers]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  },[]);

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
            {/* Search Input */}
            <div className="p-1 px-1.5 border-b border-[#262626] mb-1">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search models"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-none pl-8 pr-3 py-1.5 text-[13px] font-medium text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#3a3a3a] rounded bg-[#111] hover:bg-[#151515] focus:bg-[#1a1a1a] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Provider Section */}
            <div className="flex flex-col gap-0.5 px-1.5 pb-1">
              <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] text-neutral-200 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-[4px] flex items-center justify-center overflow-hidden bg-[#2a2a2a] flex-shrink-0">
                    <ModelSvgIcon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[13px] font-medium text-neutral-100">Opencode</span>
                </div>
              </div>
              <div className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[#1a1a1a] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 flex items-center justify-center -ml-0.5">
                    <Plus size={14} />
                  </div>
                  <span className="text-[13px] font-medium">Add new provider</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 mt-1 border-t border-[#262626]">
              <div className="w-3.5 h-3.5 rounded-sm flex items-center justify-center overflow-hidden">
                <ModelSvgIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-bold text-neutral-500 tracking-widest leading-none">RECENT</span>
            </div>

            {/* Model Section */}
            <div className="flex flex-col gap-0.5 px-1 mt-0.5 pb-1 max-h-[260px] overflow-y-auto custom-scrollbar">
              {flattenedModels.filter((m: any) => m.isFree).filter((m: any) => {
                const q = search.toLowerCase();
                return m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);
              }).map((m) => {
                const active = config?.model === m.id;
                const isSaving = saving === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => pick(m.id)}
                    disabled={!!saving}
                    className={`w-full group relative flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors
                      ${active ? 'bg-[#2a2a2a] text-neutral-100' : 'text-neutral-300 hover:bg-[#202020] hover:text-neutral-200'}
                      ${saving && !isSaving ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-4 flex-1">
                      <div className="w-4 h-4 rounded-[4px] flex items-center justify-center overflow-hidden bg-[#2a2a2a] flex-shrink-0">
                         <ModelSvgIcon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-[13px] font-medium truncate leading-none">{m.label}</span>
                      <span className="text-[11px] text-neutral-500 font-medium flex-shrink-0 leading-none">{m.context}</span>
                    </div>

                    <div className="flex items-center flex-shrink-0 shrink-0 h-[16px]">
                      <div className="hidden group-hover:flex items-center transition-opacity whitespace-nowrap text-[11px] text-neutral-500 mr-2.5">
                        In {m.priceIn} • Out {m.priceOut}
                      </div>
                      <div className="w-4 h-4 flex items-center justify-center">
                        {isSaving ? (
                          <Loader2 size={13} className="animate-spin text-[#e87f39]" />
                        ) : active ? (
                          <Check size={14} className="text-[#e87f39]" strokeWidth={2.5} />
                        ) : null}
                      </div>
                      <Star size={13} strokeWidth={2} className="ml-1 text-neutral-600 hover:text-neutral-300 transition-colors hidden group-hover:block" />
                    </div>
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

function InlineModelPicker({
  config,
  providers,
  availableModels,
  onChanged,
}: {
  config: ConfigInfo | null;
  providers: ProviderInfo[];
  availableModels?: string[];
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const flattenedModels = useMemo(() => {
    const list: { id: string; label: string; desc: string; context: string; priceIn: string; priceOut: string; isFree: boolean }[] = [];
    const freeSet = new Set(availableModels ||[]);
    providers.forEach(p => {
      Object.entries(p.models || {}).forEach(([mId, m]) => {
        const bareId = mId.includes('/') ? mId.split('/')[1]! : mId;
        const isFree = freeSet.size > 0 
          ? freeSet.has(bareId) 
          : ((m.cost?.input === 0 && m.cost?.output === 0) || mId.endsWith('-free'));
        const priceIn = m.cost?.input !== undefined ? `$${m.cost.input}` : '$0.00';
        const priceOut = m.cost?.output !== undefined ? `$${m.cost.output}` : '$0.00';
        const context = m.limit?.context ? `${Math.floor(m.limit.context / 1000)}K` : '128K';
        
        list.push({
          id: mId,
          label: m.name || mId,
          desc: p.name || p.id,
          context,
          priceIn,
          priceOut,
          isFree,
        });
      });
    });
    return list;
  }, [providers]);

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
        {flattenedModels.filter((m: any) => m.isFree).slice(0, 6).map((m) => {
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
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-[13px] font-medium text-neutral-200 truncate">
                    {m.label}
                  </span>
                  <span className="text-[11px] text-neutral-600 flex-shrink-0">
                    {m.context}
                  </span>
                </div>
                {isSaving && <Loader2 size={12} className="animate-spin text-neutral-400 flex-shrink-0" />}
                {active && !isSaving && <Check size={12} className="text-[#e87f39] flex-shrink-0" strokeWidth={2.5} /> }
              </div>
              <div className="text-[11px] text-neutral-600 mt-0.5 flex flex-wrap items-center justify-between">
                <span>{m.desc}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  In {m.priceIn} • Out {m.priceOut}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

function VirtualizedChat({
  messages,
  messagesEndRef,
  isLoading,
}: {
  messages: import('../hooks/useChat').Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  isLoading?: boolean;
}) {
  const { containerRef, observeElement, isVisible } = useVirtualMessages(messages, 10);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-[780px] mx-auto w-full py-6 px-5 space-y-5">
        {isLoading && messages.length === 0 ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="h-4 bg-neutral-800 rounded w-16" />
                <div className="h-4 bg-neutral-800 rounded w-3/4" />
                <div className="h-4 bg-neutral-800 rounded w-1/2" />
              </div>
            ))}
          </>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg.id}
              ref={(el) => { if (el) observeElement(el, msg.id); }}
            >
              {isVisible(idx) ? (
                <ChatMessages message={msg} />
              ) : (
                <MessagePlaceholder message={msg} />
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default function App() {
  const [isPinned, setIsPinned] = useState(true);
  const[isHovered, setIsHovered] = useState(false);
  const [input, setInput] = useState('');
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const[providers, setProviders] = useState<ProviderInfo[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showFileTree, setShowFileTree] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);

  // SSH state
  const ssh = useSsh();
  
  // Terminal sizing state
  const [showTerminal, setShowTerminal] = useState(false);
  const[terminalHeight, setTerminalHeight] = useState(380);
  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const[showSettings, setShowSettings] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [appMode, setAppMode] = useState<'plan' | 'build'>('build');
  
  // Session source for working directory
  const [sessionSource, setSessionSource] = useState<SessionSource | null>(null);
  const [showDirectoryPicker, setShowDirectoryPicker] = useState(false);
  const [savedSshServers, setSavedSshServers] = useState<SshServerConfig[]>([]);

  const isVisible = isPinned || isHovered;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomTextareaRef = useRef<HTMLTextAreaElement>(null);
  const suppressAutoLoadSessionRef = useRef<string | null>(null);

  const { messages, isStreaming, isLoading, status, send, loadMessages, clearMessages, getSessionUsage } = useChat();
  const { sessions, activeSessionId, createSession, deleteSession, selectSession, renameSessionLocal } =
    useSessions();
  const { files, loadDirectory } = useFileTree();
  const remoteFileTree = useRemoteFileTree();
  const git = useGit(true, 5000);
  const [contextLimit, setContextLimit] = useState(200000);

  const loadConfig = useCallback(() => {
    getConfig().then(setConfig).catch(console.error);
    getProviders()
      .then((p) => {
        providersCache = p;
        setProviders(p.all);
      })
      .catch(console.error);
    getAvailableModels()
      .then(setAvailableModels)
      .catch(console.error);
  },[]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);
  
  // Load SSH servers
  useEffect(() => {
    sshListServers()
      .then(setSavedSshServers)
      .catch(console.error);
  }, []);

  const findContextLimit = useCallback((modelId: string): number => {
    const pCache = providersCache;
    if (!pCache) return 200000;

    for (const provider of pCache.all) {
      if (provider.models && provider.models[modelId]) {
        const model = provider.models[modelId];
        return model.limit?.context || 200000;
      }
    }
    return 200000;
  },[]);

  useEffect(() => {
    if (config?.model) {
      const parts = config.model.split('/');
      const providerId = parts.length > 1 ? parts[0]! : 'opencode';
      const modelId = parts.length > 1 ? parts[1]! : parts[0]!;

      const cachedLimit = findContextLimit(modelId);
      if (cachedLimit !== 200000) {
        setContextLimit(cachedLimit);
        return;
      }

      getModelInfo(providerId, modelId)
        .then((info) => {
          const limit = info.limit?.context;
          setContextLimit(limit && limit > 0 ? limit : 200000);
        })
        .catch(() => {
          setContextLimit(200000);
        });
    }
  },[config?.model, findContextLimit]);

  useEffect(() => {
    if (config?.project_dir) loadDirectory(config.project_dir);
  }, [config?.project_dir, loadDirectory]);

  useEffect(() => {
    // If we have an active remote connection, default to listing `.`
    if (ssh.activeConnectionId) {
      remoteFileTree.loadDirectory(ssh.activeConnectionId, '.');
    }
  }, [ssh.activeConnectionId, remoteFileTree.loadDirectory]);

  useEffect(() => {
    if (!activeSessionId) return;

    if (suppressAutoLoadSessionRef.current === activeSessionId) {
      suppressAutoLoadSessionRef.current = null;
      return;
    }
    loadMessages(activeSessionId);
  },[activeSessionId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  },[messages, status]);

  useEffect(() => {
    const ta = textareaRef.current || bottomTextareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }
  }, [input]);

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
    if (!input.trim() || isStreaming || !config?.model) return;

    const text = input.trim();
    let sessionId = activeSessionId;

    if (!sessionId) {
      // Pass workdir and sshConfigId from directory picker selection
      const session = await createSession(
        text.slice(0, 50),
        sessionSource?.path,
        sessionSource?.configId,
      );
      if (!session) return;

      sessionId = session.id;
      suppressAutoLoadSessionRef.current = sessionId;
    }

    await send(sessionId, text, appMode);
    setInput('');
  },[input, isStreaming, config?.model, activeSessionId, createSession, send, appMode, sessionSource]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = async () => {
    clearMessages();
    setSessionSource(null);
    selectSession('');  // Clear active session so handleSend creates a new one
    setShowDirectoryPicker(true);
  };
  
  const handleDirectorySelect = async (path: string, configId?: string) => {
    // Don't create a session yet — just remember the source so handleSend
    // can pass it when the user actually sends their first message.
    setSessionSource({ path, configId });
    setShowDirectoryPicker(false);
  };

  // ── Drag & Resize Logic for Terminal Panel ──
  const handleTerminalResize = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      setTerminalHeight(380);
      return;
    }
    
    e.preventDefault();
    setIsDraggingTerminal(true);
    const startY = e.clientY;
    const startHeight = terminalHeight;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      let newHeight = startHeight + delta;
      
      // Clamp between 100px and 85% of screen height
      newHeight = Math.max(100, Math.min(newHeight, window.innerHeight * 0.85));
      setTerminalHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsDraggingTerminal(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const hasMessages = messages.length > 0;
  const canSend = !!input.trim() && !isStreaming && !!config?.model;
  const usage = getSessionUsage();
  
  const usagePercent = contextLimit > 0 ? Math.min(100, Math.floor((usage.contextTokens / contextLimit) * 100)) : 0;
  const costStr = `$${usage.cost.toFixed(4)}`;
  const tokenStr = usage.totalTokens.toLocaleString();

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] font-sans text-white overflow-hidden relative">
      <AnimatePresence>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        {showUpdateModal && <UpdateModal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} />}
      </AnimatePresence>
      
      {/* Window Controls */}
      <div className="absolute top-0 left-0 h-12 flex items-center px-4 gap-2 z-40 pointer-events-none">
        <div className="w-3 h-3 rounded-full bg-[#ff5f56] pointer-events-auto cursor-pointer" />
        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] pointer-events-auto cursor-pointer" />
        <div className="w-3 h-3 rounded-full bg-[#27c93f] pointer-events-auto cursor-pointer" />
      </div>

      {!isPinned && (
        <div
          className="absolute left-0 top-0 bottom-0 w-8 z-20 cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
        />
      )}

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
              THREADS
              <button
                onClick={handleNewChat}
                className="hover:text-neutral-300 transition-colors"
                title="New Thread"
              >
                <FolderPlus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {/* Local Workspace Project */}
              <ProjectFolder 
                name={config?.project_dir ? config.project_dir.split('\\').pop() || 'Local Workspace' : 'Local Workspace'} 
                icon={<Folder size={14} />} 
                defaultOpen={true}
              >
                {sessions.map((session) => (
                  <SidebarItem
                    key={session.id}
                    label={session.title || 'Untitled'}
                    active={session.id === activeSessionId}
                    onClick={() => selectSession(session.id)}
                    onDelete={() => deleteSession(session.id)}
                  />
                ))}
                {sessions.length === 0 && (
                  <div className="text-[12px] text-neutral-600 px-2 py-1">No threads yet</div>
                )}
              </ProjectFolder>

              {/* Remote SSH Projects */}
              {ssh.servers.map((server) => (
                <ProjectFolder 
                  key={server.id} 
                  name={server.name} 
                  icon={
                    <div className="relative">
                      <Server size={14} className="text-teal-500" />
                      {ssh.isConnected(server.id) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-[6px] h-[6px] bg-teal-400 rounded-full border border-[#0f0f0f]" />
                      )}
                    </div>
                  }
                >
                  <div className="text-[12px] text-neutral-600 px-2 py-1">
                    {ssh.isConnected(server.id) ? 'No remote threads' : 'Not connected'}
                  </div>
                </ProjectFolder>
              ))}
            </div>
          </div>

          <div className="px-4 mb-6">
            <div className="flex items-center w-full justify-between text-[11px] font-semibold text-neutral-500 mb-2 tracking-wider">
              <div className="flex items-center gap-2">
                <SquareTerminal size={12} />
                FILES
              </div>
            </div>
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
            <button 
              onClick={() => setShowUpdateModal(true)}
              className="flex items-center gap-2 hover:text-neutral-300 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-neutral-600" />
              Updates
            </button>
            <span className="text-neutral-600">v0.1.0</span>
          </div>
          <div className="flex items-center justify-between">
            <div 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-3 cursor-pointer group hover:bg-[#1a1a1a] p-1.5 -ml-1.5 rounded-lg transition-colors"
            >
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Paulius&backgroundColor=b6e3f4"
                alt="Mvk"
                className="w-6 h-6 rounded-full bg-neutral-800"
              />
              <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                Mvk
              </span>
            </div>
            <button className="text-neutral-500 hover:text-neutral-300 transition-colors">
              <McpIcon size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0a]">
        
        {/* Chat / Landing Zone */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
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

                <InlineModelPicker 
                  config={config} 
                  providers={providers}
                  availableModels={availableModels}
                  onChanged={() => {
                    clearMessages();
                    loadConfig();
                  }} 
                />

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
                      <ModelDropdown 
                        config={config} 
                        providers={providers} 
                        availableModels={availableModels}
                        onChanged={loadConfig} 
                      />
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
                <button 
                  onClick={() => setShowTerminal(!showTerminal)}
                  className={`flex items-center gap-2 text-sm transition-colors ${showTerminal ? 'text-neutral-200' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  <SquareTerminal size={16} />
                  Terminal
                </button>
              </div>
            </>
          ) : (
            <>
              {/* ── Top Bar ── */}
              <TopBar
                title={sessions.find(s => s.id === activeSessionId)?.title || 'New Chat'}
                projectDir={config?.project_dir}
                sshConnections={ssh.connections}
                onTitleChange={(newTitle) => {
                  if (activeSessionId) {
                    renameSessionLocal(activeSessionId, newTitle);
                  }
                }}
                gitStatus={git.status}
              />

              {/* ── Chat ── */}
              <VirtualizedChat messages={messages} messagesEndRef={messagesEndRef} isLoading={isLoading} />

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
                        <ModelDropdown 
                          config={config} 
                          providers={providers} 
                          availableModels={availableModels}
                          onChanged={loadConfig} 
                        />
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
                          <McpIcon size={16} />
                        </button>
                        <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 rounded-md hover:bg-[#222]">
                          <Layers size={16} />
                        </button>
                        <div className="h-3 w-px bg-[#2a2a2a]" />
                        <ModeSelector mode={appMode} onChange={setAppMode} />
                        <button 
                          onClick={() => setShowGitPanel(!showGitPanel)}
                          className={`flex items-center gap-1.5 text-[13px] transition-colors p-1 rounded-md ${
                            showGitPanel 
                              ? 'bg-[#222] text-neutral-200' 
                              : 'text-neutral-500 hover:text-neutral-200 hover:bg-[#222]'
                          }`}
                        >
                          <GitBranch size={14} />
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
                      <button 
                        onClick={() => setShowGitPanel(true)}
                        className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors"
                      >
                        <GitBranch size={12} />
                        {git.currentBranch || 'main'}
                        <ChevronDown size={10} className="opacity-50" />
                      </button>
                      <button className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors">
                        <Shield size={12} />
                        Full Access
                        <ChevronDown size={10} className="opacity-50" />
                      </button>
                      <button 
                        onClick={() => setShowTerminal(!showTerminal)}
                        className={`flex items-center gap-1.5 transition-colors ${showTerminal ? 'text-neutral-200' : 'hover:text-neutral-300'}`}
                      >
                        <SquareTerminal size={12} />
                        Terminal
                      </button>
                    </div>
                    <ContextUsage percent={usagePercent} tokens={tokenStr} spent={costStr} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Global Terminal Panel Bottom Slider ── */}
        <motion.div
          initial={false}
          animate={{ 
            height: showTerminal ? terminalHeight : 0,
            opacity: showTerminal ? 1 : 0
          }}
          transition={isDraggingTerminal ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.3 }}
          className="w-full flex-shrink-0 bg-[#0a0a0a] border-t border-white/[0.04] overflow-hidden z-40 flex flex-col relative shadow-[0_-12px_30px_rgba(0,0,0,0.4)]"
        >
          <div 
            className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-50 hover:bg-white/10 transition-colors"
            onMouseDown={handleTerminalResize}
          />

          <TerminalPanel onClose={() => setShowTerminal(false)} isOpen={showTerminal} />
        </motion.div>

      </div>

      {/* Git Panel - Right Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: showGitPanel ? 380 : 40 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
        className="flex-shrink-0 h-full border-l border-[#1a1a1a] overflow-hidden bg-[#0d0d0d] relative z-20"
      >
        <div className="absolute top-0 right-0 w-[380px] h-full">
          <GitPanel
            status={git.status}
            branches={git.branches}
            currentBranch={git.currentBranch}
            loading={git.loading}
            onRefresh={git.refresh}
            onStageFile={git.stageFile}
            onUnstageFile={git.unstageFile}
            onStageAll={git.stageAll}
            onCommit={git.commit}
            onCheckoutBranch={git.checkoutBranch}
            onCreateBranch={git.createBranch}
            sshServers={ssh.servers}
            sshConnections={ssh.connections}
            sshConnecting={ssh.connecting}
            sshError={ssh.error}
            onSshSaveServer={ssh.saveServer}
            onSshDeleteServer={ssh.deleteServer}
            onSshConnect={ssh.connect}
            onSshDisconnect={ssh.disconnect}
            onSshSpawnTerminal={(configId, serverName) => {
              setShowTerminal(true);
              window.dispatchEvent(new CustomEvent('spawn-ssh-terminal', { 
                detail: { configId, serverName } 
              }));
            }}
            isOpen={showGitPanel}
            onToggle={setShowGitPanel}
          />
        </div>
      </motion.div>
      
      {/* ── Directory Picker Modal for New Session ── */}
      <DirectoryPickerModal
        isOpen={showDirectoryPicker}
        onClose={() => setShowDirectoryPicker(false)}
        onSelect={handleDirectorySelect}
        initialMode={sessionSource?.configId ? 'ssh' : 'local'}
        sshConnections={ssh.connections}
        savedSshServers={savedSshServers}
      />
    </div>
  );
}