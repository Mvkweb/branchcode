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

export async function listLocalDirectory(path: string): Promise<Record<string, unknown>> {
  return invoke('list_local_directory', { path });
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

export interface ProviderInfo {
  id: string;
  name: string;
  models?: Record<string, ModelInfo>;
}

export async function getModelInfo(providerId: string, modelId: string): Promise<ModelInfo> {
  return invoke('get_model_info', { providerId, modelId });
}

export async function getProviders(): Promise<{ all: ProviderInfo[]; default: Record<string, string> }> {
  return invoke('get_providers');
}

export async function getAvailableModels(): Promise<string[]> {
  return invoke('get_available_models');
}

// ── Git Types ──

export interface GitStatus {
  branch: string;
  staged: GitFile[];
  modified: GitFile[];
  untracked: GitFile[];
  is_repo: boolean;
}

export interface GitFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
}

export interface GitDiff {
  path: string;
  old_content: string | null;
  new_content: string | null;
  diff: string;
  additions: number;
  deletions: number;
}

export interface GitBranch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

// ── Git Commands ──

export async function getGitStatus(): Promise<GitStatus> {
  return invoke('get_git_status');
}

export async function getGitDiff(filePath: string): Promise<GitDiff> {
  return invoke('get_git_diff', { filePath });
}

export async function getCurrentBranch(): Promise<string> {
  return invoke('get_current_branch');
}

export async function getBranches(): Promise<GitBranch[]> {
  return invoke('get_branches');
}

export async function checkoutBranch(branchName: string): Promise<void> {
  return invoke('checkout_branch', { branchName });
}

export async function createBranch(branchName: string): Promise<void> {
  return invoke('create_branch', { branchName });
}

export async function stageFile(filePath: string): Promise<void> {
  return invoke('stage_file', { filePath });
}

export async function unstageFile(filePath: string): Promise<void> {
  return invoke('unstage_file', { filePath });
}

export async function stageAll(): Promise<void> {
  return invoke('stage_all');
}

export async function commit(message: string): Promise<void> {
  return invoke('commit', { message });
}

export async function getGitDiffStats(): Promise<GitFile[]> {
  return invoke('get_git_diff_stats');
}

// ── Terminal Commands ──

export async function spawnTerminal(): Promise<string> {
  return invoke('spawn_terminal');
}

export async function writeTerminal(id: string, data: string): Promise<void> {
  return invoke('write_terminal', { id, data });
}

export async function readTerminal(id: string): Promise<string | null> {
  return invoke('read_terminal', { id });
}

export async function resizeTerminal(id: string, cols: number, rows: number): Promise<void> {
  return invoke('resize_terminal', { id, cols, rows });
}

export async function closeTerminal(id: string): Promise<void> {
  return invoke('close_terminal', { id });
}

// ── SSH Types ──

export interface SshServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: SshAuthMethod;
  default_directory?: string;
  group?: string;
  tags?: string[];
  os?: string;
}

export type SshAuthMethod =
  | { type: 'password'; password: string }
  | { type: 'key'; path: string; passphrase?: string };

export interface SshConnectionInfo {
  config_id: string;
  server_name: string;
  connected: boolean;
  remote_opencode_ready: boolean;
  os?: string;
}

export interface SftpFileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

// ── SSH Commands ──

export async function sshListServers(): Promise<SshServerConfig[]> {
  return invoke('ssh_list_servers');
}

export async function sshSaveServer(config: SshServerConfig): Promise<SshServerConfig> {
  return invoke('ssh_save_server', { config });
}

export async function sshUpdateServer(config: SshServerConfig): Promise<void> {
  return invoke('ssh_update_server', { config });
}

export async function sshDeleteServer(id: string): Promise<void> {
  return invoke('ssh_delete_server', { id });
}

export async function sshConnect(configId: string): Promise<SshConnectionInfo> {
  return invoke('ssh_connect', { configId });
}

export async function sshDisconnect(configId: string): Promise<void> {
  return invoke('ssh_disconnect', { configId });
}

export async function sshGetConnections(): Promise<SshConnectionInfo[]> {
  return invoke('ssh_get_connections');
}

export async function sshListDir(configId: string, path: string): Promise<SftpFileEntry[]> {
  return invoke('ssh_list_dir', { configId, path });
}

export async function sshReadFile(configId: string, path: string): Promise<string> {
  return invoke('ssh_read_file', { configId, path });
}

export async function sshWriteFile(configId: string, path: string, content: string): Promise<void> {
  return invoke('ssh_write_file', { configId, path, content });
}

export async function sshSpawnShell(configId: string): Promise<string> {
  return invoke('ssh_spawn_shell', { configId });
}

export async function sshWriteShell(shellId: string, data: string): Promise<void> {
  return invoke('ssh_write_shell', { shellId, data });
}

export async function sshCloseShell(shellId: string): Promise<void> {
  return invoke('ssh_close_shell', { shellId });
}

export async function sshExecCommand(configId: string, command: string): Promise<string> {
  return invoke('ssh_exec_command', { configId, command });
}

export async function sshStartRemoteOpencode(configId: string): Promise<number> {
  return invoke('ssh_start_remote_opencode', { configId });
}
