import React, { ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type SectionKey =
  | 'workspace'
  | 'appearance'
  | 'models'
  | 'shortcuts'
  | 'notifications'
  | 'privacy'
  | 'labs';

type ToggleKey =
  | 'autoTitle'
  | 'restoreDrafts'
  | 'subtleMotion'
  | 'dottedCanvas'
  | 'sidebarBadges'
  | 'quietLabels'
  | 'desktopAlerts'
  | 'mentionAlerts'
  | 'soundCues'
  | 'usageTelemetry'
  | 'localHistory'
  | 'redactedAnalytics'
  | 'smartRouting'
  | 'multimodalUploads'
  | 'slashCommandBar'
  | 'fuzzySearch'
  | 'experimentalComposer'
  | 'speculativeResponses'
  | 'inlineDiffs';

type ToggleState = Record<ToggleKey, boolean>;

type SettingsState = {
  startupMode: string;
  landingView: string;
  inputWidth: string;
  themeMode: string;
  density: string;
  reasoningProfile: string;
  digestMode: string;
  contextDepth: number;
  replyLength: number;
  cornerRadius: number;
  toolBudget: number;
  contextWindow: number;
  defaultModel: string;
  toggles: ToggleState;
};

type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

// icons

const IconWorkspace: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M9.5 20V9.5" />
  </svg>
);

const IconAppearance: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 3v2.5M12 18.5V21M4.2 4.2l1.8 1.8M18 18l1.8 1.8M3 12h2.5M18.5 12H21M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
  </svg>
);

const IconModels: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3L3 7.5v9L12 21l9-4.5v-9L12 3z" />
    <path d="M12 3v18M3 7.5l9 4.5 9-4.5" />
  </svg>
);

const IconShortcuts: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
    <path d="M7 10h.01M12 10h.01M17 10h.01M7 14h10" />
  </svg>
);

const IconNotifications: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

const IconPrivacy: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3l7 3v5c0 4.8-2.8 8.6-7 10-4.2-1.4-7-5.2-7-10V6l7-3Z" />
    <path d="M9.5 12l1.7 1.7 3.8-4.2" />
  </svg>
);

const IconLabs: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10 3v5l-5.5 9.5A2.5 2.5 0 0 0 6.7 21h10.6a2.5 2.5 0 0 0 2.2-3.5L14 8V3" />
    <path d="M8.5 13h7" />
  </svg>
);

const IconLogo: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2.2" />
    <rect x="13" y="3" width="8" height="8" rx="2.2" />
    <rect x="3" y="13" width="8" height="8" rx="2.2" />
    <rect x="13" y="13" width="8" height="8" rx="2.2" />
  </svg>
);

const IconClose: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const IconCheck: Icon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m5 13 4 4L19 7" />
  </svg>
);

// data

const NAV: { key: SectionKey; label: string; description: string; icon: Icon }[] = [
  { key: 'workspace', label: 'Workspace', description: 'Startup, composer, and project defaults.', icon: IconWorkspace },
  { key: 'appearance', label: 'Appearance', description: 'Theme, density, and surface styling.', icon: IconAppearance },
  { key: 'models', label: 'Models', description: 'Default model and routing behavior.', icon: IconModels },
  { key: 'shortcuts', label: 'Shortcuts', description: 'Keyboard bindings and command bar.', icon: IconShortcuts },
  { key: 'notifications', label: 'Notifications', description: 'Alerts and digest delivery.', icon: IconNotifications },
  { key: 'privacy', label: 'Privacy', description: 'Local data, analytics, and cleanup.', icon: IconPrivacy },
  { key: 'labs', label: 'Labs', description: 'Experimental features still in progress.', icon: IconLabs },
];

const MODEL_OPTIONS = [
  { id: 'mimo-v2-pro', name: 'MiMo V2 Pro', provider: 'Xiaomi', note: 'Fast, balanced' },
  { id: 'mimo-v2-omni', name: 'MiMo V2 Omni', provider: 'Multimodal', note: 'Text and image' },
  { id: 'core-lite', name: 'Core Lite', provider: 'Stealth', note: 'Short answers' },
  { id: 'qwen-3.6-plus', name: 'Qwen 3.6 Plus', provider: 'Alibaba', note: 'Strong for code' },
  { id: 'nemotron-3-super', name: 'Nemotron 3 Super', provider: 'NVIDIA', note: 'Heavier reasoning' },
  { id: 'minimax-m2.5', name: 'MiniMax M2.5', provider: 'MiniMax', note: 'Best default' },
];

