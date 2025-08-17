use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QwenConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiAuthConfig {
    pub method: String, // "oauth-personal", "gemini-api-key", "vertex-ai", or "cloud-shell"
    pub api_key: Option<String>,
    pub vertex_project: Option<String>,
    pub vertex_location: Option<String>,
}

use crate::acp::{
    InitializeParams, InitializeResult, AuthenticateParams, SessionNewParams, SessionNewResult,
    ClientCapabilities, FileSystemCapabilities, SessionUpdateParams, SessionUpdate,
    SessionRequestPermissionParams, SessionPromptResult, ContentBlock,
};
use crate::cli::{
    StreamAssistantMessageChunkParams,
};
use crate::events::{
    CliIoPayload, CliIoType, EventEmitter, GeminiOutputPayload, GeminiThoughtPayload,
    InternalEvent,
};
use crate::rpc::{FileRpcLogger, JsonRpcRequest, JsonRpcResponse, NoOpRpcLogger, RpcLogger};
use crate::types::{BackendError, BackendResult};

pub struct PersistentSession {
    pub conversation_id: String,
    pub acp_session_id: Option<String>,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
    pub stdin: Option<ChildStdin>,
    pub message_sender: Option<mpsc::UnboundedSender<String>>,
    pub rpc_logger: Arc<dyn RpcLogger>,
    pub child: Option<Child>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessStatus {
    pub conversation_id: String,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
}

impl From<&PersistentSession> for ProcessStatus {
    fn from(session: &PersistentSession) -> Self {
        Self {
            conversation_id: session.conversation_id.clone(),
            pid: session.pid,
            created_at: session.created_at,
            is_alive: session.is_alive,
        }
    }
}

pub type ProcessMap = Arc<Mutex<HashMap<String, PersistentSession>>>;

pub struct SessionManager {
    processes: ProcessMap,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_process_statuses(&self) -> BackendResult<Vec<ProcessStatus>> {
        let processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;

        let statuses = processes.values().map(ProcessStatus::from).collect();

        Ok(statuses)
    }

    pub fn kill_process(&self, conversation_id: &str) -> BackendResult<()> {
        let mut processes = self
            .processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;

        if let Some(session) = processes.get_mut(conversation_id) {
            if let Some(mut child) = session.child.take() {
                drop(child.kill());
            } else if let Some(pid) = session.pid {
                #[cfg(windows)]
                {
                    use std::process::Command as StdCommand;
                    let output = StdCommand::new("taskkill")
                        .args(["/PID", &pid.to_string(), "/F"])
                        .output()
                        .map_err(|e| {
                            BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process: {e}"
                            ))
                        })?;

                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                        let stderr_lower = stderr.to_lowercase();
                        // Treat "not found" as success to make kill idempotent in tests and runtime
                        if stderr_lower.contains("not found") {
                            // Consider the process already gone
                        } else {
                            return Err(BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process {pid}: {stderr}"
                            )));
                        }
                    }
                }

                #[cfg(not(windows))]
                {
                    use std::process::Command as StdCommand;
                    let output = StdCommand::new("kill")
                        .args(["-9", &pid.to_string()])
                        .output()
                        .map_err(|e| {
                            BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process: {e}"
                            ))
                        })?;

                    if !output.status.success() {
                        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                        let stderr_lower = stderr.to_lowercase();
                        if stderr_lower.contains("no such process") {
                            // Consider the process already gone
                        } else {
                            return Err(BackendError::CommandExecutionFailed(format!(
                                "Failed to kill process {pid}: {stderr}"
                            )));
                        }
                    }
                }
            }

            session.is_alive = false;
            session.pid = None;
            session.stdin = None;
            session.message_sender = None;
        }

        Ok(())
    }

    pub(crate) fn get_processes(&self) -> &ProcessMap {
        &self.processes
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

// Helper function to send JSON-RPC request and read response
async fn send_jsonrpc_request<E: EventEmitter>(
    request: JsonRpcRequest,
    stdin: &mut ChildStdin,
    reader: &mut AsyncBufReader<ChildStdout>,
    session_id: &str,
    emitter: &E,
    rpc_logger: &Arc<dyn RpcLogger>,
) -> BackendResult<JsonRpcResponse> {
    let request_json = serde_json::to_string(&request).map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to serialize request: {e}"))
    })?;

    println!("🔍 RAW INPUT TO GEMINI CLI: {}", request_json);
    let _ = rpc_logger.log_rpc(&request_json);

    // Send request
    stdin.write_all(request_json.as_bytes()).await.map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to write request: {e}"))
    })?;
    stdin.write_all(b"\n").await.map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to write newline: {e}"))
    })?;
    stdin.flush().await.map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to flush: {e}"))
    })?;

    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Input,
            data: request_json,
        },
    );

    // Read response
    let mut line = String::new();
    reader.read_line(&mut line).await.map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to read response: {e}"))
    })?;

    println!("🔍 RAW OUTPUT FROM GEMINI CLI: {}", line.trim());
    let _ = rpc_logger.log_rpc(line.trim());

    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Output,
            data: line.trim().to_string(),
        },
    );

    let response = serde_json::from_str::<JsonRpcResponse>(&line).map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to parse response: {e}"))
    })?;

    if let Some(error) = &response.error {
        return Err(BackendError::SessionInitFailed(format!(
            "CLI Error: {error:?}"
        )));
    }

    Ok(response)
}

