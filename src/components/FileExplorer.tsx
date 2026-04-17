import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Globe, HardDrive, Loader2 } from 'lucide-react';
import { FileIcon } from './FileIcon';
import { listDirectory as tauriListDirectory } from '../lib/tauri';
import { sshListDir } from '../lib/tauri';
import { useSsh } from '../hooks/useSsh';
import { useChat } from '../hooks/useChat';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  isOpen?: boolean;
  isLoading?: boolean;
}

interface TreeNodeProps {
  node: FileNode;
  level: number;
  onToggle: (path: string) => void;
  onSelect: (path: string, isDir: boolean) => void;
  selectedPath: string | null;
  configId?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INDENT_BASE = 6;
const INDENT_PER_LEVEL = 13;
const ROW_HEIGHT = 22;

// macOS-like easing curve
const ease = [0.32, 0.72, 0, 1] as const;

// ── Tree Node ──────────────────────────────────────────────────────────────────

function TreeNode({ node, level, onToggle, onSelect, selectedPath, configId }: TreeNodeProps) {
  const isSelected = selectedPath === node.path;
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = useCallback(() => {
    onSelect(node.path, node.isDir);
    if (node.isDir) onToggle(node.path);
  }, [node.path, node.isDir, onToggle, onSelect]);

  return (
    <div>
      <div
        onClick={handleClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        className={`relative flex items-center cursor-default select-none group transition-[background-color] duration-100 ${
          isSelected
            ? 'bg-white/[0.06]'
            : 'hover:bg-white/[0.025]'
        }`}
        style={{
          height: `${ROW_HEIGHT}px`,
          paddingLeft: `${INDENT_BASE + level * INDENT_PER_LEVEL}px`,
          transform: isPressed ? 'scale(0.998)' : 'scale(1)',
          transition: 'transform 80ms ease-out, background-color 100ms ease-out',
        }}
      >
        {/* Indent guide lines */}
        {Array.from({ length: level }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-white/[0.04] pointer-events-none"
            style={{ left: `${INDENT_BASE + i * INDENT_PER_LEVEL + 6}px` }}
          />
        ))}

        {/* Selection accent — left edge bar */}
        {isSelected && (
          <motion.div
            layoutId="file-selection-bar"
            className="absolute left-0 top-[3px] bottom-[3px] w-[2px] bg-[#3b82f6] rounded-r-full"
            transition={{ type: 'spring', stiffness: 600, damping: 38 }}
          />
        )}

        {/* Chevron / spinner */}
        <div className="w-[14px] h-[14px] flex items-center justify-center flex-shrink-0 text-white/30 group-hover:text-white/55 transition-colors duration-100 relative z-10 mr-[3px]">
          {node.isDir && (
            node.isLoading ? (
              <Loader2 size={10} className="animate-spin text-[#3b82f6]" strokeWidth={2} />
            ) : (
              <motion.div
                animate={{ rotate: node.isOpen ? 90 : 0 }}
                transition={{ duration: 0.12, ease }}
              >
                <ChevronRight size={11} strokeWidth={2} />
              </motion.div>
            )
          )}
        </div>

        <div className="relative z-10 flex items-center gap-[7px] min-w-0">
          <div className="flex-shrink-0">
            <FileIcon name={node.name} isDir={node.isDir} isOpen={node.isOpen} />
          </div>
          <span
            className={`text-[12.5px] tracking-[0.05px] truncate leading-none transition-colors duration-100 ${
              isSelected ? 'text-white/95' : 'text-white/70 group-hover:text-white/90'
            }`}
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
          >
            {node.name}
          </span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {node.isDir && node.isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.18, ease },
              opacity: { duration: 0.1, ease: 'easeOut' },
            }}
            className="overflow-hidden"
          >
            {node.children.map((child, idx) => (
              <motion.div
                key={child.path}
                initial={{ opacity: 0, x: -2 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.12,
                  delay: Math.min(idx * 0.005, 0.05),
                  ease: 'easeOut',
                }}
              >
                <TreeNode
                  node={child}
                  level={level + 1}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  selectedPath={selectedPath}
                  configId={configId}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tree State Hook ────────────────────────────────────────────────────────────

function useTreeState(initialPath: string, configId?: string) {
  const [rootNodes, setRootNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

  const updateNode = (
    nodes: FileNode[],
    path: string,
    updates: Partial<FileNode>
  ): FileNode[] =>
    nodes.map(n => {
      if (n.path === path) return { ...n, ...updates };
      if (n.children) return { ...n, children: updateNode(n.children, path, updates) };
      return n;
    });

  const findNode = (nodes: FileNode[], path: string): FileNode | null => {
    for (const n of nodes) {
      if (n.path === path) return n;
      if (n.children) {
        const found = findNode(n.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const fetchDirectory = async (dirPath: string): Promise<FileNode[]> => {
    try {
      if (configId) {
        const result = await sshListDir(configId, dirPath);
        return result
          .map(file => ({
            name: file.name,
            path: file.path,
            isDir: file.is_dir,
          }))
          .sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
      } else {
        const result = await tauriListDirectory(dirPath);
        const items = Array.isArray(result) ? result : Object.values(result as object);
        return items
          .map((entry: any) => ({
            name: entry.name || entry.path.split(/[\\/]/).pop() || '',
            path: entry.path,
            isDir: entry.type === 'directory',
          }))
          .sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
      }
    } catch (err) {
      console.error('Failed to fetch directory', dirPath, err);
      return [];
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDirectory(initialPath).then(children => {
      setRootNodes(children);
      setLoading(false);
    });
  }, [initialPath, configId]);

  const toggleNode = useCallback(
    async (path: string) => {
      const node = findNode(rootNodes, path);
      if (!node || !node.isDir) return;

      if (node.isOpen) {
        setRootNodes(prev => updateNode(prev, path, { isOpen: false }));
      } else if (!node.children) {
        setRootNodes(prev => updateNode(prev, path, { isLoading: true }));
        const children = await fetchDirectory(path);
        setRootNodes(prev =>
          updateNode(prev, path, { isOpen: true, isLoading: false, children })
        );
      } else {
        setRootNodes(prev => updateNode(prev, path, { isOpen: true }));
      }
    },
    [rootNodes, configId]
  );

  return { rootNodes, loading, toggleNode };
}

// ── Section Header ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  expanded: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}

function SectionHeader({ expanded, onToggle, icon, label, badge }: SectionHeaderProps) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-[5px] px-3 h-[24px] cursor-default select-none text-white/55 hover:text-white/85 transition-colors duration-100 group"
    >
      <motion.div
        animate={{ rotate: expanded ? 90 : 0 }}
        transition={{ duration: 0.13, ease }}
        className="text-white/30 group-hover:text-white/60 transition-colors duration-100 flex-shrink-0"
      >
        <ChevronRight size={10} strokeWidth={2.25} />
      </motion.div>
      <div className="flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        {icon}
      </div>
      <span
        className="text-[10.5px] font-semibold tracking-[0.6px] uppercase truncate"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' }}
      >
        {label}
      </span>
      {badge && (
        <span className="ml-auto text-[8.5px] font-medium tracking-wide text-[#3b82f6]/80 bg-[#3b82f6]/[0.08] border border-[#3b82f6]/15 px-[5px] py-[1px] rounded-[3px] uppercase">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Status Messages ────────────────────────────────────────────────────────────

function StatusMessage({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="px-7 py-2 text-[11.5px] text-white/35 flex items-center gap-2 select-none">
      {icon}
      {text}
    </div>
  );
}

// ── File Explorer ──────────────────────────────────────────────────────────────

export function FileExplorer() {
  const { config } = useChat();
  const ssh = useSsh();

  const localProjectName = config?.project_dir
    ? config.project_dir.split(/[\\/]/).pop()
    : 'Local Project';
  const remoteConnection = ssh.activeConnection;

  const localState = useTreeState(config?.project_dir || '.', undefined);
  const remoteState = useTreeState('.', remoteConnection?.config_id);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [localExpanded, setLocalExpanded] = useState(true);
  const [remoteExpanded, setRemoteExpanded] = useState(true);

  return (
    <div
      className="flex flex-col h-full bg-[#0d0d0d] text-white/80"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      {/* Header — macOS toolbar style */}
      <div
        className="px-4 h-[34px] flex items-center text-[10.5px] font-semibold tracking-[0.7px] text-white/45 uppercase select-none flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
        }}
      >
        <span className="flex-1">Explorer</span>
      </div>

      {/* Tree container */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden py-[6px] outline-none"
        tabIndex={-1}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.08) transparent',
        }}
      >
        {/* Local Section */}
        <div className="mb-[2px]">
          <SectionHeader
            expanded={localExpanded}
            onToggle={() => setLocalExpanded(!localExpanded)}
            icon={<HardDrive size={10.5} strokeWidth={1.75} className="text-white/45" />}
            label={localProjectName || 'Local'}
          />

          <AnimatePresence initial={false}>
            {localExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.18, ease },
                  opacity: { duration: 0.12 },
                }}
                className="overflow-hidden"
              >
                {localState.loading ? (
                  <StatusMessage
                    icon={<Loader2 size={11} className="animate-spin" />}
                    text="Loading…"
                  />
                ) : localState.rootNodes.length === 0 ? (
                  <StatusMessage text="No files" />
                ) : (
                  <div>
                    {localState.rootNodes.map(node => (
                      <TreeNode
                        key={node.path}
                        node={node}
                        level={0}
                        onToggle={localState.toggleNode}
                        onSelect={p => setSelectedPath(p)}
                        selectedPath={selectedPath}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Remote SSH Section */}
        {remoteConnection && (
          <div>
            {/* Hairline divider */}
            <div className="mx-3 my-[6px] h-px bg-white/[0.04]" />

            <SectionHeader
              expanded={remoteExpanded}
              onToggle={() => setRemoteExpanded(!remoteExpanded)}
              icon={<Globe size={10.5} strokeWidth={1.75} className="text-[#3b82f6]/80" />}
              label={remoteConnection.server_name}
              badge="ssh"
            />

            <AnimatePresence initial={false}>
              {remoteExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.18, ease },
                    opacity: { duration: 0.12 },
                  }}
                  className="overflow-hidden"
                >
                  {remoteState.loading ? (
                    <StatusMessage
                      icon={<Loader2 size={11} className="animate-spin" />}
                      text="Connecting…"
                    />
                  ) : remoteState.rootNodes.length === 0 ? (
                    <StatusMessage text="No files" />
                  ) : (
                    <div>
                      {remoteState.rootNodes.map(node => (
                        <TreeNode
                          key={node.path}
                          node={node}
                          level={0}
                          onToggle={remoteState.toggleNode}
                          onSelect={p => setSelectedPath(p)}
                          selectedPath={selectedPath}
                          configId={remoteConnection.config_id}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}