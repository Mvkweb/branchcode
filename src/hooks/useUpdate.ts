import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface CommitUpdate {
  id: string;
  fullSha: string;
  branch: string;
  message: string;
  date: string;
  status: string;
  url: string;
}

export interface ReleaseAsset {
  name: string;
  url: string;
}

export interface ReleaseUpdate {
  version: string;
  message: string;
  date: string;
  assets: ReleaseAsset[];
}

export interface UpdateChannels {
  commits: CommitUpdate[];
  prerelease: ReleaseUpdate[];
  stable: ReleaseUpdate[];
}

export interface UpdateResponse {
  channels: UpdateChannels;
}

export type UpdateType = "commit" | "prerelease" | "stable";

export interface UpdateState {
  isLoading: boolean;
  error: string | null;
  data: UpdateResponse | null;
  selectedType: UpdateType;
  lastCheckedAt: number | null;
}

export function useUpdate() {
  const [state, setState] = useState<UpdateState>({
    isLoading: false,
    error: null,
    data: null,
    selectedType: "commit",
    lastCheckedAt: null,
  });

  const checkUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await invoke<UpdateResponse | null>("check_updates");

      setState((prev) => ({
        ...prev,
        isLoading: false,
        data: data ?? null,
        lastCheckedAt: Date.now(),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const setType = useCallback((selectedType: UpdateType) => {
    setState((prev) => ({ ...prev, selectedType }));
  }, []);

  const items = useMemo(() => {
    const d = state.data?.channels;
    if (!d) return [];

    switch (state.selectedType) {
      case "commit":
        return d.commits;
      case "prerelease":
        return d.prerelease;
      case "stable":
        return d.stable;
    }
  }, [state.data, state.selectedType]);

  return {
    ...state,
    checkUpdates,
    setType,
    items,
  };
}