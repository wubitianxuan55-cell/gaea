use serde::{Deserialize, Serialize};
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct BackendProcesses {
    node: Option<Child>,
    python: Option<Child>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub platform: String,
    pub release: String,
    pub arch: String,
    pub hostname: String,
    pub total_memory: u64,
    pub free_memory: u64,
    pub home_dir: String,
    pub cpus: usize,
    pub uptime: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub output: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NativeFile {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        platform: std::env::consts::OS.to_string(),
        release: sys_info::os_release().unwrap_or_default(),
        arch: std::env::consts::ARCH.to_string(),
        hostname: sys_info::hostname().unwrap_or_default(),
        total_memory: sys_info::mem_info().map(|m| m.total).unwrap_or(0),
        free_memory: sys_info::mem_info().map(|m| m.avail).unwrap_or(0),
        home_dir: dirs_next::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
        cpus: sys_info::cpu_num().unwrap_or(0) as usize,
        uptime: 0, // sys_info 0.9 removed uptime()
    }
}

#[tauri::command]
fn list_home_files() -> Vec<NativeFile> {
    let home = dirs_next::home_dir().unwrap_or_default();
    let entries = std::fs::read_dir(&home);
    match entries {
        Ok(iter) => iter
            .filter_map(|e| e.ok())
            .take(50)
            .map(|e| {
                let path = e.path();
                let is_dir = path.is_dir();
                NativeFile {
                    name: e.file_name().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                    is_directory: is_dir,
                }
            })
            .collect(),
        Err(_) => vec![],
    }
}

#[tauri::command]
async fn set_ignore_cursor_events(app: tauri::AppHandle, ignore: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("no main window")?;
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_command(command: String) -> CommandResult {
    // Safety: restrict to cmd.exe /C for Windows compatibility
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", &command]).output()
    } else {
        Command::new("sh").args(["-c", &command]).output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            CommandResult {
                success: out.status.success(),
                output: if stdout.is_empty() { stderr } else { stdout },
            }
        }
        Err(e) => CommandResult {
            success: false,
            output: e.to_string(),
        },
    }
}

fn spawn_python(python_exe: &std::path::Path, api_py: &std::path::Path, work_dir: &std::path::Path) -> Option<Child> {
    println!(
        "[LumiOS] Starting GPT-SoVITS API: {} {}",
        python_exe.display(),
        api_py.display()
    );
    match Command::new(python_exe)
        .arg(api_py)
        .arg("-a")
        .arg("127.0.0.1")
        .arg("-p")
        .arg("9880")
        .arg("-d")
        .arg("cuda")
        .current_dir(work_dir)
        .spawn()
    {
        Ok(child) => {
            println!("[LumiOS] GPT-SoVITS API PID: {}", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!("[LumiOS] Failed to start GPT-SoVITS API: {}", e);
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Mutex::new(BackendProcesses { node: None, python: None }))
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            list_home_files,
            run_command,
            set_ignore_cursor_events,
        ])
        .setup(|app| {
            // Spawn Node.js backend
            let resource_dir = app
                .path()
                .resource_dir()
                .unwrap_or_default();
            let dist_server = resource_dir.join("dist-server");
            let node_exe = dist_server.join("node.exe");
            let server_js = dist_server.join("entry.cjs");
            let server_mjs = dist_server.join("server.mjs");

            if node_exe.exists() && server_js.exists() && server_mjs.exists() {
                println!(
                    "[LumiOS] Starting backend: {} {}",
                    node_exe.display(),
                    server_js.display()
                );
                match Command::new(&node_exe)
                    .arg(&server_js)
                    .current_dir(&dist_server)
                    .spawn()
                {
                    Ok(child) => {
                        println!("[LumiOS] Backend PID: {}", child.id());
                        let state = app.state::<Mutex<BackendProcesses>>();
                        state.lock().unwrap().node = Some(child);
                    }
                    Err(e) => {
                        eprintln!("[LumiOS] Failed to start backend: {}", e);
                    }
                }
            } else {
                eprintln!(
                    "[LumiOS] Backend not found. node.exe: {}, entry.cjs: {}, server.mjs: {}",
                    node_exe.exists(),
                    server_js.exists(),
                    server_mjs.exists()
                );
            }

            // Spawn GPT-SoVITS Python API server
            let gpt_sovits_dir = resource_dir.join("gpt-sovits-api");
            let python_exe = gpt_sovits_dir.join("venv/Scripts/python.exe");
            let api_py = gpt_sovits_dir.join("api.py");
            // Also check development paths
            let dev_python = std::path::PathBuf::from("../gpt-sovits-src/venv/Scripts/python.exe");
            let dev_api = std::path::PathBuf::from("../gpt-sovits-src/api.py");

            let python_child = if python_exe.exists() && api_py.exists() {
                spawn_python(&python_exe, &api_py, &gpt_sovits_dir)
            } else if dev_python.exists() && dev_api.exists() {
                spawn_python(&dev_python, &dev_api, &std::path::PathBuf::from("../gpt-sovits-src"))
            } else {
                eprintln!(
                    "[LumiOS] GPT-SoVITS API not found at {} or {}",
                    python_exe.display(),
                    dev_python.display()
                );
                None
            };
            if let Some(child) = python_child {
                let state = app.state::<Mutex<BackendProcesses>>();
                state.lock().unwrap().python = Some(child);
            }

            // Register Alt+Space global shortcut
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            let window = app.get_webview_window("main").unwrap();
            let reg = app.global_shortcut();
            let _ = reg.on_shortcut("Alt+Space", move |_app, _shortcut, _event| {
                if window.is_visible().unwrap_or(true) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Lumi OS")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<Mutex<BackendProcesses>>();
                let mut procs = state.lock().unwrap();
                if let Some(child) = procs.node.as_mut() {
                    println!("[LumiOS] Stopping Node backend...");
                    let _ = child.kill();
                }
                if let Some(child) = procs.python.as_mut() {
                    println!("[LumiOS] Stopping GPT-SoVITS API...");
                    let _ = child.kill();
                }
            }
        });
}
