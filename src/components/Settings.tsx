import React, { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type SectionKey =
  | 'appearance' | 'chat' | 'notifications' | 'sessions'
  | 'shortcuts' | 'git' | 'projects' | 'agents'
  | 'commands' | 'mcp' | 'providers' | 'usage'
  | 'skills' | 'voice' | 'privacy';

type PermissionState = 'allow' | 'deny' | 'ask';

type ToggleKey =
  | 'showReasoning' | 'stickyHeader' | 'showToolIcons' | 'showDotfiles'
  | 'queueMessages' | 'persistDrafts' | 'spellcheck' | 'desktopAlerts'
  | 'mentionAlerts' | 'soundCues' | 'usageTelemetry' | 'localHistory'
  | 'terminalQuickKeys' | 'sendUsageReports'
  | 'gitmojiPicker' | 'showGitignored';

type ToggleState = Record<ToggleKey, boolean>;

type GitIdentity = {
  id: string;
  name: string;
  email: string;
  signingKey?: string;
};

type SettingsState = {
  selectedAgent: string;
  colorMode: string;
  lightTheme: string;
  darkTheme: string;
  appName: string;
  renderMode: string;
  messageRendering: string;
  mermaidRendering: string;
  diffLayout: string;
  diffViewMode: string;
  defaultModel: string;
  interfaceFontSize: number;
  terminalFontSize: number;
  spacingDensity: number;
  inputBarOffset: number;
  toggles: ToggleState;
  permissions: Record<string, PermissionState>;
  githubConnected: boolean;
  githubUser?: { login: string; avatar: string; name: string };
  gitIdentities: GitIdentity[];
  selectedIdentity: string | null;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = {
  Appearance: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3"/><path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/>
    </svg>
  ),
  Chat: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Bell: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  Clock: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  Keyboard: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
    </svg>
  ),
  Git: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>
    </svg>
  ),
  Folder: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Agent: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/>
    </svg>
  ),
  Command: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 6 0V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3"/>
    </svg>
  ),
  Plug: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0v-15A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 1 17 4.5v15a2.5 2.5 0 0 1-5 0v-15A2.5 2.5 0 0 1 14.5 2z"/>
    </svg>
  ),
  Provider: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  BarChart: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 3v18h18M7 16l4-4 4 4 4-4"/>
    </svg>
  ),
  Star: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Mic: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
    </svg>
  ),
  Globe: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
    </svg>
  ),
  X: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  ChevronDown: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  Plus: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  RotateCcw: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
    </svg>
  ),
  Info: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
    </svg>
  ),
  Check: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  Shield: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Trash: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  Github: (p: any) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  ),
  User: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Key: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  ),
  Link2: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  Unlink: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  ),
};

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV: { key: SectionKey; label: string; icon: keyof typeof I; beta?: boolean }[] = [
  { key: 'appearance',    label: 'Appearance',    icon: 'Appearance' },
  { key: 'chat',          label: 'Chat',          icon: 'Chat' },
  { key: 'notifications', label: 'Notifications', icon: 'Bell' },
  { key: 'sessions',      label: 'Sessions',      icon: 'Clock' },
  { key: 'shortcuts',     label: 'Shortcuts',     icon: 'Keyboard' },
  { key: 'git',           label: 'Git',           icon: 'Git' },
  { key: 'projects',      label: 'Projects',      icon: 'Folder' },
  { key: 'agents',        label: 'Agents',        icon: 'Agent' },
  { key: 'commands',      label: 'Commands',      icon: 'Command' },
  { key: 'mcp',           label: 'MCP',           icon: 'Plug' },
  { key: 'providers',     label: 'Providers',     icon: 'Provider' },
  { key: 'usage',         label: 'Usage',         icon: 'BarChart' },
  { key: 'skills',        label: 'Skills',        icon: 'Star' },
  { key: 'voice',         label: 'Voice',         icon: 'Mic',    beta: true },
  { key: 'privacy',       label: 'Remote Tunnel', icon: 'Globe',  beta: true },
];

// ─── Data ─────────────────────────────────────────────────────────────────────

const AGENTS = [
  { id: 'build',   name: 'build',   kind: 'system', desc: 'The default agent. Executes tools and edits.' },
  { id: 'explore', name: 'explore', kind: 'system', desc: 'Fast agent specialized for exploration.' },
  { id: 'general', name: 'general', kind: 'system', desc: 'General-purpose agent for mixed tasks.' },
  { id: 'plan',    name: 'plan',    kind: 'system', desc: 'Read-only planning. No edits or commands.' },
];

