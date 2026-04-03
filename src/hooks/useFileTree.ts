import { useState, useCallback } from 'react';
import { listDirectory as tauriListDirectory } from '../lib/tauri';

export function useFileTree() {
  const [files, setFiles] = useState<Record<string, unknown>>({});
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const result = await tauriListDirectory(path);
      setFiles(result);
      setCurrentPath(path);
    } catch (err) {
      console.error('Failed to list directory:', err);
      setFiles({});
    } finally {
      setLoading(false);
    }
  }, []);

  return { files, currentPath, loading, loadDirectory };
}
