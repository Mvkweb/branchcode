import { useState, useEffect } from 'react';

interface FileIconProps {
  name: string;
  isDir: boolean;
  isOpen?: boolean;
}

const getIconName = (name: string, isDir: boolean): string => {
  if (isDir) return 'folder';

  const lowerName = name.toLowerCase();
  const ext = lowerName.split('.').pop() || '';
  
  // Specific filename matches
  switch (true) {
    case lowerName === 'package.json':
    case lowerName === 'tsconfig.json':
    case ext === 'json':
      return 'json';
    case ext === 'ts':
      return 'typeScript';
    case ext === 'tsx':
      return 'tsx';
    case ext === 'js':
    case ext === 'jsx':
      return 'javaScript';
    case ext === 'css':
      return 'css';
    case ext === 'md':
      return 'text';
    case ext === 'rs':
      return 'rustFile';
    case ext === 'py':
      return 'python';
    case ext === 'go':
      return 'go';
    case lowerName === 'go.mod':
      return 'gomod';
    case lowerName === 'go.sum':
      return 'goSum';
    case lowerName === 'go.work':
      return 'goWork';
    case ext === 'java':
      return 'java';
    case ext === 'kt':
    case ext === 'kts':
      return 'kotlin';
    case ext === 'c':
      return 'c';
    case ext === 'cpp':
    case ext === 'cc':
    case ext === 'cxx':
      return 'cpp';
    case ext === 'h':
    case ext === 'hpp':
      return 'h';
    case ext === 'cs':
      return 'csharp';
    case ext === 'fs':
      return 'font';
    case ext === 'png':
    case ext === 'jpg':
    case ext === 'jpeg':
    case ext === 'gif':
    case ext === 'webp':
    case ext === 'svg':
      return 'image';
    case lowerName === 'dockerfile':
    case lowerName === '.dockerignore':
    case lowerName.includes('docker'):
      return 'docker';
    case lowerName === 'makefile':
      return 'makefile';
    case lowerName === 'cmakelists.txt':
      return 'cmake';
    case ext === 'toml':
      return 'toml';
    case ext === 'yml':
    case ext === 'yaml':
    case ext === 'env':
    case ext === 'lock':
    case ext === 'lockb':
    case lowerName.includes('config'):
      return 'config';
    case lowerName.includes('ignore'):
      return 'gitignore';
    case ext === 'sh':
    case ext === 'bash':
    case ext === 'zsh':
      return 'shell';
    case ext === 'rb':
      return 'ruby';
    case ext === 'php':
      return 'php';
    case ext === 'graphql':
    case ext === 'gql':
      return 'graphql';
    case lowerName.includes('eslint'):
      return 'eslint';
    case ext === 'vue':
      return 'vueJs';
    case ext === 'scala':
    case ext === 'sbt':
      return 'scala';
    case ext === 'tf':
      return 'terraform';
    case ext === 'zig':
      return 'zig';
    case ext === 'dart':
      return 'dart';
    case ext === 'ex':
    case ext === 'exs':
      return 'elixir';
    case ext === 'erl':
    case ext === 'hrl':
      return 'erlang';
    case ext === 'gleam':
      return 'gleam';
    case ext === 'lua':
      return 'lua';
    case ext === 'swift':
      return 'swift';
    case ext === 'txt':
      return 'text';
    default:
      return 'anyType';
  }
};

// Icons that we KNOW have _dark variants from our list_dir check
const HAS_DARK_VARIANT = new Set([
  'anyType', 'c', 'config', 'cpp', 'csharp', 'dart', 'docker', 'elixir', 
  'font', 'folder', 'gleam', 'go', 'goSum', 'goWork', 'gomod', 'h', 'hcl', 
  'image', 'java', 'javaScript', 'json', 'kotlin', 'makefile', 'php', 
  'ruby', 'rustFile', 'scala', 'shell', 'terraform', 'text', 'toml', 
  'tsx', 'typeScript', 'zig'
]);

export function FileIcon({ name, isDir, isOpen }: FileIconProps) {
  const iconName = getIconName(name, isDir);
  const useDark = HAS_DARK_VARIANT.has(iconName);
  const src = `/icons-ide/${iconName}${useDark ? '_dark' : ''}.svg`;

  return (
    <img 
      src={src} 
      alt={name} 
      className={`w-[16px] h-[16px] flex-shrink-0 ${isDir && isOpen ? 'opacity-80' : ''}`}
      style={{ userSelect: 'none', pointerEvents: 'none' }}
      loading="lazy"
    />
  );
}
