use serde::Serialize;

#[derive(Serialize)]
pub struct GreetResponse {
    pub message: String,
}

#[tauri::command]
pub fn greet(name: &str) -> GreetResponse {
    GreetResponse {
        message: format!("Hello, {}! Welcome to Branchcode.", name),
    }
}

#[tauri::command]
pub fn get_app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
