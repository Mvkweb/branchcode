mod opencode_client;
mod server;
mod git;
mod pty;
mod updater;
mod ssh_client;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as TokioMutex;
use opencode_client::OcStreamEvent;
use pty::PtyState;
use serde::Serialize;
use ssh_client::SshState;
use tauri::{State, ipc::Channel};

struct AppState {
    client: Arc<opencode_client::OpenCodeClient>,
    project_dir: Mutex<String>,
    model: Mutex<String>,
    git: Mutex<Option<git::GitService>>,
    pty: PtyState,
    ssh_manager: SshState,
    server: TokioMutex<Option<server::OpenCodeServer>>,
    server_port: u16,
    /// The OpenCode server doesn't persist workdir per session, so we track it ourselves.
    session_workdirs: Mutex<HashMap<String, String>>,
}

// ── Config commands ──

#[derive(Serialize)]
struct ConfigInfo {
    provider: String,
    model: String,
    has_api_key: bool,
    project_dir: String,
    server_running: bool,
    server_version: Option<String>,
}

#[tauri::command]
fn get_config(state: State<AppState>) -> ConfigInfo {
    let model = state.model.lock().unwrap().clone();
    let project_dir = state.project_dir.lock().unwrap().clone();
    let (provider, _) = if model.contains('/') {
        let pos = model.find('/').unwrap();
        (model[..pos].to_string(), model[pos + 1..].to_string())
    } else {
        ("opencode".to_string(), model.clone())
    };

    ConfigInfo {
        provider,
        model,
        has_api_key: true,
        project_dir,
        server_running: true,
        server_version: None,
    }
}

#[tauri::command]
fn set_model(model: String, state: State<AppState>) -> Result<(), String> {
    let mut m = state.model.lock().unwrap();
    *m = model;
    println!("Model set to: {}", m);
    Ok(())
}

// ── Session commands ──

#[tauri::command]
async fn get_sessions(state: State<'_, AppState>) -> Result<Vec<opencode_client::OcSession>, String> {
    state.client.list_sessions().await
}

