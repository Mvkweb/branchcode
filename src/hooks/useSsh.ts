import { useState, useCallback, useEffect, useRef } from 'react';
import {
  sshListServers,
  sshSaveServer,
  sshUpdateServer,
  sshDeleteServer,
  sshConnect,
  sshDisconnect,
  sshGetConnections,
  type SshServerConfig,
  type SshConnectionInfo,
} from '../lib/tauri';

export interface SshState {
  servers: SshServerConfig[];
  connections: SshConnectionInfo[];
  activeConnectionId: string | null;
  loading: boolean;
  connecting: string | null; // config_id currently connecting
  error: string | null;
}

export function useSsh() {
  const [state, setState] = useState<SshState>({
    servers: [],
    connections: [],
    activeConnectionId: null,
    loading: false,
    connecting: null,
    error: null,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load servers from disk ──

  const loadServers = useCallback(async () => {
    try {
      const servers = await sshListServers();
      if (mountedRef.current) {
        setState(prev => ({ ...prev, servers }));
      }
    } catch (err) {
      console.error('[SSH] Failed to load servers:', err);
    }
  }, []);

  // ── Load active connections ──

  const refreshConnections = useCallback(async () => {
    try {
      const connections = await sshGetConnections();
      if (mountedRef.current) {
        setState(prev => ({ ...prev, connections }));
      }
    } catch (err) {
      console.error('[SSH] Failed to refresh connections:', err);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    loadServers();
    refreshConnections();
  }, [loadServers, refreshConnections]);

  // ── Save a new or updated server ──

  const saveServer = useCallback(async (config: SshServerConfig) => {
    setState(prev => ({ ...prev, error: null }));
    try {
      const existing = state.servers.find(s => s.id === config.id);
      if (existing) {
        await sshUpdateServer(config);
      } else {
        await sshSaveServer(config);
      }
      await loadServers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, error: msg }));
      throw err;
    }
  }, [state.servers, loadServers]);

  // ── Delete a server ──

  const deleteServer = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, error: null }));
    try {
      await sshDeleteServer(id);
      await loadServers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, error: msg }));
    }
  }, [loadServers]);

  // ── Connect to a server ──

  const connect = useCallback(async (configId: string) => {
    setState(prev => ({ ...prev, connecting: configId, error: null }));
    try {
      const info = await sshConnect(configId);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          connecting: null,
          activeConnectionId: configId,
          connections: [
            ...prev.connections.filter(c => c.config_id !== configId),
            info,
          ],
        }));
      }
      return info;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, connecting: null, error: msg }));
      }
      throw err;
    }
  }, []);

  // ── Disconnect from a server ──

  const disconnect = useCallback(async (configId: string) => {
    setState(prev => ({ ...prev, error: null }));
    try {
      await sshDisconnect(configId);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          connections: prev.connections.filter(c => c.config_id !== configId),
          activeConnectionId:
            prev.activeConnectionId === configId ? null : prev.activeConnectionId,
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({ ...prev, error: msg }));
    }
  }, []);

  // ── Set active connection ──

  const setActiveConnection = useCallback((configId: string | null) => {
    setState(prev => ({ ...prev, activeConnectionId: configId }));
  }, []);

  // ── Clear error ──

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // ── Derived state ──

  const activeConnection = state.connections.find(
    c => c.config_id === state.activeConnectionId
  ) ?? null;

  const isConnected = (configId: string) =>
    state.connections.some(c => c.config_id === configId);

  return {
    servers: state.servers,
    connections: state.connections,
    activeConnection,
    activeConnectionId: state.activeConnectionId,
    connecting: state.connecting,
    loading: state.loading,
    error: state.error,
    loadServers,
    saveServer,
    deleteServer,
    connect,
    disconnect,
    setActiveConnection,
    clearError,
    isConnected,
    refreshConnections,
  };
}
