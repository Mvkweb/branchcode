use anyhow::{anyhow, Result};
use dashmap::DashMap;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::{io::{Read, Write}, sync::{Arc, Mutex, OnceLock}, sync::atomic::{AtomicU64, Ordering}, time::Duration};
use tauri::{AppHandle, Emitter, State};

static SHELL: OnceLock<&'static str> = OnceLock::new();

fn shell() -> &'static str {
    *SHELL.get_or_init(|| {
        #[cfg(windows)] {
            if std::path::Path::new("C:\\Program Files\\PowerShell\\7\\pwsh.exe").exists() {
                Box::leak("C:\\Program Files\\PowerShell\\7\\pwsh.exe".into())
            } else {
                Box::leak("powershell.exe".into())
            }
        }
        #[cfg(not(windows))] {
            Box::leak(std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into()))
        }
    })
}

#[derive(Serialize, Clone)] struct PtyData { id: String, data: Vec<u8> }
#[derive(Serialize, Clone)] struct PtyExit { id: String }

struct Handle {
    child: Mutex<Box<dyn portable_pty::Child + Send + Sync>>,
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
}

pub struct PtyManager { map: DashMap<String, Arc<Handle>>, counter: AtomicU64 }

impl PtyManager {
    pub fn new() -> Self { Self { map: DashMap::new(), counter: AtomicU64::new(1) } }

    pub fn spawn(&self, app: AppHandle, cols: u16, rows: u16) -> Result<String> {
        let pair = native_pty_system().openpty(PtySize { rows, cols, pixel_width: cols * 9, pixel_height: rows * 17 })?;
        
        let mut cmd = CommandBuilder::new(shell());
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("WT_SESSION", "1");
        
        if let Ok(cwd) = std::env::current_dir() { cmd.cwd(cwd); }

        let child = pair.slave.spawn_command(cmd)?;
        let id = format!("term-{}", self.counter.fetch_add(1, Ordering::Relaxed));
        
        let reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;
        
        let handle = Arc::new(Handle { child: Mutex::new(child), writer: Mutex::new(writer), master: Mutex::new(pair.master) });
        self.map.insert(id.clone(), handle.clone());

        std::thread::spawn({ let app = app.clone(); let id = id.clone(); move || {
            let mut buf = [0u8; 8192]; let mut r = reader;
            while let Ok(n) = r.read(&mut buf) { if n == 0 { break } let _ = app.emit("pty:data", PtyData { id: id.clone(), data: buf[..n].to_vec() }); }
        }});

        std::thread::spawn({ let app = app.clone(); let id = id.clone(); let h = handle.clone(); move || loop {
            std::thread::sleep(Duration::from_millis(150));
            if h.child.lock().unwrap().try_wait().ok().flatten().is_some() { let _ = app.emit("pty:exit", PtyExit { id }); break; }
        }});
        
        Ok(id)
    }

    pub fn write(&self, id: &str, data: &str) -> Result<()> {
        let h = self.map.get(id).ok_or_else(|| anyhow!("gone"))?;
        let mut w = h.writer.lock().unwrap();
        w.write_all(data.as_bytes())?;
        w.flush()?;
        Ok(())
    }

    pub fn resize(&self, id: &str, cols: u16, rows: u16) -> Result<()> {
        let h = self.map.get(id).ok_or_else(|| anyhow!("gone"))?;
        h.master.lock().unwrap().resize(PtySize { rows, cols, pixel_width: cols * 9, pixel_height: rows * 17 })?;
        Ok(())
    }

    pub fn close(&self, id: &str) -> Result<()> {
        if let Some((_, h)) = self.map.remove(id) { let _ = h.child.lock().unwrap().kill(); }
        Ok(())
    }
}

pub type PtyState = Arc<PtyManager>;

#[tauri::command]
pub fn spawn_terminal(s: State<PtyState>, a: AppHandle, cols: u16, rows: u16) -> Result<String, String> {
    s.spawn(a, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_terminal(s: State<PtyState>, id: String, data: String) -> Result<(), String> {
    s.write(&id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resize_terminal(s: State<PtyState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    s.resize(&id, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_terminal(s: State<PtyState>, id: String) -> Result<(), String> {
    s.close(&id).map_err(|e| e.to_string())
}