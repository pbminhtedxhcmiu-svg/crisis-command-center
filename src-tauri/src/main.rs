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

/// Tạo lệnh chạy node runtime.
/// - Bản cài đặt: bundler đặt sidecar PHẲNG cạnh main exe (node.exe / node)
/// - Quy ước dev (`tauri dev`): binaries/node/node-<target-triple>
fn node_command(app: &tauri::AppHandle) -> Result<tauri_plugin_shell::process::Command, String> {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let flat = dir.join(if cfg!(windows) { "node.exe" } else { "node" });
            if flat.exists() {
                return Ok(app.shell().command(flat));
            }
        }
    }
    app.shell()
        .sidecar("binaries/node/node")
        .map_err(|e| format!("không tìm thấy node runtime: {e}"))
}

/// Chạy `prisma migrate deploy` bằng prisma-cli bundle trước khi mở server.
fn run_migrations(app: &tauri::AppHandle, app_dir: &std::path::Path, db_url: &str) -> Result<(), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("không xác định được thư mục resource: {e}"))?;

    let (mut rx, _child) = node_command(app)?
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
                CommandEvent::Stdout(line) => {
                    log.push_str(&String::from_utf8_lossy(&line));
                    log.push('\n');
                }
                CommandEvent::Stderr(line) => {
                    log.push_str(&String::from_utf8_lossy(&line));
                    log.push('\n');
                }
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
    let (mut rx, child) = node_command(app)?
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
                    CommandEvent::Stdout(line) => println!("[next] {}", String::from_utf8_lossy(&line)),
                    CommandEvent::Stderr(line) => eprintln!("[next] {}", String::from_utf8_lossy(&line)),
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

/// Kiểm tra bản cập nhật qua plugin updater (endpoint latest.json trên GitHub Releases).
/// Tải về và cài passive (không cần admin trên NSIS per-user), rồi yêu cầu restart.
fn check_for_updates(handle: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;
    let result = tauri::async_runtime::block_on(async move {
        match handle.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => {
                    println!("[ccc] có bản mới {} — đang tải & cài...", update.version);
                    let mut downloaded = 0u64;
                    match update
                        .download_and_install(
                            |chunk, total| {
                                downloaded += chunk as u64;
                                if let Some(total) = total {
                                    if total > 0 && downloaded % (8 * 1024 * 1024) < chunk as u64 {
                                        println!("[ccc] update... {} / {} MB", downloaded / 1024 / 1024, total / 1024 / 1024);
                                    }
                                }
                            },
                            || {
                                println!("[ccc] tải xong — cài đặt...");
                            },
                        )
                        .await
                    {
                        Ok(()) => println!("[ccc] update đã cài — sẽ áp dụng khi khởi động lại"),
                        Err(e) => eprintln!("[ccc] cài update thất bại: {e}"),
                    }
                }
                Ok(None) => println!("[ccc] đã là bản mới nhất"),
                Err(e) => eprintln!("[ccc] kiểm tra update thất bại: {e}"),
            },
            Err(e) => eprintln!("[ccc] updater không khả dụng: {e}"),
        }
    });
    let _ = result;
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
                        // Auto-update: kiểm tra nền sau khi app đã dùng được, im lặng khi lỗi mạng
                        // (đang trong spawn_blocking — không chặn UI, download/cài passive)
                        check_for_updates(handle);
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
