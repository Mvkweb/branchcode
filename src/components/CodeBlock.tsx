import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';
import { Check, Copy } from 'lucide-react';

function getLanguageIconClass(lang: string): { class: string; invert?: boolean; color?: string; isLarge?: boolean } | undefined {
  const norm = lang.toLowerCase();
  
  const icons: Record<string, { icon: string; invert?: boolean; color?: string; isLarge?: boolean }> = {
    js: { icon: 'ci-javascript' },
    javascript: { icon: 'ci-javascript' },
    ts: { icon: 'ci-typescript' },
    typescript: { icon: 'ci-typescript' },
    jsx: { icon: 'ci-react' },
    tsx: { icon: 'ci-react' },
    py: { icon: 'ci-python' },
    python: { icon: 'ci-python' },
    rs: { icon: 'ci-rust', invert: true },
    rust: { icon: 'ci-rust', invert: true },
    go: { icon: 'ci-golang' },
    golang: { icon: 'ci-golang' },
    html: { icon: 'ci-html' },
    css: { icon: 'ci-css' },
    scss: { icon: 'ci-sass' },
    sass: { icon: 'ci-sass' },
    less: { icon: 'ci-less' },
    sh: { icon: 'ci-bash' },
    bash: { icon: 'ci-bash' },
    shell: { icon: 'ci-bash' },
    zsh: { icon: 'ci-ohmyzsh' },
    fish: { icon: 'ci-fish' },
    json: { icon: 'ci-json' },
    yaml: { icon: 'ci-yaml' },
    yml: { icon: 'ci-yaml' },
    toml: { icon: 'ci-toml' },
    xml: { icon: 'ci-xml' },
    ini: { icon: 'ci-ini' },
    env: { icon: 'ci-dotenv' },
    md: { icon: 'ci-markdown' },
    markdown: { icon: 'ci-markdown' },
    txt: { icon: 'ci-text' },
    java: { icon: 'ci-java' },
    kotlin: { icon: 'ci-kotlin' },
    kt: { icon: 'ci-kotlin' },
    scala: { icon: 'ci-scala' },
    groovy: { icon: 'ci-groovy', invert: true, isLarge: true },
    clojure: { icon: 'ci-clojure' },
    csharp: { icon: 'ci-csharp' },
    'c#': { icon: 'ci-csharp' },
    cs: { icon: 'ci-csharp' },
    'f#': { icon: 'ci-fsharp' },
    fs: { icon: 'ci-fsharp' },
    vb: { icon: 'ci-vbdotnet' },
    'vb.net': { icon: 'ci-vbdotnet' },
    c: { icon: 'ci-c' },
    'c++': { icon: 'ci-cplusplus' },
    cpp: { icon: 'ci-cplusplus' },
    objectivec: { icon: 'ci-objectivec' },
    'obj-c': { icon: 'ci-objectivec' },
    zig: { icon: 'ci-zig', color: '#f7a41d' },
    nim: { icon: 'ci-nim' },
    assembly: { icon: 'ci-assembly' },
    haskell: { icon: 'ci-haskell' },
    erlang: { icon: 'ci-erlang' },
    elixir: { icon: 'ci-elixir' },
    ex: { icon: 'ci-elixir' },
    exs: { icon: 'ci-elixir' },
    ocaml: { icon: 'ci-ocaml' },
    fsharp: { icon: 'ci-fsharp' },
    elm: { icon: 'ci-elm' },
    lisp: { icon: 'ci-commonlisp' },
    elisp: { icon: 'ci-commonlisp' },
    scheme: { icon: 'ci-scheme' },
    ruby: { icon: 'ci-ruby' },
    rb: { icon: 'ci-ruby' },
    php: { icon: 'ci-php' },
    perl: { icon: 'ci-perl' },
    lua: { icon: 'ci-lua' },
    r: { icon: 'ci-r' },
    swift: { icon: 'ci-swift' },
    dart: { icon: 'ci-dart' },
    react: { icon: 'ci-react' },
    vue: { icon: 'ci-vuejs' },
    svelte: { icon: 'ci-svelte' },
    angular: { icon: 'ci-angular' },
    nextjs: { icon: 'ci-nextjs' },
    nuxt: { icon: 'ci-nuxtjs' },
    express: { icon: 'ci-express' },
    fastapi: { icon: 'ci-fastapi' },
    django: { icon: 'ci-django' },
    rails: { icon: 'ci-rubyonrails' },
    laravel: { icon: 'ci-laravel' },
    spring: { icon: 'ci-spring' },
    flask: { icon: 'ci-flask' },
    node: { icon: 'ci-nodejs' },
    nodejs: { icon: 'ci-nodejs' },
    npm: { icon: 'ci-npm' },
    yarn: { icon: 'ci-yarn' },
    pnpm: { icon: 'ci-pnpm' },
    bun: { icon: 'ci-bun' },
    sql: { icon: 'ci-mysql' },
    mysql: { icon: 'ci-mysql' },
    postgresql: { icon: 'ci-postgresql' },
    postgres: { icon: 'ci-postgresql' },
    mongodb: { icon: 'ci-mongodb' },
    mongo: { icon: 'ci-mongodb' },
    sqlite: { icon: 'ci-sqlite' },
    redis: { icon: 'ci-redis' },
    graphql: { icon: 'ci-graphql' },
    docker: { icon: 'ci-docker' },
    dockerfile: { icon: 'ci-docker' },
    kubernetes: { icon: 'ci-kubernetes' },
    kube: { icon: 'ci-kubernetes' },
    k8s: { icon: 'ci-kubernetes' },
    terraform: { icon: 'ci-terraform' },
    ansible: { icon: 'ci-ansible' },
    helm: { icon: 'ci-helm' },
    jenkins: { icon: 'ci-jenkins' },
    gitlab: { icon: 'ci-gitlab' },
    github: { icon: 'ci-github' },
    githubactions: { icon: 'ci-githubactions' },
    git: { icon: 'ci-git' },
    vscode: { icon: 'ci-vscode' },
    intellij: { icon: 'ci-intellij' },
    vim: { icon: 'ci-vim' },
    neovim: { icon: 'ci-neovim' },
    emacs: { icon: 'ci-emacs' },
    sublime: { icon: 'ci-sublime' },
    composer: { icon: 'ci-composer' },
    pip: { icon: 'ci-pypi' },
    pipenv: { icon: 'ci-pipenv' },
    poetry: { icon: 'ci-poetry' },
    cargo: { icon: 'ci-cargo' },
    jest: { icon: 'ci-jest' },
    mocha: { icon: 'ci-mocha' },
    pytest: { icon: 'ci-pytest' },
    junit: { icon: 'ci-junit' },
    cypress: { icon: 'ci-cypress' },
    playwright: { icon: 'ci-playwright' },
    webpack: { icon: 'ci-webpack' },
    vite: { icon: 'ci-vite' },
    esbuild: { icon: 'ci-esbuild' },
    rollup: { icon: 'ci-rollup' },
    parcel: { icon: 'ci-parcel' },
    cmake: { icon: 'ci-cmake' },
    make: { icon: 'ci-make' },
    gradle: { icon: 'ci-gradle' },
    maven: { icon: 'ci-maven' },
    latex: { icon: 'ci-latex' },
    bibtex: { icon: 'ci-latex' },
    powershell: { icon: 'ci-powershell' },
    ps1: { icon: 'ci-powershell' },
    wasm: { icon: 'ci-webassembly' },
  };
  
  const result = icons[norm];
  if (!result) return undefined;
  
  return {
    class: result.icon,
    invert: result.invert,
    color: result.color,
    isLarge: result.isLarge
  };
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
  const iconClass = getLanguageIconClass(language);

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
      <div className="absolute top-3.5 left-5 flex items-center gap-2 select-none z-10 px-1 opacity-80">
        {iconClass && (
          <span 
            className={`${iconClass.class}${iconClass.invert ? ' ci-invert' : ''}`}
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: iconClass.isLarge ? '20px' : '16px',
              height: iconClass.isLarge ? '20px' : '16px',
              fontSize: iconClass.isLarge ? '18px' : '14px',
              color: iconClass.color
            }}
          ></span>
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
