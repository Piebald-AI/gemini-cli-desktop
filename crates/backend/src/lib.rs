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
pub use filesystem::{DirEntry, GitInfo, VolumeType};
pub use projects::{
    EnrichedProject, ProjectListItem, ProjectMetadata, ProjectMetadataView, ProjectsResponse,
    TouchThrottle, ensure_project_metadata, list_enriched_projects, list_projects,
    make_enriched_project, maybe_touch_updated_at,
};
pub use rpc::{JsonRpcError, JsonRpcRequest, JsonRpcResponse, RpcLogger};
pub use search::{MessageMatch, RecentChat, SearchFilters, SearchResult};
pub use security::{execute_terminal_command, is_command_safe};
use std::path::Path;

pub use session::{
    GeminiAuthConfig, PersistentSession, ProcessStatus, QwenConfig, SessionManager,
    initialize_session,
};
// Standard library imports
use anyhow::{Context, Result};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
    pub fn emit_cli_io(&self, session_id: &str, io_type: CliIoType, data: &str) -> Result<()> {
        let payload = CliIoPayload {
            io_type,
            data: data.to_string(),
        };
        self.emitter
            .emit(&format!("cli-io-{session_id}"), payload)
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
    pub fn emit_tool_call_update(&self, session_id: &str, update: &ToolCallUpdate) -> Result<()> {
        self.emitter
            .emit(
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
        self.emitter
            .emit(
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
        self.emitter
            .emit("command-result", result.clone())
            .context("Failed to emit command result event")
    }

    /// Check if Gemini CLI is installed and available
    pub async fn check_cli_installed(&self) -> Result<bool> {
        let result = {
            #[cfg(windows)]
            {
                Command::new("cmd.exe")
                    .args(["/C", "gemini", "--version"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output()
                    .await
            }
            #[cfg(not(windows))]
            {
                Command::new("sh")
                    .args(["-lc", "gemini --version"])
                    .output()
                    .await
            }
        };

        match result {
            Ok(output) => Ok(output.status.success()),
            Err(_) => Ok(false),
        }
    }

    /// Initialize a new CLI session (Gemini or Qwen)
    pub async fn initialize_session(
        &self,
        session_id: String,
        working_directory: String,
        model: String,
        backend_config: Option<QwenConfig>,
        gemini_auth: Option<GeminiAuthConfig>,
    ) -> Result<()> {
        let requested_backend = if backend_config.is_some() {
            "qwen"
        } else {
            "gemini"
        };

        {
            let processes = self.session_manager.get_processes();
            if let Ok(guard) = processes.lock()
                && let Some(existing) = guard.get(&session_id)
                && existing.is_alive
            {
                // Check if the existing session is using the same backend type
                if existing.backend_type == requested_backend {
                    println!(
                        "🔄 [SESSION-CHECK] Existing {requested_backend} session found for {session_id}, reusing"
                    );
                    return Ok(());
                } else {
                    // Different backend requested - kill the existing session first
                    println!(
                        "🔄 [SESSION-CHECK] Backend switch detected: {} -> {} for session {}",
                        existing.backend_type, requested_backend, session_id
                    );
                    println!(
                        "🔄 [SESSION-CHECK] Killing existing {} session before starting {}",
                        existing.backend_type, requested_backend
                    );
                    // Drop the guard before calling kill_process to avoid deadlock
                    drop(guard);
                    self.session_manager.kill_process(&session_id)?;
                }
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
            let processes = processes
                .lock()
                .map_err(|_| anyhow::anyhow!("Failed to lock processes mutex"))?;

            if let Some(session) = processes.get(&session_id) {
                (
                    session.message_sender.clone(),
                    session.acp_session_id.clone(),
                )
            } else {
                anyhow::bail!("Session not found: {}", session_id);
            }
        };

        let message_sender = message_sender.context("No message sender available")?;

        let acp_session_id = acp_session_id.context("No ACP session ID available")?;

        // Get working directory from session
        let working_directory = {
            let processes = self.session_manager.get_processes();
            let processes = processes.lock().unwrap();

            processes
                .get(&session_id)
                .map(|s| s.working_directory.clone())
                .unwrap_or_else(|| ".".to_string())
        };

        // Parse @-mentions and create ACP prompt content blocks
        let prompt_blocks = self.parse_mentions_to_content_blocks(&message, &working_directory);
        let prompt_params = SessionPromptParams {
            session_id: acp_session_id.clone(),
            prompt: prompt_blocks.clone(),
        };

        let request_id = {
            let mut id_guard = self.next_request_id.lock().unwrap();
            let id = *id_guard;
            *id_guard += 1;
            id
        };

        let params_value =
            serde_json::to_value(prompt_params).context("Failed to serialize prompt params")?;
        let prompt_request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: request_id,
            method: "session/prompt".to_string(),
            params: params_value,
        };

        let request_json =
            serde_json::to_string(&prompt_request).context("Failed to serialize prompt request")?;

        message_sender
            .send(request_json)
            .context("Failed to send message through channel")?;

        println!("✅ ACP session/prompt sent to session: {session_id}");
        Ok(())
    }

    /// Parse @-mentions in a message and convert to ACP ContentBlocks
    fn parse_mentions_to_content_blocks(
        &self,
        message: &str,
        _working_directory: &str,
    ) -> Vec<ContentBlock> {
        let mut blocks: Vec<ContentBlock> = Vec::new();

        // Regex to match @-mentions (files/folders)
        let regex_pattern = r"@([^\s,;!?\(\)\[\]\{\}]+)";
        let re = regex::Regex::new(regex_pattern).unwrap();
        let mut last_end = 0;
        let captures: Vec<_> = re.captures_iter(message).collect();
        for capture in captures.iter() {
            let match_range = capture.get(0).unwrap();
            let mention_path = capture.get(1).unwrap().as_str();

            // Check if this @ is part of an email address (has non-whitespace before it)

            if match_range.start() > 0 {
                let char_index = match_range.start() - 1;
                let char_before = message.chars().nth(char_index);

                if let Some(c) = char_before
                    && !c.is_whitespace()
                {
                    continue;
                }
            }

            // Add text before the @-mention

            if match_range.start() > last_end {
                let text_before = &message[last_end..match_range.start()];
                if !text_before.is_empty() {
                    let text_block = ContentBlock::Text {
                        text: text_before.to_string(),
                    };
                    blocks.push(text_block);
                }
            }

            // Create the resource link for the @-mention
            // Get the filename for the name field
            let file_name_os = Path::new(mention_path).file_name();
            let name_str = file_name_os.and_then(|n| n.to_str());
            let name = name_str.unwrap_or(mention_path).to_string();

            // Use the mention path as-is for the URI (relative path)
            let uri = mention_path.to_string();

            let resource_link = ContentBlock::ResourceLink {
                uri: uri.clone(),
                name: name.clone(),
            };
            blocks.push(resource_link);

            last_end = match_range.end();
        }

        // Add any remaining text after the last @-mention
        if last_end < message.len() {
            let remaining_text = &message[last_end..];
            if !remaining_text.is_empty() {
                let text_block = ContentBlock::Text {
                    text: remaining_text.to_string(),
                };
                blocks.push(text_block);
            }
        }

        // If no @-mentions were found, return the original message as a single text block
        if blocks.is_empty() {
            let text_block = ContentBlock::Text {
                text: message.to_string(),
            };
            blocks.push(text_block);
        }
        blocks
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
            let processes = processes
                .lock()
                .map_err(|_| anyhow::anyhow!("Failed to lock processes mutex"))?;

            let mut found_conversation_id = None;
            for (conv_id, session) in processes.iter() {
                if let Some(session_acp_id) = &session.acp_session_id
                    && session_acp_id == &acp_session_id
                {
                    found_conversation_id = Some(conv_id.clone());
                    break;
                }
            }

            found_conversation_id.context(format!(
                "No conversation found for ACP session ID: {acp_session_id}"
            ))?
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
            Some(serde_json::to_value(response_data).context("Failed to serialize response data")?),
            None,
            self.session_manager.get_processes(),
        )
        .await;

        // Do NOT mark the tool call as completed here.
        // The CLI will emit subsequent session/update events with accurate status transitions.
        // Returning Ok(()) ensures the frontend remains in "running" until a real "completed" arrives.
        let _ = &tool_call_id; // keep parameter used for future extensions
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

        let mut child = {
            #[cfg(windows)]
            {
                Command::new("cmd.exe")
                    .args(["/C", "gemini", "--model", &model_to_use])
                    .stdin(std::process::Stdio::piped())
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn()
                    .context("Failed to spawn Gemini CLI process")?
            }
            #[cfg(not(windows))]
            {
                Command::new("gemini")
                    .args(["--model", &model_to_use])
                    .stdin(std::process::Stdio::piped())
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .spawn()
                    .context("Failed to spawn Gemini CLI process")?
            }
        };

        if let Some(stdin) = child.stdin.take() {
            use tokio::io::AsyncWriteExt;
            let mut stdin = stdin;
            stdin
                .write_all(prompt.as_bytes())
                .await
                .context("Failed to write prompt to stdin")?;
            stdin.shutdown().await.context("Failed to shutdown stdin")?;
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
        if result.is_ok()
            && let Ok(statuses) = self.session_manager.get_process_statuses()
        {
            println!("📡 [STATUS-WS] Emitting process status change after killing process");
            let _ = self.emitter.emit("process-status-changed", &statuses);
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

    /// List files recursively with gitignore support
    pub async fn list_files_recursive(&self, path: String) -> Result<Vec<DirEntry>> {
        filesystem::list_files_recursive(path).await
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
    pub async fn get_project_discussions(&self, project_id: &str) -> Result<Vec<RecentChat>> {
        search::get_project_discussions(project_id).await
    }

    /// Get git repository information for a directory
    pub async fn get_git_info(&self, directory: String) -> Result<Option<GitInfo>> {
        filesystem::get_git_info(directory).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::MockEventEmitter;

    // Helper function to create a test backend
    fn create_test_backend() -> GeminiBackend<MockEventEmitter> {
        let emitter = MockEventEmitter::new();
        GeminiBackend::new(emitter)
    }

    #[test]
    fn test_parse_single_mention() {
        let backend = create_test_backend();
        let message = "Please explain @README.md file";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/project");

        assert_eq!(blocks.len(), 3);

        // First block should be text before mention
        match &blocks[0] {
            ContentBlock::Text { text } => assert_eq!(text, "Please explain "),
            _ => panic!("Expected Text block"),
        }

        // Second block should be resource link
        match &blocks[1] {
            ContentBlock::ResourceLink { uri, name } => {
                assert_eq!(name, "README.md");
                assert_eq!(uri, "README.md");
            }
            _ => panic!("Expected ResourceLink block"),
        }

        // Third block should be text after mention
        match &blocks[2] {
            ContentBlock::Text { text } => assert_eq!(text, " file"),
            _ => panic!("Expected Text block"),
        }
    }

    #[test]
    fn test_parse_multiple_mentions() {
        let backend = create_test_backend();
        let message = "Compare @config.json with @package.json files";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/app");

        assert_eq!(blocks.len(), 5);

        // Check structure: text, resource, text, resource, text
        match &blocks[0] {
            ContentBlock::Text { text } => assert_eq!(text, "Compare "),
            _ => panic!("Expected Text block"),
        }

        match &blocks[1] {
            ContentBlock::ResourceLink { name, .. } => {
                assert_eq!(name, "config.json");
            }
            _ => panic!("Expected ResourceLink block"),
        }

        match &blocks[2] {
            ContentBlock::Text { text } => assert_eq!(text, " with "),
            _ => panic!("Expected Text block"),
        }

        match &blocks[3] {
            ContentBlock::ResourceLink { name, .. } => {
                assert_eq!(name, "package.json");
            }
            _ => panic!("Expected ResourceLink block"),
        }

        match &blocks[4] {
            ContentBlock::Text { text } => assert_eq!(text, " files"),
            _ => panic!("Expected Text block"),
        }
    }

    #[test]
    fn test_parse_no_mentions() {
        let backend = create_test_backend();
        let message = "Hello world, no mentions here!";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/home");

        assert_eq!(blocks.len(), 1);

        match &blocks[0] {
            ContentBlock::Text { text } => assert_eq!(text, message),
            _ => panic!("Expected single Text block"),
        }
    }

    #[test]
    fn test_parse_mention_with_path() {
        let backend = create_test_backend();
        let message = "Check @src/main.rs for details";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/project");

        assert_eq!(blocks.len(), 3);

        match &blocks[1] {
            ContentBlock::ResourceLink { uri, name } => {
                assert_eq!(name, "main.rs");
                assert_eq!(uri, "src/main.rs");
            }
            _ => panic!("Expected ResourceLink block"),
        }
    }

    #[test]
    fn test_parse_mention_at_start() {
        let backend = create_test_backend();
        let message = "@index.html is the entry point";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/web");

        assert_eq!(blocks.len(), 2);

        match &blocks[0] {
            ContentBlock::ResourceLink { name, .. } => {
                assert_eq!(name, "index.html");
            }
            _ => panic!("Expected ResourceLink block"),
        }

        match &blocks[1] {
            ContentBlock::Text { text } => assert_eq!(text, " is the entry point"),
            _ => panic!("Expected Text block"),
        }
    }

    #[test]
    fn test_parse_mention_at_end() {
        let backend = create_test_backend();
        let message = "The configuration is in @settings.yaml";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/config");

        assert_eq!(blocks.len(), 2);

        match &blocks[0] {
            ContentBlock::Text { text } => assert_eq!(text, "The configuration is in "),
            _ => panic!("Expected Text block"),
        }

        match &blocks[1] {
            ContentBlock::ResourceLink { name, .. } => {
                assert_eq!(name, "settings.yaml");
            }
            _ => panic!("Expected ResourceLink block"),
        }
    }

    #[test]
    fn test_parse_email_not_mention() {
        let backend = create_test_backend();
        let message = "Contact me@company.com for help";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/home");

        // Email should not be parsed as mention due to lack of space before @
        assert_eq!(blocks.len(), 1);

        match &blocks[0] {
            ContentBlock::Text { text } => assert_eq!(text, message),
            _ => panic!("Expected single Text block"),
        }
    }

    #[test]
    fn test_parse_different_file_types() {
        let backend = create_test_backend();

        // Test Python file
        let message = "See @script.py";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/");
        match &blocks[1] {
            ContentBlock::ResourceLink { .. } => {
                // Just verify it's a ResourceLink
            }
            _ => panic!("Expected ResourceLink"),
        }

        // Test TypeScript file
        let message = "Check @app.ts";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/");
        match &blocks[1] {
            ContentBlock::ResourceLink { .. } => {
                // Just verify it's a ResourceLink
            }
            _ => panic!("Expected ResourceLink"),
        }

        // Test unknown extension defaults to text/plain
        let message = "Review @data.xyz";
        let blocks = backend.parse_mentions_to_content_blocks(message, "/");
        match &blocks[1] {
            ContentBlock::ResourceLink { .. } => {
                // Just verify it's a ResourceLink
            }
            _ => panic!("Expected ResourceLink"),
        }
    }
}
