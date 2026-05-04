use crate::config::get;
use crate::config::StoreWrapper;
use crate::error::Error;
use crate::StringWrapper;
use crate::APP;
use log::{error, info};
use serde_json::{json, Value};
use std::io::Read;
use tauri::Manager;

#[tauri::command]
pub fn get_text(state: tauri::State<StringWrapper>) -> String {
    return state.0.lock().unwrap().to_string();
}

#[tauri::command]
pub fn reload_store() {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    state.0.reload().unwrap();
}

#[tauri::command]
pub fn cut_image(
    left: u32,
    top: u32,
    width: u32,
    height: u32,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use dirs::cache_dir;
    use image::GenericImage;
    info!("Cut image: {}x{}+{}+{}", width, height, left, top);
    let mut app_cache_dir_path = cache_dir().ok_or_else(|| "Get Cache Dir Failed".to_string())?;
    app_cache_dir_path.push(&app_handle.config().identifier);
    app_cache_dir_path.push("pot_screenshot.png");
    if !app_cache_dir_path.exists() {
        return Err("Screenshot file does not exist".to_string());
    }
    let mut img = match image::open(&app_cache_dir_path) {
        Ok(v) => v,
        Err(e) => {
            error!("{:?}", e.to_string());
            return Err(e.to_string());
        }
    };
    if left >= img.width() || top >= img.height() {
        return Err("Screenshot crop origin is outside of the image".to_string());
    }
    let width = width.min(img.width() - left);
    let height = height.min(img.height() - top);
    let img2 = img.sub_image(left, top, width, height);
    app_cache_dir_path.pop();
    app_cache_dir_path.push("pot_screenshot_cut.png");
    match img2.to_image().save(&app_cache_dir_path) {
        Ok(_) => Ok(()),
        Err(e) => {
            error!("{:?}", e.to_string());
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn get_base64(app_handle: tauri::AppHandle) -> String {
    use base64::{engine::general_purpose, Engine as _};
    use dirs::cache_dir;
    use std::fs::File;
    use std::io::Read;
    let mut app_cache_dir_path = cache_dir().expect("Get Cache Dir Failed");
    app_cache_dir_path.push(&app_handle.config().identifier);
    app_cache_dir_path.push("pot_screenshot_cut.png");
    if !app_cache_dir_path.exists() {
        return "".to_string();
    }
    let mut file = File::open(app_cache_dir_path).unwrap();
    let mut vec = Vec::new();
    match file.read_to_end(&mut vec) {
        Ok(_) => {}
        Err(e) => {
            error!("{:?}", e.to_string());
            return "".to_string();
        }
    }
    let base64 = general_purpose::STANDARD.encode(&vec);
    base64.replace("\r\n", "")
}

#[tauri::command]
pub fn copy_img(app_handle: tauri::AppHandle, width: usize, height: usize) -> Result<(), Error> {
    use arboard::{Clipboard, ImageData};
    use dirs::cache_dir;
    use image::ImageReader;
    use std::borrow::Cow;

    let mut app_cache_dir_path = cache_dir().expect("Get Cache Dir Failed");
    app_cache_dir_path.push(&app_handle.config().identifier);
    app_cache_dir_path.push("pot_screenshot_cut.png");
    let data = ImageReader::open(app_cache_dir_path)?.decode()?;

    let img = ImageData {
        width,
        height,
        bytes: Cow::from(data.as_bytes()),
    };
    let result = Clipboard::new()?.set_image(img)?;
    Ok(result)
}

fn normalize_proxy_host(host: &str) -> String {
    let trimmed = host.trim().trim_end_matches('/');
    trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
        .unwrap_or(trimmed)
        .to_string()
}

fn normalize_no_proxy(no_proxy: &str) -> String {
    let mut values: Vec<String> = no_proxy
        .split(',')
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect();

    for required in ["localhost", "127.0.0.1", "::1"] {
        if !values.iter().any(|value| value.eq_ignore_ascii_case(required)) {
            values.push(required.to_string());
        }
    }

    values.join(",")
}

#[tauri::command]
pub fn set_proxy() -> Result<bool, String> {
    let host = match get("proxy_host") {
        Some(v) => v.as_str().unwrap_or("").trim().to_string(),
        None => return Err("Missing proxy host".to_string()),
    };
    let port = match get("proxy_port") {
        Some(v) => match v.as_i64() {
            Some(port) => port.to_string(),
            None => v.as_str().unwrap_or("").trim().to_string(),
        },
        None => return Err("Missing proxy port".to_string()),
    };
    let no_proxy = match get("no_proxy") {
        Some(v) => normalize_no_proxy(v.as_str().unwrap_or("")),
        None => normalize_no_proxy(""),
    };
    let host = normalize_proxy_host(&host);
    if host.is_empty() || port.is_empty() {
        return Err("Missing proxy host or port".to_string());
    }
    let username = get("proxy_username")
        .and_then(|v| v.as_str().map(|s| s.trim().to_string()))
        .unwrap_or_default();
    let password = get("proxy_password")
        .and_then(|v| v.as_str().map(|s| s.trim().to_string()))
        .unwrap_or_default();
    let auth = if username.is_empty() {
        String::new()
    } else if password.is_empty() {
        format!("{}@", username)
    } else {
        format!("{}:{}@", username, password)
    };
    let proxy = format!("http://{}{}:{}", auth, host, port);

    for key in ["http_proxy", "HTTP_PROXY"] {
        std::env::set_var(key, &proxy);
    }
    for key in ["https_proxy", "HTTPS_PROXY"] {
        std::env::set_var(key, &proxy);
    }
    for key in ["all_proxy", "ALL_PROXY"] {
        std::env::set_var(key, &proxy);
    }
    for key in ["no_proxy", "NO_PROXY"] {
        std::env::set_var(key, &no_proxy);
    }
    Ok(true)
}

#[tauri::command]
pub fn unset_proxy() -> Result<bool, String> {
    for key in [
        "http_proxy",
        "HTTP_PROXY",
        "https_proxy",
        "HTTPS_PROXY",
        "all_proxy",
        "ALL_PROXY",
        "no_proxy",
        "NO_PROXY",
    ] {
        std::env::remove_var(key);
    }
    Ok(true)
}

#[tauri::command]
pub fn open_config_dir(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    use tauri_plugin_opener::OpenerExt;

    let config_root = dirs::config_dir().ok_or_else(|| "Get Config Dir Failed".to_string())?;
    let upstream_config_dir = config_root.join("neopot");
    let config_dir = if upstream_config_dir.exists() {
        upstream_config_dir
    } else {
        app_handle
            .path()
            .app_config_dir()
            .map_err(|e| e.to_string())?
    };

    app_handle
        .opener()
        .open_path(config_dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn install_plugin(path_list: Vec<String>) -> Result<i32, Error> {
    let mut success_count = 0;

    for path in path_list {
        if !path.ends_with("potext") {
            continue;
        }
        let path = std::path::Path::new(&path);
        let file_name = path.file_name().unwrap().to_str().unwrap();
        let file_name = file_name.replace(".potext", "");
        if !file_name.starts_with("plugin") {
            return Err(Error::Error(
                "Invalid Plugin: file name must start with plugin".into(),
            ));
        }

        let mut zip = zip::ZipArchive::new(std::fs::File::open(path)?)?;
        #[allow(unused_mut)]
        let mut plugin_type: String;
        if let Ok(mut info) = zip.by_name("info.json") {
            let mut content = String::new();
            info.read_to_string(&mut content)?;
            let json: serde_json::Value = serde_json::from_str(&content)?;
            plugin_type = json["plugin_type"]
                .as_str()
                .ok_or(Error::Error("can't find plugin type in info.json".into()))?
                .to_string();
        } else {
            return Err(Error::Error("Invalid Plugin: miss info.json".into()));
        }
        if zip.by_name("main.js").is_err() {
            return Err(Error::Error("Invalid Plugin: miss main.js".into()));
        }
        let config_path = dirs::config_dir().unwrap();
        let config_path = config_path.join(APP.get().unwrap().config().identifier.clone());
        let config_path = config_path.join("plugins");
        let config_path = config_path.join(plugin_type);
        let plugin_path = config_path.join(file_name);
        std::fs::create_dir_all(&config_path)?;
        zip.extract(&plugin_path)?;

        success_count += 1;
    }
    Ok(success_count)
}

#[tauri::command]
pub fn run_binary(
    plugin_type: String,
    plugin_name: String,
    cmd_name: String,
    args: Vec<String>,
) -> Result<Value, Error> {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    let config_path = dirs::config_dir().unwrap();
    let config_path = config_path.join(APP.get().unwrap().config().identifier.clone());
    let config_path = config_path.join("plugins");
    let config_path = config_path.join(plugin_type);
    let plugin_path = config_path.join(plugin_name);

    #[cfg(target_os = "windows")]
    let mut cmd = Command::new("cmd");
    #[cfg(target_os = "windows")]
    let cmd = cmd.creation_flags(0x08000000);
    #[cfg(target_os = "windows")]
    let cmd = cmd.args(["/c", &cmd_name]);
    #[cfg(not(target_os = "windows"))]
    let mut cmd = Command::new(&cmd_name);

    let output = cmd.args(args).current_dir(plugin_path).output()?;
    Ok(json!({
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "status": output.status.code().unwrap_or(-1),
    }))
}

#[tauri::command]
pub fn font_list() -> Result<Vec<String>, Error> {
    use font_kit::source::SystemSource;
    let source = SystemSource::new();

    Ok(source.all_families()?)
}

#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) {
    if !window.is_devtools_open() {
        window.open_devtools();
    } else {
        window.close_devtools();
    }
}
