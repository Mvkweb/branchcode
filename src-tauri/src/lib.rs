mod opencode_client;
mod server;
mod git;

use opencode_client::OcStreamEvent;
use serde::Serialize;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

struct AppState {
    client: Arc<opencode_client::OpenCodeClient>,
    project_dir: String,
    model: std::sync::Mutex<String>,
    git: std::sync::Mutex<Option<git::GitService>>,
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
        project_dir: state.project_dir.clone(),
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
    state: State<'_, AppState>,
) -> Result<opencode_client::OcSession, String> {
    state.client.create_session(title).await
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

    state
        .client
        .send_message(&session_id, &message, &model, agent_str, &on_event)
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
    // Try E:\dev\branchcode-test first, fallback to current directory
    let project_dir = if std::path::Path::new("E:\\dev\\branchcode-test").exists() {
        "E:\\dev\\branchcode-test".to_string()
    } else {
        std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string())
    };

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

    let state = AppState {
        client,
        project_dir,
        model: std::sync::Mutex::new(String::new()),
        git: std::sync::Mutex::new(Some(git_service)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}