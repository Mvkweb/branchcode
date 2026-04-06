import type { Message } from '../hooks/useChat';

const DB_NAME = 'oc-chat-cache';
const STORE = 'sessions';
const VERSION = 1;
const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_MESSAGES_CACHED = 50;

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'sessionId' });
    };
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

interface CacheEntry {
  sessionId: string;
  messages: Message[];
  timestamp: number;
}

export async function readCache(sessionId: string): Promise<Message[] | null> {
  try {
    const idb = await getDB();
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(sessionId);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (!entry || Date.now() - entry.timestamp > TTL_MS) {
          return resolve(null);
        }
        resolve(entry.messages);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeCache(sessionId: string, messages: Message[]): Promise<void> {
  try {
    const idb = await getDB();
    const trimmed = messages.slice(-MAX_MESSAGES_CACHED);
    const tx = idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ sessionId, messages: trimmed, timestamp: Date.now() });
  } catch {
    // non-fatal
  }
}

export async function invalidateCache(sessionId: string): Promise<void> {
  try {
    const idb = await getDB();
    const tx = idb.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(sessionId);
  } catch {
    // non-fatal
  }
}