const SHORTCUTS_LIST = [
  { label: 'Command palette', keys: ['⌘', 'K'] },
  { label: 'Focus composer', keys: ['⌘', 'I'] },
  { label: 'New session', keys: ['⌘', 'N'] },
  { label: 'Open settings', keys: ['⌘', ','] },
  { label: 'Toggle sidebar', keys: ['⌘', 'B'] },
  { label: 'Toggle panel', keys: ['⌘', 'J'] },
];

const RECENT_PROJECTS = [
  { name: '3D Solar System', sub: 'Three.js scene', updated: '3m ago' },
  { name: 'Kanban Landing', sub: 'Marketing page', updated: '21m ago' },
  { name: 'Notes Agent', sub: 'Structured notes', updated: 'Yesterday' },
];

const LAB_FLAGS: { key: ToggleKey; label: string; badge: string; desc: string }[] = [
  {
    key: 'experimentalComposer',
    label: 'Expanded composer',
    badge: 'alpha',
    desc: 'A roomier composer with richer attachments.',
  },
  {
    key: 'speculativeResponses',
    label: 'Speculative streaming',
    badge: 'beta',
    desc: 'Render earlier structure to improve perceived speed.',
  },
  {
    key: 'inlineDiffs',
    label: 'Inline code diffs',
    badge: 'preview',
    desc: 'Show patch-style edits directly in replies.',
  },
];

function createDefaultSettings(): SettingsState {
  return {
    startupMode: 'resume',
    landingView: 'canvas',
    inputWidth: 'centered',
    themeMode: 'midnight',
    density: 'comfortable',
    reasoningProfile: 'balanced',
    digestMode: 'weekly',
    contextDepth: 8,
    replyLength: 3,
    cornerRadius: 16,
    toolBudget: 5,
    contextWindow: 128,
    defaultModel: 'minimax-m2.5',
    toggles: {
      autoTitle: true,
      restoreDrafts: true,
      subtleMotion: true,
      dottedCanvas: true,
      sidebarBadges: false,
      quietLabels: true,
      desktopAlerts: true,
      mentionAlerts: true,
      soundCues: false,
      usageTelemetry: false,
      localHistory: true,
      redactedAnalytics: true,
      smartRouting: true,
      multimodalUploads: true,
      slashCommandBar: true,
      fuzzySearch: true,
      experimentalComposer: true,
      speculativeResponses: false,
      inlineDiffs: true,
    },
  };
}

