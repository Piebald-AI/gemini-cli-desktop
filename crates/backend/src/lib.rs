// Module declarations
pub mod acp;
pub mod cli;
pub mod events;
pub mod filesystem;
pub mod projects;
pub mod rpc;
pub mod search;
pub mod security;
pub mod session;

// Test utilities (only available in test builds)
#[cfg(test)]
pub mod test_utils;

// Re-exports
pub use acp::{
    AuthenticateParams, ContentBlock, InitializeParams, InitializeResult, Location,
    PermissionOutcome, PermissionResult, SessionNewParams, SessionNewResult, SessionPromptParams,
    SessionPromptResult, SessionRequestPermissionParams, SessionUpdate, SessionUpdateParams,
    ToolCallContentItem, ToolCallKind, ToolCallStatus,
};
pub use cli::{AssistantChunk, CommandResult, MessageChunk, StreamAssistantMessageChunkParams};
pub use events::{
    CliIoPayload,
    CliIoType,
    ErrorPayload,
    EventEmitter,
    GeminiOutputPayload,
    GeminiThoughtPayload,
    InternalEvent,
    // Legacy tool call types - kept for compatibility during ACP transition
    ToolCallConfirmation,
    ToolCallConfirmationContent,
    ToolCallConfirmationRequest,
    ToolCallEvent,
    ToolCallLocation,
    ToolCallUpdate,
};
pub use filesystem::{DirEntry, VolumeType};
pub use projects::{
    EnrichedProject, ProjectListItem, ProjectMetadata, ProjectMetadataView, ProjectsResponse,
    TouchThrottle, ensure_project_metadata, list_enriched_projects, list_projects,
    make_enriched_project, maybe_touch_updated_at,
};
pub use rpc::{JsonRpcError, JsonRpcRequest, JsonRpcResponse, RpcLogger};
pub use search::{MessageMatch, RecentChat, SearchFilters, SearchResult};
pub use security::{execute_terminal_command, is_command_safe};
pub use session::{
    GeminiAuthConfig, PersistentSession, ProcessStatus, QwenConfig, SessionManager,
    initialize_session,
};
// Standard library imports
use anyhow::{Context, Result};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::process::Command;

/// Main backend interface for Gemini CLI functionality
pub struct GeminiBackend<E: EventEmitter> {
    emitter: E,
    session_manager: SessionManager,
    next_request_id: Arc<Mutex<u32>>,
    touch_throttle: TouchThrottle,
}

