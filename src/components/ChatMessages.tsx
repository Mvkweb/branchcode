import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Terminal,
  Pencil,
  Wrench,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileEdit,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Message } from '../hooks/useChat';
import { getGitDiff } from '../lib/tauri';

interface Props {
  message: Message;
}

// ── Shimmer text for thinking state ──

function ShimmerText({ children }: { children: string }) {
  return (
    <span
      className="inline-block bg-clip-text text-transparent"
      style={{
        backgroundImage:
          'linear-gradient(90deg, #737373 25%, #e5e5e5 50%, #737373 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite linear',
      }}
    >
      {children}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </span>
  );
}

// ── Thinking indicator ──

function ThinkingBlock({
  reasoning,
  isStreaming,
}: {
  reasoning: string;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(isStreaming);
  const hasReasoning = reasoning && reasoning.length > 0;

  useEffect(() => {
    if (isStreaming) setExpanded(true);
  }, [isStreaming]);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 py-1 group"
      >
        {isStreaming ? (
          <ShimmerText>Thinking...</ShimmerText>
        ) : hasReasoning ? (
          <span className="text-[13px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
            Thought
          </span>
        ) : (
          <span className="text-[13px] text-neutral-500">Thinking...</span>
        )}
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-neutral-600"
        >
          <ChevronRight size={12} />
        </motion.span>
      </button>

      <AnimatePresence>
        {expanded && hasReasoning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pl-0 pt-1 pb-2 text-[13px] text-neutral-600 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
              {reasoning}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tool call row ──

function ToolCallRow({ tc }: { tc: { name: string; input?: string; status?: string } }) {
  const name = tc.name.toLowerCase();
  const isBash =
    name.includes('bash') ||
    name.includes('exec') ||
    name.includes('run') ||
    name.includes('shell') ||
    name.includes('command');
  const isEdit =
    name.includes('edit') ||
    name.includes('write') ||
    name.includes('create') ||
    name.includes('update') ||
    name.includes('patch');
  const isRead =
    name.includes('read') ||
    name.includes('file') ||
    name.includes('get') ||
    name.includes('explore');

  const isDone = tc.status === 'completed';
  const isRunning = tc.status === 'running' || tc.status === 'pending';
  const isError = tc.status === 'error';

  // Parse input for display
  let label = tc.name;
  let filePath = '';
  let diffStats = '';
  let command = '';

  if (tc.input) {
    try {
      const parsed = JSON.parse(tc.input);
      if (isBash && parsed.command) {
        command = parsed.command;
        label = command.length > 60 ? command.slice(0, 60) + '...' : command;
      } else if (parsed.path || parsed.file_path) {
        filePath = parsed.path || parsed.file_path;
        label = filePath;
      }
    } catch {
      if (tc.input.length < 80) label = tc.input;
    }
  }

  // Determine icon and prefix
  const getIcon = () => {
    if (isBash) return <Terminal size={13} className="text-neutral-500" />;
    if (isEdit) return <Pencil size={13} className="text-neutral-500" />;
    if (isRead) return <BookOpen size={13} className="text-neutral-500" />;
    return <Wrench size={13} className="text-neutral-500" />;
  };

  const getPrefix = () => {
    if (isBash) return 'Shell Command';
    if (isEdit) return 'Edited';
    if (isRead) return 'Read';
    return tc.name;
  };

  const getStatusIcon = () => {
    if (isDone) return <Check size={14} className="text-emerald-500" />;
    if (isRunning) return <Loader2 size={14} className="text-neutral-400 animate-spin" />;
    if (isError) return <span className="text-red-400 text-xs">✕</span>;
    return <Check size={14} className="text-emerald-500" />;
  };

  // Edited file style (with subtle bg like reference)
  if (isEdit && filePath) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between py-[6px] px-3 rounded-lg bg-[#111] border border-[#1a1a1a]"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 text-[13px]">
          <Pencil size={13} className="text-neutral-500 flex-shrink-0" />
          <span className="text-neutral-300 font-mono truncate">{filePath}</span>
          {diffStats && (
            <span className="text-[11px] text-neutral-600 flex-shrink-0">{diffStats}</span>
          )}
        </div>
        <div className="flex-shrink-0 ml-3">{getStatusIcon()}</div>
      </motion.div>
    );
  }

  // Bash/shell command style
  if (isBash && command) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2.5 py-[6px] text-[13px]"
      >
        <Terminal size={13} className="text-neutral-500 flex-shrink-0" />
        <span className="text-neutral-400">Shell Command</span>
        <span className="text-neutral-600 font-mono text-[12px] truncate">{label}</span>
        <div className="ml-auto flex-shrink-0">{getStatusIcon()}</div>
      </motion.div>
    );
  }

  // Read file style
  if (isRead && filePath) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2.5 py-[6px] text-[13px]"
      >
        <BookOpen size={13} className="text-neutral-500 flex-shrink-0" />
        <span className="text-neutral-400">Read</span>
        <span className="text-neutral-300 font-mono truncate">{filePath}</span>
        <div className="ml-auto flex-shrink-0">{getStatusIcon()}</div>
      </motion.div>
    );
  }

  // Generic fallback
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2.5 py-[6px] text-[13px]"
    >
      {getIcon()}
      <span className="text-neutral-400">{getPrefix()}</span>
      {filePath && <span className="text-neutral-300 font-mono truncate">{filePath}</span>}
      {!filePath && label !== tc.name && (
        <span className="text-neutral-500 font-mono text-[12px] truncate">{label}</span>
      )}
      <div className="ml-auto flex-shrink-0">{getStatusIcon()}</div>
    </motion.div>
  );
}