// primitives

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Surface({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cx(
        'rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium text-neutral-200">{title}</div>
        {description && (
          <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SegmentedControl({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div
      aria-label={id}
      className="inline-flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cx(
              'relative rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors',
              active ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[10px] border border-white/[0.09] bg-white/[0.08]"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cx(
        'relative h-6 w-10 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
        checked
          ? 'border-white/[0.14] bg-white/[0.14]'
          : 'border-white/[0.08] bg-white/[0.03]'
      )}
    >
      <motion.span
        animate={{ x: checked ? 16 : 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 500, damping: 32 }
        }
        className="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm">
      <button
        type="button"
        aria-label="Decrease value"
        onClick={() => onChange(Math.max(min, value - step))}
        className="px-3 py-2 text-neutral-500 transition-colors hover:text-white"
      >
        −
      </button>

      <div className="min-w-[76px] border-x border-white/[0.06] px-3 py-2 text-center text-neutral-200">
        {value}
        {suffix}
      </div>

      <button
        type="button"
        aria-label="Increase value"
        onClick={() => onChange(Math.min(max, value + step))}
        className="px-3 py-2 text-neutral-500 transition-colors hover:text-white"
      >
        +
      </button>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-white/[0.09] bg-white/[0.05] px-2 py-1 font-mono text-[11px] text-neutral-300">
      {children}
    </span>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-500">
      {children}
    </span>
  );
}

// main

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const reduceMotion = useReducedMotion();

  const [active, setActive] = useState<SectionKey>('workspace');
  const [settings, setSettings] = useState<SettingsState>(() => createDefaultSettings());

  const activeNav = NAV.find((item) => item.key === active)!;
  const toggles = settings.toggles;

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggle = (key: ToggleKey) => {
    setSettings((prev) => ({
      ...prev,
      toggles: {
        ...prev.toggles,
        [key]: !prev.toggles[key],
      },
    }));
  };

  const resetAll = () => {
    setSettings(createDefaultSettings());
    setActive('workspace');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const panel = (() => {
    switch (active) {
      case 'workspace':
        return (
          <div className="space-y-6">
            <PanelSection title="Session">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow
                  title="Open on startup"
                  description="Choose what happens when the app launches."
                >
                  <SegmentedControl
                    id="startup"
                    value={settings.startupMode}
                    onChange={(v) => update('startupMode', v)}
                    options={[
                      { label: 'Resume', value: 'resume' },
                      { label: 'Fresh', value: 'fresh' },
                      { label: 'Ask', value: 'ask' },
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  title="Home view"
                  description="What you see first after startup."
                >
                  <SegmentedControl
                    id="landing"
                    value={settings.landingView}
                    onChange={(v) => update('landingView', v)}
                    options={[
                      { label: 'Canvas', value: 'canvas' },
                      { label: 'Recent', value: 'recent' },
                      { label: 'Projects', value: 'projects' },
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  title="Auto-name conversations"
                  description="Create a title from the first message."
                >
                  <Switch checked={toggles.autoTitle} onChange={() => toggle('autoTitle')} />
                </SettingRow>

                <SettingRow
                  title="Restore drafts"
                  description="Keep unsent text between sessions."
                >
                  <Switch checked={toggles.restoreDrafts} onChange={() => toggle('restoreDrafts')} />
                </SettingRow>
              </Surface>
            </PanelSection>

            <PanelSection title="Composer">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow title="Input width">
                  <SegmentedControl
                    id="input-width"
                    value={settings.inputWidth}
                    onChange={(v) => update('inputWidth', v)}
                    options={[
                      { label: 'Centered', value: 'centered' },
                      { label: 'Wide', value: 'wide' },
                      { label: 'Floating', value: 'floating' },
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  title="Context depth"
                  description="How many recent turns stay in focus."
                >
                  <Stepper
                    value={settings.contextDepth}
                    onChange={(v) => update('contextDepth', v)}
                    min={2}
                    max={16}
                    suffix=" turns"
                  />
                </SettingRow>

                <SettingRow
                  title="Reply length"
                  description="Soft preference from concise to detailed."
                >
                  <Stepper
                    value={settings.replyLength}
                    onChange={(v) => update('replyLength', v)}
                    min={1}
                    max={5}
                    suffix="/5"
                  />
                </SettingRow>
              </Surface>
            </PanelSection>

            <PanelSection title="Recent projects">
              <div className="grid gap-2 sm:grid-cols-3">
                {RECENT_PROJECTS.map((project) => (
                  <div
                    key={project.name}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05]">
                        <IconLogo className="h-3.5 w-3.5 text-neutral-400" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-neutral-200">
                          {project.name}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {project.sub}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] text-neutral-600">
                      {project.updated}
                    </div>
                  </div>
                ))}
              </div>
            </PanelSection>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <PanelSection title="Theme">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow title="Color mode">
                  <SegmentedControl
                    id="theme"
                    value={settings.themeMode}
                    onChange={(v) => update('themeMode', v)}
                    options={[
                      { label: 'System', value: 'system' },
                      { label: 'Midnight', value: 'midnight' },
                      { label: 'Ink+', value: 'ink' },
                    ]}
                  />
                </SettingRow>

                <SettingRow title="Density">
                  <SegmentedControl
                    id="density"
                    value={settings.density}
                    onChange={(v) => update('density', v)}
                    options={[
                      { label: 'Compact', value: 'compact' },
                      { label: 'Default', value: 'comfortable' },
                      { label: 'Airy', value: 'airy' },
                    ]}
                  />
                </SettingRow>

                <SettingRow title="Corner radius">
                  <Stepper
                    value={settings.cornerRadius}
                    onChange={(v) => update('cornerRadius', v)}
                    min={8}
                    max={24}
                    suffix=" px"
                  />
                </SettingRow>
              </Surface>
            </PanelSection>

            <PanelSection title="Surface">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow
                  title="Subtle motion"
                  description="Keep transitions and hover feedback restrained."
                >
                  <Switch checked={toggles.subtleMotion} onChange={() => toggle('subtleMotion')} />
                </SettingRow>

                <SettingRow
                  title="Dotted canvas"
                  description="Show a faint grid on the home surface."
                >
                  <Switch checked={toggles.dottedCanvas} onChange={() => toggle('dottedCanvas')} />
                </SettingRow>

                <SettingRow
                  title="Sidebar badges"
                  description="Show compact metadata in navigation."
                >
                  <Switch checked={toggles.sidebarBadges} onChange={() => toggle('sidebarBadges')} />
                </SettingRow>

                <SettingRow
                  title="Quiet labels"
                  description="Lower contrast on secondary text."
                >
                  <Switch checked={toggles.quietLabels} onChange={() => toggle('quietLabels')} />
                </SettingRow>
              </Surface>
            </PanelSection>

            <PanelSection title="Preview">
              <Surface
                className="overflow-hidden bg-[#0a0b0d]"
                style={{ borderRadius: settings.cornerRadius + 4 } as React.CSSProperties}
              >
                <div className="relative aspect-[16/9] p-3 sm:p-4">
                  {toggles.dottedCanvas && (
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.06]"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                      }}
                    />
                  )}

                  <div className="relative h-full">
                    <div className="h-9 rounded-xl border border-white/[0.06] bg-white/[0.03]" />

                    <div className="mt-3 grid h-[calc(100%-48px)] grid-cols-[150px_1fr] gap-3">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                        <div className="mb-3 h-4 rounded bg-white/[0.07]" />
                        <div className="space-y-2">
                          <div className="h-7 rounded-lg bg-white/[0.06]" />
                          <div className="h-7 rounded-lg bg-white/[0.04]" />
                          <div className="h-7 rounded-lg bg-white/[0.04]" />
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="mb-3 h-4 w-32 rounded bg-white/[0.07]" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-16 rounded-xl bg-white/[0.05]" />
                          <div className="h-16 rounded-xl bg-white/[0.04]" />
                        </div>
                        <div className="mt-2 h-16 rounded-xl bg-white/[0.04]" />
                      </div>
                    </div>
                  </div>
                </div>
              </Surface>
            </PanelSection>
          </div>
        );

      case 'models':
        return (
          <div className="space-y-6">
            <PanelSection title="Default model">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MODEL_OPTIONS.map((model) => {
                  const selected = settings.defaultModel === model.id;

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => update('defaultModel', model.id)}
                      className={cx(
                        'rounded-2xl border p-3.5 text-left transition-colors',
                        selected
                          ? 'border-white/[0.14] bg-white/[0.06]'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.04]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-neutral-100">
                            {model.name}
                          </div>
                          <div className="mt-1 text-[11px] text-neutral-500">
                            {model.provider}
                          </div>
                          <div className="mt-2 text-xs leading-5 text-neutral-500">
                            {model.note}
                          </div>
                        </div>

                        <div
                          className={cx(
                            'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border',
                            selected
                              ? 'border-white/[0.18] bg-white text-black'
                              : 'border-white/[0.08]'
                          )}
                        >
                          {selected && <IconCheck className="h-3 w-3" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </PanelSection>

            <PanelSection title="Routing">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow title="Reasoning profile">
                  <SegmentedControl
                    id="reasoning"
                    value={settings.reasoningProfile}
                    onChange={(v) => update('reasoningProfile', v)}
                    options={[
                      { label: 'Fast', value: 'fast' },
                      { label: 'Balanced', value: 'balanced' },
                      { label: 'Deep', value: 'deep' },
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  title="Tool budget"
                  description="Maximum number of tool steps before settling."
                >
                  <Stepper
                    value={settings.toolBudget}
                    onChange={(v) => update('toolBudget', v)}
                    min={1}
                    max={12}
                    suffix=" steps"
                  />
                </SettingRow>

                <SettingRow title="Context window">
                  <Stepper
                    value={settings.contextWindow}
                    onChange={(v) => update('contextWindow', v)}
                    min={32}
                    max={256}
                    step={8}
                    suffix="k"
                  />
                </SettingRow>

                <SettingRow
                  title="Smart routing"
                  description="Choose a better-fit model for the task."
                >
                  <Switch checked={toggles.smartRouting} onChange={() => toggle('smartRouting')} />
                </SettingRow>

                <SettingRow
                  title="Multimodal uploads"
                  description="Allow image handoff on supported models."
                >
                  <Switch
                    checked={toggles.multimodalUploads}
                    onChange={() => toggle('multimodalUploads')}
                  />
                </SettingRow>
              </Surface>
            </PanelSection>
          </div>
        );

      case 'shortcuts':
        return (
          <div className="space-y-6">
            <PanelSection title="Bindings">
              <Surface className="divide-y divide-white/[0.06] px-4">
                {SHORTCUTS_LIST.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 py-3.5"
                  >
                    <span className="text-sm text-neutral-300">{item.label}</span>

                    <div className="flex gap-1">
                      {item.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </Surface>
            </PanelSection>

            <PanelSection title="Command bar">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow
                  title="Slash opens command bar"
                  description="Route / in the composer to quick actions."
                >
                  <Switch
                    checked={toggles.slashCommandBar}
                    onChange={() => toggle('slashCommandBar')}
                  />
                </SettingRow>

                <SettingRow
                  title="Fuzzy search"
                  description="Looser matching in palette results."
                >
                  <Switch checked={toggles.fuzzySearch} onChange={() => toggle('fuzzySearch')} />
                </SettingRow>
              </Surface>
            </PanelSection>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <PanelSection title="Alerts">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow
                  title="Desktop notifications"
                  description="System alerts for replies and tasks."
                >
                  <Switch
                    checked={toggles.desktopAlerts}
                    onChange={() => toggle('desktopAlerts')}
                  />
                </SettingRow>

                <SettingRow
                  title="Mentions"
                  description="Notify when something needs your attention."
                >
                  <Switch
                    checked={toggles.mentionAlerts}
                    onChange={() => toggle('mentionAlerts')}
                  />
                </SettingRow>

                <SettingRow
                  title="Sound cues"
                  description="Play subtle sounds for send and completion."
                >
                  <Switch checked={toggles.soundCues} onChange={() => toggle('soundCues')} />
                </SettingRow>
              </Surface>
            </PanelSection>

            <PanelSection title="Digest">
              <Surface className="px-4">
                <SettingRow
                  title="Digest cadence"
                  description="Summary emails for recent activity."
                >
                  <SegmentedControl
                    id="digest"
                    value={settings.digestMode}
                    onChange={(v) => update('digestMode', v)}
                    options={[
                      { label: 'Off', value: 'off' },
                      { label: 'Weekly', value: 'weekly' },
                      { label: 'Daily', value: 'daily' },
                    ]}
                  />
                </SettingRow>
              </Surface>
            </PanelSection>
          </div>
        );

      case 'privacy':
        return (
          <div className="space-y-6">
            <PanelSection title="Data">
              <Surface className="divide-y divide-white/[0.06] px-4">
                <SettingRow
                  title="Usage telemetry"
                  description="Light product signals without prompt content."
                >
                  <Switch
                    checked={toggles.usageTelemetry}
                    onChange={() => toggle('usageTelemetry')}
                  />
                </SettingRow>

                <SettingRow
                  title="Local history"
                  description="Store recent sessions on this device."
                >
                  <Switch checked={toggles.localHistory} onChange={() => toggle('localHistory')} />
                </SettingRow>

                <SettingRow
                  title="Redacted analytics"
                  description="Strip identifiers from event metadata."
                >
                  <Switch
                    checked={toggles.redactedAnalytics}
                    onChange={() => toggle('redactedAnalytics')}
                  />
                </SettingRow>
              </Surface>
            </PanelSection>

            <PanelSection title="Storage">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ['Cache', '18 MB'],
                  ['Sessions', '24'],
                  ['Workspaces', '3'],
                ].map(([label, value]) => (
                  <Surface key={label} className="p-3.5">
                    <div className="text-xs text-neutral-500">{label}</div>
                    <div className="mt-1 text-sm font-medium text-neutral-200">{value}</div>
                  </Surface>
                ))}
              </div>
            </PanelSection>

            <PanelSection title="Actions">
              <div className="grid gap-1.5">
                {[
                  'Export settings JSON',
                  'Clear local cache',
                  'Reset privacy defaults',
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left text-sm text-neutral-400 transition-colors hover:border-white/[0.12] hover:text-neutral-200"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </PanelSection>
          </div>
        );

      case 'labs':
        return (
          <div className="space-y-6">
            <PanelSection title="Flags">
              <Surface className="divide-y divide-white/[0.06] px-4">
                {LAB_FLAGS.map((item) => (
                  <SettingRow
                    key={item.key}
                    title={item.label}
                    description={item.desc}
                  >
                    <div className="flex items-center gap-3">
                      <Tag>{item.badge}</Tag>
                      <Switch checked={toggles[item.key]} onChange={() => toggle(item.key)} />
                    </div>
                  </SettingRow>
                ))}
              </Surface>
            </PanelSection>

            <Surface className="px-4 py-4">
              <div className="flex items-start gap-3">
                <IconLabs className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />
                <p className="text-xs leading-5 text-neutral-500">
                  Experimental features may change or disappear between releases.
                </p>
              </div>
            </Surface>
          </div>
        );
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 12 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 12 }}
        transition={
          reduceMotion
            ? { duration: 0.12 }
            : { type: 'spring', stiffness: 280, damping: 28, mass: 0.9 }
        }
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[min(84vh,760px)] w-full max-w-[1040px] overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0b0c0f] shadow-[0_36px_120px_rgba(0,0,0,0.58)]"
      >
        <aside className="flex w-[208px] shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-2.5 px-4 py-5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.07]">
              <IconLogo className="h-3.5 w-3.5 text-white/80" />
            </div>
            <span className="text-[13px] font-semibold text-white">Settings</span>
          </div>

          <nav className="flex-1 space-y-1 px-2.5 pb-4">
            {NAV.map(({ key, label, icon: Icon }) => {
              const isActive = key === active;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className="group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl border border-white/[0.08] bg-white/[0.06]"
                    />
                  )}

                  <Icon
                    className={cx(
                      'relative h-4 w-4 shrink-0 transition-colors',
                      isActive
                        ? 'text-white'
                        : 'text-neutral-600 group-hover:text-neutral-400'
                    )}
                  />

                  <span
                    className={cx(
                      'relative text-sm transition-colors',
                      isActive
                        ? 'font-medium text-white'
                        : 'text-neutral-500 group-hover:text-neutral-300'
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/[0.06] px-4 py-4 text-[11px] text-neutral-600">
            v0.1.50
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div>
              <h2 id="settings-title" className="text-sm font-semibold text-white">
                {activeNav.label}
              </h2>
              <p className="mt-1 text-xs text-neutral-600">{activeNav.description}</p>
            </div>

            <button
              type="button"
              aria-label="Close settings"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-neutral-500 transition-colors hover:text-white"
            >
              <IconClose className="h-3.5 w-3.5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-5 py-5 sm:px-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.14 }}
                >
                  {panel}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <footer className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3 sm:px-6">
            <p className="hidden text-xs text-neutral-600 sm:block">
              Changes are applied automatically.
            </p>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={resetAll}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-neutral-400 transition-colors hover:text-white"
              >
                Reset defaults
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/[0.1] bg-white/[0.08] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/[0.11]"
              >
                Done
              </button>
            </div>
          </footer>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default SettingsModal;