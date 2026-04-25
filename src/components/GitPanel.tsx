import { useState, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Circle,
} from "lucide-react";
import type {
  GitStatus,
  GitFile,
  GitBranch as GitBranchType,
} from "../lib/tauri";
import { type SshServerConfig, type SshConnectionInfo } from "../lib/tauri";
import { FileExplorer } from "./FileExplorer";
import { DiffViewer } from "./DiffViewer";
import { SshPanel, LinuxIcon } from "./ssh/SshPanel";

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
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

type DockTab = "explorer" | "todo" | "git" | "terminal" | "ssh";
type SshAuthMethod =
  | { type: "password"; password: string }
  | { type: "key"; path: string; passphrase?: string };

// ── Constants ──────────────────────────────────────────────────────────────────

const ease = [0.32, 0.72, 0, 1] as const;
const spring = { type: "spring", stiffness: 520, damping: 38 } as const;

// macOS-style font stack
const fontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif';

const dockItems: {
  id: DockTab;
  icon: React.ReactNode;
  label: string;
  separator?: boolean;
}[] = [
  {
    id: "explorer",
    icon: <Folder size={14} strokeWidth={1.6} />,
    label: "Files",
  },
  {
    id: "todo",
    icon: <ListTodo size={14} strokeWidth={1.6} />,
    label: "Tasks",
  },
  {
    id: "git",
    icon: <GitBranch size={14} strokeWidth={1.6} />,
    label: "Source Control",
  },
  {
    id: "terminal",
    icon: <SquareTerminal size={14} strokeWidth={1.6} />,
    label: "Terminal",
  },
  {
    id: "ssh",
    icon: <LinuxIcon size={14} />,
    label: "Remote",
    separator: true,
  },
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
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<{ diff: string }>("get_git_diff", {
          filePath: file.path,
        });
        setDiff(result.diff);
      } catch (e) {
        console.error("Failed to load diff:", e);
      } finally {
        setLoadingDiff(false);
      }
    }
    setExpanded(!expanded);
  };

  const fileName = file.path.split("/").pop() || file.path;
  const folder = file.path.includes("/")
    ? file.path.substring(0, file.path.lastIndexOf("/"))
    : "";

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
          fill={isStaged ? "#3b82f6" : "#a3a3a3"}
          className="flex-shrink-0 opacity-80"
        />

        <div className="flex-1 min-w-0 flex items-baseline gap-[6px] overflow-hidden">
          <span
            className="text-[12px] text-white/80 truncate"
            style={{ fontFamily: fontStack }}
          >
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
            <X
              size={11}
              className="text-white/55 hover:text-rose-400"
              strokeWidth={2}
            />
          ) : (
            <Plus
              size={11}
              className="text-white/55 hover:text-[#60a5fa]"
              strokeWidth={2}
            />
          )}
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 pt-0.5">
              <div
                className="rounded-[5px] overflow-hidden"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.015)",
                }}
              >
                {loadingDiff ? (
                  <div className="flex items-center gap-2 text-white/40 text-[11px] px-3 py-2.5">
                    <Loader2 size={11} className="animate-spin" />
                    Fetching diff…
                  </div>
                ) : diff ? (
                  <DiffViewer
                    diff={diff}
                    maxLines={0}
                    maxHeightClass="max-h-[280px]"
                  />
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
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleCommit = async () => {
    if (!message.trim() || committing) return;
    setCommitting(true);
    try {
      await onCommit(message.trim());
      setMessage("");
    } catch (e) {
      console.error("Commit failed:", e);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div
      className="p-2.5 space-y-2 relative z-20"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background:
          "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 100%)",
      }}
    >
      <div className="flex gap-1.5">
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={disabled || committing}
          className="flex-1 flex items-center justify-center gap-1.5 h-[28px] rounded-[5px] text-[11.5px] font-medium text-white/55 hover:text-white/85 transition-all disabled:opacity-30 disabled:pointer-events-none"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
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
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.18)",
          }}
        >
          <Plus size={11} strokeWidth={2.25} />
          Stage all
        </motion.button>
      </div>

      <div
        className="relative flex items-center rounded-[5px] h-[32px] overflow-hidden transition-all duration-150"
        style={{
          background: focused
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.025)",
          border: focused
            ? "1px solid rgba(59,130,246,0.4)"
            : "1px solid rgba(255,255,255,0.05)",
          boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.08)" : "none",
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
            if (e.key === "Enter" && !e.shiftKey) {
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
            {committing ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Upload size={10.5} strokeWidth={2} />
            )}
            Commit
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Tab Placeholder ────────────────────────────────────────────────────────────

