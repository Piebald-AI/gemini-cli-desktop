use include_dir::{Dir, include_dir};
use rocket::{
    Shutdown, State, get,
    http::{ContentType, Status},
    post, routes,
    serde::json::Json,
};
use rocket_ws::{Message, Stream, WebSocket};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
};
use tokio::sync::{Mutex, mpsc as tokio_mpsc};

// Import backend functionality
use backend::{
    DirEntry, EnrichedProject, EventEmitter, GeminiBackend, ProcessStatus, RecentChat,
    SearchFilters, SearchResult,
};

static FRONTEND_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/../../frontend/dist");

// =====================================
// WebSocket Connection Management
// =====================================

/// Manages active WebSocket connections for event broadcasting
#[derive(Clone)]
pub struct WebSocketManager {
    connections: Arc<Mutex<Vec<tokio_mpsc::UnboundedSender<String>>>>,
    connection_counter: Arc<AtomicU64>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for WebSocketManager {
    fn default() -> Self {
        Self {
            connections: Arc::new(Mutex::new(Vec::new())),
            connection_counter: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl WebSocketManager {
    /// Register a new WebSocket connection
    pub async fn add_connection(&self, sender: tokio_mpsc::UnboundedSender<String>) -> u64 {
        let connection_id = self.connection_counter.fetch_add(1, Ordering::SeqCst);
        let mut connections = self.connections.lock().await;
        connections.push(sender);
        println!(
            "📡 WebSocket connection added (ID: {}). Total connections: {}",
            connection_id,
            connections.len()
        );
        connection_id
    }

    /// Remove a specific WebSocket connection
    pub async fn remove_connection(&self, sender: &tokio_mpsc::UnboundedSender<String>) {
        let mut connections = self.connections.lock().await;
        if let Some(pos) = connections
            .iter()
            .position(|conn| std::ptr::eq(conn, sender))
        {
            connections.remove(pos);
            println!(
                "📡 WebSocket connection removed. Total connections: {}",
                connections.len()
            );
        }
    }

    /// Broadcast an event message to all connected clients
    pub async fn broadcast(&self, message: String) -> backend::BackendResult<()> {
        let mut connections = self.connections.lock().await;
        let mut failed_indices = Vec::new();

        // Send to all connections, tracking failures
        for (i, sender) in connections.iter().enumerate() {
            if sender.send(message.clone()).is_err() {
                failed_indices.push(i);
            }
        }

        // Remove failed connections (iterate backwards to maintain indices)
        for &i in failed_indices.iter().rev() {
            connections.remove(i);
        }

        if !failed_indices.is_empty() {
            println!(
                "📡 Removed {} dead WebSocket connections. Active: {}",
                failed_indices.len(),
                connections.len()
            );
        }

        Ok(())
    }

    /// Get the number of active connections
    pub async fn connection_count(&self) -> usize {
        self.connections.lock().await.len()
    }

    /// Close all WebSocket connections gracefully
    pub async fn close_all_connections(&self) {
        let mut connections = self.connections.lock().await;
        println!(
            "📡 Closing {} WebSocket connections for graceful shutdown",
            connections.len()
        );
        connections.clear();
    }
}

/// WebSocket event message format with sequence number for ordering
#[derive(Serialize)]
struct WebSocketEvent<T> {
    event: String,
    payload: T,
    sequence: u64,
}

// =====================================
// WebSockets EventEmitter Implementation
// =====================================

/// WebSocket-based event emitter that implements EventEmitter
#[derive(Clone)]
pub struct WebSocketsEventEmitter {
    sequence_counter: Arc<AtomicU64>,
    event_sender: mpsc::Sender<String>,
}

impl WebSocketsEventEmitter {
    pub fn new(ws_manager: WebSocketManager) -> Self {
        // Create synchronous channel for ordered event processing
        let (event_sender, event_receiver) = mpsc::channel::<String>();

        // Spawn async worker task to bridge sync channel to async WebSocket broadcast
        let ws_manager_worker = ws_manager.clone();
        std::thread::spawn(move || {
            // Create async runtime for this worker thread
            let rt = tokio::runtime::Runtime::new().unwrap();
            rt.block_on(async move {
                // Process events in order from synchronous channel
                while let Ok(message) = event_receiver.recv() {
                    if let Err(e) = ws_manager_worker.broadcast(message).await {
                        eprintln!("❌ Failed to broadcast WebSocket event: {e}");
                    }
                }
            });
        });

        Self {
            sequence_counter: Arc::new(AtomicU64::new(0)),
            event_sender,
        }
    }
}

impl EventEmitter for WebSocketsEventEmitter {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> backend::BackendResult<()> {
        // Get next sequence number for ordering
        let sequence = self.sequence_counter.fetch_add(1, Ordering::SeqCst);

        // Create WebSocket event message with sequence number for ordering
        let ws_event = WebSocketEvent {
            event: event.to_string(),
            payload,
            sequence,
        };

        // Serialize to JSON
        let message = serde_json::to_string(&ws_event)
            .map_err(|e| backend::BackendError::JsonError(e.to_string()))?;

        // Send synchronously to ordered channel - this maintains perfect ordering
        self.event_sender
            .send(message)
            .map_err(|_| backend::BackendError::ChannelError)?;

        Ok(())
    }
}

// =====================================
// Application State
// =====================================

struct AppState {
    backend: Arc<Mutex<GeminiBackend<WebSocketsEventEmitter>>>,
    ws_manager: WebSocketManager,
}

// =====================================
// Request/Response Types
// =====================================

#[derive(Serialize, Deserialize)]
struct StartSessionRequest {
    session_id: String,
    working_directory: Option<String>,
    model: Option<String>,
    backend_config: Option<backend::session::QwenConfig>,
    gemini_auth: Option<backend::session::GeminiAuthConfig>,
}

#[derive(Serialize, Deserialize)]
struct SendMessageRequest {
    session_id: String,
    message: String,
    conversation_history: String,
    model: Option<String>,
    backend_config: Option<backend::session::QwenConfig>,
    gemini_auth: Option<backend::session::GeminiAuthConfig>,
}

#[derive(Serialize, Deserialize)]
struct KillProcessRequest {
    conversation_id: String,
}

#[derive(Serialize, Deserialize)]
struct ToolConfirmationRequest {
    session_id: String,
    request_id: u32,
    tool_call_id: String,
    outcome: String,
}

#[derive(Serialize, Deserialize)]
struct ExecuteCommandRequest {
    command: String,
}

#[derive(Serialize, Deserialize)]
struct GenerateTitleRequest {
    message: String,
    model: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ValidateDirectoryRequest {
    path: String,
}

#[derive(Serialize, Deserialize)]
struct IsHomeDirectoryRequest {
    path: String,
}

#[derive(Serialize, Deserialize)]
struct ListDirectoryRequest {
    path: String,
}

#[derive(Serialize, Deserialize)]
struct GetParentDirectoryRequest {
    path: String,
}

/// Serves the frontend for Gemini Desktop from the embedded built files.
#[get("/<path..>")]
fn index(path: PathBuf) -> Result<(ContentType, &'static [u8]), Status> {
    let mut path = path.to_str().unwrap().trim();
    if path.is_empty() {
        path = "index.html";
    }

    let file = FRONTEND_DIR.get_file(path).ok_or(Status::NotFound)?;

    Ok((
        ContentType::from_extension(path.split('.').next_back().unwrap()).unwrap(),
        file.contents(),
    ))
}

// =====================================
// Backend API Routes
// =====================================

#[get("/projects?<limit>&<offset>")]
async fn list_projects(
    limit: Option<u32>,
    offset: Option<u32>,
    state: &State<AppState>,
) -> Result<Json<serde_json::Value>, Status> {
    let lim = limit.unwrap_or(25);
    let off = offset.unwrap_or(0);
    let backend = state.backend.lock().await;
    match backend.list_projects(lim, off).await {
        Ok(resp) => {
            let v = serde_json::to_value(resp)
                .map_err(|_e| Status::InternalServerError)
                .unwrap();
            Ok(Json(v))
        }
        Err(_e) => Err(Status::InternalServerError),
    }
}

#[get("/projects-enriched")]
async fn list_projects_enriched(
    state: &State<AppState>,
) -> Result<Json<Vec<EnrichedProject>>, Status> {
    let backend = state.backend.lock().await;
    match backend.list_enriched_projects().await {
        Ok(list) => Ok(Json(list)),
        Err(_e) => Err(Status::InternalServerError),
    }
}

#[get("/project?<sha256>&<external_root_path>")]
async fn get_enriched_project_http(
    state: &State<AppState>,
    sha256: String,
    external_root_path: String,
) -> Result<Json<EnrichedProject>, Status> {
    let backend = state.backend.lock().await;
    match backend
        .get_enriched_project(sha256, external_root_path)
        .await
    {
        Ok(p) => Ok(Json(p)),
        Err(_e) => Err(Status::InternalServerError),
    }
}

#[get("/projects/<project_id>/discussions")]
async fn get_project_discussions(
    project_id: &str,
    state: &State<AppState>,
) -> Result<Json<Vec<RecentChat>>, Status> {
    let backend = state.backend.lock().await;
    match backend.get_project_discussions(project_id).await {
        Ok(discussions) => Ok(Json(discussions)),
        Err(_e) => Err(Status::InternalServerError),
    }
}

#[get("/recent-chats")]
async fn get_recent_chats(state: &State<AppState>) -> Result<Json<Vec<RecentChat>>, Status> {
    let backend = state.backend.lock().await;
    match backend.get_recent_chats().await {
        Ok(chats) => Ok(Json(chats)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[derive(Deserialize)]
struct SearchChatsRequest {
    query: String,
    filters: Option<SearchFilters>,
}

#[post("/search-chats", data = "<request>")]
async fn search_chats(
    request: Json<SearchChatsRequest>,
    state: &State<AppState>,
) -> Result<Json<Vec<SearchResult>>, Status> {
    let backend = state.backend.lock().await;
    match backend
        .search_chats(request.query.clone(), request.filters.clone())
        .await
    {
        Ok(results) => Ok(Json(results)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[get("/check-cli-installed")]
async fn check_cli_installed(state: &State<AppState>) -> Result<Json<bool>, Status> {
    let backend = state.backend.lock().await;
    match backend.check_cli_installed().await {
        Ok(result) => Ok(Json(result)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[post("/start-session", data = "<request>")]
async fn start_session(request: Json<StartSessionRequest>, state: &State<AppState>) -> Status {
    let req = request.into_inner();
    println!(
        "🎯 [SESSION-REQUEST] Received start_session request for: {}",
        req.session_id
    );
    println!(
        "🎯 [SESSION-REQUEST] Working directory: {:?}",
        req.working_directory
    );
    println!("🎯 [SESSION-REQUEST] Model: {:?}", req.model);
    println!(
        "🎯 [SESSION-REQUEST] Backend config present: {}",
        req.backend_config.is_some()
    );
    println!(
        "🎯 [SESSION-REQUEST] Gemini auth present: {}",
        req.gemini_auth.is_some()
    );
    if let Some(ref auth) = req.gemini_auth {
        println!("🔔 YOLO-DEBUG Server: Received gemini_auth: method={}, yolo={:?}", auth.method, auth.yolo);
    }

    let backend = state.backend.lock().await;

    // If working_directory is provided, initialize a session with that directory
    if let Some(working_directory) = req.working_directory {
        let model = req
            .model
            .unwrap_or_else(|| "gemini-2.0-flash-exp".to_string());
        println!("🎯 [SESSION-REQUEST] Attempting to initialize session with backend...");
        match backend
            .initialize_session(
                req.session_id,
                working_directory,
                model,
                req.backend_config,
                req.gemini_auth.clone(),
            )
            .await
        {
            Ok(_) => {
                println!("✅ [SESSION-REQUEST] Session initialization completed successfully");
                Status::Ok
            }
            Err(e) => {
                println!("❌ [SESSION-REQUEST] Session initialization failed: {e}");
                Status::InternalServerError
            }
        }
    } else {
        // For compatibility with existing frontend, just check if CLI is installed
        match backend.check_cli_installed().await {
            Ok(available) => {
                if available {
                    Status::Ok
                } else {
                    Status::ServiceUnavailable
                }
            }
            Err(_) => Status::InternalServerError,
        }
    }
}

#[post("/send-message", data = "<request>")]
async fn send_message(request: Json<SendMessageRequest>, state: &State<AppState>) -> Status {
    let req = request.into_inner();

    let backend = state.backend.lock().await;

    // Check if session exists, if not and we have backend config, initialize it first
    let session_exists = backend
        .get_process_statuses()
        .unwrap_or_default()
        .iter()
        .any(|status| status.conversation_id == req.session_id && status.is_alive);

    if !session_exists && req.backend_config.is_some() {
        println!("🚀 YOLO-DEBUG: send_message creating new session for backend_config");
        if let Some(ref auth) = req.gemini_auth {
            println!("🚀 YOLO-DEBUG: send_message gemini_auth: {:?}", auth);
        } else {
            println!("🚀 YOLO-DEBUG: send_message NO gemini_auth provided!");
        }
        let model = req
            .model
            .unwrap_or_else(|| "gemini-2.0-flash-exp".to_string());
        // Initialize session with minimal working directory (current directory)
        match backend
            .initialize_session(
                req.session_id.clone(),
                ".".to_string(),
                model,
                req.backend_config,
                req.gemini_auth,
            )
            .await
        {
            Ok(_) => {}
            Err(_) => return Status::InternalServerError,
        }
    }

    match backend
        .send_message(req.session_id, req.message, req.conversation_history)
        .await
    {
        Ok(_) => Status::Ok,
        Err(_) => Status::InternalServerError,
    }
}

#[get("/process-statuses")]
async fn get_process_statuses(state: &State<AppState>) -> Result<Json<Vec<ProcessStatus>>, Status> {
    println!("🌐 [API-STATUS] Frontend requesting process statuses...");
    let backend = state.backend.lock().await;
    match backend.get_process_statuses() {
        Ok(statuses) => {
            println!(
                "🌐 [API-STATUS] Returning {} statuses to frontend:",
                statuses.len()
            );
            for status in &statuses {
                println!(
                    "🌐 [API-STATUS]   - {}: {} (PID: {:?})",
                    status.conversation_id,
                    if status.is_alive {
                        "ACTIVE"
                    } else {
                        "INACTIVE"
                    },
                    status.pid
                );
            }
            Ok(Json(statuses))
        }
        Err(e) => {
            println!("❌ [API-STATUS] Failed to get statuses: {e}");
            Err(Status::InternalServerError)
        }
    }
}

#[post("/kill-process", data = "<request>")]
async fn kill_process(request: Json<KillProcessRequest>, state: &State<AppState>) -> Status {
    let backend = state.backend.lock().await;
    match backend.kill_process(&request.conversation_id) {
        Ok(_) => Status::Ok,
        Err(_) => Status::InternalServerError,
    }
}

#[post("/tool-confirmation", data = "<request>")]
async fn send_tool_call_confirmation_response(
    request: Json<ToolConfirmationRequest>,
    state: &State<AppState>,
) -> Status {
    let req = request.into_inner();
    let backend = state.backend.lock().await;
    match backend
        .handle_tool_confirmation(
            req.session_id,
            req.request_id,
            req.tool_call_id,
            req.outcome,
        )
        .await
    {
        Ok(_) => Status::Ok,
        Err(_) => Status::InternalServerError,
    }
}

#[post("/execute-command", data = "<request>")]
async fn execute_confirmed_command(
    request: Json<ExecuteCommandRequest>,
    state: &State<AppState>,
) -> Result<Json<String>, Status> {
    let backend = state.backend.lock().await;
    match backend
        .execute_confirmed_command(request.command.clone())
        .await
    {
        Ok(output) => Ok(Json(output)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[post("/generate-title", data = "<request>")]
async fn generate_conversation_title(
    request: Json<GenerateTitleRequest>,
    state: &State<AppState>,
) -> Result<Json<String>, Status> {
    let req = request.into_inner();
    let backend = state.backend.lock().await;
    match backend
        .generate_conversation_title(req.message, req.model)
        .await
    {
        Ok(title) => Ok(Json(title)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[post("/validate-directory", data = "<request>")]
async fn validate_directory(
    request: Json<ValidateDirectoryRequest>,
    state: &State<AppState>,
) -> Result<Json<bool>, Status> {
    let backend = state.backend.lock().await;
    match backend.validate_directory(request.path.clone()).await {
        Ok(valid) => Ok(Json(valid)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[post("/is-home-directory", data = "<request>")]
async fn is_home_directory(
    request: Json<IsHomeDirectoryRequest>,
    state: &State<AppState>,
) -> Result<Json<bool>, Status> {
    let backend = state.backend.lock().await;
    match backend.is_home_directory(request.path.clone()).await {
        Ok(is_home) => Ok(Json(is_home)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[get("/get-home-directory")]
async fn get_home_directory(state: &State<AppState>) -> Result<Json<String>, Status> {
    let backend = state.backend.lock().await;
    match backend.get_home_directory().await {
        Ok(home_path) => Ok(Json(home_path)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[post("/get-parent-directory", data = "<request>")]
async fn get_parent_directory(
    request: Json<GetParentDirectoryRequest>,
    state: &State<AppState>,
) -> Result<Json<Option<String>>, Status> {
    let backend = state.backend.lock().await;
    match backend.get_parent_directory(request.path.clone()).await {
        Ok(parent_path) => Ok(Json(parent_path)),
        Err(_) => Err(Status::InternalServerError),
    }
}

#[post("/list-directory", data = "<request>")]
async fn list_directory_contents(
    request: Json<ListDirectoryRequest>,
    state: &State<AppState>,
) -> Json<Vec<DirEntry>> {
    let backend = state.backend.lock().await;
    let contents = backend
        .list_directory_contents(request.path.clone())
        .await
        .unwrap();
    Json(contents)
}

#[get("/list-volumes")]
async fn list_volumes(state: &State<AppState>) -> Result<Json<Vec<DirEntry>>, Status> {
    let backend = state.backend.lock().await;
    match backend.list_volumes().await {
        Ok(volumes) => Ok(Json(volumes)),
        Err(_) => Err(Status::InternalServerError),
    }
}

// =====================================
// WebSocket Route Handler
// =====================================

#[get("/ws")]
fn websocket_handler(
    ws: WebSocket,
    state: &State<AppState>,
    mut shutdown: Shutdown,
) -> Stream!['static] {
    let ws_manager = state.ws_manager.clone();

    Stream! { ws =>
        // We don't have any use for the `WebSocket` instance right now.
        let _ = ws;

        // Create a channel for this WebSocket connection to receive backend events
        let (tx, mut rx) = tokio_mpsc::unbounded_channel::<String>();

        // Register this connection with the manager
        let connection_id = ws_manager.add_connection(tx.clone()).await;
        println!("📡 New WebSocket connection established (ID: {})", connection_id);

        // Event forwarding loop with graceful shutdown support
        loop {
            tokio::select! {
                // Handle incoming backend messages
                msg = rx.recv() => {
                    match msg {
                        Some(backend_msg) => yield Message::text(backend_msg),
                        None => break, // Channel closed
                    }
                }
                // Handle server shutdown
                _ = &mut shutdown => {
                    println!("📡 WebSocket connection (ID: {connection_id}) received shutdown signal");
                    break;
                }
            }
        }

        // Clean up connection when the stream ends
        ws_manager.remove_connection(&tx).await;
        println!("📡 WebSocket connection terminated (ID: {})", connection_id);
    }
}

#[rocket::launch]
fn rocket() -> _ {
    // Create WebSocket manager and backend with WebSockets event emitter
    let ws_manager = WebSocketManager::new();
    let emitter = WebSocketsEventEmitter::new(ws_manager.clone());
    let backend = GeminiBackend::new(emitter);

    // Store in app state
    let app_state = AppState {
        backend: Arc::new(Mutex::new(backend)),
        ws_manager,
    };

    rocket::custom(
        rocket::Config::figment()
            .merge(("port", 1858))
            .merge(("address", "0.0.0.0")),
    )
    .manage(app_state)
    .mount("/", routes![index])
    .mount(
        "/api",
        routes![
            websocket_handler,
            check_cli_installed,
            start_session,
            send_message,
            get_process_statuses,
            kill_process,
            send_tool_call_confirmation_response,
            execute_confirmed_command,
            generate_conversation_title,
            validate_directory,
            is_home_directory,
            get_home_directory,
            get_parent_directory,
            list_directory_contents,
            list_volumes,
            get_recent_chats,
            search_chats,
            list_projects,
            list_projects_enriched,
            get_enriched_project_http,
            get_project_discussions,
        ],
    )
}
