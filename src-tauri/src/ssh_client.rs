use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use russh::keys::load_secret_key;
use russh::*;
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex as TokioMutex;

// ── Serialized config types ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshServerConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethodConfig,
    pub default_directory: Option<String>,
    pub group: Option<String>,
    pub tags: Option<Vec<String>>,
    pub os: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AuthMethodConfig {
    #[serde(rename = "password")]
    Password { password: String },
    #[serde(rename = "key")]
    KeyFile {
        path: String,
        passphrase: Option<String>,
    },
}

// ── Connection state ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SshConnectionInfo {
    pub config_id: String,
    pub server_name: String,
    pub connected: bool,
    pub os: Option<String>,
}

// ── SFTP file entry ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SftpFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

// ── Tauri event payloads ──────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct SshShellData {
    id: String,
    data: Vec<u8>,
}

#[derive(Serialize, Clone)]
struct SshShellExit {
    id: String,
}

// ── russh client handler ──────────────────────────────────────────────────────

struct ClientHandler;

#[async_trait::async_trait]
impl client::Handler for ClientHandler {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::key::PublicKey,
    ) -> std::result::Result<bool, Self::Error> {
        // Accept all server keys for now (like ssh -o StrictHostKeyChecking=no)
        // TODO: implement known_hosts checking
        Ok(true)
    }
}

// ── Active connection ─────────────────────────────────────────────────────────

struct SshConnection {
    handle: client::Handle<ClientHandler>,
    config_id: String,
    server_name: String,
}

// ── Shell commands sent from the main thread to the reader task ───────────────

enum ShellCmd {
    Write(Vec<u8>),
    Resize(u32, u32),
    Close,
}

// ── Shell handle ──────────────────────────────────────────────────────────────

struct SshShellHandle {
    cmd_tx: tokio::sync::mpsc::UnboundedSender<ShellCmd>,
    conn_id: String,
}

// ── SSH Manager (main state) ──────────────────────────────────────────────────

pub struct SshManager {
    configs: Vec<SshServerConfig>,
    connections: HashMap<String, SshConnection>,
    shells: HashMap<String, SshShellHandle>,
    config_path: PathBuf,
    next_shell_id: usize,
}

