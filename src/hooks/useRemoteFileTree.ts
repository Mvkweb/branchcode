import { useState, useCallback } from 'react';
import { sshListDir, type SftpFileEntry } from '../lib/tauri';

export function useRemoteFileTree() {
  const [files, setFiles] = useState<SftpFileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [loading, setLoading] = useState(false);

  const loadDirectory = useCallback(async (configId: string, path: string) => {
    setLoading(true);
    try {
      const result = await sshListDir(configId, path);
      // Sort: dirs first, then alphabetical
      const sorted = result.sort((a, b) => {
        if (a.is_dir === b.is_dir) {
          return a.name.localeCompare(b.name);
        }
        return a.is_dir ? -1 : 1;
      });
      setFiles(sorted);
      setCurrentPath(path);
    } catch (err) {
      console.error('[SSH] Failed to list remote directory:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { files, currentPath, loading, loadDirectory };
}
