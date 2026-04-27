use crate::clipboard::*;
use crate::config::{get, set};
use crate::window::{
    config_window, input_translate, ocr_recognize, ocr_translate, updater_window,
};
use log::{info, warn};
use tauri::menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_opener::OpenerExt;

const TRAY_ID: &str = "main";

struct TrayLabels {
    input_translate: &'static str,
    clipboard_monitor: &'static str,
    auto_copy: &'static str,
    copy_source: &'static str,
    copy_target: &'static str,
    copy_source_target: &'static str,
    copy_disable: &'static str,
    ocr_recognize: &'static str,
    ocr_translate: &'static str,
    config: &'static str,
    check_update: &'static str,
    view_log: &'static str,
    restart: &'static str,
    quit: &'static str,
}

#[tauri::command]
pub fn update_tray(app_handle: tauri::AppHandle, mut language: String, mut copy_mode: String) {
    if language.is_empty() {
        language = match get("app_language") {
            Some(v) => v.as_str().unwrap().to_string(),
            None => {
                set("app_language", "en");
                "en".to_string()
            }
        };
    }
    if copy_mode.is_empty() {
        copy_mode = match get("translate_auto_copy") {
            Some(v) => v.as_str().unwrap().to_string(),
            None => {
                set("translate_auto_copy", "disable");
                "disable".to_string()
            }
        };
    }

    let enable_clipboard_monitor = match get("clipboard_monitor") {
        Some(v) => v.as_bool().unwrap(),
        None => {
            set("clipboard_monitor", false);
            false
        }
    };

    info!(
        "Update tray with language: {}, copy mode: {}",
        language, copy_mode
    );

    let menu = match language.as_str() {
        "en" => tray_menu_en(&app_handle, &copy_mode, enable_clipboard_monitor),
        "zh_cn" => tray_menu_zh_cn(&app_handle, &copy_mode, enable_clipboard_monitor),
        "zh_tw" => tray_menu_zh_tw(&app_handle, &copy_mode, enable_clipboard_monitor),
        "ja" => tray_menu_ja(&app_handle, &copy_mode, enable_clipboard_monitor),
        "ko" => tray_menu_ko(&app_handle, &copy_mode, enable_clipboard_monitor),
        "fr" => tray_menu_fr(&app_handle, &copy_mode, enable_clipboard_monitor),
        "de" => tray_menu_de(&app_handle, &copy_mode, enable_clipboard_monitor),
        "ru" => tray_menu_ru(&app_handle, &copy_mode, enable_clipboard_monitor),
        "pt_br" => tray_menu_pt_br(&app_handle, &copy_mode, enable_clipboard_monitor),
        "fa" => tray_menu_fa(&app_handle, &copy_mode, enable_clipboard_monitor),
        "uk" => tray_menu_uk(&app_handle, &copy_mode, enable_clipboard_monitor),
        _ => tray_menu_en(&app_handle, &copy_mode, enable_clipboard_monitor),
    }
    .unwrap();

    let Some(tray) = app_handle.tray_by_id(TRAY_ID) else {
        warn!("Tray icon not found: {}", TRAY_ID);
        return;
    };

    tray.set_menu(Some(menu)).unwrap();
    #[cfg(not(target_os = "linux"))]
    tray.set_tooltip(Some(format!("pot {}", app_handle.package_info().version)))
        .unwrap();
}

pub fn tray_menu_event_handler(app: &AppHandle, event: MenuEvent) {
    match event.id().as_ref() {
        "input_translate" => on_input_translate_click(),
        "copy_source" => on_auto_copy_click(app, "source"),
        "clipboard_monitor" => on_clipboard_monitor_click(app),
        "copy_target" => on_auto_copy_click(app, "target"),
        "copy_source_target" => on_auto_copy_click(app, "source_target"),
        "copy_disable" => on_auto_copy_click(app, "disable"),
        "ocr_recognize" => on_ocr_recognize_click(),
        "ocr_translate" => on_ocr_translate_click(),
        "config" => on_config_click(),
        "check_update" => on_check_update_click(),
        "view_log" => on_view_log_click(app),
        "restart" => on_restart_click(app),
        "quit" => on_quit_click(app),
        _ => {}
    }
}

