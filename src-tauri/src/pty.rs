use anyhow::{Context, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

pub type PtyState = Arc<Mutex<PtyManager>>;

pub struct PtyHandle {
    // Keep the child alive so the shell doesn't terminate
    _child: Box<dyn portable_pty::Child + Send + Sync>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    // Channel receiver for non-blocking reads
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
        println!("[PTY] Detected shell: {}", shell);
        
        let mut cmd = CommandBuilder::new(&shell);
        
        if let Ok(home) = std::env::var("USERPROFILE") {
            println!("[PTY] Setting cwd to: {}", home);
            cmd.cwd(std::path::Path::new(&home));
        } else if let Ok(cwd) = std::env::current_dir() {
            cmd.cwd(cwd);
        }

        // Store the child to prevent Drop from terminating the shell!
        let child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell")?;
        
        let id = format!("term-{}", self.next_id);
        self.next_id += 1;
        println!("[PTY] Created terminal: {}", id);

        let mut reader = pair
            .master
            .try_clone_reader()
            .context("Failed to clone reader")?;
        
        let writer = pair
            .master
            .take_writer()
            .context("Failed to take writer")?;

        // Background thread: continuously read from the pipe and funnel data through MPSC
        let (tx, rx) = std::sync::mpsc::channel();
        let id_clone = id.clone();
        std::thread::spawn(move || {
            println!("[PTY] Reader thread started for {}", id_clone);
            let mut buf = [0u8; 4096];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 { 
                    println!("[PTY] EOF for {}", id_clone);
                    break; // EOF reached
                }
                let data = String::from_utf8_lossy(&buf[..n]).to_string();
                println!("[PTY] Read {} bytes from {}", n, id_clone);
                if tx.send(data).is_err() {
                    println!("[PTY] Channel send failed for {}", id_clone);
                    break; // Receiver channel dropped
                }
            }
            println!("[PTY] Reader thread ending for {}", id_clone);
        });

        self.handles.insert(
            id.clone(),
            PtyHandle {
                _child: child,
                master: pair.master, // 'pair.slave' naturally drops here, allowing proper EOF behavior!
                writer,
                rx,
            },
        );

        Ok(id)
    }

    pub fn write(&mut self, id: &str, data: &str) -> Result<()> {
        let handle = self.handles.get_mut(id).context("Terminal not found")?;
        println!("[PTY] write to {}: {:?}", id, data);
        handle.writer.write_all(data.as_bytes())?;
        handle.writer.flush()?;
        Ok(())
    }

    pub fn read(&mut self, id: &str) -> Result<Option<String>> {
        let handle = self.handles.get_mut(id).context("Terminal not found")?;

        let mut output = String::new();
        // try_recv is NON-BLOCKING! If there's no data, it immediately breaks the loop.
        while let Ok(data) = handle.rx.try_recv() {
            output.push_str(&data);
        }
        
        if output.is_empty() {
            // No data available
            Ok(None)
        } else {
            println!("[PTY] read from {}: {:?}", id, output);
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
        }).context("Failed to resize terminal")?;
        
        Ok(())
    }

    pub fn close(&mut self, id: &str) -> Result<()> {
        if let Some(mut handle) = self.handles.remove(id) {
            // Explicitly kill the process when the tab gets closed
            let _ = handle._child.kill(); 
        }
        Ok(())
    }
}