pub async fn initialize_session<E: EventEmitter + 'static>(
    session_id: String,
    working_directory: String,
    model: String,
    backend_config: Option<QwenConfig>,
    gemini_auth: Option<GeminiAuthConfig>,
    emitter: E,
    session_manager: &SessionManager,
) -> BackendResult<(mpsc::UnboundedSender<String>, Arc<dyn RpcLogger>)> {
    let is_qwen = backend_config.is_some();
    let cli_name = if is_qwen { "Qwen Code" } else { "Gemini" };
    println!("🚀 Initializing persistent {cli_name} session for: {session_id}");

    let rpc_logger: Arc<dyn RpcLogger> =
        match FileRpcLogger::new(Some(&working_directory), Some(cli_name)) {
            Ok(logger) => {
                println!("📝 RPC logging enabled for session: {session_id}");
                let _ = logger.cleanup_old_logs();
                Arc::new(logger)
            }
            Err(e) => {
                println!("⚠️  Failed to create RPC logger for session {session_id}: {e}");
                Arc::new(NoOpRpcLogger)
            }
        };

    let (message_tx, message_rx) = mpsc::unbounded_channel::<String>();

    let mut cmd = {
        if let Some(config) = &backend_config {
            // Set environment variables for Qwen Code (OpenAI-compatible API)
            unsafe {
                std::env::set_var("OPENAI_API_KEY", &config.api_key);
                std::env::set_var("OPENAI_BASE_URL", &config.base_url);
                std::env::set_var("OPENAI_MODEL", &config.model);
            }

            #[cfg(target_os = "windows")]
            {
                let mut c = Command::new("cmd");
                c.args(["/C", "qwen", "--experimental-acp"]);
                c
            }
            #[cfg(not(target_os = "windows"))]
            {
                let mut c = Command::new("sh");
                let qwen_command = "qwen --experimental-acp".to_string();
                c.args(["-c", &qwen_command]);
                c
            }
        } else {
            // Configure environment based on Gemini auth method
            if let Some(auth) = &gemini_auth {
                match auth.method.as_str() {
                    "gemini-api-key" => {
                        if let Some(api_key) = &auth.api_key {
                            unsafe {
                                std::env::set_var("GEMINI_API_KEY", api_key);
                            }
                        }
                    },
                    "vertex-ai" => {
                        if let Some(project) = &auth.vertex_project {
                            unsafe {
                                std::env::set_var("GOOGLE_CLOUD_PROJECT", project);
                            }
                        }
                        if let Some(location) = &auth.vertex_location {
                            unsafe {
                                std::env::set_var("GOOGLE_CLOUD_LOCATION", location);
                            }
                        }
                    },
                    _ => {}
                }
            }
            
            #[cfg(target_os = "windows")]
            {
                let mut c = Command::new("cmd");
                c.args(["/C", "gemini", "--model", &model, "--experimental-acp"]);
                c
            }
            #[cfg(not(target_os = "windows"))]
            {
                let mut c = Command::new("sh");
                let gemini_command = format!("gemini --model {model} --experimental-acp");
                c.args(["-c", &gemini_command]);
                c
            }
        }
    };

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if !working_directory.is_empty() {
        println!("🗂️ Setting working directory to: {working_directory}");
        cmd.current_dir(&working_directory);
    }

    let mut child = cmd.spawn().map_err(|e| {
        let cmd_name = if is_qwen { "qwen" } else { "gemini" };
        #[cfg(target_os = "windows")]
        {
            BackendError::SessionInitFailed(format!(
                "Failed to run {cmd_name} command via cmd: {e}"
            ))
        }
        #[cfg(not(target_os = "windows"))]
        {
            BackendError::SessionInitFailed(format!(
                "Failed to run {} command via shell: {e}",
                cmd_name
            ))
        }
    })?;

    let pid = child.id();
    let mut stdin = child.stdin.take().ok_or(BackendError::SessionInitFailed(
        "Failed to get stdin".to_string(),
    ))?;
    let stdout = child.stdout.take().ok_or(BackendError::SessionInitFailed(
        "Failed to get stdout".to_string(),
    ))?;

    let mut reader = AsyncBufReader::new(stdout);
    
    // Step 1: Initialize
    let init_params = InitializeParams {
        protocol_version: 1,
        client_capabilities: ClientCapabilities {
            fs: FileSystemCapabilities {
                read_text_file: true,
                write_text_file: true,
            },
        },
    };

    let init_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "initialize".to_string(),
        params: serde_json::to_value(init_params).map_err(|e| {
            BackendError::SessionInitFailed(format!("Failed to serialize init params: {e}"))
        })?,
    };

    let init_response = send_jsonrpc_request(
        init_request, &mut stdin, &mut reader, &session_id, &emitter, &rpc_logger
    ).await?;
    
    let _init_result: InitializeResult = serde_json::from_value(
        init_response.result.unwrap_or_default()
    ).map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to parse init result: {e}"))
    })?;
    
    println!("✅ Initialization completed for: {session_id}");

    // Step 2: Authenticate - choose method based on configuration
    let auth_method_id = if let Some(auth) = &gemini_auth {
        auth.method.clone()
    } else if backend_config.is_some() {
        // Qwen uses API key auth
        "gemini-api-key".to_string()
    } else {
        // Default to OAuth for Gemini if no config provided
        "oauth-personal".to_string()
    };
    
    let auth_params = AuthenticateParams {
        method_id: auth_method_id,
    };

    let auth_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 2,
        method: "authenticate".to_string(),
        params: serde_json::to_value(auth_params).map_err(|e| {
            BackendError::SessionInitFailed(format!("Failed to serialize auth params: {e}"))
        })?,
    };

    let _auth_response = send_jsonrpc_request(
        auth_request, &mut stdin, &mut reader, &session_id, &emitter, &rpc_logger
    ).await?;
    
    println!("✅ Authentication completed for: {session_id}");

    // Step 3: Create new session
    let session_params = SessionNewParams {
        cwd: working_directory.clone(),
        mcp_servers: vec![], // No MCP servers for now
    };

    let session_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 3,
        method: "session/new".to_string(),
        params: serde_json::to_value(session_params).map_err(|e| {
            BackendError::SessionInitFailed(format!("Failed to serialize session params: {e}"))
        })?,
    };

    let session_response = send_jsonrpc_request(
        session_request, &mut stdin, &mut reader, &session_id, &emitter, &rpc_logger
    ).await?;

    let session_result: SessionNewResult = serde_json::from_value(
        session_response.result.unwrap_or_default()
    ).map_err(|e| {
        BackendError::SessionInitFailed(format!("Failed to parse session result: {e}"))
    })?;

    println!("✅ ACP session created with ID: {}", session_result.session_id);

    {
        let processes = session_manager.get_processes();
        let mut processes = processes
            .lock()
            .map_err(|_| BackendError::SessionInitFailed("Failed to lock processes".to_string()))?;
        processes.insert(
            session_id.clone(),
            PersistentSession {
                conversation_id: session_id.clone(),
                acp_session_id: Some(session_result.session_id),
                pid,
                created_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                is_alive: true,
                stdin: Some(stdin),
                message_sender: Some(message_tx.clone()),
                rpc_logger: rpc_logger.clone(),
                child: Some(child),
            },
        );
    }

    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<InternalEvent>();

    let session_id_for_events = session_id.clone();
    tokio::spawn(async move {
        while let Some(internal_event) = event_rx.recv().await {
            println!("📨 Processing internal_event: {internal_event:?}");
            match internal_event {
                InternalEvent::CliIo {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("cli-io-{session_id}"), payload);
                }
                InternalEvent::GeminiOutput {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("ai-output-{session_id}"), payload.text);
                }
                InternalEvent::GeminiThought {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("ai-thought-{session_id}"), payload.thought);
                }
                InternalEvent::ToolCall {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("ai-tool-call-{session_id}"), payload);
                }
                InternalEvent::ToolCallUpdate {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("ai-tool-call-update-{session_id}"), payload);
                }
                InternalEvent::ToolCallConfirmation {
                    session_id,
                    payload,
                } => {
                    let _ =
                        emitter.emit(&format!("ai-tool-call-confirmation-{session_id}"), payload);
                }
                InternalEvent::GeminiTurnFinished { session_id } => {
                    let _ = emitter.emit(&format!("ai-turn-finished-{session_id}"), true);
                }
                InternalEvent::Error {
                    session_id,
                    payload,
                } => {
                    let _ = emitter.emit(&format!("ai-error-{session_id}"), payload.error);
                }
                // Pure ACP events - emit directly with new event names
                InternalEvent::AcpSessionUpdate {
                    session_id,
                    update,
                } => {
                    println!("🔧 [EDIT-DEBUG] Emitting acp-session-update-{} event: {:?}", session_id, update);
                    let emit_result = emitter.emit(&format!("acp-session-update-{session_id}"), update);
                    if emit_result.is_err() {
                        println!("🔧 [EDIT-DEBUG] Failed to emit acp-session-update event: {:?}", emit_result);
                    } else {
                        println!("🔧 [EDIT-DEBUG] Successfully emitted acp-session-update-{} event", session_id);
                    }
                }
                InternalEvent::AcpPermissionRequest {
                    session_id,
                    request_id,
                    request,
                } => {
                    println!("🚨 BACKEND: Emitting acp-permission-request-{} with request_id={}", session_id, request_id);
                    println!("🚨 BACKEND: Request payload: {:?}", serde_json::json!({
                        "request_id": request_id,
                        "request": &request
                    }));
                    let _ = emitter.emit(&format!("acp-permission-request-{session_id}"), serde_json::json!({
                        "request_id": request_id,
                        "request": request
                    }));
                    println!("🚨 BACKEND: Event emitted successfully");
                }
            }
        }
        println!("🔄 Event forwarding task finished for session: {session_id_for_events}");
    });

    let session_id_clone = session_id.clone();
    let processes_clone = session_manager.get_processes().clone();

    tokio::spawn(async move {
        // Ensure the I/O loop does not block forever if the CLI becomes silent.
        // The internal handler itself reads line-by-line and will exit on EOF.
        handle_session_io_internal(
            session_id_clone,
            reader,
            message_rx,
            processes_clone,
            event_tx,
        )
        .await;
    });

    Ok((message_tx, rpc_logger))
}

