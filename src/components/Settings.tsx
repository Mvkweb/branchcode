import React, { ReactNode, useEffect, useMemo, useState } from 'react';
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
  | 'terminalQuickKeys' | 'sendUsageReports';

type ToggleState = Record<ToggleKey, boolean>;

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
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = {
  Appearance: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/></svg>,
  Chat: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Bell: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Clock: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  Keyboard: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>,
  Git: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>,
  Folder: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  Agent: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/></svg>,
  Command: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 6 0 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 6 0V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3"/></svg>,
  Plug: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-5 0v-15A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 1 17 4.5v15a2.5 2.5 0 0 1-5 0v-15A2.5 2.5 0 0 1 14.5 2z"/></svg>,
  Provider: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  BarChart: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18M7 16l4-4 4 4 4-4"/></svg>,
  Star: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Mic: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>,
  Globe: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/></svg>,
  X: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  ChevronDown: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  Plus: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  RotateCcw: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>,
  Info: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  Check: (p: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
};

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV: { key: SectionKey; label: string; icon: keyof typeof I; beta?: boolean }[] = [
  { key: 'appearance', label: 'Appearance', icon: 'Appearance' },
  { key: 'chat',       label: 'Chat',       icon: 'Chat' },
  { key: 'notifications', label: 'Notifications', icon: 'Bell' },
  { key: 'sessions',   label: 'Sessions',   icon: 'Clock' },
  { key: 'shortcuts',  label: 'Shortcuts',  icon: 'Keyboard' },
  { key: 'git',        label: 'Git',        icon: 'Git' },
  { key: 'projects',   label: 'Projects',   icon: 'Folder' },
  { key: 'agents',     label: 'Agents',     icon: 'Agent' },
  { key: 'commands',   label: 'Commands',   icon: 'Command' },
  { key: 'mcp',        label: 'MCP',        icon: 'Plug' },
  { key: 'providers',  label: 'Providers',  icon: 'Provider' },
  { key: 'usage',      label: 'Usage',      icon: 'BarChart' },
  { key: 'skills',     label: 'Skills',     icon: 'Star' },
  { key: 'voice',      label: 'Voice',      icon: 'Mic',    beta: true },
  { key: 'privacy',    label: 'Remote Tunnel', icon: 'Globe', beta: true },
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
    },
    permissions: {
      '*': 'deny', apply_patch: 'deny', bash: 'allow', codesearch: 'allow',
      doom_loop: 'ask', edit: 'deny', external_directory: 'ask',
      glob: 'allow', grep: 'allow', list: 'allow', lsp: 'deny',
      plan_enter: 'deny', plan_exit: 'deny',
    },
  };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Surface hierarchy: bg-0 < bg-1 < bg-2 < bg-3
// bg-0  #080808  deepest chrome
// bg-1  #0f0f0f  sidebar
// bg-2  #141414  content area
// bg-3  #1a1a1a  elevated cards / inputs
// border: #222 default, #2e2e2e slightly lifted
// text: #f0f0f0 primary, #888 secondary, #444 muted

// ─── Primitives ───────────────────────────────────────────────────────────────

