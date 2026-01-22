use tauri::{Manager, WebviewUrl, LogicalPosition, LogicalSize, Size, Position};
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
      let url = if cfg!(debug_assertions) {
        WebviewUrl::External("http://localhost:1420".parse().unwrap())
      } else {
        WebviewUrl::App("index.html".into())
      };

      let panel_w: f64 = 375.0;
      let panel_h: f64 = 720.0;
      let top_offset: f64 = 80.0;
      let right_margin: f64 = 16.0;

      let _panel = PanelBuilder::<_, LauncherPanel>::new(app.handle(), "launcher")
        .url(url)
        .level(PanelLevel::Floating)
        .collection_behavior(
          CollectionBehavior::new()
            .can_join_all_spaces()
            .full_screen_auxiliary()
            .ignores_cycle()
        )
        .no_activate(true)
        .with_window(|w| {
          w.decorations(false)
            .resizable(false)
            .always_on_top(true)
            .visible(false) // start hidden
        })
        .build()?;

      let apply_layout = move |handle: &tauri::AppHandle| {
        if let Some(win) = handle.get_webview_window("launcher") {
          let _ = win.set_size(Size::Logical(LogicalSize::new(panel_w, panel_h)));

          let monitor = win.current_monitor().ok().flatten()
            .or_else(|| win.primary_monitor().ok().flatten());

          if let Some(m) = monitor {
            let ms = m.size();
            let mp = m.position();
            let sf = m.scale_factor();

            let mon_x = mp.x as f64 / sf;
            let mon_y = mp.y as f64 / sf;
            let screen_w = ms.width as f64 / sf;
            // let screen_h = ms.height as f64 / sf;

            let x = mon_x + screen_w - panel_w - right_margin;
            let y = mon_y + top_offset;

            let _ = win.set_position(Position::Logical(LogicalPosition::new(x, y)));
          }
        }
      };

      let shortcuts = ["Command+Shift+Space", "Option+Space"];

      for shortcut in shortcuts {
        let apply_layout = apply_layout.clone();

        app.global_shortcut().on_shortcut(shortcut, move |handle, _s, event| {
          if event.state() != ShortcutState::Pressed {
            return;
          }

          if let Ok(panel) = handle.get_webview_panel("launcher") {
            if panel.is_visible() {
              panel.hide();
            } else {
              // set before show
              apply_layout(handle);
              panel.show_and_make_key();
              // set again after show to prevent “jump to center”
              apply_layout(handle);
            }
          }
        })?;
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