async fn handle_session_io_internal(
    session_id: String,
    mut reader: AsyncBufReader<ChildStdout>,
    mut message_rx: mpsc::UnboundedReceiver<String>,
    processes: ProcessMap,
    event_tx: mpsc::UnboundedSender<InternalEvent>,
) {
    let mut line_buffer = String::new();

    loop {
        tokio::select! {
            message = message_rx.recv() => {
                if let Some(message_json) = message {
                    let stdin_opt = {
                        let mut processes_guard = processes.lock().unwrap();
                        if let Some(session) = processes_guard.get_mut(&session_id) {
                            session.stdin.take()
                        } else {
                            None
                        }
                    };

                    if let Some(mut stdin) = stdin_opt {

                        if let Ok(processes_guard) = processes.lock()
                            && let Some(session) = processes_guard.get(&session_id)
                        {
                            let _ = session.rpc_logger.log_rpc(&message_json);
                        }

                        if let Err(e) = stdin.write_all(message_json.as_bytes()).await {
                            eprintln!("Failed to write to stdin: {e}");
                            break;
                        }
                        if let Err(e) = stdin.write_all(b"\n").await {
                            eprintln!("Failed to write newline: {e}");
                            break;
                        }
                        if let Err(e) = stdin.flush().await {
                            eprintln!("Failed to flush stdin: {e}");
                            break;
                        }

                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Input,
                                data: message_json,
                            },
                        });

                        {
                            let mut processes_guard = processes.lock().unwrap();
                            if let Some(session) = processes_guard.get_mut(&session_id) {
                                session.stdin = Some(stdin);
                            }
                        }
                    }
                } else {
                    println!("Message receiver closed for session: {session_id}");
                    break;
                }
            }

            result = reader.read_line(&mut line_buffer) => {
                match result {
                    Ok(0) => {
                        println!("CLI process closed for session: {session_id}");
                        break;
                    }
                    Ok(_) => {
                        let line = line_buffer.trim().to_string();

                        if let Ok(processes_guard) = processes.lock()
                            && let Some(session) = processes_guard.get(&session_id)
                        {
                            let _ = session.rpc_logger.log_rpc(&line);
                        }

                        let _ = event_tx.send(InternalEvent::CliIo {
                            session_id: session_id.clone(),
                            payload: CliIoPayload {
                                io_type: CliIoType::Output,
                                data: line.clone(),
                            },
                        });

                        println!("🔧 [EDIT-DEBUG] Processing CLI output line: {}", line.chars().take(100).collect::<String>());
                        
                        handle_cli_output_line(
                            &session_id,
                            &line,
                            &event_tx,
                            &processes,
                        ).await;
                        
                        println!("🔧 [EDIT-DEBUG] Finished processing CLI line");

                        line_buffer.clear();
                    }
                    Err(e) => {
                        eprintln!("Error reading from CLI: {e}");
                        break;
                    }
                }
            }
        }
    }

    {
        let mut processes_guard = processes.lock().unwrap();
        if let Some(session) = processes_guard.get_mut(&session_id) {
            session.is_alive = false;
            session.stdin = None;
            session.message_sender = None;
        }
    }

    println!("🛑 Session I/O handler finished for: {session_id}");
}