pub fn tray_event_handler(_app: &AppHandle, event: TrayIconEvent) {
    #[cfg(target_os = "windows")]
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        on_tray_click();
    }
}

#[cfg(target_os = "windows")]
fn on_tray_click() {
    let event = match get("tray_click_event") {
        Some(v) => v.as_str().unwrap().to_string(),
        None => {
            set("tray_click_event", "config");
            "config".to_string()
        }
    };
    match event.as_str() {
        "config" => config_window(),
        "translate" => input_translate(),
        "ocr_recognize" => ocr_recognize(),
        "ocr_translate" => ocr_translate(),
        "disable" => {}
        _ => config_window(),
    }
}

fn on_input_translate_click() {
    input_translate();
}

fn on_clipboard_monitor_click(app: &AppHandle) {
    let enable_clipboard_monitor = match get("clipboard_monitor") {
        Some(v) => v.as_bool().unwrap(),
        None => {
            set("clipboard_monitor", false);
            false
        }
    };
    let current = !enable_clipboard_monitor;

    set("clipboard_monitor", current);
    let state = app.state::<ClipboardMonitorEnableWrapper>();
    state
        .0
        .lock()
        .unwrap()
        .replace_range(.., &current.to_string());
    if current {
        start_clipboard_monitor(app.clone());
    }
    update_tray(app.clone(), "".to_string(), "".to_string());
}

fn on_auto_copy_click(app: &AppHandle, mode: &str) {
    info!("Set copy mode to: {}", mode);
    set("translate_auto_copy", mode);
    app.emit("translate_auto_copy_changed", mode).unwrap();
    update_tray(app.clone(), "".to_string(), mode.to_string());
}

fn on_ocr_recognize_click() {
    ocr_recognize();
}

fn on_ocr_translate_click() {
    ocr_translate();
}

fn on_config_click() {
    config_window();
}

fn on_check_update_click() {
    updater_window();
}

fn on_view_log_click(app: &AppHandle) {
    let log_path = app.path().app_log_dir().unwrap();
    app.opener()
        .open_path(log_path.to_string_lossy().to_string(), None::<&str>)
        .unwrap();
}

fn on_restart_click(app: &AppHandle) {
    info!("============== Restart App ==============");
    let _ = app.global_shortcut().unregister_all();
    match std::env::current_exe() {
        Ok(exe) => {
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                let command = format!(
                    "timeout /T 2 /NOBREAK >NUL & start \"\" \"{}\"",
                    exe.to_string_lossy()
                );
                let _ = std::process::Command::new("cmd")
                    .creation_flags(0x08000000)
                    .args(["/C", &command])
                    .spawn();
            }

            #[cfg(not(target_os = "windows"))]
            {
                let command = format!("sleep 2; \"{}\"", exe.to_string_lossy());
                let _ = std::process::Command::new("sh")
                    .args(["-c", &command])
                    .spawn();
            }
            app.exit(0);
        }
        Err(e) => {
            warn!("Failed to resolve current executable for restart: {}", e);
            app.request_restart();
        }
    }
}

fn on_quit_click(app: &AppHandle) {
    let _ = app.global_shortcut().unregister_all();
    info!("============== Quit App ==============");
    app.exit(0);
}

fn item(app: &AppHandle, id: &str, text: &str) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, id, text, true, None::<&str>)
}

fn check_item(
    app: &AppHandle,
    id: &str,
    text: &str,
    checked: bool,
) -> tauri::Result<CheckMenuItem<Wry>> {
    CheckMenuItem::with_id(app, id, text, true, checked, None::<&str>)
}

