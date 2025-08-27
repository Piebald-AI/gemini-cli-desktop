use crate::state::AppState;
use backend::{
    DirEntry, EnrichedProject, GeminiAuthConfig, GitInfo, ProcessStatus, ProjectsResponse,
    QwenConfig, RecentChat, SearchFilters, SearchResult,
};
use serde_json::Value;
use tauri::{AppHandle, State};

#[cfg(windows)]
#[allow(clippy::unreadable_literal)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn check_cli_installed(state: State<'_, AppState>) -> Result<bool, String> {
    state
        .backend
        .check_cli_installed()
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn start_session(
    session_id: String,
    working_directory: Option<String>,
    model: Option<String>,
    backend_config: Option<QwenConfig>,
    gemini_auth: Option<GeminiAuthConfig>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if let Some(working_directory) = working_directory {
        let model = model.unwrap_or_else(|| "gemini-2.0-flash-exp".to_string());
        state
            .backend
            .initialize_session(
                session_id,
                working_directory,
                model,
                backend_config,
                gemini_auth,
            )
            .await
            .map_err(|e| format!("{e:#}"))
    } else {
        // Skip CLI check if using Qwen backend
        if backend_config.is_some() {
            Ok(())
        } else {
            Err("Failed to get backend config".to_string())
        }
    }
}