// ── File Edit with Diff ──

function FileEditItem({ path }: { path: string }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);

  const fileName = path.split('/').pop() || path;

  const loadDiff = async () => {
    if (diff) return;
    setLoading(true);
    try {
      const result = await getGitDiff(path);
      setDiff(result.diff);
    } catch (e) {
      console.error('Failed to load diff:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (!expanded) {
      loadDiff();
    }
    setExpanded(!expanded);
  };

  return (
    <div className="border border-[#1e1e1e] rounded-lg overflow-hidden bg-[#0c0c0c]">
      <button
        onClick={handleClick}
        className="w-full flex items-center justify-between py-[6px] px-3 hover:bg-[#151515] transition-colors"
      >
        <div className="flex items-center gap-2.5 text-[13px]">
          <FileEdit size={13} className="text-yellow-500" />
          <span className="text-neutral-300 font-mono">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          {diff && (
            <span className="text-[10px] text-neutral-600">
              +{diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length} / 
              -{diff.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).length}
            </span>
          )}
          {expanded ? (
            <ChevronDown size={14} className="text-neutral-500" />
          ) : (
            <ChevronRight size={14} className="text-neutral-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-neutral-500 text-[12px]">
                <Loader2 size={12} className="animate-spin" />
                Loading diff...
              </div>
            ) : diff ? (
              <pre className="text-[11px] font-mono leading-[1.5] p-3 max-h-48 overflow-y-auto custom-scrollbar">
                {diff.split('\n').slice(0, 50).map((line, i) => {
                  let className = 'text-neutral-400';
                  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
                    className = 'text-neutral-500';
                  } else if (line.startsWith('+')) {
                    className = 'text-green-400';
                  } else if (line.startsWith('-')) {
                    className = 'text-red-400';
                  }
                  return (
                    <div key={i} className={className}>
                      {line}
                    </div>
                  );
                })}
                {diff.split('\n').length > 50 && (
                  <div className="text-neutral-600 text-[10px] py-1">
                    ... {diff.split('\n').length - 50} more lines
                  </div>
                )}
              </pre>
            ) : (
              <div className="px-3 py-2 text-[12px] text-neutral-500">
                No diff available
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tool Activity Card ──

function ToolActivityCard({
  toolCalls,
  toolResults,
  fileEdits,
}: {
  toolCalls?: Message['toolCalls'];
  toolResults?: Message['toolResults'];
  fileEdits?: Message['fileEdits'];
}) {
  const [expanded, setExpanded] = useState(true);
  const totalCount =
    (toolCalls?.length || 0) + (toolResults?.length || 0) + (fileEdits?.length || 0);

  if (totalCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="border border-[#1e1e1e] rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#0e0e0e] transition-colors"
      >
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-300">
          <Wrench size={14} className="text-neutral-500" />
          <span className="font-medium">Tool Activity</span>
          <span className="text-neutral-600">({totalCount})</span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown size={14} className="text-neutral-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1">
              {toolCalls?.map((tc, idx) => (
                <ToolCallRow key={`tc-${idx}`} tc={tc} />
              ))}
              {toolResults?.map((tr, idx) => (
                <motion.div
                  key={`tr-${idx}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  className="flex items-center gap-2.5 py-[6px] text-[13px]"
                >
                  <Terminal size={13} className="text-neutral-500 flex-shrink-0" />
                  <span className="text-neutral-400">{tr.name}</span>
                  <div className="ml-auto flex-shrink-0">
                    <Check size={14} className="text-emerald-500" />
                  </div>
                </motion.div>
              ))}
              {fileEdits?.map((path, idx) => (
                <FileEditItem key={`fe-${idx}`} path={path} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Explored files summary (when no tool card needed) ──

function ExploredFiles({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="text-[13px] text-neutral-500 py-0.5">
      Explored {count} file{count > 1 ? 's' : ''}
    </div>
  );
}

// ── Main Component ──

export function ChatMessages({ message }: Props) {
  const isUser = message.role === 'user';

  // ── User Message ──
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] bg-[#1a1a1a] border border-[#262626] rounded-2xl rounded-br-[6px] px-4 py-3">
          <p className="text-[15px] leading-[1.7] text-neutral-100 whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  // ── Assistant Message ──
  const hasToolActivity =
    (message.toolCalls?.length ?? 0) > 0 ||
    (message.toolResults?.length ?? 0) > 0 ||
    (message.fileEdits?.length ?? 0) > 0;

  const readCount = (message.toolCalls || []).filter((tc) => {
    const n = tc.name.toLowerCase();
    return (
      n.includes('read') ||
      n.includes('explore') ||
      n.includes('file') ||
      n.includes('get')
    );
  }).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className="w-full space-y-3"
    >
      {/* Thinking */}
      {(message.reasoning || message.streaming) && (
        <ThinkingBlock
          reasoning={message.reasoning ?? ''}
          isStreaming={!!message.streaming}
        />
      )}

      {/* Explored files count (subtle, like reference) */}
      {readCount > 0 && !hasToolActivity && <ExploredFiles count={readCount} />}

      {/* Inline tool calls (outside tool card — for simple edit/read flows) */}
      {message.toolCalls &&
        message.toolCalls.length > 0 &&
        message.toolCalls.length <= 3 &&
        !message.toolResults?.length && (
          <div className="space-y-1">
            {message.toolCalls.map((tc, idx) => (
              <ToolCallRow key={`inline-tc-${idx}`} tc={tc} />
            ))}
          </div>
        )}

      {/* Tool Activity Card */}
      {hasToolActivity &&
        ((message.toolCalls?.length ?? 0) > 0 || (message.fileEdits?.length ?? 0) > 0 || (message.toolResults?.length ?? 0) > 0) && (
          <ToolActivityCard
            toolCalls={message.toolCalls}
            toolResults={message.toolResults}
            fileEdits={message.fileEdits}
          />
        )}

      {/* Content */}
      {message.content && (
        <div className="text-[15px] leading-[1.75] text-neutral-300">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p({ children }) {
                return <p className="mb-4 last:mb-0">{children}</p>;
              },
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const content = String(children).replace(/\n$/, '');
                const isBlock = match || content.includes('\n');

                if (isBlock) {
                  return (
                    <div className="my-5 relative group">
                      {match && (
                        <div className="absolute top-3 right-3 text-[11px] text-neutral-600 font-mono select-none opacity-60">
                          {match[1]}
                        </div>
                      )}
                      <pre className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-lg p-4 overflow-x-auto">
                        <code className="text-[13px] leading-[1.65] font-mono text-neutral-300">
                          {children}
                        </code>
                      </pre>
                    </div>
                  );
                }

                return (
                  <code
                    className="bg-[#1e1e1e] border border-[#2a2a2a] px-[6px] py-[2px] rounded-[5px] text-[13px] font-mono text-neutral-200"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              ul({ children }) {
                return (
                  <ul className="pl-5 mb-4 space-y-1.5 list-disc marker:text-neutral-600">
                    {children}
                  </ul>
                );
              },
              ol({ children }) {
                return (
                  <ol className="pl-5 mb-4 space-y-1.5 list-decimal marker:text-neutral-600">
                    {children}
                  </ol>
                );
              },
              li({ children }) {
                return <li className="text-neutral-300 leading-[1.7]">{children}</li>;
              },
              a({ children, href }) {
                return (
                  <a
                    href={href}
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 decoration-indigo-400/30 hover:decoration-indigo-300/50 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                );
              },
              strong({ children }) {
                return <strong className="font-semibold text-neutral-100">{children}</strong>;
              },
              em({ children }) {
                return <em className="text-neutral-400">{children}</em>;
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-2 border-[#2a2a2a] pl-4 my-4 text-neutral-400">
                    {children}
                  </blockquote>
                );
              },
              h1({ children }) {
                return (
                  <h1 className="text-xl font-semibold text-neutral-100 mt-6 mb-3">{children}</h1>
                );
              },
              h2({ children }) {
                return (
                  <h2 className="text-lg font-semibold text-neutral-100 mt-5 mb-2.5">
                    {children}
                  </h2>
                );
              },
              h3({ children }) {
                return (
                  <h3 className="text-[15px] font-semibold text-neutral-100 mt-4 mb-2">
                    {children}
                  </h3>
                );
              },
              hr() {
                return <hr className="border-[#1e1e1e] my-6" />;
              },
              table({ children }) {
                return (
                  <div className="my-4 overflow-x-auto rounded-lg border border-[#1e1e1e]">
                    <table className="w-full text-[13px]">{children}</table>
                  </div>
                );
              },
              thead({ children }) {
                return <thead className="bg-[#0e0e0e]">{children}</thead>;
              },
              th({ children }) {
                return (
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium border-b border-[#1e1e1e]">
                    {children}
                  </th>
                );
              },
              td({ children }) {
                return (
                  <td className="px-3 py-2 text-neutral-400 border-b border-[#141414]">
                    {children}
                  </td>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      )}

      {/* Streaming dots */}
      {message.streaming && !message.content && !message.reasoning && (
        <div className="flex gap-1.5 py-2 items-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-neutral-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Lightweight placeholder for off-screen messages (culling) ──

export function MessagePlaceholder({ message }: Props) {
  const isUser = message.role === 'user';
  
  // Simple character-based height estimation - fast and stable
  const estimatedHeight = useMemo(() => {
    const text = message.content || '';
    if (!text) return isUser ? 52 : 80;
    
    // Rough estimate: ~70 chars per line for user, ~60 for assistant (wider markdown)
    const charsPerLine = isUser ? 70 : 60;
    const lines = Math.ceil(text.length / charsPerLine);
    const lineHeight = isUser ? 20 : 22;
    
    return isUser 
      ? Math.max(52, 20 + lines * lineHeight)
      : Math.max(80, 30 + lines * lineHeight);
  }, [message.content, isUser]);

  return (
    <div
      style={{ height: estimatedHeight, minHeight: 40 }}
      className="w-full"
      aria-hidden
    />
  );
}