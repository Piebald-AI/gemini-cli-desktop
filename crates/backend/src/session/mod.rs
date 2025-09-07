use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader as AsyncBufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::mpsc;
use tokio::time::{Duration, sleep};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

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
    pub yolo: Option<bool>,
}

use crate::acp::{
    AuthenticateParams, ClientCapabilities, ContentBlock, FileSystemCapabilities, InitializeParams,
    InitializeResult, SessionNewParams, SessionNewResult, SessionPromptResult,
    SessionRequestPermissionParams, SessionUpdate, SessionUpdateParams,
};
use crate::cli::StreamAssistantMessageChunkParams;
use crate::events::{
    CliIoPayload, CliIoType, EventEmitter, GeminiOutputPayload, GeminiThoughtPayload, InternalEvent,
};
use crate::rpc::{FileRpcLogger, JsonRpcRequest, JsonRpcResponse, NoOpRpcLogger, RpcLogger};
use anyhow::{Context, Result};

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
    pub working_directory: String,
    pub backend_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessStatus {
    pub conversation_id: String,
    pub pid: Option<u32>,
    pub created_at: u64,
    pub is_alive: bool,
    pub backend_type: String,
}

impl From<&PersistentSession> for ProcessStatus {
    fn from(session: &PersistentSession) -> Self {
        Self {
            conversation_id: session.conversation_id.clone(),
            pid: session.pid,
            created_at: session.created_at,
            is_alive: session.is_alive,
            backend_type: session.backend_type.clone(),
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

    pub fn get_process_statuses(&self) -> Result<Vec<ProcessStatus>> {
        let processes = self
            .processes
            .lock()
            .map_err(|_| anyhow::anyhow!("Failed to lock processes mutex"))?;

        let statuses: Vec<ProcessStatus> = processes.values().map(ProcessStatus::from).collect();

        println!(
            "📊 [STATUS-CHECK] Current process statuses ({} sessions):",
            statuses.len()
        );
        for status in &statuses {
            println!(
                "📊 [STATUS-CHECK]   - {}: {} {} (PID: {:?}, created: {})",
                status.conversation_id,
                if status.is_alive {
                    "ACTIVE"
                } else {
                    "INACTIVE"
                },
                status.backend_type.to_uppercase(),
                status.pid,
                status.created_at
            );
        }

        Ok(statuses)
    }

    pub fn kill_process(&self, conversation_id: &str) -> Result<()> {
        let mut processes = self
            .processes
            .lock()
            .map_err(|_| anyhow::anyhow!("Failed to lock processes mutex"))?;

        if let Some(session) = processes.get_mut(conversation_id) {
            if let Some(mut child) = session.child.take() {
                drop(child.kill());
            } else if let Some(pid) = session.pid {
                let output = {
                    #[cfg(windows)]
                    {
                        use std::os::windows::process::CommandExt;
                        use std::process::Command as StdCommand;

                        let mut cmd = StdCommand::new("taskkill");
                        cmd.args(["/PID", &pid.to_string(), "/F"]);
                        #[cfg(windows)]
                        cmd.creation_flags(CREATE_NO_WINDOW);
                        cmd.output().context("Failed to kill process")?
                    }
                    #[cfg(not(windows))]
                    {
                        use std::process::Command as StdCommand;

                        StdCommand::new("kill")
                            .args(["-9", &pid.to_string()])
                            .output()
                            .context("Failed to kill process")?
                    }
                };

                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    let stderr_lower = stderr.to_lowercase();
                    #[cfg(windows)]
                    {
                        // Treat "not found" as success to make kill idempotent in tests and runtime
                        if stderr_lower.contains("not found") {
                            // Consider the process already gone
                        } else {
                            anyhow::bail!("Failed to kill process {pid}: {stderr}");
                        }
                    }
                    #[cfg(not(windows))]
                    {
                        if stderr_lower.contains("no such process") {
                            // Consider the process already gone
                        } else {
                            anyhow::bail!("Failed to kill process {pid}: {stderr}");
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
    request: &JsonRpcRequest,
    stdin: &mut ChildStdin,
    reader: &mut AsyncBufReader<ChildStdout>,
    session_id: &str,
    emitter: &E,
    rpc_logger: &Arc<dyn RpcLogger>,
) -> Result<Option<JsonRpcResponse>> {
    let request_json = serde_json::to_string(request).context("Failed to serialize request")?;

    println!("🔍 RAW INPUT TO GEMINI CLI: {request_json}");
    let _ = rpc_logger.log_rpc(&request_json);

    // Send request
    stdin
        .write_all(request_json.as_bytes())
        .await
        .context("Failed to write request")?;
    stdin
        .write_all(if cfg!(windows) { b"\r\n" } else { b"\n" })
        .await
        .context("Failed to write newline")?;
    stdin.flush().await.context("Failed to flush")?;

    let _ = emitter.emit(
        &format!("cli-io-{session_id}"),
        CliIoPayload {
            io_type: CliIoType::Input,
            data: request_json,
        },
    );

    // Read response - keep reading lines until we get valid JSON
    println!("⏳ Waiting for response from CLI...");
    let mut line = String::new();
    let trimmed_line = loop {
        line.clear();
        if let Err(e) = reader.read_line(&mut line).await {
            anyhow::bail!("Failed to read response: {e}");
        }
        println!("Read line from CLI: '{}'", line.trim());

        let trimmed = line.trim();
        println!("🔍 RAW OUTPUT FROM GEMINI CLI: {trimmed}");

        let _ = rpc_logger.log_rpc(trimmed);

        let _ = emitter.emit(
            &format!("cli-io-{session_id}"),
            CliIoPayload {
                io_type: CliIoType::Output,
                data: trimmed.to_string(),
            },
        );

        // Skip non-JSON lines like "Data collection is disabled."
        if trimmed.is_empty() || (!trimmed.starts_with('{') && !trimmed.starts_with('[')) {
            println!("🔍 Skipping non-JSON line: {trimmed}");
            continue;
        }

        // Try to parse as JSON - if it fails, continue reading
        if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            // Valid JSON found
            break trimmed.to_string();
        } else {
            println!("🔍 Line is not valid JSON, continuing: {trimmed}");
            continue;
        }
    };

    let response = serde_json::from_str::<JsonRpcResponse>(&trimmed_line)
        .context("Failed to parse response")?;

    if let Some(error) = &response.error {
        anyhow::bail!("CLI Error: {error:?}");
    }

    Ok(Some(response))
}

pub async fn initialize_session<E: EventEmitter + 'static>(
    session_id: String,
    working_directory: String,
    model: String,
    backend_config: Option<QwenConfig>,
    gemini_auth: Option<GeminiAuthConfig>,
    emitter: E,
    session_manager: &SessionManager,
) -> Result<(mpsc::UnboundedSender<String>, Arc<dyn RpcLogger>)> {
    let is_qwen = backend_config.is_some();
    let cli_name = if is_qwen { "Qwen Code" } else { "Gemini" };
    println!("🚀 [HANDSHAKE] Starting {cli_name} session initialization for: {session_id}");
    println!("🚀 [HANDSHAKE] Working directory: {working_directory}");
    println!("🚀 [HANDSHAKE] Model: {model}");
    println!(
        "🚀 [HANDSHAKE] Backend config present: {}",
        backend_config.is_some()
    );
    println!(
        "🚀 [HANDSHAKE] Gemini auth config present: {}",
        gemini_auth.is_some()
    );
    if let Some(auth) = &gemini_auth {
        println!("🚀 [HANDSHAKE] Auth method: {}", auth.method);
    }

    let rpc_logger: Arc<dyn RpcLogger> =
        match FileRpcLogger::new(Some(&working_directory), Some(cli_name)) {
            Ok(logger) => {
                println!("📝 [HANDSHAKE] RPC logging enabled for session: {session_id}");
                let _ = logger.cleanup_old_logs();
                Arc::new(logger)
            }
            Err(e) => {
                println!(
                    "⚠️ [HANDSHAKE] Failed to create RPC logger for session {session_id}: {e}"
                );
                Arc::new(NoOpRpcLogger)
            }
        };

    let (message_tx, message_rx) = mpsc::unbounded_channel::<String>();

    let mut cmd = {
        if let Some(config) = &backend_config {
            println!("🔧 [HANDSHAKE] Setting up Qwen Code environment");
            // Set environment variables for Qwen Code (OpenAI-compatible API)
            unsafe {
                std::env::set_var("OPENAI_API_KEY", &config.api_key);
                std::env::set_var("OPENAI_BASE_URL", &config.base_url);
                std::env::set_var("OPENAI_MODEL", &config.model);
            }
            println!("🔧 [HANDSHAKE] Set OPENAI_BASE_URL: {}", config.base_url);
            println!("🔧 [HANDSHAKE] Set OPENAI_MODEL: {}", config.model);

            #[cfg(windows)]
            {
                println!(
                    "🔧 [HANDSHAKE] Creating Windows Qwen command: cmd.exe /C qwen --experimental-acp"
                );
                let mut c = Command::new("cmd.exe");
                c.args(["/C", "qwen", "--experimental-acp"]);
                #[cfg(windows)]
                c.creation_flags(CREATE_NO_WINDOW);
                c
            }
            #[cfg(not(windows))]
            {
                println!(
                    "🔧 [HANDSHAKE] Creating Unix Qwen command: sh -lc 'qwen --experimental-acp'"
                );
                let mut c = Command::new("sh");
                let qwen_command = "qwen --experimental-acp".to_string();
                c.args(["-lc", &qwen_command]);
                c
            }
        } else {
            println!("🔧 [HANDSHAKE] Setting up Gemini CLI environment");

            // Configure environment based on Gemini auth method
            if let Some(auth) = &gemini_auth {
                match auth.method.as_str() {
                    "gemini-api-key" => {
                        if let Some(api_key) = &auth.api_key {
                            println!("🔧 [HANDSHAKE] Setting GEMINI_API_KEY environment variable");
                            unsafe {
                                std::env::set_var("GEMINI_API_KEY", api_key);
                            }
                        } else {
                            println!(
                                "⚠️ [HANDSHAKE] No API key provided for gemini-api-key auth method"
                            );
                        }
                    }
                    "vertex-ai" => {
                        if let Some(project) = &auth.vertex_project {
                            println!("🔧 [HANDSHAKE] Setting GOOGLE_CLOUD_PROJECT: {project}");
                            unsafe {
                                std::env::set_var("GOOGLE_CLOUD_PROJECT", project);
                            }
                        }
                        if let Some(location) = &auth.vertex_location {
                            println!("🔧 [HANDSHAKE] Setting GOOGLE_CLOUD_LOCATION: {location}");
                            unsafe {
                                std::env::set_var("GOOGLE_CLOUD_LOCATION", location);
                            }
                        }
                    }
                    _ => {
                        println!(
                            "🔧 [HANDSHAKE] Using auth method: {} (no env vars needed)",
                            auth.method
                        );
                    }
                }
            } else {
                println!("🔧 [HANDSHAKE] No auth config provided, using default OAuth");
            }

            #[cfg(windows)]
            {
                let yolo_flag = gemini_auth.as_ref().and_then(|a| a.yolo).unwrap_or(false);
                // Use the working gemini executable path instead of just "gemini"
                let gemini_path = r"gemini";
                let mut args = vec!["/C", gemini_path, "--model", &model];
                if yolo_flag {
                    args.push("--yolo");
                }
                args.push("--experimental-acp");

                let command_display = if yolo_flag {
                    format!("cmd.exe /C {gemini_path} --model {model} --yolo --experimental-acp")
                } else {
                    format!("cmd.exe /C {gemini_path} --model {model} --experimental-acp")
                };
                println!("🔧 [HANDSHAKE] Creating Windows Gemini command: {command_display}");

                let mut c = Command::new("cmd.exe");
                c.args(args);
                // Force unbuffered output for Python-based CLIs
                c.env("PYTHONUNBUFFERED", "1");
                #[cfg(windows)]
                c.creation_flags(CREATE_NO_WINDOW);
                c
            }
            #[cfg(not(windows))]
            {
                let yolo_flag = gemini_auth.as_ref().and_then(|a| a.yolo).unwrap_or(false);
                let gemini_command = if yolo_flag {
                    format!("gemini --model {model} --yolo --experimental-acp")
                } else {
                    format!("gemini --model {model} --experimental-acp")
                };
                println!(
                    "🔧 [HANDSHAKE] Creating Unix Gemini command: sh -lc '{}'",
                    gemini_command
                );
                let mut c = Command::new("sh");
                c.args(["-lc", &gemini_command]);
                c
            }
        }
    };

    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if !working_directory.is_empty() {
        println!("🗂️ [HANDSHAKE] Setting working directory to: {working_directory}");
        cmd.current_dir(&working_directory);
    }

    // Pre-flight check: Test if CLI is available
    println!("🔍 [PRECHECK] Testing CLI availability...");
    if !is_qwen {
        // Test Gemini CLI availability
        let test_result = if cfg!(windows) {
            #[cfg(windows)]
            {
                std::process::Command::new("cmd.exe")
                    .args(["/C", "gemini", "--version"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output()
            }
            #[cfg(not(windows))]
            {
                std::process::Command::new("gemini")
                    .arg("--version")
                    .output()
            }
        } else {
            std::process::Command::new("gemini")
                .arg("--version")
                .output()
        };

        match test_result {
            Ok(output) => {
                if output.status.success() {
                    println!("✅ [PRECHECK] Gemini CLI is available and responding");
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    println!("❌ [PRECHECK] Gemini CLI returned error: {stderr}");
                    anyhow::bail!(
                        "Gemini CLI test failed. Please ensure:\n1. Gemini CLI is properly installed\n2. You have an active internet connection\n3. Authentication is configured correctly\n\nError: {stderr}"
                    )
                }
            }
            Err(e) => {
                println!("❌ [PRECHECK] Cannot execute Gemini CLI: {e}");
                anyhow::bail!(
                    "Gemini CLI not found or not executable. Please ensure:\n1. Gemini CLI is installed (run: pip install google-generativeai)\n2. 'gemini' command is in your PATH\n3. You have proper permissions to execute it\n\nError: {e}"
                )
            }
        }
    } else {
        println!("🔍 [PRECHECK] Skipping CLI check for Qwen (uses API directly)");
    }

    println!("🔄 [HANDSHAKE] Spawning CLI process...");
    let mut child = cmd.spawn().map_err(|e| {
        let cmd_name = if is_qwen { "qwen" } else { "gemini" };
        println!("❌ [HANDSHAKE] Failed to spawn {cmd_name} process: {e}");
        #[cfg(windows)]
        {
            anyhow::anyhow!(
                "Session initialization failed: Failed to run {cmd_name} command via cmd: {e}"
            )
        }
        #[cfg(not(windows))]
        {
            anyhow::anyhow!(
                "Session initialization failed: Failed to run {} command via shell: {e}",
                cmd_name
            )
        }
    })?;

    println!("✅ [HANDSHAKE] CLI process spawned successfully");

    let pid = child.id();
    println!("🔗 [HANDSHAKE] CLI process PID: {pid:?}");

    let mut stdin = child
        .stdin
        .take()
        .context("Failed to get stdin from child process")?;
    let stdout = child
        .stdout
        .take()
        .context("Failed to get stdout from child process")?;
    let stderr = child
        .stderr
        .take()
        .context("Failed to get stderr from child process")?;

    let mut reader = AsyncBufReader::new(stdout);
    let mut stderr_reader = AsyncBufReader::new(stderr);

    // Spawn a task to log stderr
    let session_id_for_stderr = session_id.clone();
    let emitter_for_stderr = emitter.clone();
    tokio::spawn(async move {
        let mut line = String::new();
        loop {
            match stderr_reader.read_line(&mut line).await {
                Ok(0) => break,
                Ok(_) => {
                    println!("🔍 STDERR from CLI: {}", line.trim());
                    let _ = emitter_for_stderr.emit(
                        &format!("cli-io-{}", session_id_for_stderr),
                        CliIoPayload {
                            io_type: CliIoType::Error,
                            data: line.clone(),
                        },
                    );
                    line.clear();
                }
                Err(_) => break,
            }
        }
    });
    println!("📡 [HANDSHAKE] Set up stdin/stdout/stderr communication channels");

    // Step 1: Initialize
    println!("🤝 [HANDSHAKE] Step 1/3: Sending initialize request");
    let init_params = InitializeParams {
        protocol_version: 1,
        client_capabilities: ClientCapabilities {
            fs: FileSystemCapabilities {
                read_text_file: false,
                write_text_file: false,
            },
        },
    };
    println!("🤝 [HANDSHAKE] Initialize params: protocol_version=1");

    let init_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "initialize".to_string(),
        params: serde_json::to_value(init_params).context("Failed to serialize init params")?,
    };

    // { "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": { "protocolVersion": 1, "clientCapabilities": { "fs": { "readTextFile": true, "writeTextFile": true } } } }

    // The initialize message may end up getting sent before Gemini has fully started up, so we'll
    // loop and sleep for a short time until we get a JSON response back from Gemini.
    let init_response;
    let mut retries = 0;
    // Increased from 5 to 20 retries to allow for longer Gemini startup times
    const MAX_RETRIES: u32 = 20;
    loop {
        retries += 1;
        if retries == MAX_RETRIES {
            anyhow::bail!("Max number of retries reached");
        }
        let init_response_result = send_jsonrpc_request(
            &init_request,
            &mut stdin,
            &mut reader,
            &session_id,
            &emitter,
            &rpc_logger,
        )
        .await
        .map_err(|e| {
            println!("❌ [HANDSHAKE] Initialize request failed: {e}");
            e
        });

        // `None` indicates that we haven't gotten any JSON response from Gemini yet.
        match init_response_result {
            Ok(None) => {
                println!("No response received yet; sending again");
                sleep(Duration::from_secs(2)).await;
            }
            Ok(Some(res)) => {
                init_response = res;
                break;
            }
            Err(e) => return Err(e),
        }
    }

    let _init_result: InitializeResult =
        serde_json::from_value(init_response.result.unwrap_or_default())
            .context("Failed to parse init result")?;

    println!("✅ [HANDSHAKE] Step 1/3: Initialize completed successfully for: {session_id}");

    // Step 2: Create new session
    println!("📁 [HANDSHAKE] Step 2/3: Creating new ACP session");
    let session_params = SessionNewParams {
        cwd: working_directory.clone(),
        mcp_servers: vec![], // No MCP servers for now
    };
    println!("📁 [HANDSHAKE] Session params: cwd={working_directory}, mcp_servers=[]");

    let session_request = JsonRpcRequest {
        jsonrpc: "2.0".to_string(),
        id: 3,
        method: "session/new".to_string(),
        params: serde_json::to_value(session_params)
            .context("Failed to serialize session params")?,
    };

    let mut session_response = send_jsonrpc_request(
        &session_request,
        &mut stdin,
        &mut reader,
        &session_id,
        &emitter,
        &rpc_logger,
    )
    .await;

    if let Err(e) = session_response {
        let msg = e.to_string();
        if msg.contains("Authentication required") {
            println!("⚠️ [HANDSHAKE] Session creation request failed - needs auth");
            // Step 3: Authenticate - choose method based on configuration
            println!("🔐 [HANDSHAKE] Step 3/3: Determining authentication method");
            let auth_method_id = if let Some(auth) = &gemini_auth {
                println!("🔐 [HANDSHAKE] Using provided auth method: {}", auth.method);
                auth.method.clone()
            } else if backend_config.is_some() {
                println!("🔐 [HANDSHAKE] Using gemini-api-key auth for Qwen backend");
                // Qwen uses API key auth
                "gemini-api-key".to_string()
            } else {
                println!("🔐 [HANDSHAKE] Using default oauth-personal auth method");
                // Default to OAuth for Gemini if no config provided
                "oauth-personal".to_string()
            };

            let auth_params = AuthenticateParams {
                method_id: auth_method_id.clone(),
            };
            println!("🔐 [HANDSHAKE] Sending authenticate request with method: {auth_method_id}");

            let auth_request = JsonRpcRequest {
                jsonrpc: "2.0".to_string(),
                id: 2,
                method: "authenticate".to_string(),
                params: serde_json::to_value(auth_params)
                    .context("Failed to serialize auth params")?,
            };

            let _auth_response = send_jsonrpc_request(
                &auth_request,
                &mut stdin,
                &mut reader,
                &session_id,
                &emitter,
                &rpc_logger,
            )
            .await
            .map_err(|e| {
                println!("❌ [HANDSHAKE] Authentication request failed: {e}");
                e
            })?;

            println!(
                "✅ [HANDSHAKE] Step 3/3: Authentication completed successfully for: {session_id}"
            );

            session_response = send_jsonrpc_request(
                &session_request,
                &mut stdin,
                &mut reader,
                &session_id,
                &emitter,
                &rpc_logger,
            )
            .await;
        } else {
            println!("❌ [HANDSHAKE] Session creation request failed: {msg}");
            return Err(e);
        }
    };

    let session_response = session_response?;

    let session_result: SessionNewResult = if let Some(result) = session_response {
        serde_json::from_value(result.result.unwrap_or_default())
            .context("Failed to parse session result")?
    } else {
        anyhow::bail!(
            "No valid JSON response received from Gemini CLI initialize request. This usually indicates:\n1. Gemini CLI is not properly installed or not in PATH\n2. Authentication failed (check API keys or OAuth setup)\n3. Network connectivity issues\n4. CLI process crashed or failed to start\n\nPlease check the console output above for more details."
        );
    };

    println!(
        "✅ [HANDSHAKE] Step 3/3: ACP session created successfully with ID: {}",
        session_result.session_id
    );

    {
        println!("💾 [HANDSHAKE] Storing session in process manager");
        let processes = session_manager.get_processes();
        let mut processes = processes.lock().map_err(|_| {
            println!("❌ [HANDSHAKE] Failed to lock processes mutex");
            anyhow::anyhow!("Session initialization failed: Failed to lock processes")
        })?;

        let backend_type = if backend_config.is_some() {
            "qwen"
        } else {
            "gemini"
        };
        let persistent_session = PersistentSession {
            conversation_id: session_id.clone(),
            acp_session_id: Some(session_result.session_id.clone()),
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
            working_directory: working_directory.clone(),
            backend_type: backend_type.to_string(),
        };

        processes.insert(session_id.clone(), persistent_session);
        println!(
            "💾 [HANDSHAKE] {} session stored successfully - marking as ALIVE",
            backend_type.to_uppercase()
        );
        println!(
            "💾 [HANDSHAKE] Session details: conversation_id={}, backend={}, acp_session_id={}, pid={:?}, is_alive=true",
            session_id,
            backend_type.to_uppercase(),
            session_result.session_id,
            pid
        );
    }

    // Emit real-time status change - session became active
    if let Ok(statuses) = session_manager.get_process_statuses() {
        println!("📡 [STATUS-WS] Emitting process status change after session became active");
        let _ = emitter.emit("process-status-changed", &statuses);
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
                // Deprecated events - no-op, use ACP equivalents instead
                #[allow(deprecated)]
                InternalEvent::ToolCall { .. } => {
                    // No-op: Use AcpSessionUpdate instead
                }
                #[allow(deprecated)]
                InternalEvent::ToolCallUpdate { .. } => {
                    // No-op: Use AcpSessionUpdate instead
                }
                #[allow(deprecated)]
                InternalEvent::ToolCallConfirmation { .. } => {
                    // No-op: Use AcpPermissionRequest instead
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
                InternalEvent::AcpSessionUpdate { session_id, update } => {
                    println!(
                        "🔧 [EDIT-DEBUG] Emitting acp-session-update-{session_id} event: {update:?}"
                    );
                    let emit_result =
                        emitter.emit(&format!("acp-session-update-{session_id}"), update);
                    if emit_result.is_err() {
                        println!(
                            "🔧 [EDIT-DEBUG] Failed to emit acp-session-update event: {emit_result:?}"
                        );
                    } else {
                        println!(
                            "🔧 [EDIT-DEBUG] Successfully emitted acp-session-update-{session_id} event"
                        );
                    }
                }
                InternalEvent::AcpPermissionRequest {
                    session_id,
                    request_id,
                    request,
                } => {
                    println!(
                        "🚨 BACKEND: Emitting acp-permission-request-{session_id} with request_id={request_id}"
                    );
                    println!(
                        "🚨 BACKEND: Request payload: {:?}",
                        serde_json::json!({
                            "request_id": request_id,
                            "request": &request
                        })
                    );
                    let _ = emitter.emit(
                        &format!("acp-permission-request-{session_id}"),
                        serde_json::json!({
                            "request_id": request_id,
                            "request": request
                        }),
                    );
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
        println!("🔄 [HANDSHAKE] Starting I/O handler task for session: {session_id_clone}");
        handle_session_io_internal(
            session_id_clone,
            reader,
            message_rx,
            processes_clone,
            event_tx,
        )
        .await;
        println!("💀 [HANDSHAKE] I/O handler task exited for session!");
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
    println!("🔄 [IO-HANDLER] Starting I/O handler loop for session: {session_id}");
    let mut line_buffer = String::new();

    loop {
        println!("🔄 [IO-HANDLER] Waiting for message or CLI output for session: {session_id}");
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
                        if let Err(e) = stdin.write_all(if cfg!(windows) { b"\r\n" } else { b"\n" }).await {
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
                        println!("💀 [SESSION-LIFECYCLE] CLI process closed (EOF) for session: {session_id}");
                        println!("💀 [SESSION-LIFECYCLE] This will cause session to become INACTIVE");
                        break;
                    }
                    Ok(bytes_read) => {
                        println!("📥 [SESSION-LIFECYCLE] Read {bytes_read} bytes from CLI for session: {session_id}");
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

                        let line_preview = line.chars().take(100).collect::<String>();
                        println!("🔧 [EDIT-DEBUG] Processing CLI output line: {line_preview}");

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
                        println!("💀 [SESSION-LIFECYCLE] Error reading from CLI for session {session_id}: {e}");
                        println!("💀 [SESSION-LIFECYCLE] This will cause session to become INACTIVE");
                        break;
                    }
                }
            }
        }
    }

    {
        println!(
            "💀 [SESSION-LIFECYCLE] I/O handler exiting, marking session as INACTIVE: {session_id}"
        );
        let mut processes_guard = processes.lock().unwrap();
        if let Some(session) = processes_guard.get_mut(&session_id) {
            println!("💀 [SESSION-LIFECYCLE] Setting is_alive=false for session: {session_id}");
            session.is_alive = false;
            session.stdin = None;
            session.message_sender = None;
        } else {
            println!(
                "⚠️ [SESSION-LIFECYCLE] Session {session_id} not found in processes map when trying to mark inactive"
            );
        }
    }

    println!("🛑 [SESSION-LIFECYCLE] Session I/O handler finished for: {session_id}");
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
    println!("🔧 [EDIT-DEBUG] handle_cli_output_line called for session: {session_id}");
    println!("🔧 [EDIT-DEBUG] Line content: {line}");

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
                                    }
                                    _ => {
                                        // Handle other content types as needed
                                        println!("Received non-text content block: {content:?}");
                                    }
                                }
                            }
                            SessionUpdate::AgentThoughtChunk { content } => {
                                match content {
                                    ContentBlock::Text { text } => {
                                        let _ = event_tx.send(InternalEvent::GeminiThought {
                                            session_id: session_id.to_string(),
                                            payload: GeminiThoughtPayload { thought: text },
                                        });
                                    }
                                    _ => {
                                        // Handle other content types as needed
                                        println!(
                                            "Received non-text thought content block: {content:?}"
                                        );
                                    }
                                }
                            }
                            SessionUpdate::ToolCall {
                                tool_call_id,
                                status,
                                title,
                                content,
                                locations,
                                kind,
                                server_name,
                                tool_name,
                            } => {
                                println!(
                                    "🔧 [EDIT-DEBUG] Backend received ToolCall from CLI: tool_call_id={tool_call_id}, status={status:?}, title={title}"
                                );

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
                                        server_name: server_name.clone(),
                                        tool_name: tool_name.clone(),
                                    },
                                });

                                if emit_result.is_err() {
                                    println!(
                                        "🔧 [EDIT-DEBUG] Failed to send ToolCall event: {emit_result:?}"
                                    );
                                } else {
                                    println!(
                                        "🔧 [EDIT-DEBUG] Successfully sent ToolCall event for: {tool_call_id}"
                                    );
                                }
                            }
                            SessionUpdate::ToolCallUpdate {
                                tool_call_id,
                                status,
                                content,
                                server_name,
                                tool_name,
                            } => {
                                println!(
                                    "🔧 [EDIT-DEBUG] Backend received ToolCallUpdate from CLI: tool_call_id={tool_call_id}, status={status:?}"
                                );
                                println!(
                                    "🔧 [EDIT-DEBUG] ToolCallUpdate has content: {} items",
                                    content.len()
                                );

                                // Emit pure ACP SessionUpdate event - no legacy conversion
                                let _ = event_tx.send(InternalEvent::AcpSessionUpdate {
                                    session_id: session_id.to_string(),
                                    update: SessionUpdate::ToolCallUpdate {
                                        tool_call_id: tool_call_id.clone(),
                                        status: status.clone(),
                                        content: content.clone(),
                                        server_name: server_name.clone(),
                                        tool_name: tool_name.clone(),
                                    },
                                });
                                println!(
                                    "🔧 [EDIT-DEBUG] Sent AcpSessionUpdate event for ToolCallUpdate: {tool_call_id}"
                                );
                            }
                        }
                    }
                }
                "session/request_permission" => {
                    println!("🔔 BACKEND: Received session/request_permission from CLI");
                    println!("🔔 BACKEND: JSON value: {json_value:?}");
                    // First try to parse and log what fails
                    let params_value = json_value.get("params").cloned().unwrap_or_default();
                    println!(
                        "🔔 BACKEND: Trying to parse params: {}",
                        serde_json::to_string_pretty(&params_value)
                            .unwrap_or("failed to stringify".to_string())
                    );

                    if let Ok(params) =
                        serde_json::from_value::<SessionRequestPermissionParams>(params_value)
                        && let Some(id) = json_value.get("id").and_then(|i| i.as_u64())
                    {
                        println!("🔔 BACKEND: Successfully parsed permission request with id={id}");
                        println!(
                            "🔔 BACKEND: Tool call ID in request: {}",
                            params.tool_call.tool_call_id
                        );
                        // Emit pure ACP permission request - no legacy conversion
                        let _ = event_tx.send(InternalEvent::AcpPermissionRequest {
                            session_id: session_id.to_string(),
                            request_id: id,
                            request: params,
                        });
                        println!(
                            "🔔 BACKEND: Sent InternalEvent::AcpPermissionRequest to event_tx"
                        );
                    } else {
                        // Try to get the specific parsing error
                        let parse_result = serde_json::from_value::<SessionRequestPermissionParams>(
                            json_value.get("params").cloned().unwrap_or_default(),
                        );
                        println!(
                            "❌ BACKEND: Failed to parse session/request_permission params: {:?}",
                            parse_result.err()
                        );
                    }
                }
                _ => {}
            }
        } else if json_value.get("result").is_some() {
            // Handle JSON-RPC responses (as opposed to notifications)
            if let Ok(result) = serde_json::from_value::<SessionPromptResult>(
                json_value.get("result").cloned().unwrap_or_default(),
            ) && result.stop_reason == "end_turn"
            {
                let _ = event_tx.send(InternalEvent::GeminiTurnFinished {
                    session_id: session_id.to_string(),
                });
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
            working_directory: ".".to_string(),
            backend_type: "gemini".to_string(),
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
            backend_type: "gemini".to_string(),
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
            working_directory: ".".to_string(),
            backend_type: "gemini".to_string(),
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
                    working_directory: ".".to_string(),
                    backend_type: "gemini".to_string(),
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
                    working_directory: ".".to_string(),
                    backend_type: "gemini".to_string(),
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
                    working_directory: ".".to_string(),
                    backend_type: "gemini".to_string(),
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
        handle_cli_output_line("test-session", "invalid json", &tx, &processes).await;
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
        handle_cli_output_line("test-session", &input, &tx, &processes).await;

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
        handle_cli_output_line("test-session", &input, &tx, &processes).await;

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
        handle_cli_output_line("test-session", &input, &tx, &processes).await;

        // Should not receive any events for non-end_turn responses
        let result = timeout(Duration::from_millis(100), rx.recv()).await;
        assert!(
            result.is_err(),
            "Should not receive events for non-end_turn responses"
        );
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
        handle_cli_output_line("test-session", &input, &tx, &processes).await;
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
                let error_msg = e.to_string();
                if error_msg.contains("Session initialization failed") {
                    // This is expected when CLI is not available
                    println!("Session init failed as expected (CLI not available): {e}");
                } else {
                    panic!("Unexpected error: {}", e);
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
                    working_directory: ".".to_string(),
                    backend_type: "gemini".to_string(),
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
                    working_directory: ".".to_string(),
                    backend_type: "gemini".to_string(),
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
                            working_directory: ".".to_string(),
                            backend_type: "gemini".to_string(),
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
                    working_directory: ".".to_string(),
                    backend_type: "gemini".to_string(),
                },
            );
        });

        handle.join().unwrap();

        let guard = processes.lock().unwrap();
        assert!(guard.contains_key("thread-test"));
        assert_eq!(guard.get("thread-test").unwrap().pid, Some(999));
    }

    #[test]
    fn test_skip_non_json_lines() {
        // Test that we correctly identify non-JSON lines that should be skipped
        let non_json_lines = vec![
            "Data collection is disabled.",
            "",
            "Warning: Something happened",
            "Loading...",
            "debug: info",
        ];

        for line in non_json_lines {
            // These should be identified as non-JSON and skipped
            let is_json_candidate = !line.trim().is_empty()
                && (line.trim().starts_with('{') || line.trim().starts_with('['));
            assert!(
                !is_json_candidate,
                "Line '{}' should be skipped as non-JSON",
                line
            );
        }

        // Test valid JSON lines
        let json_lines = vec![
            r#"{"jsonrpc": "2.0", "id": 1, "result": {}}"#,
            r#"[{"type": "test"}]"#,
            r#"{"method": "test"}"#,
        ];

        for line in json_lines {
            let is_json_candidate = !line.trim().is_empty()
                && (line.trim().starts_with('{') || line.trim().starts_with('['));
            assert!(
                is_json_candidate,
                "Line '{}' should be considered as potential JSON",
                line
            );

            // Verify it's actually parseable JSON
            assert!(
                serde_json::from_str::<serde_json::Value>(line.trim()).is_ok(),
                "Line '{}' should be valid JSON",
                line
            );
        }
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
                        working_directory: ".".to_string(),
                        backend_type: "gemini".to_string(),
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