function TabPlaceholder({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
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
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {icon}
      </div>
      <p
        className="text-[12px] font-medium text-white/65"
        style={{ fontFamily: fontStack }}
      >
        {title}
      </p>
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
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label
        className="text-[10.5px] text-white/45 mb-1 block"
        style={{ fontFamily: fontStack }}
      >
        {label} {optional && <span className="text-white/25">(optional)</span>}
      </label>
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full h-[30px] rounded-[5px] px-2.5 text-[12px] text-white/90 placeholder-white/25 outline-none transition-all"
        style={{
          background: focused
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.025)",
          border: focused
            ? "1px solid rgba(59,130,246,0.4)"
            : "1px solid rgba(255,255,255,0.06)",
          boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.08)" : "none",
          fontFamily: fontStack,
        }}
      />
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
  const isSsh = item.id === "ssh";
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item.label}
      whileTap={{ scale: 0.88 }}
      transition={{ duration: 0.1 }}
      className={`relative w-[28px] h-[28px] flex items-center justify-center rounded-[6px] transition-colors duration-150 ${
        isActive
          ? "text-white bg-[#171717]"
          : "text-[#666] hover:text-[#ededed] hover:bg-[#0e0e0e]"
      }`}
    >
      {/* Active background */}
      {isActive && (
        <motion.div
          layoutId="dock-active-bg"
          className="absolute inset-0 rounded-[6px]"
          style={{
            background: "#171717",
            border: "1px solid #262626",
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
          className="absolute inset-0 rounded-[6px]"
          style={{ background: "#0e0e0e" }}
        />
      )}

      {/* Active left rail */}
      {isActive && (
        <motion.div
          layoutId="dock-active-rail"
          className="absolute -left-[8px] top-1/2 -translate-y-1/2 w-[2px] h-[14px] rounded-r-full"
          style={{
            background: "#ffffff",
            boxShadow: "0 0 4px rgba(255,255,255,0.2)",
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
          style={{ boxShadow: "0 0 5px rgba(59,130,246,0.7)" }}
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
  isOpen = true,
  onToggle,
}: GitPanelProps) {
  const [activeDockTab, setActiveDockTab] = useState<DockTab>("git");
  const [activeGitTab, setActiveGitTab] = useState<"unstaged" | "staged">(
    "unstaged",
  );

  const unstagedChanges = status
    ? status.modified.length + status.untracked.length
    : 0;
  const stagedChanges = status ? status.staged.length : 0;
  const totalChanges = unstagedChanges + stagedChanges;

  return (
    <div
      className="flex h-full w-full bg-[#0d0d0d]"
      style={{ fontFamily: fontStack }}
    >
      {/* ── Main Panel ── */}
      <div
        className="flex-1 flex flex-col min-w-0 text-white/85 selection:bg-[#3b82f6]/30"
        style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        {activeDockTab === "git" ? (
          !status ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40 p-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <AlertCircle
                  size={18}
                  className="opacity-60"
                  strokeWidth={1.75}
                />
              </div>
              <p className="text-[12.5px] font-medium text-white/75">
                No Git repository
              </p>
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
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.3)",
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
                      <Loader2
                        size={11}
                        className="text-white/40 animate-spin"
                      />
                    ) : (
                      <ChevronDown
                        size={11}
                        className="text-white/40 group-hover:text-white/70 transition-colors"
                      />
                    )}
                  </button>
                </div>
                <motion.div
                  whileHover={{ y: -0.5 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1.5 px-2 h-[22px] rounded-[5px] text-white/65 hover:text-white/95 transition-colors cursor-pointer group"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <GitBranch
                    size={10}
                    className="text-white/45 group-hover:text-white/70 transition-colors"
                    strokeWidth={2}
                  />
                  <span className="text-[10.5px] font-mono tracking-tight">
                    {currentBranch || "main"}
                  </span>
                </motion.div>
              </div>

              {/* Segmented tabs */}
              <div className="px-2.5 pt-2.5 pb-1.5">
                <div
                  className="flex p-[2px] rounded-[6px] relative"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {(["unstaged", "staged"] as const).map((tab) => {
                    const count =
                      tab === "unstaged" ? unstagedChanges : stagedChanges;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveGitTab(tab)}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 h-[24px] text-[11px] font-medium rounded-[4px] transition-colors capitalize z-10 ${
                          activeGitTab === tab
                            ? "text-white/95"
                            : "text-white/45 hover:text-white/70"
                        }`}
                      >
                        {activeGitTab === tab && (
                          <motion.div
                            layoutId="git-tab-indicator"
                            className="absolute inset-0 rounded-[4px] -z-10"
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                            }}
                            transition={spring}
                          />
                        )}
                        <span>{tab}</span>
                        {count > 0 && (
                          <span
                            className={`text-[10px] font-mono leading-none px-1 py-[2px] rounded-[3px] transition-all ${
                              activeGitTab === tab
                                ? "text-white/85 bg-white/[0.08]"
                                : "text-white/40 bg-white/[0.04]"
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
                    {activeGitTab === "unstaged" ? (
                      <div className="pb-3">
                        {status.modified.length > 0 ||
                        status.untracked.length > 0 ? (
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
                            <p className="text-[11.5px] text-white/55">
                              No unstaged changes
                            </p>
                            <p className="text-[10.5px] text-white/30 mt-1">
                              Your working tree is clean
                            </p>
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
                            <p className="text-[11.5px] text-white/55">
                              No staged changes
                            </p>
                            <p className="text-[10.5px] text-white/30 mt-1">
                              Stage files to commit
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeGitTab === "unstaged" && (
                      <div className="mt-auto px-3 pb-3 pt-4">
                        <div
                          className="rounded-[6px] p-2.5"
                          style={{
                            background: "rgba(255,255,255,0.015)",
                            border: "1px solid rgba(255,255,255,0.04)",
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
                                <span className="text-[10px] font-mono text-white/40">
                                  a1b2c3d
                                </span>
                                <span className="text-[10px] text-white/30">
                                  2h ago
                                </span>
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
        ) : activeDockTab === "ssh" ? (
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
        ) : activeDockTab === "explorer" ? (
          <FileExplorer />
        ) : activeDockTab === "todo" ? (
          <TabPlaceholder
            icon={<ListTodo size={18} strokeWidth={1.6} />}
            title="Project Tasks"
          />
        ) : (
          <TabPlaceholder
            icon={<SquareTerminal size={18} strokeWidth={1.6} />}
            title="Use main terminal"
          />
        )}
      </div>

      {/* ── Right Navigation Dock ── */}
      <div
        className="w-[40px] flex-shrink-0 flex flex-col items-center py-2 gap-0.5 relative z-10"
        style={{
          background: "#0a0a0a",
          borderLeft: "1px solid #1f1f1f",
        }}
      >
        {dockItems.map((item) => (
          <div key={item.id} className="flex flex-col items-center w-full">
            {item.separator && (
              <div className="w-3 h-px bg-white/[0.06] my-1.5" />
            )}
            <DockButton
              item={item}
              isActive={activeDockTab === item.id && isOpen}
              onClick={() => {
                if (activeDockTab === item.id && isOpen) {
                  onToggle?.(false);
                } else {
                  setActiveDockTab(item.id);
                  onToggle?.(true);
                }
              }}
              hasIndicator={
                item.id === "ssh" &&
                sshConnections.length > 0 &&
                (activeDockTab !== item.id || !isOpen)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
});
