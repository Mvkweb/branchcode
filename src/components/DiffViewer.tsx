export function DiffViewer({ 
  diff, 
  maxLines = 50,
  maxHeightClass = "max-h-48"
}: { 
  diff: string; 
  maxLines?: number;
  maxHeightClass?: string;
}) {
  const lines = diff.split('\n');
  const showLines = maxLines > 0 ? lines.slice(0, maxLines) : lines;
  
  return (
    <div className={`text-[11px] font-mono leading-[1.6] ${maxHeightClass} overflow-y-auto custom-scrollbar bg-[#0c0c0c] rounded-b-md`}>
      {showLines.map((line, i) => {
        const isHeader = line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@');
        const isAdd = line.startsWith('+') && !isHeader;
        const isRemove = line.startsWith('-') && !isHeader;
        
        let bgClass = 'bg-transparent';
        let textClass = 'text-neutral-400 opacity-80';
        
        if (isHeader) {
          bgClass = 'bg-[#111]';
          textClass = 'text-neutral-500 font-medium';
        } else if (isAdd) {
          bgClass = 'bg-emerald-500/15';
          textClass = 'text-emerald-400';
        } else if (isRemove) {
          bgClass = 'bg-rose-500/15';
          textClass = 'text-rose-400';
        }

        return (
          <div key={i} className={`flex w-full px-3 py-[1px] ${bgClass}`}>
            <span className={`whitespace-pre-wrap break-all ${textClass}`}>
              {line}
            </span>
          </div>
        );
      })}
      {maxLines > 0 && lines.length > maxLines && (
        <div className="text-neutral-600 text-[10px] px-3 py-2 bg-gradient-to-t from-[#0c0c0c] to-transparent sticky bottom-0">
          ... {lines.length - maxLines} more lines
        </div>
      )}
    </div>
  );
}
