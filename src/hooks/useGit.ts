import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getGitStatus,
  getGitDiff,
  getCurrentBranch,
  getBranches,
  checkoutBranch,
  createBranch,
  stageFile,
  unstageFile,
  stageAll,
  commit,
  type GitStatus,
  type GitDiff,
  type GitBranch,
} from '../lib/tauri';

export interface UseGitReturn {
  status: GitStatus | null;
  branches: GitBranch[];
  currentBranch: string;
  diffCache: Map<string, GitDiff>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getDiff: (filePath: string) => Promise<GitDiff | null>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  stageAll: () => Promise<void>;
  commit: (message: string) => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
}

export function useGit(autoRefresh = true, intervalMs = 5000): UseGitReturn {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [diffCache, setDiffCache] = useState<Map<string, GitDiff>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const [statusResult, branchResult, branchesResult] = await Promise.all([
        getGitStatus(),
        getCurrentBranch(),
        getBranches(),
      ]);

      setStatus(statusResult);
      setCurrentBranch(branchResult);
      setBranches(branchesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error('Git refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      refresh();
    };
    window.addEventListener('git-refresh', handleRefresh);
    return () => {
      window.removeEventListener('git-refresh', handleRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (autoRefresh && status?.is_repo) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = window.setInterval(refresh, intervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, intervalMs, refresh, status?.is_repo]);

  const getDiff = useCallback(
    async (filePath: string): Promise<GitDiff | null> => {
      if (diffCache.has(filePath)) {
        return diffCache.get(filePath) || null;
      }

      try {
        const diff = await getGitDiff(filePath);
        setDiffCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(filePath, diff);
          return newCache;
        });
        return diff;
      } catch (err) {
        console.error('Failed to get diff:', err);
        return null;
      }
    },
    [diffCache]
  );

  const stageFileAction = useCallback(
    async (filePath: string) => {
      await stageFile(filePath);
      await refresh();
    },
    [refresh]
  );

  const unstageFileAction = useCallback(
    async (filePath: string) => {
      await unstageFile(filePath);
      await refresh();
    },
    [refresh]
  );

  const stageAllAction = useCallback(async () => {
    await stageAll();
    await refresh();
  }, [refresh]);

  const commitAction = useCallback(
    async (message: string) => {
      await commit(message);
      setDiffCache(new Map());
      await refresh();
    },
    [refresh]
  );

  const checkoutBranchAction = useCallback(
    async (name: string) => {
      await checkoutBranch(name);
      setDiffCache(new Map());
      await refresh();
    },
    [refresh]
  );

  const createBranchAction = useCallback(
    async (name: string) => {
      await createBranch(name);
      await refresh();
    },
    [refresh]
  );

  return {
    status,
    branches,
    currentBranch,
    diffCache,
    loading,
    error,
    refresh,
    getDiff,
    stageFile: stageFileAction,
    unstageFile: unstageFileAction,
    stageAll: stageAllAction,
    commit: commitAction,
    checkoutBranch: checkoutBranchAction,
    createBranch: createBranchAction,
  };
}