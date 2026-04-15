use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitUpdate {
    pub id: String,
    #[serde(rename = "fullSha")]
    pub full_sha: String,
    pub branch: String,
    pub message: String,
    pub date: String,
    pub status: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseUpdate {
    pub version: String,
    pub message: String,
    pub date: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateChannels {
    pub commits: Vec<CommitUpdate>,
    pub prerelease: Vec<ReleaseUpdate>,
    pub stable: Vec<ReleaseUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateResponse {
    pub channels: UpdateChannels,
}

const WORKER_URL: &str = "https://branchcode.mvktest.workers.dev/";

#[tauri::command]
pub async fn check_updates() -> Result<Option<UpdateResponse>, String> {
    if cfg!(debug_assertions) {
        println!("[Updater] Skipping update check in dev mode");
        return Ok(None);
    }

    println!("[Updater] Checking for updates from worker...");

    let client = reqwest::Client::new();
    
    let response = client
        .get(WORKER_URL)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch updates: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Worker returned status: {}", response.status()));
    }

    let data: UpdateResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    println!("[Updater] Got updates - commits: {}, prerelease: {}, stable: {}",
        data.channels.commits.len(),
        data.channels.prerelease.len(),
        data.channels.stable.len()
    );

    Ok(Some(data))
}

#[tauri::command]
pub async fn download_and_install(url: String) -> Result<String, String> {
    if cfg!(debug_assertions) {
        return Err("Cannot install updates in dev mode".to_string());
    }

    println!("[Updater] Downloading update from: {}", url);

    // Download the installer
    let client = reqwest::Client::new();
    
    let response = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: {}", response.status()));
    }

    // Get the installer bytes
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read installer: {}", e))?;

    // Save to temp directory
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join("branchcode_installer.exe");

    std::fs::write(&installer_path, &bytes)
        .map_err(|e| format!("Failed to save installer: {}", e))?;

    println!("[Updater] Installer saved to: {:?}", installer_path);

    // Launch the installer and exit the app
    // This is platform-specific - on Windows we'd use msiexec or the exe directly
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", installer_path.to_str().unwrap()])
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;
    }

    Ok("Installer downloaded. The app will now exit to complete the update.".to_string())
}