impl<E: EventEmitter + 'static> GeminiBackend<E> {
    /// Create a new GeminiBackend instance
    pub fn new(emitter: E) -> Self {
        Self {
            emitter,
            session_manager: SessionManager::new(),
            next_request_id: Arc::new(Mutex::new(1000)),
            touch_throttle: TouchThrottle::new(Duration::from_secs(60)),
        }
    }

    // =====================================
    // Event Helper Methods
    // =====================================

    /// Emit CLI I/O event
    pub fn emit_cli_io(
        &self,
        session_id: &str,
        io_type: CliIoType,
        data: &str,
    ) -> Result<()> {
        let payload = CliIoPayload {
            io_type,
            data: data.to_string(),
        };
        self.emitter.emit(&format!("cli-io-{session_id}"), payload)
            .context("Failed to emit CLI I/O event")
    }

    /// Emit Gemini output event
    pub fn emit_gemini_output(&self, session_id: &str, text: &str) -> Result<()> {
        let payload = GeminiOutputPayload {
            text: text.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-output-{session_id}"), payload)
            .context("Failed to emit Gemini output event")
    }

    /// Emit Gemini thought event
    pub fn emit_gemini_thought(&self, session_id: &str, thought: &str) -> Result<()> {
        let payload = GeminiThoughtPayload {
            thought: thought.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-thought-{session_id}"), payload)
            .context("Failed to emit Gemini thought event")
    }

    /// Emit tool call event
    pub fn emit_tool_call(&self, session_id: &str, tool_call: &ToolCallEvent) -> Result<()> {
        self.emitter
            .emit(&format!("gemini-tool-call-{session_id}"), tool_call.clone())
            .context("Failed to emit tool call event")
    }

    /// Emit tool call update event
    pub fn emit_tool_call_update(
        &self,
        session_id: &str,
        update: &ToolCallUpdate,
    ) -> Result<()> {
        self.emitter.emit(
            &format!("gemini-tool-call-update-{session_id}"),
            update.clone(),
        )
        .context("Failed to emit tool call update event")
    }

    /// Emit tool call confirmation event
    pub fn emit_tool_call_confirmation(
        &self,
        session_id: &str,
        confirmation: &ToolCallConfirmationRequest,
    ) -> Result<()> {
        self.emitter.emit(
            &format!("gemini-tool-call-confirmation-{session_id}"),
            confirmation.clone(),
        )
        .context("Failed to emit tool call confirmation event")
    }

    /// Emit error event
    pub fn emit_error(&self, session_id: &str, error: &str) -> Result<()> {
        let payload = ErrorPayload {
            error: error.to_string(),
        };
        self.emitter
            .emit(&format!("gemini-error-{session_id}"), payload)
            .context("Failed to emit error event")
    }

    /// Emit command result event
    pub fn emit_command_result(&self, result: &CommandResult) -> Result<()> {
        self.emitter.emit("command-result", result.clone())
            .context("Failed to emit command result event")
    }

    /// Check if Gemini CLI is installed and available
    pub async fn check_cli_installed(&self) -> Result<bool> {
        let result = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "gemini", "--version"])
                .output()
                .await
        } else {
            Command::new("sh")
                .args(["-c", "gemini --version"])
                .output()
                .await
        };

        match result {
            Ok(output) => Ok(output.status.success()),
            Err(_) => Ok(false),
        }
    }

    /// Initialize a new Gemini CLI session
    pub async fn initialize_session(
        &self,
        session_id: String,
        working_directory: String,
        model: String,
        backend_config: Option<QwenConfig>,
        gemini_auth: Option<GeminiAuthConfig>,
    ) -> Result<()> {
        {
            let processes = self.session_manager.get_processes();
            if let Ok(guard) = processes.lock()
                && let Some(existing) = guard.get(&session_id)
                && existing.is_alive
            {
                return Ok(());
            }
        }

        let (_message_tx, _rpc_logger) = initialize_session(
            session_id,
            working_directory,
            model,
            backend_config,
            gemini_auth,
            self.emitter.clone(),
            &self.session_manager,
        )
        .await?;
        Ok(())
    }

    /// Send a message to an existing session
    pub async fn send_message(
        &self,
        session_id: String,
        message: String,
        _conversation_history: String,
    ) -> Result<()> {
        println!("📤 Sending message to session: {session_id}");

        let (message_sender, acp_session_id) = {
            let processes = self.session_manager.get_processes();
            let processes = processes.lock()
                .context("Failed to lock processes")?;

            if let Some(session) = processes.get(&session_id) {
                (
                    session.message_sender.clone(),
                    session.acp_session_id.clone(),
                )
            } else {
                anyhow::bail!("Session not found: {}", session_id);
            }
        };

        let message_sender = message_sender
            .context("No message sender available")?;

        let acp_session_id = acp_session_id
            .context("No ACP session ID available")?;

        // Create ACP prompt content blocks
        let prompt_blocks = vec![ContentBlock::Text { text: message }];

        let prompt_params = SessionPromptParams {
            session_id: acp_session_id,
            prompt: prompt_blocks,
        };

        let request_id = {
            let mut id_guard = self.next_request_id.lock().unwrap();
            let id = *id_guard;
            *id_guard += 1;
            id
        };

        let prompt_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: request_id,
            method: "session/prompt".to_string(),
            params: serde_json::to_value(prompt_params)
                .context("Failed to serialize prompt parameters")?,
        };

        let request_json = serde_json::to_string(&prompt_request)
            .context("Failed to serialize prompt request")?;

        message_sender
            .send(request_json)
            .context("Failed to send message through channel")?;

        println!("✅ ACP session/prompt sent to session: {session_id}");
        Ok(())
    }

    /// Handle tool call confirmation response
    pub async fn handle_tool_confirmation(
        &self,
        acp_session_id: String,
        request_id: u32,
        tool_call_id: String,
        outcome: String,
    ) -> Result<()> {
        // Find the conversation ID that corresponds to this ACP session ID
        let conversation_id = {
            let processes = self.session_manager.get_processes();
            let processes = processes.lock()
                .context("Failed to lock processes")?;

            let mut found_conversation_id = None;
            for (conv_id, session) in processes.iter() {
                if let Some(session_acp_id) = &session.acp_session_id
                    && session_acp_id == &acp_session_id
                {
                    found_conversation_id = Some(conv_id.clone());
                    break;
                }
            }

            found_conversation_id
                .context(format!("No conversation found for ACP session ID: {acp_session_id}"))?
        };

        // Convert outcome string to ACP PermissionOutcome
        let permission_outcome = match outcome.as_str() {
            "proceed_once"
            | "proceed_always"
            | "proceed_always_server"
            | "proceed_always_tool"
            | "modify_with_editor" => PermissionOutcome::Selected {
                option_id: outcome.clone(),
            },
            "cancel" => PermissionOutcome::Cancelled,
            _ => PermissionOutcome::Selected {
                option_id: outcome.clone(),
            },
        };

        let response_data = PermissionResult {
            outcome: permission_outcome,
        };

        session::send_response_to_cli(
            &conversation_id,
            request_id,
            Some(
                serde_json::to_value(response_data)
                    .context("Failed to serialize response data")?,
            ),
            None,
            self.session_manager.get_processes(),
        )
        .await;

        // Create content items for the completed tool call
        let content_items = vec![ToolCallContentItem::Content {
            content: ContentBlock::Text {
                text: "Tool call completed after user confirmation".to_string(),
            },
        }];

        // Create ACP SessionUpdate instead of legacy ToolCallUpdate
        let session_update = SessionUpdate::ToolCallUpdate {
            tool_call_id: tool_call_id.clone(),
            status: ToolCallStatus::Completed,
            content: content_items,
        };

        // Emit ACP session update event - use the conversation_id (frontend conversation ID), not ACP session ID
        let emit_result = self.emitter.emit(
            &format!("acp-session-update-{conversation_id}"),
            session_update,
        );
        emit_result?;
        Ok(())
    }

    /// Execute a confirmed command
    pub async fn execute_confirmed_command(&self, command: String) -> Result<String> {
        println!("🖥️ Executing confirmed command: {command}");

        match execute_terminal_command(&command).await {
            Ok(output) => {
                println!("✅ Command executed successfully");

                let _ = self.emit_command_result(&CommandResult {
                    command: command.clone(),
                    success: true,
                    output: Some(output.clone()),
                    error: None,
                });

                Ok(output)
            }
            Err(error) => {
                println!("❌ Command execution failed: {error}");

                let _ = self.emit_command_result(&CommandResult {
                    command: command.clone(),
                    success: false,
                    output: None,
                    error: Some(error.to_string()),
                });

                Err(error)
            }
        }
    }

    /// Generate a conversation title
    pub async fn generate_conversation_title(
        &self,
        message: String,
        model: Option<String>,
    ) -> Result<String> {
        let prompt = format!(
            "Generate a short, concise title (3-6 words) for a conversation that starts with this user message: \"{}\". Only return the title, nothing else.",
            message.chars().take(200).collect::<String>()
        );

        let model_to_use = model.unwrap_or_else(|| "gemini-2.5-flash".to_string());

        let mut child = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", "gemini", "--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .context("Failed to spawn Gemini CLI process on Windows")?
        } else {
            Command::new("gemini")
                .args(["--model", &model_to_use])
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .context("Failed to spawn Gemini CLI process")?
        };

        if let Some(stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            let mut stdin = stdin;
            stdin
                .write_all(prompt.as_bytes())
                .await
                .context("Failed to write prompt to stdin")?;
            stdin.shutdown().await
                .context("Failed to shutdown stdin")?;
        }

        let output = child
            .wait_with_output()
            .await
            .context("Failed to wait for Gemini CLI output")?;

        if !output.status.success() {
            let error_msg = format!(
                "Gemini CLI failed with exit code {:?}: {}",
                output.status.code(),
                String::from_utf8_lossy(&output.stderr)
            );
            anyhow::bail!("{}", error_msg);
        }

        let raw_output = String::from_utf8_lossy(&output.stdout);

        let title = raw_output
            .trim()
            .lines()
            .last()
            .unwrap_or("New Conversation")
            .trim_matches('"')
            .trim()
            .to_string();

        let final_title = if title.is_empty() || title.len() > 50 {
            message.chars().take(30).collect::<String>()
        } else {
            title
        };

        Ok(final_title)
    }

    /// Get all process statuses
    pub fn get_process_statuses(&self) -> Result<Vec<ProcessStatus>> {
        self.session_manager.get_process_statuses()
    }

    /// Kill a process by conversation ID
    pub fn kill_process(&self, conversation_id: &str) -> Result<()> {
        let result = self.session_manager.kill_process(conversation_id);
        
        // Emit real-time status change after killing process
        if result.is_ok() {
            if let Ok(statuses) = self.session_manager.get_process_statuses() {
                println!("📡 [STATUS-WS] Emitting process status change after killing process");
                let _ = self.emitter.emit("process-status-changed", &statuses);
            }
        }
        
        result
    }

    /// Validate if a directory exists and is accessible
    pub async fn validate_directory(&self, path: String) -> Result<bool> {
        filesystem::validate_directory(path).await
    }

    /// Check if the given path is the user's home directory
    pub async fn is_home_directory(&self, path: String) -> Result<bool> {
        filesystem::is_home_directory(path).await
    }

    /// Get the user's home directory path
    pub async fn get_home_directory(&self) -> Result<String> {
        filesystem::get_home_directory().await
    }

    /// Get the parent directory of the given path
    pub async fn get_parent_directory(&self, path: String) -> Result<Option<String>> {
        filesystem::get_parent_directory(path).await
    }

    /// List available volumes/drives on the system
    pub async fn list_volumes(&self) -> Result<Vec<DirEntry>> {
        filesystem::list_volumes().await
    }

    /// List the contents of a directory
    pub async fn list_directory_contents(&self, path: String) -> Result<Vec<DirEntry>> {
        filesystem::list_directory_contents(path).await
    }

    /// Get recent chats
    pub async fn get_recent_chats(&self) -> Result<Vec<RecentChat>> {
        search::get_recent_chats().await
    }

    /// Search across all chat logs
    pub async fn search_chats(
        &self,
        query: String,
        filters: Option<SearchFilters>,
    ) -> Result<Vec<SearchResult>> {
        search::search_chats(query, filters).await
    }

    /// List projects
    pub async fn list_projects(&self, limit: u32, offset: u32) -> Result<ProjectsResponse> {
        let lim = std::cmp::min(limit.max(1), 100);
        list_projects(lim, offset)
    }

    /// Return enriched projects
    pub async fn list_enriched_projects(&self) -> Result<Vec<EnrichedProject>> {
        list_enriched_projects()
    }

    /// Get an enriched project for a given sha256
    pub async fn get_enriched_project(
        &self,
        sha256: String,
        external_root_path: String,
    ) -> Result<EnrichedProject> {
        let external = Path::new(&external_root_path);
        ensure_project_metadata(&sha256, Some(external))?;
        let _ = maybe_touch_updated_at(&sha256, &self.touch_throttle);
        Ok(make_enriched_project(&sha256, Some(external), false))
    }

    /// Get discussions for a specific project
    pub async fn get_project_discussions(
        &self,
        project_id: &str,
    ) -> Result<Vec<RecentChat>> {
        search::get_project_discussions(project_id).await
    }
}
