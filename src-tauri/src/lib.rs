mod opencode_client;
mod server;

use opencode_client::OcStreamEvent;
use serde::Serialize;
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;

struct AppState {
    client: Arc<opencode_client::OpenCodeClient>,
    project_dir: String,
    model: std::sync::Mutex<String>,
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
    state: State<'_, AppState>,
) -> Result<(), String> {
    let model = state.model.lock().unwrap().clone();

    if model.is_empty() {
        return Err("No model selected. Pick a model first.".to_string());
    }

    state
        .client
        .send_message(&session_id, &message, &model, &on_event)
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

// ── App setup ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let project_dir = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| ".".to_string());

    println!("CWD: {}", project_dir);

    let port = 4096;

    // Start opencode serve
    let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
    let _server = rt.block_on(server::OpenCodeServer::start(port));

    match &_server {
        Ok(s) => println!("OpenCode server running on port {}", s.port()),
        Err(e) => eprintln!("Failed to start OpenCode server: {}", e),
    }

    let client = Arc::new(opencode_client::OpenCodeClient::new(format!("http://127.0.0.1:{}", port)));

    let state = AppState {
        client,
        project_dir,
        model: std::sync::Mutex::new(String::new()),
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