impl SshManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let config_path = app_data_dir.join("ssh_servers.json");
        let configs = Self::load_configs(&config_path).unwrap_or_default();

        println!("[SSH] Loaded {} server configs from {:?}", configs.len(), config_path);

        Self {
            configs,
            connections: HashMap::new(),
            shells: HashMap::new(),
            config_path,
            next_shell_id: 1,
        }
    }

    fn load_configs(path: &PathBuf) -> Result<Vec<SshServerConfig>> {
        if !path.exists() {
            return Ok(Vec::new());
        }
        let data = std::fs::read_to_string(path)?;
        let configs: Vec<SshServerConfig> = serde_json::from_str(&data)?;
        Ok(configs)
    }

    fn save_configs(&self) -> Result<()> {
        if let Some(parent) = self.config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let data = serde_json::to_string_pretty(&self.configs)?;
        std::fs::write(&self.config_path, data)?;
        Ok(())
    }

    // ── Config CRUD ───────────────────────────────────────────────────────────

    pub fn list_servers(&self) -> Vec<SshServerConfig> {
        self.configs.clone()
    }

    pub fn add_server(&mut self, mut config: SshServerConfig) -> Result<SshServerConfig> {
        if config.id.is_empty() {
            config.id = uuid::Uuid::new_v4().to_string();
        }
        if config.port == 0 {
            config.port = 22;
        }
        self.configs.push(config.clone());
        self.save_configs()?;
        println!("[SSH] Added server: {} ({})", config.name, config.host);
        Ok(config)
    }

    pub fn update_server(&mut self, config: SshServerConfig) -> Result<()> {
        if let Some(existing) = self.configs.iter_mut().find(|c| c.id == config.id) {
            *existing = config;
            self.save_configs()?;
        }
        Ok(())
    }

    pub fn remove_server(&mut self, id: &str) -> Result<()> {
        self.configs.retain(|c| c.id != id);
        self.save_configs()?;
        Ok(())
    }

    pub fn get_config(&self, id: &str) -> Option<&SshServerConfig> {
        self.configs.iter().find(|c| c.id == id)
    }

    // ── Connection management ─────────────────────────────────────────────────

    pub async fn connect(&mut self, config_id: &str) -> Result<SshConnectionInfo> {
        let config = self
            .configs
            .iter()
            .find(|c| c.id == config_id)
            .cloned()
            .ok_or_else(|| anyhow!("Server config not found: {}", config_id))?;

        println!("[SSH] Connecting to {}@{}:{}", config.username, config.host, config.port);

        let russh_config = client::Config {
            ..Default::default()
        };

        let handler = ClientHandler;
        let mut handle = client::connect(
            Arc::new(russh_config),
            (config.host.as_str(), config.port),
            handler,
        )
        .await
        .context(format!("Failed to connect to {}:{}", config.host, config.port))?;

        // Authenticate
        let authenticated = match &config.auth_method {
            AuthMethodConfig::Password { password } => {
                handle
                    .authenticate_password(&config.username, password)
                    .await
                    .context("Password authentication failed")?
            }
            AuthMethodConfig::KeyFile { path, passphrase } => {
                let key_path = shellexpand_path(path);
                let secret_key = load_secret_key(&key_path, passphrase.as_deref())
                    .context(format!("Failed to load SSH key from {:?}", key_path))?;
                handle
                    .authenticate_publickey(&config.username, Arc::new(secret_key))
                    .await
                    .context("Key authentication failed")?
            }
        };

        if !authenticated {
            return Err(anyhow!("Authentication failed for {}@{}", config.username, config.host));
        }

        println!("[SSH] Connected and authenticated to {}", config.name);

        let conn = SshConnection {
            handle,
            config_id: config.id.clone(),
            server_name: config.name.clone(),
        };

        let info = SshConnectionInfo {
            config_id: config.id.clone(),
            server_name: config.name.clone(),
            connected: true,
            os: config.os.clone(),
        };

        self.connections.insert(config.id, conn);
        Ok(info)
    }

    pub async fn disconnect(&mut self, config_id: &str) -> Result<()> {
        // Send Close to any shells on this connection
        let shell_ids: Vec<String> = self.shells.iter()
            .filter(|(_, s)| s.conn_id == config_id)
            .map(|(id, _)| id.clone())
            .collect();
        for id in &shell_ids {
            if let Some(shell) = self.shells.get(id) {
                let _ = shell.cmd_tx.send(ShellCmd::Close);
            }
        }

        if let Some(conn) = self.connections.remove(config_id) {
            println!("[SSH] Disconnecting from {}", conn.server_name);
            conn.handle
                .disconnect(Disconnect::ByApplication, "User disconnected", "en")
                .await
                .ok();
        }
        // Remove associated shells
        self.shells.retain(|_, shell| shell.conn_id != config_id);
        Ok(())
    }

    pub fn get_connections(&self) -> Vec<SshConnectionInfo> {
        self.connections
            .values()
            .map(|c| {
                let os = self.configs.iter()
                    .find(|cfg| cfg.id == c.config_id)
                    .and_then(|cfg| cfg.os.clone());
                SshConnectionInfo {
                    config_id: c.config_id.clone(),
                    server_name: c.server_name.clone(),
                    connected: true,
                    os,
                }
            })
            .collect()
    }

    pub fn is_connected(&self, config_id: &str) -> bool {
        self.connections.contains_key(config_id)
    }

    // ── SFTP Operations ───────────────────────────────────────────────────────

    pub async fn sftp_list_dir(&mut self, config_id: &str, path: &str) -> Result<Vec<SftpFileEntry>> {
        let conn = self
            .connections
            .get_mut(config_id)
            .ok_or_else(|| anyhow!("Not connected: {}", config_id))?;

        let channel = conn.handle.channel_open_session().await?;
        channel.request_subsystem(true, "sftp").await?;
        let sftp = SftpSession::new(channel.into_stream()).await?;

        let entries = sftp.read_dir(path).await?;
        let mut result = Vec::new();

        for entry in entries {
            let name = entry.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let file_path = if path.ends_with('/') {
                format!("{}{}", path, name)
            } else {
                format!("{}/{}", path, name)
            };
            result.push(SftpFileEntry {
                name,
                path: file_path,
                is_dir: entry.file_type().is_dir(),
                size: entry.metadata().size.unwrap_or(0),
            });
        }

        // Sort: dirs first, then alphabetical
        result.sort_by(|a, b| {
            b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name))
        });

        Ok(result)
    }

    pub async fn sftp_read_file(&mut self, config_id: &str, path: &str) -> Result<String> {
        let conn = self
            .connections
            .get_mut(config_id)
            .ok_or_else(|| anyhow!("Not connected: {}", config_id))?;

        let channel = conn.handle.channel_open_session().await?;
        channel.request_subsystem(true, "sftp").await?;
        let sftp = SftpSession::new(channel.into_stream()).await?;

        let mut file = sftp.open(path).await?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).await?;

        Ok(contents)
    }

    pub async fn sftp_write_file(&mut self, config_id: &str, path: &str, content: &str) -> Result<()> {
        let conn = self
            .connections
            .get_mut(config_id)
            .ok_or_else(|| anyhow!("Not connected: {}", config_id))?;

        let channel = conn.handle.channel_open_session().await?;
        channel.request_subsystem(true, "sftp").await?;
        let sftp = SftpSession::new(channel.into_stream()).await?;

        let mut file = sftp.create(path).await?;
        file.write_all(content.as_bytes()).await?;
        file.flush().await?;

        Ok(())
    }

    // ── Shell (PTY) ───────────────────────────────────────────────────────────

    pub async fn spawn_shell(
        &mut self,
        config_id: &str,
        app: AppHandle,
    ) -> Result<String> {
        let conn = self
            .connections
            .get_mut(config_id)
            .ok_or_else(|| anyhow!("Not connected: {}", config_id))?;

        let channel = conn.handle.channel_open_session().await?;

        // Request a PTY
        channel
            .request_pty(
                true,
                "xterm-256color",
                80,
                24,
                0,
                0,
                &[],
            )
            .await?;

        // Start shell
        channel.request_shell(true).await?;

        let shell_id = format!("ssh-shell-{}", self.next_shell_id);
        self.next_shell_id += 1;

        // Create the command channel for write/resize/close
        let (cmd_tx, mut cmd_rx) = tokio::sync::mpsc::unbounded_channel::<ShellCmd>();

        let shell_handle = SshShellHandle {
            cmd_tx,
            conn_id: config_id.to_string(),
        };
        self.shells.insert(shell_id.clone(), shell_handle);

        // Spawn the shell task — owns the Channel exclusively
        let read_id = shell_id.clone();
        tokio::spawn(async move {
            let mut channel = channel;
            loop {
                tokio::select! {
                    // Incoming data from remote
                    msg = channel.wait() => {
                        match msg {
                            Some(ChannelMsg::Data { ref data }) => {
                                let _ = app.emit(
                                    "ssh:data",
                                    SshShellData {
                                        id: read_id.clone(),
                                        data: data.to_vec(),
                                    },
                                );
                            }
                            Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                                let _ = app.emit(
                                    "ssh:data",
                                    SshShellData {
                                        id: read_id.clone(),
                                        data: data.to_vec(),
                                    },
                                );
                            }
                            Some(ChannelMsg::Eof) | None => break,
                            _ => {}
                        }
                    }
                    // Commands from the main thread (write, resize, close)
                    cmd = cmd_rx.recv() => {
                        match cmd {
                            Some(ShellCmd::Write(data)) => {
                                let _ = channel.data(&data[..]).await;
                            }
                            Some(ShellCmd::Resize(cols, rows)) => {
                                let _ = channel.window_change(cols, rows, 0, 0).await;
                            }
                            Some(ShellCmd::Close) | None => {
                                let _ = channel.eof().await;
                                break;
                            }
                        }
                    }
                }
            }
            let _ = app.emit("ssh:exit", SshShellExit { id: read_id });
        });

        Ok(shell_id)
    }

    pub fn write_shell(&self, shell_id: &str, data: &[u8]) -> Result<()> {
        let shell = self
            .shells
            .get(shell_id)
            .ok_or_else(|| anyhow!("Shell not found: {}", shell_id))?;

        shell.cmd_tx.send(ShellCmd::Write(data.to_vec()))
            .map_err(|_| anyhow!("Shell task has exited"))?;
        Ok(())
    }

    pub fn resize_shell(&self, shell_id: &str, cols: u32, rows: u32) -> Result<()> {
        let shell = self
            .shells
            .get(shell_id)
            .ok_or_else(|| anyhow!("Shell not found: {}", shell_id))?;

        shell.cmd_tx.send(ShellCmd::Resize(cols, rows))
            .map_err(|_| anyhow!("Shell task has exited"))?;
        Ok(())
    }

    pub fn close_shell(&mut self, shell_id: &str) {
        if let Some(shell) = self.shells.remove(shell_id) {
            let _ = shell.cmd_tx.send(ShellCmd::Close);
        }
    }

    // ── Remote Commands ───────────────────────────────────────────────────────

    pub async fn exec_command(&mut self, config_id: &str, cmd: &str) -> Result<String> {
        let conn = self
            .connections
            .get_mut(config_id)
            .ok_or_else(|| anyhow!("Not connected: {}", config_id))?;

        let channel = conn.handle.channel_open_session().await?;
        channel.exec(true, cmd).await?;

        let mut output = Vec::new();
        let mut stream = channel.into_stream();
        let mut buf = [0u8; 4096];

        loop {
            match stream.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => output.extend_from_slice(&buf[..n]),
                Err(_) => break,
            }
        }

        Ok(String::from_utf8_lossy(&output).to_string())
    }

    // ── Remote Context (no file downloads) ─────────────────────────────────────

    /// Gather context about a remote directory via SSH for the AI.
    /// Returns a string with the file tree and contents of key config/source files.
    /// Nothing is downloaded to disk — everything stays in memory as prompt context.
    pub async fn gather_remote_context(
        &mut self,
        config_id: &str,
        remote_path: &str,
    ) -> Result<String> {
        let mut context = String::new();
        context.push_str(&format!("## Remote project: {}\n\n", remote_path));

        // Get file tree via `find` with RELATIVE paths (so the AI uses relative paths for file ops)
        let tree_cmd = format!(
            "cd '{}' && find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' \
             -not -path '*/target/*' -not -path '*/__pycache__/*' \
             -not -path '*/dist/*' -not -path '*/.next/*' \
             -not -path '*/.cache/*' -not -path '*/vendor/*' \
             -not -path '*/logs/*' -not -path '*/crash-reports/*' \
             -not -path '*/libraries/*' -not -path '*/versions/*' \
             -not -path '*/mods/*' -not -path '*/world/*' \
             -not -path '*/saves/*' -not -path '*/structures/*' \
             2>/dev/null | head -500",
            remote_path
        );

        match self.exec_command(config_id, &tree_cmd).await {
            Ok(tree) => {
                let tree = tree.trim();
                if !tree.is_empty() {
                    context.push_str("### File tree\n```\n");
                    context.push_str(tree);
                    context.push_str("\n```\n\n");
                }
            }
            Err(e) => {
                eprintln!("[SSH Context] Failed to get file tree: {}", e);
            }
        }

        // Auto-read key project files if they exist (small text configs only)
        let key_files = [
            "README.md", "readme.md", "README.txt",
            "package.json", "Cargo.toml", "go.mod", "pom.xml",
            "requirements.txt", "pyproject.toml", "setup.py",
            "docker-compose.yml", "docker-compose.yaml", "Dockerfile",
            ".env.example", "Makefile",
            "server.properties", // Minecraft
        ];

        let mut files_read = 0;
        for filename in &key_files {
            if files_read >= 5 {
                break; // Don't overload the context
            }
            let file_path = format!("{}/{}", remote_path.trim_end_matches('/'), filename);
            // Check if file exists and read it (only if <50KB)
            let read_cmd = format!(
                "test -f '{}' && wc -c < '{}' | tr -d ' '",
                file_path, file_path
            );
            match self.exec_command(config_id, &read_cmd).await {
                Ok(size_str) => {
                    let size_str = size_str.trim();
                    if size_str.is_empty() {
                        continue; // File doesn't exist
                    }
                    let size: u64 = size_str.parse().unwrap_or(0);
                    if size == 0 || size > 50_000 {
                        continue; // Skip empty or large files
                    }
                    match self.exec_command(config_id, &format!("cat '{}'", file_path)).await {
                        Ok(content) => {
                            let content = content.trim();
                            if !content.is_empty() {
                                context.push_str(&format!("### {}\n```\n", filename));
                                // Truncate very long files in context
                                if content.len() > 3000 {
                                    context.push_str(&content[..3000]);
                                    context.push_str("\n... (truncated)");
                                } else {
                                    context.push_str(content);
                                }
                                context.push_str("\n```\n\n");
                                files_read += 1;
                                println!("[SSH Context] Read {} ({} bytes)", filename, content.len());
                            }
                        }
                        Err(_) => {}
                    }
                }
                Err(_) => {}
            }
        }

        Ok(context)
    }
}
// ── Helpers ───────────────────────────────────────────────────────────────────

