use anyhow::{anyhow, Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize, Child};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::State;

pub type PtyState = Arc<Mutex<PtyManager>>;

pub struct PtyHandle {
    child: Box<dyn Child + Send + Sync>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    rx: std::sync::mpsc::Receiver<String>,
}

pub struct PtyManager {
    handles: HashMap<String, PtyHandle>,
    next_id: usize,
}

impl PtyManager {
    pub fn new() -> Self {
        PtyManager {
            handles: HashMap::new(),
            next_id: 1,
        }
    }

    fn detect_shell() -> String {
        #[cfg(target_os = "windows")]
        {
            if std::process::Command::new("pwsh")
                .args(["-NoProfile", "-Command", "exit 0"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
            {
                return "pwsh.exe".to_string();
            }
            if std::process::Command::new("powershell")
                .args(["-NoProfile", "-Command", "exit 0"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
            {
                return "powershell.exe".to_string();
            }
            std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    }

    pub fn spawn(&mut self) -> Result<String> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to open PTY")?;

        let shell = Self::detect_shell();

        let mut cmd = CommandBuilder::new(&shell);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        
        if let Ok(cwd) = std::env::current_dir() {
            cmd.cwd(cwd);
        } else if let Ok(home) = std::env::var("USERPROFILE") {
            cmd.cwd(std::path::Path::new(&home));
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell")?;

        let id = format!("term-{}", self.next_id);
        self.next_id += 1;

        let mut reader = pair
            .master
            .try_clone_reader()
            .context("Failed to clone reader")?;

        let writer = pair
            .master
            .take_writer()
            .context("Failed to take writer")?;

        let (tx, rx) = std::sync::mpsc::channel();
        let id_clone = id.clone();
        
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let data = String::from_utf8_lossy(&buf[..n]).to_string();
                if tx.send(data).is_err() {
                    break;
                }
            }
        });

        self.handles.insert(
            id.clone(),
            PtyHandle {
                child,
                master: pair.master,
                writer,
                rx,
            },
        );

        Ok(id)
    }

    pub fn write(&mut self, id: &str, data: &str) -> Result<()> {
        let handle = self.handles.get_mut(id).context("Terminal not found")?;
        handle.writer.write_all(data.as_bytes())?;
        handle.writer.flush()?;
        Ok(())
    }

    pub fn read(&mut self, id: &str) -> Result<Option<String>> {
        let handle = self.handles.get_mut(id).context("Terminal not found")?;
        let mut output = String::new();
        while let Ok(data) = handle.rx.try_recv() {
            output.push_str(&data);
        }
        if output.is_empty() {
            Ok(None)
        } else {
            Ok(Some(output))
        }
    }

    pub fn resize(&mut self, id: &str, cols: u16, rows: u16) -> Result<()> {
        let handle = self.handles.get_mut(id).context("Terminal not found")?;
        handle.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }

    pub fn close(&mut self, id: &str) -> Result<()> {
        if let Some(mut handle) = self.handles.remove(id) {
            let _ = handle.child.kill();
        }
        Ok(())
    }

    pub fn is_alive(&mut self, id: &str) -> bool {
        if !self.handles.contains_key(id) {
            return false;
        }
        let handle = self.handles.get(id).unwrap();
        match handle.rx.try_recv() {
            Err(std::sync::mpsc::TryRecvError::Disconnected) => false,
            _ => true,
        }
    }
}

#[tauri::command]
pub fn spawn_terminal(state: State<PtyState>) -> Result<String, String> {
    let mut pty_manager = state.lock().map_err(|e| e.to_string())?;
    pty_manager.spawn().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_terminal(id: String, data: String, state: State<PtyState>) -> Result<(), String> {
    let mut pty_manager = state.lock().map_err(|e| e.to_string())?;
    pty_manager.write(&id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_terminal(id: String, state: State<PtyState>) -> Result<Option<String>, String> {
    let mut pty_manager = state.lock().map_err(|e| e.to_string())?;
    pty_manager.read(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_terminal(id: String, cols: u16, rows: u16, state: State<PtyState>) -> Result<(), String> {
    let mut pty_manager = state.lock().map_err(|e| e.to_string())?;
    pty_manager.resize(&id, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_terminal(id: String, state: State<PtyState>) -> Result<(), String> {
    let mut pty_manager = state.lock().map_err(|e| e.to_string())?;
    pty_manager.close(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn is_terminal_alive(id: String, state: State<PtyState>) -> Result<bool, String> {
    let mut pty_manager = state.lock().map_err(|e| e.to_string())?;
    Ok(pty_manager.is_alive(&id))
}