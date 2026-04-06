use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};
use reqwest::Client;

pub struct OpenCodeServer {
    process: Option<Child>,
    port: u16,
}

impl OpenCodeServer {
    pub async fn start(port: u16, work_dir: &str) -> Result<Self, String> {
        if Self::is_healthy(port).await {
            println!("OpenCode server already running on port {}", port);
            return Ok(Self { process: None, port });
        }

        println!("Starting OpenCode server on port {} in {}...", port, work_dir);
        let process = Command::new("opencode")
            .args(["serve", "--port", &port.to_string()])
            .current_dir(work_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start opencode serve: {}. Is opencode installed?", e))?;

        let start = Instant::now();
        let timeout = Duration::from_secs(30);
        loop {
            if start.elapsed() > timeout {
                return Err("Timed out waiting for OpenCode server to start (30s)".to_string());
            }

            if Self::is_healthy(port).await {
                println!("OpenCode server is ready on port {}", port);
                return Ok(Self { process: Some(process), port });
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    }

    async fn is_healthy(port: u16) -> bool {
        let client = match Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
        {
            Ok(c) => c,
            Err(_) => return false,
        };
        client
            .get(&format!("http://127.0.0.1:{}/global/health", port))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
}

impl Drop for OpenCodeServer {
    fn drop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
            let _ = process.wait();
        }
    }
}