fn build_tray_menu(
    app: &AppHandle,
    copy_mode: &str,
    clipboard_monitor_checked: bool,
    labels: TrayLabels,
) -> tauri::Result<Menu<Wry>> {
    let input_translate = item(app, "input_translate", labels.input_translate)?;
    let clipboard_monitor = check_item(
        app,
        "clipboard_monitor",
        labels.clipboard_monitor,
        clipboard_monitor_checked,
    )?;
    let copy_source = check_item(
        app,
        "copy_source",
        labels.copy_source,
        copy_mode == "source",
    )?;
    let copy_target = check_item(
        app,
        "copy_target",
        labels.copy_target,
        copy_mode == "target",
    )?;
    let copy_source_target = check_item(
        app,
        "copy_source_target",
        labels.copy_source_target,
        copy_mode == "source_target",
    )?;
    let copy_disable = check_item(
        app,
        "copy_disable",
        labels.copy_disable,
        copy_mode == "disable",
    )?;
    let ocr_recognize = item(app, "ocr_recognize", labels.ocr_recognize)?;
    let ocr_translate = item(app, "ocr_translate", labels.ocr_translate)?;
    let config = item(app, "config", labels.config)?;
    let check_update = item(app, "check_update", labels.check_update)?;
    let view_log = item(app, "view_log", labels.view_log)?;
    let restart = item(app, "restart", labels.restart)?;
    let quit = item(app, "quit", labels.quit)?;

    let copy_separator = PredefinedMenuItem::separator(app)?;
    let auto_copy = Submenu::with_items(
        app,
        labels.auto_copy,
        true,
        &[
            &copy_source,
            &copy_target,
            &copy_source_target,
            &copy_separator,
            &copy_disable,
        ],
    )?;
    let action_separator = PredefinedMenuItem::separator(app)?;
    let config_separator = PredefinedMenuItem::separator(app)?;
    let quit_separator = PredefinedMenuItem::separator(app)?;

    Menu::with_items(
        app,
        &[
            &input_translate,
            &clipboard_monitor,
            &auto_copy,
            &action_separator,
            &ocr_recognize,
            &ocr_translate,
            &config_separator,
            &config,
            &check_update,
            &view_log,
            &quit_separator,
            &restart,
            &quit,
        ],
    )
}

fn tray_menu_en(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "Input Translate",
            clipboard_monitor: "Clipboard Monitor",
            auto_copy: "Auto Copy",
            copy_source: "Source",
            copy_target: "Target",
            copy_source_target: "Source+Target",
            copy_disable: "Disable",
            ocr_recognize: "OCR Recognize",
            ocr_translate: "OCR Translate",
            config: "Config",
            check_update: "Check Update",
            view_log: "View Log",
            restart: "Restart",
            quit: "Quit",
        },
    )
}

fn tray_menu_zh_cn(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "输入翻译",
            clipboard_monitor: "监听剪切板",
            auto_copy: "自动复制",
            copy_source: "原文",
            copy_target: "译文",
            copy_source_target: "原文+译文",
            copy_disable: "关闭",
            ocr_recognize: "文字识别",
            ocr_translate: "截图翻译",
            config: "偏好设置",
            check_update: "检查更新",
            view_log: "查看日志",
            restart: "重启应用",
            quit: "退出",
        },
    )
}

fn tray_menu_zh_tw(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "輸入翻譯",
            clipboard_monitor: "偵聽剪貼簿",
            auto_copy: "自動複製",
            copy_source: "原文",
            copy_target: "譯文",
            copy_source_target: "原文+譯文",
            copy_disable: "關閉",
            ocr_recognize: "文字識別",
            ocr_translate: "截圖翻譯",
            config: "偏好設定",
            check_update: "檢查更新",
            view_log: "查看日誌",
            restart: "重啓程式",
            quit: "退出",
        },
    )
}

fn tray_menu_ja(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "翻訳を入力",
            clipboard_monitor: "クリップボードを監視する",
            auto_copy: "自動コピー",
            copy_source: "原文",
            copy_target: "訳文",
            copy_source_target: "原文+訳文",
            copy_disable: "閉じる",
            ocr_recognize: "テキスト認識",
            ocr_translate: "スクリーンショットの翻訳",
            config: "プリファレンス設定",
            check_update: "更新を確認する",
            view_log: "ログを見る",
            restart: "アプリの再起動",
            quit: "退出する",
        },
    )
}

fn tray_menu_ko(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "입력 번역",
            clipboard_monitor: "감청 전단판",
            auto_copy: "자동 복사",
            copy_source: "원문",
            copy_target: "번역문",
            copy_source_target: "원문+번역문",
            copy_disable: "닫기",
            ocr_recognize: "문자인식",
            ocr_translate: "스크린샷 번역",
            config: "기본 설정",
            check_update: "업데이트 확인",
            view_log: "로그 보기",
            restart: "응용 프로그램 다시 시작",
            quit: "퇴출",
        },
    )
}