#[tauri::command]
pub async fn send_message(
    session_id: String,
    message: String,
    conversation_history: String,
    model: Option<String>,
    _app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let _ = model;
    state
        .backend
        .send_message(session_id, message, conversation_history)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn test_gemini_command() -> Result<String, String> {
    test_cli_command("gemini".to_string()).await
}

#[tauri::command]
pub async fn test_cli_command(cli_name: String) -> Result<String, String> {
    use tokio::process::Command;
    let output = {
        #[cfg(windows)]
        {
            Command::new("cmd.exe")
                .args(["/C", &cli_name, "--help"])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .await
                .map_err(|e| format!("Failed to run {cli_name} --help via cmd: {e}"))?
        }
        #[cfg(not(windows))]
        {
            Command::new("sh")
                .args(["-lc", &format!("{cli_name} --help")])
                .output()
                .await
                .map_err(|e| format!("Failed to run {cli_name} --help via shell: {e}"))?
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    Ok(format!(
        "Running '{cli_name} --help' via shell\nExit code: {}\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}",
        output.status.code().unwrap_or(-1),
    ))
}

#[tauri::command]
pub async fn get_process_statuses(
    state: State<'_, AppState>,
) -> Result<Vec<ProcessStatus>, String> {
    state
        .backend
        .get_process_statuses()
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn kill_process(
    conversation_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .backend
        .kill_process(&conversation_id)
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn send_tool_call_confirmation_response(
    session_id: String,
    request_id: u32,
    tool_call_id: String,
    outcome: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .backend
        .handle_tool_confirmation(session_id, request_id, tool_call_id, outcome)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn execute_confirmed_command(
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .backend
        .execute_confirmed_command(command)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn generate_conversation_title(
    message: String,
    model: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .backend
        .generate_conversation_title(message, model)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn validate_directory(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .backend
        .validate_directory(path)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn is_home_directory(path: String, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .backend
        .is_home_directory(path)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn get_home_directory(state: State<'_, AppState>) -> Result<String, String> {
    state
        .backend
        .get_home_directory()
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn get_parent_directory(
    path: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state
        .backend
        .get_parent_directory(path)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn list_directory_contents(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<DirEntry>, String> {
    state
        .backend
        .list_directory_contents(path)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn list_files_recursive(
    path: String,
    _max_depth: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<DirEntry>, String> {
    state
        .backend
        .list_files_recursive(path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_volumes(state: State<'_, AppState>) -> Result<Vec<DirEntry>, String> {
    state
        .backend
        .list_volumes()
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn get_git_info(
    path: String,
    state: State<'_, AppState>,
) -> Result<Option<GitInfo>, String> {
    state
        .backend
        .get_git_info(path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_chats(state: State<'_, AppState>) -> Result<Vec<RecentChat>, String> {
    state
        .backend
        .get_recent_chats()
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn search_chats(
    query: String,
    filters: Option<SearchFilters>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    state
        .backend
        .search_chats(query, filters)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn list_projects(
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, AppState>,
) -> Result<ProjectsResponse, String> {
    let lim = limit.unwrap_or(25);
    let off = offset.unwrap_or(0);
    state
        .backend
        .list_projects(lim, off)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn list_enriched_projects(
    state: State<'_, AppState>,
) -> Result<Vec<EnrichedProject>, String> {
    state
        .backend
        .list_enriched_projects()
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn get_project(
    sha256: String,
    external_root_path: String,
    state: State<'_, AppState>,
) -> Result<EnrichedProject, String> {
    state
        .backend
        .get_enriched_project(sha256, external_root_path)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn get_project_discussions(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<RecentChat>, String> {
    state
        .backend
        .get_project_discussions(&project_id)
        .await
        .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn debug_environment() -> Result<String, String> {
    async fn test_cli_version(cli_name: &str) -> String {
        {
            #[cfg(windows)]
            {
                match tokio::process::Command::new("cmd.exe")
                    .args(["/C", cli_name, "--version"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output()
                    .await
                {
                    Ok(output) if output.status.success() => {
                        format!(
                            "{cli_name} available via shell: {}",
                            String::from_utf8_lossy(&output.stdout).trim()
                        )
                    }
                    Ok(output) => {
                        format!(
                            "{cli_name} shell test failed: {}",
                            String::from_utf8_lossy(&output.stderr)
                        )
                    }
                    Err(e) => format!("{cli_name} shell execution failed: {e}"),
                }
            }
            #[cfg(not(windows))]
            {
                match tokio::process::Command::new("sh")
                    .args(["-lc", &format!("{cli_name} --version")])
                    .output()
                    .await
                {
                    Ok(output) if output.status.success() => {
                        format!(
                            "{cli_name} available via shell: {}",
                            String::from_utf8_lossy(&output.stdout).trim()
                        )
                    }
                    Ok(output) => {
                        format!(
                            "{cli_name} shell test failed: {}",
                            String::from_utf8_lossy(&output.stderr)
                        )
                    }
                    Err(e) => format!("{cli_name} shell execution failed: {e}"),
                }
            }
        }
    }

    let path = std::env::var("PATH").unwrap_or_else(|_| "PATH not found".to_string());
    let home = std::env::var("HOME").unwrap_or_else(|_| {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "HOME not found".to_string())
    });

    let gemini_result = test_cli_version("gemini").await;
    let qwen_result = test_cli_version("qwen").await;

    let system_path = {
        #[cfg(windows)]
        {
            match tokio::process::Command::new("cmd.exe")
                .args(["/c", "echo %PATH%"])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .await
            {
                Ok(output) => String::from_utf8_lossy(&output.stdout).to_string(),
                Err(e) => format!("Failed to get system PATH: {e}"),
            }
        }
        #[cfg(not(windows))]
        {
            "Not Windows".to_string()
        }
    };

    Ok(format!(
        "Current PATH (from Tauri app):\n{}\n\nSystem PATH (from cmd):\n{}\n\nHOME: {}\n\nCLI test results:\nGemini: {}\nQwen: {}",
        path.replace(';', ";\n").replace(':', ":\n"),
        system_path.replace(';', ";\n").replace(':', ":\n"),
        home,
        gemini_result,
        qwen_result
    ))
}

// Settings.json File Management Commands

#[tauri::command]
pub async fn get_settings_file_path(backend_type: Option<String>) -> Result<String, String> {
    // Try to get the settings file path
    let home_dir = dirs::home_dir().ok_or_else(|| "Unable to find home directory".to_string())?;

    let dir_name = match backend_type.as_deref() {
        Some("qwen") => ".qwen",
        _ => ".gemini", // Default to .gemini for other backends or when not specified
    };

    let settings_path = home_dir.join(dir_name).join("settings.json");

    Ok(settings_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn read_settings_file(backend_type: Option<String>) -> Result<Value, String> {
    use std::fs;

    let home_dir = dirs::home_dir().ok_or_else(|| "Unable to find home directory".to_string())?;

    let dir_name = match backend_type.as_deref() {
        Some("qwen") => ".qwen",
        _ => ".gemini", // Default to .gemini for other backends or when not specified
    };

    let settings_path = home_dir.join(dir_name).join("settings.json");

    if !settings_path.exists() {
        // Return empty settings structure if file doesn't exist
        return Ok(serde_json::json!({
            "mcpServers": {}
        }));
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {e}"))?;

    let settings: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings JSON: {e}"))?;

    Ok(settings)
}

#[tauri::command]
pub async fn write_settings_file(
    settings: Value,
    backend_type: Option<String>,
) -> Result<(), String> {
    use std::fs;

    let home_dir = dirs::home_dir().ok_or_else(|| "Unable to find home directory".to_string())?;

    let dir_name = match backend_type.as_deref() {
        Some("qwen") => ".qwen",
        _ => ".gemini", // Default to .gemini for other backends or when not specified
    };

    let config_dir = home_dir.join(dir_name);
    let settings_path = config_dir.join("settings.json");

    // Create config directory if it doesn't exist
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create {dir_name} directory: {e}"))?;
    }

    // Pretty-print the JSON
    let formatted_json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;

    fs::write(&settings_path, formatted_json)
        .map_err(|e| format!("Failed to write settings file: {e}"))?;

    Ok(())
}