#[tauri::command]
async fn create_session(
    title: Option<String>,
    workdir: Option<String>,
    ssh_config_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<opencode_client::OcSession, String> {
    let session = state.client.create_session(title, workdir.clone(), ssh_config_id).await?;

    // Store the workdir ourselves — the OpenCode server doesn't persist it
    if let Some(ref wd) = workdir {
        if !wd.is_empty() {
            println!("[Session] Storing workdir for {}: {}", session.id, wd);
            state.session_workdirs.lock().unwrap().insert(session.id.clone(), wd.clone());
        }
    }

    Ok(session)
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

#[tauri::command]
async fn delete_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.client.delete_session(&session_id).await
}

#[tauri::command]
async fn get_messages(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<opencode_client::OcMessageResponse>, String> {
    state.client.get_messages(&session_id).await
}

// ── Chat command ──

#[tauri::command]
async fn send_message(
    session_id: String,
    message: String,
    on_event: Channel<OcStreamEvent>,
    agent: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let model = state.model.lock().unwrap().clone();

    if model.is_empty() {
        return Err("No model selected. Pick a model first.".to_string());
    }

    let agent_str = agent.as_deref();

    let session = state.client.get_session(&session_id).await?;
    // The OpenCode server doesn't persist workdir, so fall back to our local map
    let workdir = session.workdir.clone().or_else(|| {
        state.session_workdirs.lock().unwrap().get(&session_id).cloned()
    });
    let ssh_config_id = session.ssh_config_id.clone();

    // ── Restart server if the session targets a different directory ──
    if let Some(ref wd) = workdir {
        if !wd.is_empty() {
            let current_dir = state.project_dir.lock().unwrap().clone();
            if wd != &current_dir {
                println!("[Server] Session workdir differs: {} -> {}", current_dir, wd);
                let port = state.server_port;

                let mut srv_guard = state.server.lock().await;

                // Stop the old server (kills owned process + anything on the port)
                if let Some(ref mut srv) = *srv_guard {
                    srv.stop();
                }
                *srv_guard = None;

                // Force-start a new server — kills any remaining port occupants
                match server::OpenCodeServer::force_start(port, wd).await {
                    Ok(new_server) => {
                        println!("[Server] Restarted in: {}", wd);
                        *srv_guard = Some(new_server);
                        *state.project_dir.lock().unwrap() = wd.clone();

                        // Re-initialize git for the new directory
                        let git_svc = git::GitService::new(wd.clone());
                        if git_svc.is_git_repo() {
                            println!("Git repository detected at {}", wd);
                        }
                        *state.git.lock().unwrap() = Some(git_svc);
                    }
                    Err(e) => {
                        eprintln!("[Server] Failed to restart in {}: {}", wd, e);
                        let _ = on_event.send(OcStreamEvent::Error {
                            message: format!("Failed to start server in {}: {}", wd, e),
                        });
                        return Err(format!("Failed to start server in {}: {}", wd, e));
                    }
                }
            }
        }
    }

    if let Some(ref config_id) = ssh_config_id {
        let ssh_state = state.ssh_manager.clone();
        let config_id_owned = config_id.clone();
        let connect_result = ssh_state.lock().await.connect(&config_id_owned).await;
        if let Err(e) = connect_result {
            let _ = on_event.send(OcStreamEvent::Error {
                message: format!("SSH connect failed: {}", e),
            });
        }
    }

    let workdir_ref: Option<&str> = workdir.as_deref();
    let ssh_ref: Option<&str> = ssh_config_id.as_deref();
    
    state
        .client
        .send_message(&session_id, &message, &model, agent_str, workdir_ref, ssh_ref, &on_event)
        .await?;

    Ok(())
}

// ── File commands (proxy to OpenCode server) ──

#[tauri::command]
async fn read_file(path: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state.client.read_file(&path).await
}

#[tauri::command]
async fn list_directory(
    path: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    state.client.list_files(Some(&path)).await
}

#[tauri::command]
async fn list_local_directory(path: String) -> Result<serde_json::Value, String> {
    use std::fs;
    use std::path::Path;

    let dir_path = if path == "." || path.is_empty() {
        std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
    } else {
        let p = Path::new(&path);
        if p.is_relative() {
            std::env::current_dir()
                .map_err(|e| format!("Failed to get current directory: {}", e))?
                .join(p)
        } else {
            p.to_path_buf()
        }
    };

    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", dir_path.display()));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", dir_path.display()));
    }

    fn strip_extended_prefix(path: &std::path::Path) -> String {
        let s = path.to_string_lossy();
        if s.starts_with("\\\\?\\") {
            s[4..].to_string()
        } else {
            s.to_string()
        }
    }

    let entries: Vec<serde_json::Value> = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|entry| {
            entry.ok().map(|e| {
                let file_path = e.path();
                let name = e.file_name().to_string_lossy().to_string();
                let is_dir = file_path.is_dir();
                serde_json::json!({
                    "name": name,
                    "path": strip_extended_prefix(&file_path),
                    "is_dir": is_dir,
                    "type": if is_dir { "directory" } else { "file" }
                })
            })
        })
        .collect();

    Ok(serde_json::json!({ "children": entries }))
}

#[tauri::command]
async fn find_files(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    state.client.find_files(&query).await
}

#[tauri::command]
async fn get_model_info(
    provider_id: String,
    model_id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    state.client.get_model_info(&provider_id, &model_id).await
}

#[tauri::command]
async fn get_providers(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state.client.get_providers().await
}

#[tauri::command]
async fn get_available_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.client.get_available_free_models().await
}

// ── Git commands ──