const TOOL_ROWS: { label: string; key: string; mono: string; meta?: string }[] = [
  { label: 'Default',            key: '*',                  mono: '*' },
  { label: 'Apply Patch',        key: 'apply_patch',        mono: 'apply_patch' },
  { label: 'Bash',               key: 'bash',               mono: 'bash' },
  { label: 'CodeSearch',         key: 'codesearch',         mono: 'codesearch' },
  { label: 'Doom Loop',          key: 'doom_loop',          mono: 'doom_loop' },
  { label: 'Edit',               key: 'edit',               mono: 'edit' },
  { label: 'External Directory', key: 'external_directory', mono: 'external_directory', meta: 'Global: ask · Rules: 1 allow' },
  { label: 'Glob',               key: 'glob',               mono: 'glob' },
  { label: 'Grep',               key: 'grep',               mono: 'grep' },
  { label: 'List',               key: 'list',               mono: 'list' },
  { label: 'Lsp',                key: 'lsp',                mono: 'lsp' },
  { label: 'Plan Enter',         key: 'plan_enter',         mono: 'plan_enter' },
  { label: 'Plan Exit',          key: 'plan_exit',          mono: 'plan_exit' },
];

function createDefault(): SettingsState {
  return {
    selectedAgent: 'explore',
    colorMode: 'system',
    lightTheme: 'Flexoki',
    darkTheme: 'Flexoki',
    appName: 'OpenChamber – AI Coding Assistant',
    renderMode: 'live',
    messageRendering: 'markdown',
    mermaidRendering: 'svg',
    diffLayout: 'inline',
    diffViewMode: 'all-files',
    defaultModel: 'MiniMax M2.5',
    interfaceFontSize: 100,
    terminalFontSize: 13,
    spacingDensity: 100,
    inputBarOffset: 0,
    toggles: {
      showReasoning: false, stickyHeader: true, showToolIcons: true,
      showDotfiles: true, queueMessages: true, persistDrafts: true,
      spellcheck: false, desktopAlerts: true, mentionAlerts: true,
      soundCues: false, usageTelemetry: false, localHistory: true,
      terminalQuickKeys: false, sendUsageReports: true,
      gitmojiPicker: false, showGitignored: false,
    },
    permissions: {
      '*': 'deny', apply_patch: 'deny', bash: 'allow', codesearch: 'allow',
      doom_loop: 'ask', edit: 'deny', external_directory: 'ask',
      glob: 'allow', grep: 'allow', list: 'allow', lsp: 'deny',
      plan_enter: 'deny', plan_exit: 'deny',
    },
    githubConnected: false,
    gitIdentities: [],
    selectedIdentity: null,
  };
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Rule({ className }: { className?: string }) {
  return <div className={cx('h-px bg-white/[0.055]', className)} />;
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-white/22">
      {children}
    </p>
  );
}

function PermTag({ state, onClick }: { state: PermissionState; onClick: () => void }) {
  const styles = {
    allow: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15 hover:bg-emerald-500/18',
    deny:  'bg-red-500/10 text-red-400 border-red-500/15 hover:bg-red-500/18',
    ask:   'bg-amber-500/10 text-amber-400 border-amber-500/15 hover:bg-amber-500/18',
  } as const;
  return (
    <button
      onClick={onClick}
      className={cx(
        'min-w-[52px] rounded-[5px] border px-2.5 py-[3px] text-center text-[11px] font-semibold tracking-wide transition-colors duration-120',
        styles[state],
      )}
    >
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </button>
  );
}