fn tray_menu_fr(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "Traduction d'entrée",
            clipboard_monitor: "Surveiller le presse-papiers",
            auto_copy: "Copier automatiquement",
            copy_source: "Source",
            copy_target: "Cible",
            copy_source_target: "Source+Cible",
            copy_disable: "Désactiver",
            ocr_recognize: "Reconnaissance de texte",
            ocr_translate: "Traduction d'image",
            config: "Paramètres",
            check_update: "Vérifier les mises à jour",
            view_log: "Voir le journal",
            restart: "Redémarrer l'application",
            quit: "Quitter",
        },
    )
}

fn tray_menu_de(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "Eingabeübersetzung",
            clipboard_monitor: "Zwischenablage überwachen",
            auto_copy: "Automatisch kopieren",
            copy_source: "Quelle",
            copy_target: "Ziel",
            copy_source_target: "Quelle+Ziel",
            copy_disable: "Deaktivieren",
            ocr_recognize: "Texterkennung",
            ocr_translate: "Bildübersetzung",
            config: "Einstellungen",
            check_update: "Auf Updates prüfen",
            view_log: "Protokoll anzeigen",
            restart: "Anwendung neu starten",
            quit: "Beenden",
        },
    )
}

fn tray_menu_ru(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "Ввод перевода",
            clipboard_monitor: "Следить за буфером обмена",
            auto_copy: "Автоматическое копирование",
            copy_source: "Источник",
            copy_target: "Цель",
            copy_source_target: "Источник+Цель",
            copy_disable: "Отключить",
            ocr_recognize: "Распознавание текста",
            ocr_translate: "Перевод изображения",
            config: "Настройки",
            check_update: "Проверить обновления",
            view_log: "Просмотр журнала",
            restart: "Перезапустить приложение",
            quit: "Выход",
        },
    )
}

fn tray_menu_fa(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "متن",
            clipboard_monitor: "گوش دادن به تخته برش",
            auto_copy: "کپی خودکار",
            copy_source: "منبع",
            copy_target: "هدف",
            copy_source_target: "منبع + هدف",
            copy_disable: "متن",
            ocr_recognize: "تشخیص متن",
            ocr_translate: "ترجمه عکس",
            config: "تنظیمات ترجیح",
            check_update: "بررسی بروزرسانی",
            view_log: "مشاهده گزارشات",
            restart: "راه‌اندازی مجدد برنامه",
            quit: "خروج",
        },
    )
}

fn tray_menu_pt_br(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "Traduzir Entrada",
            clipboard_monitor: "Monitorando a área de transferência",
            auto_copy: "Copiar Automaticamente",
            copy_source: "Origem",
            copy_target: "Destino",
            copy_source_target: "Origem+Destino",
            copy_disable: "Desabilitar",
            ocr_recognize: "Reconhecimento de Texto",
            ocr_translate: "Tradução de Imagem",
            config: "Configurações",
            check_update: "Checar por Atualização",
            view_log: "Exibir Registro",
            restart: "Reiniciar aplicativo",
            quit: "Sair",
        },
    )
}

fn tray_menu_uk(app: &AppHandle, copy_mode: &str, clipboard_monitor: bool) -> tauri::Result<Menu<Wry>> {
    build_tray_menu(
        app,
        copy_mode,
        clipboard_monitor,
        TrayLabels {
            input_translate: "Введення перекладу",
            clipboard_monitor: "Стежити за буфером обміну",
            auto_copy: "Автоматичне копіювання",
            copy_source: "Джерело",
            copy_target: "Мета",
            copy_source_target: "Джерело+Мета",
            copy_disable: "Відключивши",
            ocr_recognize: "Розпізнавання тексту",
            ocr_translate: "Переклад зображення",
            config: "Настройка",
            check_update: "Перевірити оновлення",
            view_log: "Перегляд журналу",
            restart: "Перезапустити додаток",
            quit: "Вихід",
        },
    )
}
