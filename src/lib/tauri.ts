import { invoke, Channel } from '@tauri-apps/api/core';

// ── Types ──

export interface ConfigInfo {
  provider: string;
  model: string;
  has_api_key: boolean;
  project_dir: string;
  server_running: boolean;
  server_version: string | null;
}

export interface Session {
  id: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OcPart {
  type: string;
  text?: string;
  content?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status?: string;
  path?: string;
}

export interface OcMessage {
  id: string;
  role: string;
  session_id: string | null;
  tokens?: Record<string, unknown>;
  cost?: number;
}

export interface OcMessageResponse {
  info: OcMessage;
  parts: OcPart[];
}

export interface StreamEvent {
  event: 'token' | 'reasoning' | 'tool_call' | 'tool_result' | 'file_edit' | 'step_start' | 'step_finish' | 'done' | 'error' | 'status' | 'usage';
  data: {
    token?: string;
    text?: string;
    full_text?: string;
    message?: string;
    name?: string;
    input?: string;
    output?: string;
    path?: string;
    status?: string;
    reason?: string;
    tokens?: Record<string, unknown>;
    cost?: number;
  };
}

// ── Config ──

export async function getConfig(): Promise<ConfigInfo> {
  return invoke('get_config');
}

export async function setModel(model: string): Promise<void> {
  return invoke('set_model', { model });
}

// ── Sessions ──

export async function getSessions(): Promise<Session[]> {
  return invoke('get_sessions');
}

export async function createSession(title?: string): Promise<Session> {
  return invoke('create_session', { title });
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  return invoke('delete_session', { sessionId });
}

export async function getMessages(sessionId: string): Promise<OcMessageResponse[]> {
  return invoke('get_messages', { sessionId });
}

// ── Chat ──

export async function sendMessage(
  sessionId: string,
  message: string,
  onEvent: Channel<StreamEvent>,
  agent?: string
): Promise<void> {
  return invoke('send_message', {
    sessionId,
    message,
    onEvent: onEvent,
    agent,
  });
}

// ── Files (proxy to OpenCode server) ──

export async function readFile(path: string): Promise<Record<string, unknown>> {
  return invoke('read_file', { path });
}

export async function listDirectory(path: string): Promise<Record<string, unknown>> {
  return invoke('list_directory', { path });
}

export async function findFiles(query: string): Promise<string[]> {
  return invoke('find_files', { query });
}

export interface ModelInfo {
  id: string;
  name: string;
  limit?: {
    context?: number;
    output?: number;
  };
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
}

export async function getModelInfo(providerId: string, modelId: string): Promise<ModelInfo> {
  return invoke('get_model_info', { providerId, modelId });
}
