import { useState, useCallback, useEffect } from 'react';
import {
  getSessions as tauriGetSessions,
  createSession as tauriCreateSession,
  deleteSession as tauriDeleteSession,
  type Session,
} from '../lib/tauri';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      const result = await tauriGetSessions();
      setSessions(result);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const createSession = useCallback(async (title?: string) => {
    try {
      const session = await tauriCreateSession(title);
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      return session;
    } catch (err) {
      console.error('Failed to create session:', err);
      return null;
    }
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await tauriDeleteSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          setActiveSessionId(null);
        }
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    },
    [activeSessionId]
  );

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  return {
    sessions,
    activeSessionId,
    loading,
    createSession,
    deleteSession,
    selectSession,
    loadSessions,
  };
}
