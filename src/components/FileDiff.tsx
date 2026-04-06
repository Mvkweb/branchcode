import { useState, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileEdit, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { GitDiff } from '../lib/tauri';

interface FileDiffProps {
  filePath: string;
  onLoadDiff?: (filePath: string) => Promise<GitDiff | null>;
}

export const FileDiff = memo(function FileDiff({ filePath, onLoadDiff }: FileDiffProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<GitDiff | null>(null);

  const fileName = filePath.split('/').pop() || filePath;

  useEffect(() => {
    if (expanded && !diff && onLoadDiff && !loading) {
      setLoading(true);
      onLoadDiff(filePath)
        .then(setDiff)
        .finally(() => setLoading(false));
    }
  }, [expanded, diff, onLoadDiff, filePath, loading]);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  return (
    <div className="my-2 rounded-lg border border-[#1e1e1e] overflow-hidden bg-[#0c0c0c]">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#151515] transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-neutral-500" />
        ) : (
          <ChevronRight size={14} className="text-neutral-500" />
        )}
        <FileEdit size={14} className="text-yellow-500" />
        <span className="text-[13px] text-neutral-300 font-mono">{fileName}</span>
        {diff && (
          <span className="text-[11px] text-neutral-500 ml-auto">
            <span className="text-green-500">+{diff.additions}</span>
            {' / '}
            <span className="text-red-500">-{diff.deletions}</span>
          </span>
        )}
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
              <div className="flex items-center justify-center py-4 text-neutral-500">
                <Loader2 size={16} className="animate-spin mr-2" />
                Loading diff...
              </div>
            ) : diff ? (
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <DiffView diff={diff.diff} />
              </div>
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
});

function DiffView({ diff }: { diff: string }) {
  const lines = diff.split('\n');

  return (
    <pre className="text-[11px] font-mono leading-[1.5] p-3">
      {lines.map((line, idx) => {
        let className = 'text-neutral-400';
        let prefix = ' ';

        if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
          className = 'text-neutral-500';
        } else if (line.startsWith('+')) {
          className = 'text-green-400 bg-green-500/10';
          prefix = '+';
        } else if (line.startsWith('-')) {
          className = 'text-red-400 bg-red-500/10';
          prefix = '-';
        }

        return (
          <div
            key={idx}
            className={`flex ${className}`}
          >
            <span className="w-6 flex-shrink-0 text-neutral-600 select-none text-right pr-2">
              {prefix !== ' ' ? prefix : ''}
            </span>
            <span className="whitespace-pre-wrap break-all">{line}</span>
          </div>
        );
      })}
    </pre>
  );
}

export function CompactFileEdit({ filePath }: { filePath: string }) {
  const [expanded, setExpanded] = useState(false);
  
  const fileName = filePath.split('/').pop() || filePath;
  const dirPath = filePath.includes('/') 
    ? filePath.slice(0, filePath.lastIndexOf('/')) 
    : '';

  return (
    <div className="inline-flex items-center gap-1.5">
      <FileEdit size={12} className="text-yellow-500 flex-shrink-0" />
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[13px] text-neutral-300 font-mono hover:text-neutral-200 hover:underline underline-offset-2 transition-colors"
      >
        {fileName}
      </button>
      {dirPath && (
        <span className="text-[11px] text-neutral-600">{dirPath}/</span>
      )}
      
      {expanded && (
        <div className="absolute left-0 top-full mt-2 z-50">
          <FileDiff filePath={filePath} />
        </div>
      )}
    </div>
  );
}