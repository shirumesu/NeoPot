use log::info;

#[tauri::command]
pub fn screenshot(x: i32, y: i32) -> Result<(), String> {
    use crate::APP;
    use dirs::cache_dir;
    use screenshots::{Compression, Screen};
    use std::fs;
    info!("Screenshot screen with position: x={}, y={}", x, y);
    let screens = Screen::all().map_err(|e| e.to_string())?;
    let mut target_screen = None;

    for screen in &screens {
        let info = screen.display_info;
        info!("Screen: {:?}", info);
        let width = info.width as i32;
        let height = info.height as i32;
        if x >= info.x && x < info.x + width && y >= info.y && y < info.y + height {
            target_screen = Some(screen);
            break;
        }
    }

    let screen = target_screen
        .or_else(|| screens.first())
        .ok_or_else(|| "No screen available for screenshot".to_string())?;
    let handle = APP.get().ok_or_else(|| "App handle is not initialized".to_string())?;
    let mut app_cache_dir_path = cache_dir().ok_or_else(|| "Get Cache Dir Failed".to_string())?;
    app_cache_dir_path.push(&handle.config().identifier);
    if !app_cache_dir_path.exists() {
        fs::create_dir_all(&app_cache_dir_path).map_err(|e| e.to_string())?;
    }
    app_cache_dir_path.push("pot_screenshot.png");

    let image = screen.capture().map_err(|e| e.to_string())?;
    let buffer = image.to_png(Compression::Fast).map_err(|e| e.to_string())?;
    fs::write(app_cache_dir_path, buffer).map_err(|e| e.to_string())?;
    Ok(())
}