function Stepper({ value, onChange, min = 0, max = 999, step = 1 }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center overflow-hidden rounded-[6px] border border-white/[0.08]">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-[28px] w-7 items-center justify-center bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white/65"
        >
          <span className="text-[13px] leading-none select-none">−</span>
        </button>
        <div className="flex h-[28px] w-12 items-center justify-center border-x border-white/[0.08] bg-transparent text-[12px] font-medium tabular-nums text-white/65">
          {value}
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="flex h-[28px] w-7 items-center justify-center bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white/65"
        >
          <span className="text-[13px] leading-none select-none">+</span>
        </button>
      </div>
      <button className="text-white/18 transition-colors hover:text-white/45">
        <I.RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CheckItem({ checked, onChange, label, desc }: {
  checked: boolean; onChange: () => void; label: string; desc?: string;
}) {
  return (
    <button type="button" onClick={onChange} className="group flex w-full items-start gap-3 text-left">
      <div className={cx(
        'mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150',
        checked
          ? 'border-blue-500/40 bg-blue-500/20 text-blue-300'
          : 'border-white/[0.09] bg-transparent text-transparent group-hover:border-white/20',
      )}>
        <I.Check className="h-2.5 w-2.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] leading-snug text-white/72">{label}</div>
        {desc && <div className="mt-0.5 text-[11.5px] leading-relaxed text-white/28">{desc}</div>}
      </div>
    </button>
  );
}

function RadioItem({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-2.5">
      <div className={cx(
        'flex h-[15px] w-[15px] items-center justify-center rounded-full border transition-all duration-150',
        checked
          ? 'border-blue-500/50 bg-blue-500/15'
          : 'border-white/[0.09] group-hover:border-white/22',
      )}>
        {checked && <div className="h-[5px] w-[5px] rounded-full bg-blue-400" />}
      </div>
      <span className={cx('text-[13px]', checked ? 'text-white/78' : 'text-white/38 group-hover:text-white/58')}>
        {label}
      </span>
    </button>
  );
}

function ModeChip({ value, active, onClick }: { value: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-full border px-4 py-1 text-[12px] font-medium capitalize transition-all duration-150',
        active
          ? 'border-blue-500/30 bg-blue-500/12 text-blue-300'
          : 'border-transparent text-white/30 hover:border-white/[0.09] hover:text-white/55',
      )}
    >
      {value}
    </button>
  );
}

function DropBtn({ value }: { value: string }) {
  return (
    <button className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/55 transition-colors hover:bg-white/[0.06]">
      {value}
      <I.ChevronDown className="h-3.5 w-3.5 text-white/22" />
    </button>
  );
}

function FieldInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full flex-1 rounded-[7px] border border-white/[0.08] bg-white/[0.025] px-3 text-[13px] text-white/68 outline-none placeholder:text-white/18 transition-colors focus:border-blue-500/30 focus:bg-white/[0.04]"
    />
  );
}

// ─── Git Panel ────────────────────────────────────────────────────────────────

type IdentityFormState = { name: string; email: string; signingKey: string };

