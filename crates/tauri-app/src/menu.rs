use tauri::AppHandle;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuLabels {
    pub file: String,
    pub view: String,
    pub help: String,
    pub home: String,
    pub projects: String,
    pub mcp_servers: String,
    pub toggle_dark_mode: String,
    pub refresh: String,
    pub about: String,
}

impl Default for MenuLabels {
    fn default() -> Self {
        Self {
            file: "File".into(),
            view: "View".into(),
            help: "Help".into(),
            home: "Home".into(),
            projects: "Projects".into(),
            mcp_servers: "MCP Servers".into(),
            toggle_dark_mode: "Toggle Dark Mode".into(),
            refresh: "Refresh".into(),
            about: "About".into(),
        }
    }
}

pub fn create_app_menu(app: &AppHandle, labels: &MenuLabels) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let menu = MenuBuilder::new(app);
    
    // On macOS, the first submenu becomes the application submenu by default
    // and all items must be in submenus (top-level items are ignored)
    #[cfg(target_os = "macos")]
    {
        // About submenu (becomes the application menu on macOS)
        let about_menu = SubmenuBuilder::new(app, "About")
            .item(&MenuItemBuilder::with_id("about", &labels.about)
                .build(app)?)
            .build()?;

        // File Menu
        let file_menu = SubmenuBuilder::new(app, &labels.file)
            .item(&MenuItemBuilder::with_id("home", &labels.home)
                .accelerator("Cmd+H")
                .build(app)?)
            .item(&MenuItemBuilder::with_id("projects", &labels.projects)
                .accelerator("Cmd+P")
                .build(app)?)
            .item(&MenuItemBuilder::with_id("mcp_servers", &labels.mcp_servers)
                .accelerator("Cmd+M")
                .build(app)?)
            .build()?;

        // View Menu  
        let view_menu = SubmenuBuilder::new(app, &labels.view)
            .item(&MenuItemBuilder::with_id("toggle_theme", &labels.toggle_dark_mode)
                .build(app)?)
            .separator()
            .item(&MenuItemBuilder::with_id("refresh", &labels.refresh)
                .accelerator("F5")
                .build(app)?)
            .build()?;

        let final_menu = menu
            .item(&about_menu)  // First submenu becomes app menu
            .item(&file_menu)
            .item(&view_menu)
            .build()?;
        Ok(final_menu)
    }
    
    // Linux/Windows menu structure
    #[cfg(not(target_os = "macos"))]
    {
        // File Menu
        let file_menu = SubmenuBuilder::new(app, &labels.file)
            .item(&MenuItemBuilder::with_id("home", &labels.home)
                .accelerator("Ctrl+H")
                .build(app)?)
            .item(&MenuItemBuilder::with_id("projects", &labels.projects)
                .accelerator("Ctrl+P")
                .build(app)?)
            .item(&MenuItemBuilder::with_id("mcp_servers", &labels.mcp_servers)
                .accelerator("Ctrl+M")
                .build(app)?)
            .build()?;

        // View Menu  
        let view_menu = SubmenuBuilder::new(app, &labels.view)
            .item(&MenuItemBuilder::with_id("toggle_theme", &labels.toggle_dark_mode)
                .build(app)?)
            .separator()
            .item(&MenuItemBuilder::with_id("refresh", &labels.refresh)
                .accelerator("F5")
                .build(app)?)
            .build()?;

        // Help Menu (keeps About item on Linux)
        let help_menu = SubmenuBuilder::new(app, &labels.help)
            .item(&MenuItemBuilder::with_id("about", &labels.about)
                .build(app)?)
            .build()?;

        Ok(menu
            .item(&file_menu)
            .item(&view_menu)
            .item(&help_menu)
            .build()?)
    }
}

#[tauri::command]
pub fn update_menu_labels(app: AppHandle, labels: MenuLabels) -> Result<(), String> {
    // Use the same platform-specific logic as create_app_menu
    let menu = create_app_menu(&app, &labels).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn init_menu(app: AppHandle) -> Result<(), String> {
    // Initialize with default English labels
    let menu = create_app_menu(&app, &MenuLabels::default()).map_err(|e| e.to_string())?;
    app.set_menu(menu).map_err(|e| e.to_string())?;
    Ok(())
}