function Rule({ className }: { className?: string }) {
  return <div className={cx('h-px bg-white/[0.06]', className)} />;
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      {title && (
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/25">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function PermTag({ state, onClick }: { state: PermissionState; onClick: () => void }) {
  const map = {
    allow: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
    deny:  'bg-red-500/10    text-red-400    hover:bg-red-500/20',
    ask:   'bg-amber-500/10  text-amber-400  hover:bg-amber-500/20',
  } as const;
  return (
    <button
      onClick={onClick}
      className={cx(
        'min-w-[54px] rounded-[5px] px-2.5 py-1 text-center text-[11px] font-semibold tracking-wide transition-colors',
        map[state]
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
    <div className="flex items-center gap-0">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex h-[30px] w-8 items-center justify-center rounded-l-[6px] border border-white/[0.09] bg-white/[0.04] text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/70"
      >
        <span className="text-[13px] leading-none">−</span>
      </button>
      <div className="flex h-[30px] w-14 items-center justify-center border-y border-white/[0.09] bg-white/[0.03] text-[12px] font-medium text-white/70">
        {value}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="flex h-[30px] w-8 items-center justify-center rounded-r-[6px] border border-white/[0.09] bg-white/[0.04] text-white/40 transition-colors hover:bg-white/[0.07] hover:text-white/70"
      >
        <span className="text-[13px] leading-none">+</span>
      </button>
      <button className="ml-2 text-white/20 transition-colors hover:text-white/50">
        <I.RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CheckItem({ checked, onChange, label, desc }: {
  checked: boolean; onChange: () => void; label: string; desc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex w-full items-start gap-3 text-left"
    >
      <div className={cx(
        'mt-[2px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150',
        checked
          ? 'border-white/30 bg-white/15 text-white'
          : 'border-white/10 bg-transparent text-transparent hover:border-white/20'
      )}>
        <I.Check className="h-2.5 w-2.5" />
      </div>
      <div>
        <div className="text-[13px] text-white/75">{label}</div>
        {desc && <div className="mt-0.5 text-[12px] leading-relaxed text-white/30">{desc}</div>}
      </div>
    </button>
  );
}

function RadioItem({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2.5">
      <div className={cx(
        'flex h-[15px] w-[15px] items-center justify-center rounded-full border transition-all duration-150',
        checked ? 'border-white/40 bg-white/10' : 'border-white/10 hover:border-white/25'
      )}>
        {checked && <div className="h-[6px] w-[6px] rounded-full bg-white/80" />}
      </div>
      <span className={cx('text-[13px]', checked ? 'text-white/80' : 'text-white/40 hover:text-white/60')}>
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
        'rounded-full border px-3.5 py-1 text-[12px] font-medium transition-all duration-150',
        active
          ? 'border-white/20 bg-white/10 text-white/90'
          : 'border-transparent text-white/30 hover:border-white/10 hover:text-white/60'
      )}
    >
      {value}
    </button>
  );
}

function DropBtn({ value }: { value: string }) {
  return (
    <button className="flex h-8 items-center gap-1.5 rounded-[6px] border border-white/[0.09] bg-white/[0.04] px-3 text-[12px] text-white/60 transition-colors hover:bg-white/[0.07]">
      {value} <I.ChevronDown className="h-3.5 w-3.5 text-white/25" />
    </button>
  );
}

function LineInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 flex-1 rounded-[6px] border border-white/[0.09] bg-white/[0.03] px-3 text-[13px] text-white/70 outline-none placeholder:text-white/20 focus:border-white/20 focus:bg-white/[0.05]"
    />
  );
}

// ─── Panels ───────────────────────────────────────────────────────────────────

function AppearancePanel({ s, update, toggle }: { s: SettingsState; update: any; toggle: any }) {
  return (
    <div className="space-y-9">
      <Section title="Color Mode">
        <div className="flex gap-1.5">
          {['system', 'light', 'dark'].map(m => (
            <ModeChip key={m} value={m} active={s.colorMode === m} onClick={() => update('colorMode', m)} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-white/30">Light Theme</span>
            <DropBtn value={s.lightTheme} />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] text-white/30">Dark Theme</span>
            <DropBtn value={s.darkTheme} />
          </div>
        </div>
        <button className="mt-2 flex items-center gap-1.5 text-[12px] text-white/40 underline underline-offset-2 hover:text-white/70">
          Reload themes <I.Info className="h-3.5 w-3.5 text-white/25" />
        </button>
      </Section>

      <Rule />

      <Section title="App Identity">
        <div>
          <p className="mb-2 text-[12px] text-white/30">Install App Name — used by PWA installation process.</p>
          <div className="flex items-center gap-2">
            <LineInput value={s.appName} onChange={v => update('appName', v)} />
            <button className="text-white/20 hover:text-white/50">
              <I.RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Section>

      <Rule />

      <Section title="Spacing & Layout">
        <div className="space-y-3.5">
          {([
            { label: 'Interface Font Size', key: 'interfaceFontSize' },
            { label: 'Terminal Font Size',  key: 'terminalFontSize', min: 8, max: 32 },
            { label: 'Spacing Density',     key: 'spacingDensity' },
            { label: 'Input Bar Offset',    key: 'inputBarOffset', min: -100, max: 100, info: true },
          ] as any[]).map(({ label, key, min = 0, max = 999, info }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-white/55">{label}</span>
                {info && <I.Info className="h-3.5 w-3.5 text-white/20" />}
              </div>
              <Stepper value={s[key as keyof SettingsState] as number} onChange={v => update(key, v)} min={min} max={max} />
            </div>
          ))}
        </div>
      </Section>

      <Rule />

      <Section title="Navigation">
        <CheckItem
          checked={s.toggles.terminalQuickKeys}
          onChange={() => toggle('terminalQuickKeys')}
          label="Terminal Quick Keys"
        />
      </Section>

      <Rule />

      <Section title="Privacy">
        <CheckItem
          checked={s.toggles.sendUsageReports}
          onChange={() => toggle('sendUsageReports')}
          label="Send anonymous usage reports"
          desc="Helps us understand which app versions are actively used. Only version, platform, and runtime are collected — no personal data or code."
        />
      </Section>
    </div>
  );
}

function ChatPanel({ s, update, toggle }: { s: SettingsState; update: any; toggle: any }) {
  return (
    <div className="space-y-9">
      <Section title="Chat Render Mode">
        <div className="flex gap-3">
          {['sorted', 'live'].map(mode => (
            <button
              key={mode}
              onClick={() => update('renderMode', mode)}
              className={cx(
                'flex w-40 flex-col rounded-lg border p-3.5 text-left transition-all duration-150',
                s.renderMode === mode
                  ? 'border-white/20 bg-white/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
              )}
            >
              <span className="mb-4 text-[12px] font-medium capitalize text-white/60">{mode}</span>
              <div className="space-y-2">
                {[0,1,2].map(i => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/15" />
                    <div className="h-1.5 flex-1 rounded-full bg-white/10" />
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Rule />

      <div className="grid grid-cols-2 gap-x-10 gap-y-8">
        {[
          { title: 'User Message Rendering', key: 'messageRendering', opts: [{ id: 'markdown', label: 'Markdown' }, { id: 'plain', label: 'Plain text' }] },
          { title: 'Mermaid Rendering',      key: 'mermaidRendering',  opts: [{ id: 'svg', label: 'SVG' }, { id: 'ascii', label: 'ASCII' }] },
          { title: 'Diff Layout',            key: 'diffLayout',        opts: [{ id: 'dynamic', label: 'Dynamic' }, { id: 'inline', label: 'Always inline' }, { id: 'side-by-side', label: 'Always side-by-side' }] },
          { title: 'Diff View Mode',         key: 'diffViewMode',      opts: [{ id: 'single-file', label: 'Single file' }, { id: 'all-files', label: 'All files' }] },
        ].map(({ title, key, opts }) => (
          <div key={key}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/25">{title}</div>
            <div className="space-y-2.5">
              {opts.map(o => (
                <RadioItem key={o.id} checked={s[key as keyof SettingsState] === o.id} label={o.label} onClick={() => update(key, o.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Rule />

      <Section title="Chat Behavior">
        <div className="space-y-4">
          {([
            ['showReasoning',  'Show Reasoning Traces'],
            ['stickyHeader',   'Sticky User Header'],
            ['showToolIcons',  'Show Tool File Icons'],
            ['showDotfiles',   'Show Dotfiles'],
            ['queueMessages',  'Queue Messages by Default'],
            ['persistDrafts',  'Persist Draft Messages'],
            ['spellcheck',     'Enable Spellcheck in Text Inputs'],
          ] as [ToggleKey, string][]).map(([key, label]) => (
            <CheckItem key={key} checked={s.toggles[key]} onChange={() => toggle(key)} label={label} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function AgentsPanel({ s, update, cyclePermission }: { s: SettingsState; update: any; cyclePermission: (k: string) => void }) {
  return (
    <div className="flex h-full min-h-0">
      {/* Sub-sidebar */}
      <div className="flex w-[252px] shrink-0 flex-col border-r border-white/[0.06]">
        <div className="p-4 pb-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/25">Workspace</p>
          <button className="flex w-full items-center justify-between rounded-[7px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-white/60 transition-colors hover:bg-white/[0.05]">
            <div className="flex items-center gap-2">
              <I.Folder className="h-3.5 w-3.5 text-white/30" />
              <span>Batchcompiler</span>
            </div>
            <I.ChevronDown className="h-4 w-4 text-white/20" />
          </button>
          <div className="mt-3 flex items-center justify-between px-0.5">
            <span className="text-[12px] text-white/25">Total 4</span>
            <button className="text-white/20 transition-colors hover:text-white/60">
              <I.Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Rule />

        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/20">
            Built-in Agents
          </p>
          <div className="space-y-0.5">
            {AGENTS.map(a => {
              const isActive = s.selectedAgent === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => update('selectedAgent', a.id)}
                  className={cx(
                    'relative w-full rounded-[7px] px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="agent-active"
                      className="absolute inset-0 rounded-[7px] bg-white/[0.07]"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <div className="relative flex items-center gap-2">
                    <span className={cx('text-[13px]', isActive ? 'text-white/90 font-medium' : 'text-white/55')}>
                      {a.name}
                    </span>
                    <span className="rounded border border-amber-500/20 bg-amber-500/8 px-1.5 py-px text-[10px] font-medium text-amber-400/80">
                      {a.kind}
                    </span>
                  </div>
                  <div className="relative mt-0.5 truncate text-[12px] text-white/25">{a.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail pane */}
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
            {/* System prompt */}
            <div>
              <h3 className="mb-3 text-[13px] font-semibold text-white/70">System Prompt</h3>
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                <pre className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-white/50">
<span className="text-white/75">You are a file search specialist. You excel at thoroughly
navigating and exploring codebases.</span>

Your strengths:
- Rapidly finding files using glob patterns
- Searching code and text with powerful regex patterns
- Reading and analyzing file contents
                </pre>
              </div>
            </div>

            {/* Tool permissions */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-white/70">Tool Permissions</h3>
                <button className="rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70">
                  advanced editor
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                {TOOL_ROWS.map((row, i) => (
                  <div
                    key={row.key}
                    className={cx(
                      'flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]',
                      i < TOOL_ROWS.length - 1 && 'border-b border-white/[0.04]'
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                      <span className="text-[13px] text-white/75">{row.label}</span>
                      <span className="font-mono text-[11.5px] text-white/25">{row.mono}</span>
                      {row.meta && (
                        <span className="ml-1 text-[11px] text-white/20">{row.meta}</span>
                      )}
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
      <Section title="Alerts">
        <div className="space-y-4">
          <CheckItem checked={s.toggles.desktopAlerts}  onChange={() => toggle('desktopAlerts')}  label="Desktop notifications" />
          <CheckItem checked={s.toggles.mentionAlerts}  onChange={() => toggle('mentionAlerts')}  label="Mention alerts" />
          <CheckItem checked={s.toggles.soundCues}      onChange={() => toggle('soundCues')}      label="Sound cues" />
        </div>
      </Section>
    </div>
  );
}

function SessionsPanel({ s, toggle }: { s: SettingsState; toggle: any }) {
  return (
    <div className="space-y-5">
      <Section title="History">
        <div className="space-y-4">
          <CheckItem checked={s.toggles.persistDrafts} onChange={() => toggle('persistDrafts')} label="Persist draft messages" />
          <CheckItem checked={s.toggles.localHistory}  onChange={() => toggle('localHistory')}  label="Store local history" />
        </div>
      </Section>
    </div>
  );
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-[13px] text-white/15">{label} settings</p>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const prefersReduced = useReducedMotion();
  const [active, setActive] = useState<SectionKey>('appearance');
  const [s, setS] = useState<SettingsState>(createDefault);

  const update = <K extends keyof SettingsState>(key: K, val: SettingsState[K]) =>
    setS(prev => ({ ...prev, [key]: val }));

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
      case 'appearance':     return <AppearancePanel s={s} update={update} toggle={toggle} />;
      case 'chat':           return <ChatPanel s={s} update={update} toggle={toggle} />;
      case 'agents':         return <AgentsPanel s={s} update={update} cyclePermission={cyclePermission} />;
      case 'notifications':  return <NotificationsPanel s={s} toggle={toggle} />;
      case 'sessions':       return <SessionsPanel s={s} toggle={toggle} />;
      default:               return <PlaceholderPanel label={NAV.find(n => n.key === active)?.label ?? active} />;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-6 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.975, y: 12 }}
        animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.975, y: 8 }}
        transition={prefersReduced ? { duration: 0.14 } : { type: 'spring', stiffness: 340, damping: 28, mass: 0.85 }}
        onClick={e => e.stopPropagation()}
        className="flex h-[min(92vh,840px)] w-full max-w-[1060px] overflow-hidden rounded-[13px] border border-white/[0.07] bg-[#0f0f0f] shadow-[0_40px_100px_rgba(0,0,0,0.9)]"
      >
        {/* ── Sidebar ─────────────────────────────────────── */}
        <aside className="flex w-[210px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0a]">
          <div className="flex-1 overflow-y-auto py-2">
            {NAV.map(({ key, label, icon, beta }) => {
              const Icon = I[icon];
              const isActive = active === key;
              return (
                <button
                  key={key}
                  onClick={() => setActive(key)}
                  className={cx(
                    'relative flex w-full items-center gap-3 px-4 py-[9px] text-left text-[13px] transition-colors duration-100',
                    isActive ? 'text-white/90' : 'text-white/35 hover:text-white/65'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-pill"
                      className="absolute inset-x-2 inset-y-0.5 rounded-[6px] bg-white/[0.07]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 h-[15px] w-[15px] shrink-0" />
                  <span className="relative z-10 font-medium">{label}</span>
                  {beta && (
                    <span className="relative z-10 ml-auto rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-400/60">
                      beta
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <Rule />
          <button className="flex items-center gap-2.5 px-4 py-3.5 text-[12px] text-white/20 transition-colors hover:text-white/50">
            <I.RotateCcw className="h-3.5 w-3.5" />
            Reload OpenCode
          </button>
        </aside>

        {/* ── Content ─────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#0f0f0f]">
          {/* Topbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.05] px-7 py-[13px]">
            <span className="text-[13px] font-semibold text-white/60">
              {NAV.find(n => n.key === active)?.label}
            </span>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-[5px] text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/70"
            >
              <I.X className="h-4 w-4" />
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