function GitIdentityCard({ identity, onDelete }: { identity: GitIdentity; onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div layout className="overflow-hidden rounded-[9px] border border-white/[0.07] bg-white/[0.02]">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400/60">
          <I.User className="h-[15px] w-[15px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-white/78">{identity.name}</div>
          <div className="mt-px font-mono text-[11px] text-white/30">{identity.email}</div>
        </div>
        {identity.signingKey && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-[3px]">
            <I.Key className="h-[11px] w-[11px] text-emerald-400/70" />
            <span className="text-[10px] font-semibold tracking-wide text-emerald-400/70">GPG</span>
          </div>
        )}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <I.ChevronDown className="h-4 w-4 text-white/18" />
        </motion.div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="border-t border-white/[0.05] bg-white/[0.01] px-4 py-4">
              <dl className="space-y-2.5">
                {[
                  { label: 'Name',  value: identity.name,       mono: false },
                  { label: 'Email', value: identity.email,      mono: true },
                  ...(identity.signingKey
                    ? [{ label: 'Signing Key', value: identity.signingKey, mono: true }]
                    : []),
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    <dt className="w-[90px] shrink-0 text-[11.5px] text-white/28">{row.label}</dt>
                    <dd className={cx('text-[12px] text-white/58', row.mono && 'font-mono')}>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 rounded-[6px] border border-red-500/15 bg-red-500/6 px-3 py-1.5 text-[12px] text-red-400/65 transition-colors hover:border-red-500/28 hover:bg-red-500/12 hover:text-red-400"
                >
                  <I.Trash className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NewIdentityForm({ onAdd, onCancel }: {
  onAdd: (id: GitIdentity) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<IdentityFormState>({ name: '', email: '', signingKey: '' });
  const valid = form.name.trim().length > 0 && form.email.trim().length > 0;
  const set = (k: keyof IdentityFormState) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 3 }}
      transition={{ duration: 0.16 }}
      className="rounded-[10px] border border-blue-500/15 bg-blue-500/[0.04] p-5"
    >
      <p className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-blue-400/60">New Identity</p>
      <div className="space-y-3">
        {([
          { key: 'name',       label: 'Name',        placeholder: 'Jane Doe' },
          { key: 'email',      label: 'Email',       placeholder: 'jane@example.com' },
          { key: 'signingKey', label: 'Signing Key', placeholder: 'GPG key ID (optional)' },
        ] as { key: keyof IdentityFormState; label: string; placeholder: string }[]).map(f => (
          <div key={f.key} className="flex items-center gap-3">
            <label className="w-[90px] shrink-0 text-[12px] text-white/30">{f.label}</label>
            <FieldInput value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-[6px] border border-white/[0.07] px-3.5 py-1.5 text-[12px] text-white/32 transition-colors hover:border-white/[0.12] hover:text-white/55"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (!valid) return;
            onAdd({
              id: Date.now().toString(),
              name: form.name.trim(),
              email: form.email.trim(),
              signingKey: form.signingKey.trim() || undefined,
            });
          }}
          disabled={!valid}
          className={cx(
            'rounded-[6px] px-3.5 py-1.5 text-[12px] font-medium transition-all duration-150',
            valid
              ? 'bg-blue-500/18 text-blue-300 hover:bg-blue-500/28'
              : 'cursor-not-allowed bg-white/[0.03] text-white/18',
          )}
        >
          Add Identity
        </button>
      </div>
    </motion.div>
  );
}

function GitPanel({ s, update, toggle }: { s: SettingsState; update: any; toggle: any }) {
  const [showNewForm, setShowNewForm] = useState(false);

  const handleConnect = () => {
    update('githubConnected', true);
    update('githubUser', { login: 'janedoe', name: 'Jane Doe', avatar: '' });
  };

  const handleDisconnect = () => {
    update('githubConnected', false);
    update('githubUser', undefined);
  };

  const addIdentity = (id: GitIdentity) => {
    update('gitIdentities', [...s.gitIdentities, id]);
    setShowNewForm(false);
  };

  const removeIdentity = (id: string) =>
    update('gitIdentities', s.gitIdentities.filter(i => i.id !== id));

  return (
    <div className="space-y-9">

      {/* ── GitHub ── */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-white/65">GitHub</h2>
          <I.Info className="h-3.5 w-3.5 text-white/20" />
        </div>
        <p className="mb-4 text-[12px] text-white/28">
          Connect your GitHub account to enable pull request workflows and repository access.
        </p>

        <AnimatePresence mode="wait" initial={false}>
          {!s.githubConnected ? (
            <motion.div
              key="disconnected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="flex items-center justify-between rounded-[10px] border border-white/[0.07] bg-white/[0.02] px-5 py-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
                  <I.Github className="h-[18px] w-[18px] text-white/28" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-white/42">Not connected</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-white/12" />
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-white/22">
                    Authorize via OAuth to get started
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnect}
                className="group flex items-center gap-2 rounded-[8px] border border-blue-500/28 bg-blue-500/12 px-4 py-2 text-[12.5px] font-medium text-blue-300 shadow-[0_0_0_0_rgba(59,130,246,0)] transition-all duration-200 hover:border-blue-500/45 hover:bg-blue-500/20 hover:shadow-[0_0_16px_0_rgba(59,130,246,0.12)] active:scale-[0.97]"
              >
                <I.Github className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                Connect GitHub
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="flex items-center justify-between rounded-[10px] border border-emerald-500/15 bg-emerald-500/[0.04] px-5 py-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
                  <I.Github className="h-[18px] w-[18px] text-emerald-400/75" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-[11px] w-[11px] items-center justify-center rounded-full bg-[#0f0f0f]">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white/75">
                      {s.githubUser?.name}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-px text-[10px] font-semibold tracking-wide text-emerald-400/80">
                      connected
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-white/30">
                    github.com/{s.githubUser?.login}
                  </div>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 rounded-[7px] border border-white/[0.07] bg-white/[0.03] px-3.5 py-1.5 text-[12px] text-white/32 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/58"
              >
                <I.Unlink className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Rule />

      {/* ── Identities ── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-white/65">Identities</h2>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className={cx(
              'flex items-center gap-1.5 rounded-[7px] border px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
              showNewForm
                ? 'border-blue-500/25 bg-blue-500/10 text-blue-300'
                : 'border-white/[0.07] bg-white/[0.025] text-white/38 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/65',
            )}
          >
            <motion.div animate={{ rotate: showNewForm ? 45 : 0 }} transition={{ duration: 0.18 }}>
              <I.Plus className="h-3.5 w-3.5" />
            </motion.div>
            {showNewForm ? 'Cancel' : 'New'}
          </button>
        </div>
        <p className="mb-4 text-[12px] text-white/28">
          Manage per-project Git author settings and GPG signing keys.
        </p>

        <AnimatePresence mode="popLayout" initial={false}>
          {showNewForm && (
            <motion.div key="form" layout className="mb-3">
              <NewIdentityForm onAdd={addIdentity} onCancel={() => setShowNewForm(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="popLayout" initial={false}>
          {s.gitIdentities.length === 0 && !showNewForm ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-white/[0.07] py-14"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03] text-white/18">
                <I.Shield className="h-5 w-5" />
              </div>
              <p className="text-[13px] font-medium text-white/28">No identities configured</p>
              <p className="mt-1 text-[11.5px] text-white/18">
                Create one to manage Git author settings per project
              </p>
              <button
                onClick={() => setShowNewForm(true)}
                className="mt-5 flex items-center gap-1.5 rounded-[7px] border border-blue-500/22 bg-blue-500/8 px-3.5 py-2 text-[12px] font-medium text-blue-400/75 transition-colors hover:border-blue-500/35 hover:bg-blue-500/14 hover:text-blue-300"
              >
                <I.Plus className="h-3.5 w-3.5" />
                Add your first identity
              </button>
            </motion.div>
          ) : (
            <motion.div key="list" className="space-y-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {s.gitIdentities.map(identity => (
                  <motion.div
                    key={identity.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                  >
                    <GitIdentityCard identity={identity} onDelete={() => removeIdentity(identity.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Rule />

      {/* ── Git Preferences ── */}
      <div>
        <h2 className="mb-1.5 text-[13px] font-semibold text-white/65">Preferences</h2>
        <p className="mb-5 text-[12px] text-white/28">
          Configure how Git integrates with your workflow.
        </p>
        <div className="space-y-4">
          <CheckItem
            checked={s.toggles.gitmojiPicker}
            onChange={() => toggle('gitmojiPicker')}
            label="Enable Gitmoji Picker"
            desc="Show an emoji picker when composing commit messages."
          />
          <CheckItem
            checked={s.toggles.showGitignored}
            onChange={() => toggle('showGitignored')}
            label="Display Gitignored Files"
            desc="Include files excluded by .gitignore in the file tree."
          />
          <CheckItem
            checked={s.toggles.showDotfiles}
            onChange={() => toggle('showDotfiles')}
            label="Show Dotfiles"
            desc="Include hidden files starting with a dot."
          />
        </div>
      </div>
    </div>
  );
}

// ─── Other panels ─────────────────────────────────────────────────────────────

function AppearancePanel({ s, update, toggle }: { s: SettingsState; update: any; toggle: any }) {
  return (
    <div className="space-y-9">
      <div className="space-y-5">
        <SectionHeading>Color Mode</SectionHeading>
        <div className="flex gap-1">
          {['system', 'light', 'dark'].map(m => (
            <ModeChip key={m} value={m} active={s.colorMode === m} onClick={() => update('colorMode', m)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {[['Light Theme', 'lightTheme'], ['Dark Theme', 'darkTheme']].map(([lbl, key]) => (
            <div key={key} className="flex items-center gap-2.5">
              <span className="text-[12px] text-white/28">{lbl}</span>
              <DropBtn value={s[key as keyof SettingsState] as string} />
            </div>
          ))}
        </div>
      </div>
      <Rule />
      <div className="space-y-4">
        <SectionHeading>App Identity</SectionHeading>
        <p className="text-[12px] text-white/28">Install App Name — used by PWA installation process.</p>
        <div className="flex items-center gap-2">
          <FieldInput value={s.appName} onChange={v => update('appName', v)} />
          <button className="text-white/18 transition-colors hover:text-white/45">
            <I.RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
      <Rule />
      <div className="space-y-5">
        <SectionHeading>Spacing & Layout</SectionHeading>
        <div className="space-y-3.5">
          {([
            { label: 'Interface Font Size', key: 'interfaceFontSize' },
            { label: 'Terminal Font Size',  key: 'terminalFontSize', min: 8, max: 32 },
            { label: 'Spacing Density',     key: 'spacingDensity' },
            { label: 'Input Bar Offset',    key: 'inputBarOffset', min: -100, max: 100, info: true },
          ] as any[]).map(({ label, key, min = 0, max = 999, info }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-white/52">{label}</span>
                {info && <I.Info className="h-3.5 w-3.5 text-white/18" />}
              </div>
              <Stepper value={s[key as keyof SettingsState] as number} onChange={v => update(key, v)} min={min} max={max} />
            </div>
          ))}
        </div>
      </div>
      <Rule />
      <div className="space-y-4">
        <SectionHeading>Navigation</SectionHeading>
        <CheckItem checked={s.toggles.terminalQuickKeys} onChange={() => toggle('terminalQuickKeys')} label="Terminal Quick Keys" />
      </div>
      <Rule />
      <div className="space-y-4">
        <SectionHeading>Privacy</SectionHeading>
        <CheckItem
          checked={s.toggles.sendUsageReports}
          onChange={() => toggle('sendUsageReports')}
          label="Send anonymous usage reports"
          desc="Only version, platform, and runtime are collected — no personal data or code."
        />
      </div>
    </div>
  );
}

function ChatPanel({ s, update, toggle }: { s: SettingsState; update: any; toggle: any }) {
  return (
    <div className="space-y-9">
      <div className="space-y-4">
        <SectionHeading>Chat Render Mode</SectionHeading>
        <div className="flex gap-3">
          {['sorted', 'live'].map(mode => (
            <button
              key={mode}
              onClick={() => update('renderMode', mode)}
              className={cx(
                'flex w-40 flex-col rounded-[9px] border p-3.5 text-left transition-all duration-150',
                s.renderMode === mode
                  ? 'border-blue-500/25 bg-blue-500/[0.07]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]',
              )}
            >
              <span className="mb-4 text-[12px] font-medium capitalize text-white/55">{mode}</span>
              <div className="space-y-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/12" />
                    <div className="h-1.5 flex-1 rounded-full bg-white/8" />
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
      <Rule />
      <div className="grid grid-cols-2 gap-x-10 gap-y-8">
        {[
          { title: 'User Message Rendering', key: 'messageRendering', opts: [{ id: 'markdown', label: 'Markdown' }, { id: 'plain', label: 'Plain text' }] },
          { title: 'Mermaid Rendering',      key: 'mermaidRendering',  opts: [{ id: 'svg', label: 'SVG' }, { id: 'ascii', label: 'ASCII' }] },
          { title: 'Diff Layout',            key: 'diffLayout',        opts: [{ id: 'dynamic', label: 'Dynamic' }, { id: 'inline', label: 'Always inline' }, { id: 'side-by-side', label: 'Always side-by-side' }] },
          { title: 'Diff View Mode',         key: 'diffViewMode',      opts: [{ id: 'single-file', label: 'Single file' }, { id: 'all-files', label: 'All files' }] },
        ].map(({ title, key, opts }) => (
          <div key={key}>
            <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-white/22">{title}</p>
            <div className="space-y-2.5">
              {opts.map(o => (
                <RadioItem key={o.id} checked={s[key as keyof SettingsState] === o.id} label={o.label} onClick={() => update(key, o.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <Rule />
      <div className="space-y-4">
        <SectionHeading>Chat Behavior</SectionHeading>
        {([
          ['showReasoning', 'Show Reasoning Traces'],
          ['stickyHeader',  'Sticky User Header'],
          ['showToolIcons', 'Show Tool File Icons'],
          ['showDotfiles',  'Show Dotfiles'],
          ['queueMessages', 'Queue Messages by Default'],
          ['persistDrafts', 'Persist Draft Messages'],
          ['spellcheck',    'Enable Spellcheck in Text Inputs'],
        ] as [ToggleKey, string][]).map(([key, label]) => (
          <CheckItem key={key} checked={s.toggles[key]} onChange={() => toggle(key)} label={label} />
        ))}
      </div>
    </div>
  );
}

function AgentsPanel({ s, update, cyclePermission }: {
  s: SettingsState; update: any; cyclePermission: (k: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0">
      {/* Sub-sidebar */}
      <div className="flex w-[252px] shrink-0 flex-col border-r border-white/[0.06]">
        <div className="p-4 pb-3">
          <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-white/22">Workspace</p>
          <button className="flex w-full items-center justify-between rounded-[7px] border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[13px] text-white/55 transition-colors hover:bg-white/[0.05]">
            <div className="flex items-center gap-2">
              <I.Folder className="h-3.5 w-3.5 text-white/28" />
              <span>Batchcompiler</span>
            </div>
            <I.ChevronDown className="h-4 w-4 text-white/18" />
          </button>
          <div className="mt-3 flex items-center justify-between px-0.5">
            <span className="text-[12px] text-white/22">Total 4</span>
            <button className="text-white/18 transition-colors hover:text-white/55">
              <I.Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Rule />
        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/18">Built-in Agents</p>
          <div className="space-y-0.5">
            {AGENTS.map(a => {
              const isActive = s.selectedAgent === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => update('selectedAgent', a.id)}
                  className={cx('relative w-full rounded-[7px] px-3 py-2 text-left transition-colors', isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
                >
                  {isActive && (
                    <motion.div layoutId="agent-active" className="absolute inset-0 rounded-[7px] bg-white/[0.07]" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                  )}
                  <div className="relative flex items-center gap-2">
                    <span className={cx('text-[13px]', isActive ? 'font-medium text-white/88' : 'text-white/52')}>{a.name}</span>
                    <span className="rounded border border-sky-500/20 bg-sky-500/8 px-1.5 py-px text-[10px] font-medium text-sky-400/75">{a.kind}</span>
                  </div>
                  <div className="relative mt-0.5 truncate text-[12px] text-white/22">{a.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={s.selectedAgent}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="space-y-8 px-8 py-7"
          >
            <div>
              <h3 className="mb-3 text-[13px] font-semibold text-white/65">System Prompt</h3>
              <div className="rounded-[9px] border border-white/[0.07] bg-white/[0.02] p-4">
                <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-white/45">
<span className="text-white/72">You are a file search specialist. You excel at thoroughly
navigating and exploring codebases.</span>

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents
                </pre>
              </div>
            </div>
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-white/65">Tool Permissions</h3>
                <button className="rounded-[6px] border border-white/[0.07] bg-white/[0.025] px-3 py-1 text-[11px] text-white/32 transition-colors hover:bg-white/[0.05] hover:text-white/65">
                  advanced editor
                </button>
              </div>
              <div className="overflow-hidden rounded-[9px] border border-white/[0.07]">
                {TOOL_ROWS.map((row, i) => (
                  <div
                    key={row.key}
                    className={cx(
                      'flex items-center justify-between px-4 py-[11px] transition-colors hover:bg-white/[0.02]',
                      i < TOOL_ROWS.length - 1 && 'border-b border-white/[0.04]',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                      <span className="text-[13px] text-white/72">{row.label}</span>
                      <span className="font-mono text-[11px] text-white/22">{row.mono}</span>
                      {row.meta && <span className="text-[11px] text-white/18">{row.meta}</span>}
                    </div>
                    <PermTag state={s.permissions[row.key] ?? 'deny'} onClick={() => cyclePermission(row.key)} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function NotificationsPanel({ s, toggle }: { s: SettingsState; toggle: any }) {
  return (
    <div className="space-y-5">
      <SectionHeading>Alerts</SectionHeading>
      <div className="space-y-4">
        <CheckItem checked={s.toggles.desktopAlerts} onChange={() => toggle('desktopAlerts')} label="Desktop notifications" />
        <CheckItem checked={s.toggles.mentionAlerts} onChange={() => toggle('mentionAlerts')} label="Mention alerts" />
        <CheckItem checked={s.toggles.soundCues}     onChange={() => toggle('soundCues')}     label="Sound cues" />
      </div>
    </div>
  );
}

function SessionsPanel({ s, toggle }: { s: SettingsState; toggle: any }) {
  return (
    <div className="space-y-5">
      <SectionHeading>History</SectionHeading>
      <div className="space-y-4">
        <CheckItem checked={s.toggles.persistDrafts} onChange={() => toggle('persistDrafts')} label="Persist draft messages" />
        <CheckItem checked={s.toggles.localHistory}  onChange={() => toggle('localHistory')}  label="Store local history" />
      </div>
    </div>
  );
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-white/14">
        <I.Info className="h-5 w-5" />
      </div>
      <p className="text-[13px] text-white/18">{label} settings coming soon</p>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const prefersReduced = useReducedMotion();
  const [active, setActive] = useState<SectionKey>('git');
  const [s, setS] = useState<SettingsState>(createDefault);

  const update = (key: string, val: any) => setS(prev => ({ ...prev, [key]: val }));

  const toggle = (key: ToggleKey) =>
    setS(prev => ({ ...prev, toggles: { ...prev.toggles, [key]: !prev.toggles[key] } }));

  const cyclePermission = (key: string) => {
    const order: PermissionState[] = ['deny', 'ask', 'allow'];
    setS(prev => {
      const cur = prev.permissions[key] ?? 'deny';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      return { ...prev, permissions: { ...prev.permissions, [key]: next } };
    });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', handler); };
  }, [onClose]);

  const isAgents = active === 'agents';

  const panel = (() => {
    switch (active) {
      case 'appearance':    return <AppearancePanel s={s} update={update} toggle={toggle} />;
      case 'chat':          return <ChatPanel s={s} update={update} toggle={toggle} />;
      case 'agents':        return <AgentsPanel s={s} update={update} cyclePermission={cyclePermission} />;
      case 'notifications': return <NotificationsPanel s={s} toggle={toggle} />;
      case 'sessions':      return <SessionsPanel s={s} toggle={toggle} />;
      case 'git':           return <GitPanel s={s} update={update} toggle={toggle} />;
      default:              return <PlaceholderPanel label={NAV.find(n => n.key === active)?.label ?? active} />;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 14 }}
        animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        transition={prefersReduced ? { duration: 0.14 } : { type: 'spring', stiffness: 340, damping: 28, mass: 0.85 }}
        onClick={e => e.stopPropagation()}
        className="flex h-[min(92vh,840px)] w-full max-w-[1060px] overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#0d0d0d] shadow-[0_48px_120px_rgba(0,0,0,0.95)]"
      >
        {/* ── Sidebar ── */}
        <aside className="flex w-[212px] shrink-0 flex-col border-r border-white/[0.055] bg-[#090909]">
          <div className="flex-1 overflow-y-auto py-2.5">
            {NAV.map(({ key, label, icon, beta }) => {
              const Icon = I[icon];
              const isActive = active === key;
              return (
                <button
                  key={key}
                  onClick={() => setActive(key)}
                  className={cx(
                    'relative mx-1.5 flex w-[calc(100%-12px)] items-center gap-3 rounded-[7px] px-3 py-[8px] text-left text-[13px] transition-colors duration-100',
                    isActive ? 'text-white/88' : 'text-white/32 hover:text-white/60',
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-0 rounded-[7px] bg-white/[0.065]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 h-[15px] w-[15px] shrink-0" />
                  <span className="relative z-10 font-medium">{label}</span>
                  {beta && (
                    <span className="relative z-10 ml-auto rounded-[4px] border border-sky-500/20 bg-sky-500/8 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-400/60">
                      beta
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Rule />
          <button className="flex items-center gap-2.5 px-5 py-3.5 text-[12px] text-white/18 transition-colors hover:text-white/45">
            <I.RotateCcw className="h-3.5 w-3.5" />
            Reload OpenCode
          </button>
        </aside>

        {/* ── Content ── */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#0d0d0d]">
          {/* Topbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.05] px-7 py-3.5">
            <div className="flex items-center gap-2.5">
              {(() => { const n = NAV.find(n => n.key === active); if (!n) return null; const Icon = I[n.icon]; return <Icon className="h-[15px] w-[15px] text-white/30" />; })()}
              <span className="text-[13px] font-semibold text-white/55">
                {NAV.find(n => n.key === active)?.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] text-white/22 transition-colors hover:bg-white/[0.06] hover:text-white/65"
            >
              <I.X className="h-[15px] w-[15px]" />
            </button>
          </div>

          {/* Panel */}
          <div className={cx('min-h-0 flex-1', isAgents ? 'overflow-hidden' : 'overflow-y-auto')}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className={cx('h-full', !isAgents && 'px-8 py-8')}
              >
                {panel}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default SettingsModal;