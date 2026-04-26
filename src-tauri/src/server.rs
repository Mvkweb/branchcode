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

        Self::spawn_fresh(port, work_dir).await
    }

    /// Force-start the server in a new directory, killing anything on the port first.
    pub async fn force_start(port: u16, work_dir: &str) -> Result<Self, String> {
        // Kill anything on the port — we need a clean slate
        Self::kill_on_port(port);
        tokio::time::sleep(Duration::from_millis(1200)).await;

        // Double-check: if something is STILL alive, kill harder
        if Self::is_healthy(port).await {
            println!("[Server] Port {} still in use after kill, retrying...", port);
            Self::kill_on_port(port);
            tokio::time::sleep(Duration::from_millis(1500)).await;
        }

        Self::spawn_fresh(port, work_dir).await
    }

    /// Spawn a new opencode server process and wait for it to be healthy.
    async fn spawn_fresh(port: u16, work_dir: &str) -> Result<Self, String> {
        println!("Starting OpenCode server on port {} in {}...", port, work_dir);
        let process = Command::new("opencode")
            .args(["serve", "--port", &port.to_string()])
            .current_dir(work_dir)
            .env("OPENCODE_YOLO", "true") // Auto-approve tool calls (headless API mode)
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

    /// Stop the server: kill owned process AND anything else on the port.
    pub fn stop(&mut self) {
        if let Some(mut process) = self.process.take() {
            println!("[Server] Killing owned opencode process (pid {})", process.id());
            let _ = process.kill();
            let _ = process.wait();
        }
        // Always kill anything still on the port (e.g. externally started opencode)
        Self::kill_on_port(self.port);
    }

    /// Kill any process listening on the given port (platform-specific).
    fn kill_on_port(port: u16) {
        println!("[Server] Killing all processes on port {}...", port);

        #[cfg(target_os = "windows")]
        {
            // netstat -ano | findstr :PORT | findstr LISTENING → extract PID → taskkill
            if let Ok(output) = Command::new("cmd")
                .args(["/C", &format!("netstat -ano | findstr :{} | findstr LISTENING", port)])
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    if let Some(pid_str) = line.split_whitespace().last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            if pid > 0 {
                                println!("[Server] Killing PID {} on port {}", pid, port);
                                let _ = Command::new("taskkill")
                                    .args(["/F", "/PID", &pid.to_string()])
                                    .output();
                            }
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("sh")
                .args(["-c", &format!("lsof -ti:{} | xargs kill -9 2>/dev/null || true", port)])
                .output();
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
