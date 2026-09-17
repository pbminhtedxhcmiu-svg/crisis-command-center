#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Cổng server nội bộ (có thể override bằng biến môi trường CCC_PORT).
fn server_port() -> u16 {
    std::env::var("CCC_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(34_561)
}

/// Chuẩn hoá đường dẫn thành SQLite URL (forward slash, encode khoảng trắng).
fn sqlite_url(path: &std::path::Path) -> String {
    let s = path.to_string_lossy().replace('\\', "/").replace(' ', "%20");
    format!("file:{s}")
}

/// Chạy `prisma migrate deploy` bằng prisma-cli bundle trước khi mở server.
fn run_migrations(app: &tauri::AppHandle, app_dir: &std::path::Path, db_url: &str) -> Result<(), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("không xác định được thư mục resource: {e}"))?;

    let (mut rx, _child) = app
        .shell()
        .sidecar("binaries/node/node")
        .map_err(|e| format!("không tìm thấy sidecar node: {e}"))?
        .args([
            resource_dir
                .join("prisma-cli")
                .join("node_modules")
                .join("prisma")
                .join("build")
                .join("index.js")
                .to_string_lossy()
                .as_ref(),
            "migrate",
            "deploy",
        ])
        .current_dir(app_dir)
        .env("DATABASE_URL", db_url)
        .env("NODE_ENV", "production")
        .spawn()
        .map_err(|e| format!("không chạy được prisma migrate: {e}"))?;

    tauri::async_runtime::block_on(async move {
        let mut log = String::new();
        let mut exit_code: Option<i32> = None;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => log.push_str(&format!("{line}\n")),
                CommandEvent::Stderr(line) => log.push_str(&format!("{line}\n")),
                CommandEvent::Terminated(status) => exit_code = Some(status.code.unwrap_or(-1)),
                _ => {}
            }
        }
        match exit_code {
            Some(0) => {
                println!("[ccc] migrate deploy OK");
                Ok(())
            }
            Some(code) => Err(format!("prisma migrate deploy thất bại (exit {code}):\n{log}")),
            None => Err(format!("prisma migrate kết thúc bất thường:\n{log}")),
        }
    })
}

/// Khởi động Next standalone server bằng node sidecar và chờ cổng mở.
/// Trả về port của server khi sẵn sàng.
fn start_server(app: &tauri::AppHandle) -> Result<u16, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("không xác định được thư mục resource: {e}"))?;
    let app_dir = resource_dir.join("app");

    if !app_dir.join("server.js").exists() {
        return Err(format!(
            "không tìm thấy server.js trong {} — bundle desktop chưa được chuẩn bị",
            app_dir.display()
        ));
    }

    // DB nằm ở thư mục dữ liệu người dùng (AppData / Application Support) — ghi được
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("không xác định được thư mục dữ liệu: {e}"))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("không tạo được thư mục dữ liệu: {e}"))?;
    let db_url = sqlite_url(&data_dir.join("ccc.db"));

    // 1. Migrate DB trước khi server mở cổng
    run_migrations(app, &app_dir, &db_url)?;

    // 2. Chạy Next standalone server
    let port = server_port();
    // sidecar("binaries/node/node") tự resolve node-<target-triple><.exe> theo externalBin
    let (mut rx, child) = app
        .shell()
        .sidecar("binaries/node/node")
        .map_err(|e| format!("không tìm thấy sidecar node: {e}"))?
        .args(["server.js"])
        .current_dir(&app_dir)
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("NODE_ENV", "production")
        .env("DATABASE_URL", &db_url)
        .spawn()
        .map_err(|e| format!("không khởi động được node sidecar: {e}"))?;

    // Giữ process sống suốt vòng đời app (drop CommandChild sẽ kill process)
    std::mem::forget(child);

    // Ghi log server ra console của app (chỉ ở bản debug)
    if cfg!(debug_assertions) {
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => println!("[next] {line}"),
                    CommandEvent::Stderr(line) => eprintln!("[next] {line}"),
                    _ => {}
                }
            }
        });
    }

    // 3. Chờ cổng server mở (tối đa ~40 giây) — TCP connect thuần
    let deadline = std::time::Instant::now() + Duration::from_secs(40);
    while std::time::Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            println!("[ccc] server sẵn sàng tại http://127.0.0.1:{port}");
            return Ok(port);
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    Err(format!("server không mở cổng {port} sau 40 giây"))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                match start_server(&handle) {
                    Ok(port) => {
                        if let Some(window) = handle.get_webview_window("main") {
                            // Điều hướng WebView từ trang splash sang server nội bộ rồi mới hiện
                            let js = format!("window.location.replace('http://127.0.0.1:{port}/')");
                            let _ = window.eval(&js);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    Err(e) => {
                        eprintln!("[ccc] {e}");
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("lỗi khi chạy ứng dụng Tauri");
}
