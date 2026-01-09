use tauri::{Manager, WebviewUrl};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use tauri_nspanel::{
  tauri_panel,
  ManagerExt,
  PanelBuilder,
  PanelLevel,
  CollectionBehavior,
};

tauri_panel! {
  panel!(LauncherPanel {
    config: {
      can_become_key_window: true,
      is_floating_panel: true
    }
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_nspanel::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      // URL cho panel:
      // - dev: load từ Vite dev server
      // - build: load từ file trong bundle (index.html)
      let url = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:1420".parse().unwrap())
      } else {
        WebviewUrl::App("index.html".into())
      };

      // Tạo NSPanel
      let panel = PanelBuilder::<_, LauncherPanel>::new(app.handle(), "launcher")
        .url(url)
        .level(PanelLevel::Floating) // nổi trên window thường
        .collection_behavior(
          CollectionBehavior::new()
            .can_join_all_spaces()
            .full_screen_auxiliary() // ✅ chìa khóa để đè lên green-button fullscreen
            .ignores_cycle()
        )
        .no_activate(true) // đỡ “giật focus” lúc tạo panel
        .with_window(|w| {
          w.decorations(false)
            .resizable(false)
            .always_on_top(true)
            .visible(false) // start hidden
        })
        .build()?;

      // Hotkey toggle
      let shortcut = "Command+Shift+Space";
      app.global_shortcut().on_shortcut(shortcut, move |handle, _s, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }

        if let Ok(panel) = handle.get_webview_panel("launcher") {
            let visible = panel.is_visible();

            if visible {
            panel.hide();
            } else {
            panel.show_and_make_key();
            }
        }
        })?;


      // nếu muốn: panel.hide(); // đã visible(false) rồi

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