pub async fn send_response_to_cli(
    session_id: &str,
    request_id: u32,
    result: Option<serde_json::Value>,
    error: Option<crate::rpc::JsonRpcError>,
    processes: &ProcessMap,
) {
    let response = JsonRpcResponse {
        jsonrpc: "2.0".to_string(),
        id: request_id,
        result,
        error,
    };

    let response_json = serde_json::to_string(&response).unwrap();

    if let Ok(processes_guard) = processes.lock()
        && let Some(session) = processes_guard.get(session_id)
    {
        let _ = session.rpc_logger.log_rpc(&response_json);
    }

    if let Some(sender) = {
        let mut processes_guard = processes.lock().unwrap();
        processes_guard
            .get_mut(session_id)
            .and_then(|s| s.message_sender.clone())
    } {
        let _ = sender.send(response_json);
    }
}

async fn handle_cli_output_line(
    session_id: &str,
    line: &str,
    event_tx: &mpsc::UnboundedSender<InternalEvent>,
    _processes: &ProcessMap,
) {
    println!("🔧 [EDIT-DEBUG] handle_cli_output_line called for session: {}", session_id);
    println!("🔧 [EDIT-DEBUG] Line content: {}", line);
    
    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
        println!("🔧 [EDIT-DEBUG] Successfully parsed JSON from line");
        if let Some(method) = json_value.get("method").and_then(|m| m.as_str()) {
            match method {
                "streamAssistantMessageChunk" => {
                    if let Ok(params) = serde_json::from_value::<StreamAssistantMessageChunkParams>(
                        json_value.get("params").cloned().unwrap_or_default(),
                    ) {
                        if let Some(thought) = params.chunk.thought {
                            let _ = event_tx.send(InternalEvent::GeminiThought {
                                session_id: session_id.to_string(),
                                payload: GeminiThoughtPayload { thought },
                            });
                        }
                        if let Some(text) = params.chunk.text {
                            let _ = event_tx.send(InternalEvent::GeminiOutput {
                                session_id: session_id.to_string(),
                                payload: GeminiOutputPayload { text },
                            });
                        }
                    }
                }
                "session/update" => {
                    if let Ok(params) = serde_json::from_value::<SessionUpdateParams>(
                        json_value.get("params").cloned().unwrap_or_default(),
                    ) {
                        match params.update {
                            SessionUpdate::AgentMessageChunk { content } => {
                                match content {
                                    ContentBlock::Text { text } => {
                                        let _ = event_tx.send(InternalEvent::GeminiOutput {
                                            session_id: session_id.to_string(),
                                            payload: GeminiOutputPayload { text },
                                        });
                                    },
                                    _ => {
                                        // Handle other content types as needed
                                        println!("Received non-text content block: {:?}", content);
                                    }
                                }
                            },
                            SessionUpdate::AgentThoughtChunk { content } => {
                                match content {
                                    ContentBlock::Text { text } => {
                                        let _ = event_tx.send(InternalEvent::GeminiThought {
                                            session_id: session_id.to_string(),
                                            payload: GeminiThoughtPayload { thought: text },
                                        });
                                    },
                                    _ => {
                                        // Handle other content types as needed
                                        println!("Received non-text thought content block: {:?}", content);
                                    }
                                }
                            },
                            SessionUpdate::ToolCall { 
                                tool_call_id, 
                                status, 
                                title, 
                                content, 
                                locations, 
                                kind 
                            } => {
                                println!("🔧 [EDIT-DEBUG] Backend received ToolCall from CLI: tool_call_id={}, status={:?}, title={}", tool_call_id, status, title);
                                
                                // Emit pure ACP SessionUpdate event - no legacy conversion
                                let emit_result = event_tx.send(InternalEvent::AcpSessionUpdate {
                                    session_id: session_id.to_string(),
                                    update: SessionUpdate::ToolCall {
                                        tool_call_id: tool_call_id.clone(),
                                        status: status.clone(),
                                        title: title.clone(),
                                        content: content.clone(),
                                        locations: locations.clone(),
                                        kind: kind.clone(),
                                    },
                                });
                                
                                if emit_result.is_err() {
                                    println!("🔧 [EDIT-DEBUG] Failed to send ToolCall event: {:?}", emit_result);
                                } else {
                                    println!("🔧 [EDIT-DEBUG] Successfully sent ToolCall event for: {}", tool_call_id);
                                }
                            },
                            SessionUpdate::ToolCallUpdate { 
                                tool_call_id, 
                                status, 
                                content 
                            } => {
                                println!("🔧 [EDIT-DEBUG] Backend received ToolCallUpdate from CLI: tool_call_id={}, status={:?}", tool_call_id, status);
                                println!("🔧 [EDIT-DEBUG] ToolCallUpdate has content: {} items", content.len());
                                
                                // Emit pure ACP SessionUpdate event - no legacy conversion
                                let _ = event_tx.send(InternalEvent::AcpSessionUpdate {
                                    session_id: session_id.to_string(),
                                    update: SessionUpdate::ToolCallUpdate {
                                        tool_call_id: tool_call_id.clone(),
                                        status: status.clone(),
                                        content: content.clone(),
                                    },
                                });
                                println!("🔧 [EDIT-DEBUG] Sent AcpSessionUpdate event for ToolCallUpdate: {}", tool_call_id);
                            }
                        }
                    }
                }
                "session/request_permission" => {
                    println!("🔔 BACKEND: Received session/request_permission from CLI");
                    println!("🔔 BACKEND: JSON value: {:?}", json_value);
                    // First try to parse and log what fails
                    let params_value = json_value.get("params").cloned().unwrap_or_default();
                    println!("🔔 BACKEND: Trying to parse params: {}", serde_json::to_string_pretty(&params_value).unwrap_or("failed to stringify".to_string()));
                    
                    if let Ok(params) = serde_json::from_value::<SessionRequestPermissionParams>(params_value) 
                        && let Some(id) = json_value.get("id").and_then(|i| i.as_u64())
                    {
                        println!("🔔 BACKEND: Successfully parsed permission request with id={}", id);
                        println!("🔔 BACKEND: Tool call ID in request: {}", params.tool_call.tool_call_id);
                        // Emit pure ACP permission request - no legacy conversion
                        let _ = event_tx.send(InternalEvent::AcpPermissionRequest {
                            session_id: session_id.to_string(),
                            request_id: id,
                            request: params,
                        });
                        println!("🔔 BACKEND: Sent InternalEvent::AcpPermissionRequest to event_tx");
                    } else {
                        // Try to get the specific parsing error
                        let parse_result = serde_json::from_value::<SessionRequestPermissionParams>(
                            json_value.get("params").cloned().unwrap_or_default()
                        );
                        println!("❌ BACKEND: Failed to parse session/request_permission params: {:?}", parse_result.err());
                    }
                }
                _ => {}
            }
        } else if json_value.get("result").is_some() {
            // Handle JSON-RPC responses (as opposed to notifications)
            if let Ok(result) = serde_json::from_value::<SessionPromptResult>(
                json_value.get("result").cloned().unwrap_or_default(),
            ) {
                if result.stop_reason == "end_turn" {
                    let _ = event_tx.send(InternalEvent::GeminiTurnFinished {
                        session_id: session_id.to_string(),
                    });
                }
            }
        }

        // ACP protocol handles request/response cycles through standard JSON-RPC
        // No need for special message tracking like the old sendUserMessage system
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // use crate::events::MockEventEmitter; // Unused import removed
    use serde_json::json;
    // use std::sync::atomic::{AtomicU32, Ordering}; // Unused imports removed
    use std::sync::Arc;
    use std::time::Duration;
    use tokio::time::timeout;

    #[test]
    fn test_persistent_session_struct() {
        let session = PersistentSession {
            conversation_id: "test-id".to_string(),
            acp_session_id: None,
            pid: Some(12345),
            created_at: 1640995200,
            is_alive: true,
            stdin: None,
            message_sender: None,
            rpc_logger: Arc::new(NoOpRpcLogger),
            child: None,
        };

        assert_eq!(session.conversation_id, "test-id");
        assert_eq!(session.pid, Some(12345));
        assert_eq!(session.created_at, 1640995200);
        assert!(session.is_alive);
        assert!(session.stdin.is_none());
        assert!(session.message_sender.is_none());
        assert!(session.child.is_none());
    }

    #[test]
    fn test_process_status_serialization() {
        let status = ProcessStatus {
            conversation_id: "test-id".to_string(),
            pid: Some(12345),
            created_at: 1640995200,
            is_alive: true,
        };

        let json = serde_json::to_string(&status).unwrap();
        let deserialized: ProcessStatus = serde_json::from_str(&json).unwrap();

        assert_eq!(status.conversation_id, deserialized.conversation_id);
        assert_eq!(status.pid, deserialized.pid);
        assert_eq!(status.created_at, deserialized.created_at);
        assert_eq!(status.is_alive, deserialized.is_alive);
    }

    #[test]
    fn test_process_status_from_persistent_session() {
        let session = PersistentSession {
            conversation_id: "test-session".to_string(),
            acp_session_id: None,
            pid: Some(9876),
            created_at: 1640995300,
            is_alive: false,
            stdin: None,
            message_sender: None,
            rpc_logger: Arc::new(NoOpRpcLogger),
            child: None,
        };

        let status = ProcessStatus::from(&session);
        assert_eq!(status.conversation_id, "test-session");
        assert_eq!(status.pid, Some(9876));
        assert_eq!(status.created_at, 1640995300);
        assert!(!status.is_alive);
    }

    #[test]
    fn test_session_manager_new() {
        let manager = SessionManager::new();
        let statuses = manager.get_process_statuses().unwrap();
        assert!(statuses.is_empty());
    }

    #[test]
    fn test_session_manager_default() {
        let manager = SessionManager::default();
        let statuses = manager.get_process_statuses().unwrap();
        assert!(statuses.is_empty());
    }

    #[test]
    fn test_session_manager_get_process_statuses() {
        let manager = SessionManager::new();

        // Add a session directly to processes
        {
            let mut processes = manager.processes.lock().unwrap();
            processes.insert(
                "test-session".to_string(),
                PersistentSession {
                    conversation_id: "test-session".to_string(),
                    acp_session_id: None,
                    pid: Some(12345),
                    created_at: 1640995200,
                    is_alive: true,
                    stdin: None,
                    message_sender: None,
                    rpc_logger: Arc::new(NoOpRpcLogger),
                    child: None,
                },
            );
        }

        let statuses = manager.get_process_statuses().unwrap();
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].conversation_id, "test-session");
        assert_eq!(statuses[0].pid, Some(12345));
        assert!(statuses[0].is_alive);
    }

    #[test]
    fn test_session_manager_kill_process_nonexistent() {
        let manager = SessionManager::new();

        // Killing a non-existent process should not error
        let result = manager.kill_process("nonexistent");
        assert!(result.is_ok());
    }

    #[test]
    fn test_session_manager_kill_process_no_child_no_pid() {
        let manager = SessionManager::new();

        // Add a session with no child and no pid
        {
            let mut processes = manager.processes.lock().unwrap();
            processes.insert(
                "test-session".to_string(),
                PersistentSession {
                    conversation_id: "test-session".to_string(),
                    acp_session_id: None,
                    pid: None,
                    created_at: 1640995200,
                    is_alive: true,
                    stdin: None,
                    message_sender: None,
                    rpc_logger: Arc::new(NoOpRpcLogger),
                    child: None,
                },
            );
        }

        let result = manager.kill_process("test-session");
        assert!(result.is_ok());

        // Verify the session state was updated
        let statuses = manager.get_process_statuses().unwrap();
        assert_eq!(statuses.len(), 1);
        assert!(!statuses[0].is_alive);
        assert!(statuses[0].pid.is_none());
    }

    #[test]
    fn test_session_manager_get_processes() {
        let manager = SessionManager::new();
        let processes = manager.get_processes();
        assert!(processes.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_send_response_to_cli_no_session() {
        let processes: ProcessMap = Arc::new(Mutex::new(HashMap::new()));

        // Should not panic when session doesn't exist
        send_response_to_cli(
            "nonexistent",
            123,
            Some(json!({"status": "ok"})),
            None,
            &processes,
        )
        .await;
    }

    #[tokio::test]
    async fn test_send_response_to_cli_with_session() {
        let processes: ProcessMap = Arc::new(Mutex::new(HashMap::new()));
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        // Add session with message sender
        {
            let mut guard = processes.lock().unwrap();
            guard.insert(
                "test-session".to_string(),
                PersistentSession {
                    conversation_id: "test-session".to_string(),
                    acp_session_id: None,
                    pid: Some(12345),
                    created_at: 1640995200,
                    is_alive: true,
                    stdin: None,
                    message_sender: Some(tx),
                    rpc_logger: Arc::new(NoOpRpcLogger),
                    child: None,
                },
            );
        }

        send_response_to_cli(
            "test-session",
            123,
            Some(json!({"status": "ok"})),
            None,
            &processes,
        )
        .await;

        // Verify the response was sent
        let response = timeout(Duration::from_millis(100), rx.recv())
            .await
            .unwrap()
            .unwrap();
        let parsed: JsonRpcResponse = serde_json::from_str(&response).unwrap();
        assert_eq!(parsed.id, 123);
        assert_eq!(parsed.result, Some(json!({"status": "ok"})));
    }

    #[tokio::test]
    async fn test_handle_cli_output_line_invalid_json() {
        let (tx, _rx) = mpsc::unbounded_channel::<InternalEvent>();
    
        // Should not panic on invalid JSON
        let processes = Arc::new(Mutex::new(HashMap::new()));
        handle_cli_output_line(
            "test-session",
            "invalid json",
            &tx,
            &processes,
        )
        .await;

    }

    #[tokio::test]
    async fn test_handle_cli_output_line_stream_assistant_message_chunk() {
        let (tx, mut rx) = mpsc::unbounded_channel::<InternalEvent>();
    
        let input = json!({
            "method": "streamAssistantMessageChunk",
            "params": {
                "chunk": {
                    "text": "Hello world",
                    "thought": "I should respond"
                }
            }
        })
        .to_string();

        let processes = Arc::new(Mutex::new(HashMap::new()));
        handle_cli_output_line(
            "test-session",
            &input,
            &tx,
            &processes,
        )
        .await;

        // Should receive both thought and output events
        let event1 = timeout(Duration::from_millis(100), rx.recv())
            .await
            .unwrap()
            .unwrap();
        let event2 = timeout(Duration::from_millis(100), rx.recv())
            .await
            .unwrap()
            .unwrap();

        match (&event1, &event2) {
            (
                InternalEvent::GeminiThought {
                    session_id,
                    payload,
                },
                InternalEvent::GeminiOutput { .. },
            )
            | (
                InternalEvent::GeminiOutput { .. },
                InternalEvent::GeminiThought {
                    session_id,
                    payload,
                },
            ) => {
                assert_eq!(session_id, "test-session");
                assert_eq!(payload.thought, "I should respond");
            }
            _ => panic!(
                "Expected thought and output events, got: {:?}, {:?}",
                event1, event2
            ),
        }
    }

    #[tokio::test]
    async fn test_handle_cli_output_line_end_turn_response() {
        let (tx, mut rx) = mpsc::unbounded_channel::<InternalEvent>();
    
        let input = json!({
            "jsonrpc": "2.0",
            "id": 1000,
            "result": {
                "stopReason": "end_turn"
            }
        })
        .to_string();

        let processes = Arc::new(Mutex::new(HashMap::new()));
        handle_cli_output_line(
            "test-session",
            &input,
            &tx,
            &processes,
        )
        .await;

        // Should receive a turn finished event
        let event = timeout(Duration::from_millis(100), rx.recv())
            .await
            .unwrap()
            .unwrap();

        match event {
            InternalEvent::GeminiTurnFinished { session_id } => {
                assert_eq!(session_id, "test-session");
            }
            _ => panic!("Expected GeminiTurnFinished event, got: {:?}", event),
        }
    }

    #[tokio::test]
    async fn test_handle_cli_output_line_non_end_turn_response() {
        let (tx, mut rx) = mpsc::unbounded_channel::<InternalEvent>();
    
        let input = json!({
            "jsonrpc": "2.0",
            "id": 1000,
            "result": {
                "stopReason": "max_tokens"
            }
        })
        .to_string();

        let processes = Arc::new(Mutex::new(HashMap::new()));
        handle_cli_output_line(
            "test-session",
            &input,
            &tx,
            &processes,
        )
        .await;

        // Should not receive any events for non-end_turn responses
        let result = timeout(Duration::from_millis(100), rx.recv()).await;
        assert!(result.is_err(), "Should not receive events for non-end_turn responses");
    }

    #[tokio::test]
    async fn test_handle_cli_output_line_unknown_method() {
        let (tx, _rx) = mpsc::unbounded_channel::<InternalEvent>();
    
        let input = json!({
            "method": "unknownMethod",
            "params": {}
        })
        .to_string();

        // Should not panic or produce events for unknown methods
        let processes = Arc::new(Mutex::new(HashMap::new()));
        handle_cli_output_line(
            "test-session",
            &input,
            &tx,
            &processes,
        )
        .await;

    }

    #[test]
    fn test_json_rpc_request_creation() {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "initialize".to_string(),
            params: json!({"protocolVersion": "0.0.9"}),
        };

        let serialized = serde_json::to_string(&request).unwrap();
        let deserialized: JsonRpcRequest = serde_json::from_str(&serialized).unwrap();

        assert_eq!(request.jsonrpc, deserialized.jsonrpc);
        assert_eq!(request.id, deserialized.id);
        assert_eq!(request.method, deserialized.method);
        assert_eq!(request.params, deserialized.params);
    }

    #[test]
    fn test_json_rpc_response_creation() {
        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: 1,
            result: Some(json!({"status": "initialized"})),
            error: None,
        };

        let serialized = serde_json::to_string(&response).unwrap();
        let deserialized: JsonRpcResponse = serde_json::from_str(&serialized).unwrap();

        assert_eq!(response.jsonrpc, deserialized.jsonrpc);
        assert_eq!(response.id, deserialized.id);
        assert_eq!(response.result, deserialized.result);
        assert!(deserialized.error.is_none());
    }

    // Integration tests for critical session management functions
    // These tests address the integration test gaps identified in the audit

    #[tokio::test]
    async fn test_initialize_session_integration() {
        use crate::events::MockEventEmitter;
        use crate::test_utils::{EnvGuard, TestDirManager};
        use tempfile::TempDir;

        let mut env_guard = EnvGuard::new();
        let temp_dir = TempDir::new().unwrap();
        env_guard.set_temp_home(&temp_dir);

        let test_dir_manager = TestDirManager::new().unwrap();
        let working_dir = test_dir_manager
            .create_unique_subdir("test_session")
            .unwrap();

        let emitter = MockEventEmitter::new();
        let session_manager = SessionManager::new();

        // Test session initialization with mock emitter
        // Note: This will fail if gemini CLI is not installed, but tests the integration logic
        let result = initialize_session(
            "test-session-123".to_string(),
            working_dir.to_string_lossy().to_string(),
            "gemini-2.5-flash".to_string(),
            None,
            emitter.clone(),
            &session_manager,
        )
        .await;

        // The result may fail due to missing CLI, but we can test the error handling
        match result {
            Ok((sender, _logger)) => {
                // If successful, verify the session was created
                let statuses = session_manager.get_process_statuses().unwrap();
                assert_eq!(statuses.len(), 1);
                assert_eq!(statuses[0].conversation_id, "test-session-123");
                assert!(statuses[0].is_alive);

                // Test that we can send a message (will be queued)
                let test_message = "test message";
                let send_result = sender.send(test_message.to_string());
                assert!(send_result.is_ok());
            }
            Err(e) => {
                // Expected if gemini CLI is not available
                // Verify it's the expected error type
                match e {
                    crate::types::BackendError::SessionInitFailed(_) => {
                        // This is expected when CLI is not available
                        println!("Session init failed as expected (CLI not available): {}", e);
                    }
                    _ => panic!("Unexpected error type: {}", e),
                }
            }
        }

        // Verify events were emitted during initialization attempt
        assert!(emitter.total_events() > 0);
        assert!(emitter.has_event("cli-io-test-session-123"));
    }

    #[tokio::test]
    async fn test_session_manager_integration() {
        use crate::rpc::NoOpRpcLogger;
        use std::sync::Arc;

        let session_manager = SessionManager::new();

        // Test adding a mock session
        {
            let mut processes = session_manager.processes.lock().unwrap();
            processes.insert(
                "integration-test".to_string(),
                PersistentSession {
                    conversation_id: "integration-test".to_string(),
                    acp_session_id: None,
                    pid: Some(12345),
                    created_at: 1640995200,
                    is_alive: true,
                    stdin: None,
                    message_sender: None,
                    rpc_logger: Arc::new(NoOpRpcLogger),
                    child: None,
                },
            );
        }

        // Test process status retrieval
        let statuses = session_manager.get_process_statuses().unwrap();
        assert_eq!(statuses.len(), 1);
        assert_eq!(statuses[0].conversation_id, "integration-test");
        assert!(statuses[0].is_alive);

        // Test process killing
        let kill_result = session_manager.kill_process("integration-test");
        assert!(kill_result.is_ok());

        // Verify process was marked as not alive
        let statuses_after_kill = session_manager.get_process_statuses().unwrap();
        assert_eq!(statuses_after_kill.len(), 1);
        assert!(!statuses_after_kill[0].is_alive);
    }


    #[tokio::test]
    async fn test_send_response_to_cli_integration() {
        use crate::rpc::{JsonRpcResponse, NoOpRpcLogger};
        use std::sync::Arc;
        use tokio::sync::mpsc;

        let processes: ProcessMap = Arc::new(Mutex::new(HashMap::new()));
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        // Set up a mock session with message sender
        {
            let mut guard = processes.lock().unwrap();
            guard.insert(
                "integration-test".to_string(),
                PersistentSession {
                    conversation_id: "integration-test".to_string(),
                    acp_session_id: None,
                    pid: Some(12345),
                    created_at: 1640995200,
                    is_alive: true,
                    stdin: None,
                    message_sender: Some(tx),
                    rpc_logger: Arc::new(NoOpRpcLogger),
                    child: None,
                },
            );
        }

        // Test sending a response
        send_response_to_cli(
            "integration-test",
            123,
            Some(serde_json::json!({"status": "success"})),
            None,
            &processes,
        )
        .await;

        // Verify the response was sent
        let response_json = rx.recv().await.unwrap();
        let response: JsonRpcResponse = serde_json::from_str(&response_json).unwrap();

        assert_eq!(response.id, 123);
        assert_eq!(
            response.result,
            Some(serde_json::json!({"status": "success"}))
        );
        assert!(response.error.is_none());
    }

    #[test]
    fn test_session_thread_safety() {
        use crate::rpc::NoOpRpcLogger;
        use std::sync::Arc;
        use std::thread;

        let session_manager = SessionManager::new();
        let session_manager = Arc::new(session_manager);

        let mut handles = vec![];

        // Spawn multiple threads that add and remove sessions
        for i in 0..10 {
            let manager = Arc::clone(&session_manager);
            let handle = thread::spawn(move || {
                let session_id = format!("thread-session-{}", i);

                // Add session
                {
                    let mut processes = manager.processes.lock().unwrap();
                    processes.insert(
                        session_id.clone(),
                        PersistentSession {
                            conversation_id: session_id.clone(),
                            acp_session_id: None,
                            pid: Some(1000 + i as u32),
                            created_at: 1640995200 + i as u64,
                            is_alive: true,
                            stdin: None,
                            message_sender: None,
                            rpc_logger: Arc::new(NoOpRpcLogger),
                            child: None,
                        },
                    );
                }

                // Get status
                let statuses = manager.get_process_statuses().unwrap();
                assert!(statuses.iter().any(|s| s.conversation_id == session_id));

                // Kill session
                manager.kill_process(&session_id).unwrap();
            });
            handles.push(handle);
        }

        // Wait for all threads to complete
        for handle in handles {
            handle.join().unwrap();
        }

        // Verify final state
        let final_statuses = session_manager.get_process_statuses().unwrap();
        assert_eq!(final_statuses.len(), 10);

        // All sessions should be marked as not alive
        for status in final_statuses {
            assert!(!status.is_alive);
        }
    }

    #[test]
    fn test_process_map_thread_safety() {
        use std::thread;

        let processes: ProcessMap = Arc::new(Mutex::new(HashMap::new()));
        let processes_clone = processes.clone();

        let handle = thread::spawn(move || {
            let mut guard = processes_clone.lock().unwrap();
            guard.insert(
                "thread-test".to_string(),
                PersistentSession {
                    conversation_id: "thread-test".to_string(),
                    acp_session_id: None,
                    pid: Some(999),
                    created_at: 1640995200,
                    is_alive: true,
                    stdin: None,
                    message_sender: None,
                    rpc_logger: Arc::new(NoOpRpcLogger),
                    child: None,
                },
            );
        });

        handle.join().unwrap();

        let guard = processes.lock().unwrap();
        assert!(guard.contains_key("thread-test"));
        assert_eq!(guard.get("thread-test").unwrap().pid, Some(999));
    }

    #[test]
    fn test_session_manager_stress_add_remove() {
        let manager = SessionManager::new();

        // Add multiple sessions
        {
            let mut processes = manager.processes.lock().unwrap();
            for i in 0..10 {
                processes.insert(
                    format!("session-{}", i),
                    PersistentSession {
                        conversation_id: format!("session-{}", i),
                        acp_session_id: None,
                        pid: Some(1000 + i as u32),
                        created_at: 1640995200 + i as u64,
                        is_alive: true,
                        stdin: None,
                        message_sender: None,
                        rpc_logger: Arc::new(NoOpRpcLogger),
                        child: None,
                    },
                );
            }
        }

        let statuses = manager.get_process_statuses().unwrap();
        assert_eq!(statuses.len(), 10);

        // Kill some sessions
        for i in 0..5 {
            manager.kill_process(&format!("session-{}", i)).unwrap();
        }

        let statuses = manager.get_process_statuses().unwrap();
        assert_eq!(statuses.len(), 10); // All still there but some not alive
        let alive_count = statuses.iter().filter(|s| s.is_alive).count();
        assert_eq!(alive_count, 5);
    }
}
