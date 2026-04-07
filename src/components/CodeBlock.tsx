import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { Check, Copy } from 'lucide-react';
import * as si from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';

// Hand-picked mapping of common extensions to brand configurations from simple-icons
function getLanguageIcon(lang: string): SimpleIcon | undefined {
  const norm = lang.toLowerCase();
  switch (norm) {
    case 'js':
    case 'javascript': return si.siJavascript;
    case 'ts':
    case 'typescript': return si.siTypescript;
    case 'python':
    case 'py': return si.siPython;
    case 'rust':
    case 'rs': return si.siRust;
    case 'go': return si.siGo;
    case 'html': return si.siHtml5;
    case 'css': return si.siCss;
    case 'bash':
    case 'sh':
    case 'shell': return si.siGnubash;
    case 'json': return si.siJson;
    case 'yaml':
    case 'yml': return si.siYaml;
    case 'md':
    case 'markdown': return si.siMarkdown;
    case 'java': return undefined;
    case 'kotlin':
    case 'kt': return si.siKotlin;
    case 'groovy': return si.siApachegroovy;
    case 'elixir':
    case 'ex':
    case 'exs': return si.siElixir;
    case 'react':
    case 'jsx':
    case 'tsx': return si.siReact;
    case 'node': return si.siNodedotjs;
    case 'c':
    case 'c++':
    case 'cpp': return si.siCplusplus;
    case 'c#':
    case 'csharp':
    case 'cs': return undefined;
    case 'ruby':
    case 'rb': return si.siRuby;
    case 'php': return si.siPhp;
    case 'swift': return si.siSwift;
    case 'dart': return si.siDart;
    case 'docker':
    case 'dockerfile': return si.siDocker;
    case 'kube':
    case 'kubernetes': return si.siKubernetes;
    case 'sql': return si.siMysql;
    case 'vue': return si.siVuedotjs;
    case 'svelte': return si.siSvelte;
    case 'angular': return si.siAngular;
    case 'lua': return si.siLua;
    case 'zig': return si.siZig;
    case 'haskell': return si.siHaskell;
    case 'scala': return si.siScala;
    case 'xml': return si.siXml;
    case 'toml': return si.siToml;
    case 'git': return si.siGit;
    default: return undefined;
  }
}

// Our custom minimal branchcode theme mirroring the reference image
const branchcodeTheme: any = {
  name: 'branchcode-dark',
  type: 'dark',
  fg: '#e2e2e2',
  bg: 'transparent',
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#5c5c5c', fontStyle: 'italic' }
    },
    {
      scope: ['string', 'punctuation.definition.string', 'constant.character.escape'],
      settings: { foreground: '#4078f2' } // Muted blue
    },
    {
      scope: ['keyword', 'storage', 'variable.language', 'keyword.control'],
      settings: { foreground: '#888888' } // Light gray
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      settings: { foreground: '#e2e2e2' } // White/light gray
    },
    {
      scope: ['variable', 'support.variable', 'entity.name.type'],
      settings: { foreground: '#cccccc' }
    },
    {
      scope: ['constant.numeric', 'constant.language.boolean'],
      settings: { foreground: '#4078f2' }
    },
    {
      scope: ['punctuation', 'meta.brace'],
      settings: { foreground: '#666666' }
    }
  ]
};

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const icon = getLanguageIcon(language);

  useEffect(() => {
    let valid = true;
    
    codeToHtml(code, {
      lang: language || 'text',
      theme: branchcodeTheme,
    })
      .then((res) => {
        if (valid) setHtml(res);
      })
      .catch(() => {
        codeToHtml(code, { lang: 'text', theme: branchcodeTheme })
          .then((res) => {
            if (valid) setHtml(res);
          })
          .catch(() => {});
      });

      return () => {
        valid = false;
      };
  }, [code, language]);

  const onCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-5 relative group">
      {/* Icon + Language Name elegantly placed at top left */}
      <div className="absolute top-3.5 left-5 flex items-center gap-2 select-none z-10 px-1 opacity-60">
        {icon && (
          <svg
            role="img"
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill={`#${icon.hex}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            <title>{icon.title}</title>
            <path d={icon.path} />
          </svg>
        )}
        <span className="text-[11.5px] text-neutral-500 font-mono tracking-wide lowercase pt-[1px]">
          {language || 'text'}
        </span>
      </div>

      {/* Copy button at top right */}
      <div className="absolute top-3.5 right-4 flex items-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onCopy}
          className="text-neutral-500 hover:text-neutral-300 transition-colors bg-transparent border-none p-1 cursor-pointer flex items-center justify-center rounded"
          title="Copy code"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
      </div>

      <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-lg pt-11 pb-4 px-5 overflow-x-auto custom-scrollbar min-h-[4rem]">
        {html ? (
          <div
            className="text-[13px] leading-[1.65] font-mono [&>pre]:!bg-transparent [&>pre]:!m-0 [&>pre]:!p-0 [&_code]:counter-reset-step [&_code]:[counter-reset:step] [&_.line::before]:content-[counter(step)] [&_.line::before]:[counter-increment:step] [&_.line::before]:inline-block [&_.line::before]:w-6 [&_.line::before]:mr-4 [&_.line::before]:text-right [&_.line::before]:text-[#333333]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="m-0 p-0 text-[13px] leading-[1.65] font-mono text-neutral-300">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