fn shellexpand_path(path: &str) -> PathBuf {
    let expanded = if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            path.replacen('~', &home.to_string_lossy(), 1)
        } else {
            path.to_string()
        }
    } else {
        path.to_string()
    };
    PathBuf::from(expanded)
}

// ── Tauri State ───────────────────────────────────────────────────────────────

pub type SshState = Arc<TokioMutex<SshManager>>;

// ── Tauri Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ssh_list_servers(state: State<'_, SshState>) -> Result<Vec<SshServerConfig>, String> {
    let mgr = state.lock().await;
    Ok(mgr.list_servers())
}

#[tauri::command]
pub async fn ssh_save_server(
    config: SshServerConfig,
    state: State<'_, SshState>,
) -> Result<SshServerConfig, String> {
    let mut mgr = state.lock().await;
    mgr.add_server(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_update_server(
    config: SshServerConfig,
    state: State<'_, SshState>,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.update_server(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_delete_server(id: String, state: State<'_, SshState>) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.remove_server(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_connect(
    config_id: String,
    state: State<'_, SshState>,
) -> Result<SshConnectionInfo, String> {
    let mut mgr = state.lock().await;
    mgr.connect(&config_id).await.map_err(|e| {
        let err_msg = format!("{:#}", e);
        eprintln!("[SSH ERROR] Connection failed: {}", err_msg);
        err_msg
    })
}

#[tauri::command]
pub async fn ssh_disconnect(config_id: String, state: State<'_, SshState>) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.disconnect(&config_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_get_connections(
    state: State<'_, SshState>,
) -> Result<Vec<SshConnectionInfo>, String> {
    let mgr = state.lock().await;
    Ok(mgr.get_connections())
}

#[tauri::command]
pub async fn ssh_list_dir(
    config_id: String,
    path: String,
    state: State<'_, SshState>,
) -> Result<Vec<SftpFileEntry>, String> {
    let mut mgr = state.lock().await;
    mgr.sftp_list_dir(&config_id, &path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_read_file(
    config_id: String,
    path: String,
    state: State<'_, SshState>,
) -> Result<String, String> {
    let mut mgr = state.lock().await;
    mgr.sftp_read_file(&config_id, &path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_write_file(
    config_id: String,
    path: String,
    content: String,
    state: State<'_, SshState>,
) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.sftp_write_file(&config_id, &path, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_spawn_shell(
    config_id: String,
    state: State<'_, SshState>,
    app: AppHandle,
) -> Result<String, String> {
    let mut mgr = state.lock().await;
    mgr.spawn_shell(&config_id, app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_write_shell(
    shell_id: String,
    data: String,
    state: State<'_, SshState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.write_shell(&shell_id, data.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_close_shell(shell_id: String, state: State<'_, SshState>) -> Result<(), String> {
    let mut mgr = state.lock().await;
    mgr.close_shell(&shell_id);
    Ok(())
}

#[tauri::command]
pub async fn ssh_resize_shell(
    shell_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshState>,
) -> Result<(), String> {
    let mgr = state.lock().await;
    mgr.resize_shell(&shell_id, cols, rows)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_exec_command(
    config_id: String,
    command: String,
    state: State<'_, SshState>,
) -> Result<String, String> {
    let mut mgr = state.lock().await;
    mgr.exec_command(&config_id, &command)
        .await
        .map_err(|e| e.to_string())
}