#[tauri::command]
fn get_git_status(state: State<AppState>) -> Result<git::GitStatus, String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.get_status()
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn get_git_diff(file_path: String, state: State<AppState>) -> Result<git::GitDiff, String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.get_diff(&file_path)
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn get_current_branch(state: State<AppState>) -> Result<String, String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.get_current_branch()
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn get_branches(state: State<AppState>) -> Result<Vec<git::GitBranch>, String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.get_branches()
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn checkout_branch(branch_name: String, state: State<AppState>) -> Result<(), String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.checkout_branch(&branch_name)
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn create_branch(branch_name: String, state: State<AppState>) -> Result<(), String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.create_branch(&branch_name)
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn stage_file(file_path: String, state: State<AppState>) -> Result<(), String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.stage_file(&file_path)
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn unstage_file(file_path: String, state: State<AppState>) -> Result<(), String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.unstage_file(&file_path)
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn stage_all(state: State<AppState>) -> Result<(), String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.stage_all()
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn commit(message: String, state: State<AppState>) -> Result<(), String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.commit(&message)
    } else {
        Err("Git not initialized".to_string())
    }
}

#[tauri::command]
fn get_git_diff_stats(state: State<AppState>) -> Result<Vec<git::GitFile>, String> {
    let git_guard = state.git.lock().unwrap();
    if let Some(git_svc) = git_guard.as_ref() {
        git_svc.get_diff_stats()
    } else {
        Err("Git not initialized".to_string())
    }
}

// ── App setup ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Use the current working directory as the default project dir.
    // Per-session workdirs are passed via the OpenCode API request body,
    // so this only serves as the fallback when no session workdir is set.
    let project_dir = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string());

    println!("Project directory: {}", project_dir);

    let port = 4096;

    // Start opencode serve
    let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
    let _server = rt.block_on(server::OpenCodeServer::start(port, &project_dir));

    match &_server {
        Ok(s) => println!("OpenCode server running on port {}", s.port()),
        Err(e) => eprintln!("Failed to start OpenCode server: {}", e),
    }

    let client = Arc::new(opencode_client::OpenCodeClient::new(format!("http://127.0.0.1:{}", port)));

    // Initialize git service
    let git_service = git::GitService::new(project_dir.clone());
    let git_initialized = git_service.is_git_repo();
    
    if git_initialized {
        println!("Git repository detected at {}", project_dir);
    } else {
        println!("Not a git repository: {}", project_dir);
    }

    // Initialize SSH manager
    let ssh_data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("branchcode");
    let ssh_state: SshState = Arc::new(tokio::sync::Mutex::new(
        ssh_client::SshManager::new(ssh_data_dir),
    ));

    let state = AppState {
        client,
        project_dir: Mutex::new(project_dir),
        model: Mutex::new(String::new()),
        git: Mutex::new(Some(git_service)),
        pty: Arc::new(Mutex::new(pty::PtyManager::new())),
        ssh_manager: ssh_state.clone(),
        server: TokioMutex::new(_server.ok()),
        server_port: port,
        session_workdirs: Mutex::new(HashMap::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(state.pty.clone())
        .manage(ssh_state)
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_config,
            set_model,
            get_sessions,
            create_session,
            delete_session,
            get_messages,
            send_message,
            read_file,
            list_directory,
            list_local_directory,
            find_files,
            get_model_info,
            get_providers,
            get_available_models,
            get_git_status,
            get_git_diff,
            get_current_branch,
            get_branches,
            checkout_branch,
            create_branch,
            stage_file,
            unstage_file,
            stage_all,
            commit,
            get_git_diff_stats,
            pty::spawn_terminal,
            pty::write_terminal,
            pty::read_terminal,
            pty::resize_terminal,
            pty::close_terminal,
            pty::is_terminal_alive,
            updater::check_updates,
            updater::download_and_install,
            updater::get_release_url,
            ssh_client::ssh_list_servers,
            ssh_client::ssh_save_server,
            ssh_client::ssh_update_server,
            ssh_client::ssh_delete_server,
            ssh_client::ssh_connect,
            ssh_client::ssh_disconnect,
            ssh_client::ssh_get_connections,
            ssh_client::ssh_list_dir,
            ssh_client::ssh_read_file,
            ssh_client::ssh_write_file,
            ssh_client::ssh_resize_shell,
            ssh_client::ssh_spawn_shell,
            ssh_client::ssh_write_shell,
            ssh_client::ssh_close_shell,
            ssh_client::ssh_exec_command,
            ssh_client::ssh_start_remote_opencode,
            get_home_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}