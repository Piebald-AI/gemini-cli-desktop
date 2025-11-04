use anyhow::{Context, Result};
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentChat {
    pub id: String,
    pub title: String,
    pub started_at_iso: String,
    pub message_count: u32,
    pub summary: Option<String>,
    pub last_activity_iso: Option<String>,
    pub total_tokens: Option<u32>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationHistoryEntry {
    pub id: String,
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp_iso: String,
    pub message_type: String, // "text", "tool_call", "tool_result", etc.
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailedConversation {
    pub chat: RecentChat,
    pub messages: Vec<ConversationHistoryEntry>,
    pub context_summary: Option<String>,
    pub file_references: Vec<String>,
    pub tool_calls_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub chat: RecentChat,
    pub matches: Vec<MessageMatch>,
    pub relevance_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageMatch {
    pub content_snippet: String,
    pub line_number: u32,
    pub context_before: Option<String>,
    pub context_after: Option<String>,
    /// Sender role for this match: "user", "assistant", or "unknown"
    pub role: String,
    /// ISO8601 timestamp for the matched line/message
    pub timestamp_iso: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    pub date_range: Option<(String, String)>,
    pub project_hash: Option<String>,
    pub max_results: Option<u32>,
    pub case_sensitive: Option<bool>,
    pub include_thinking: Option<bool>,
}

fn parse_timestamp_from_filename(filename: &str) -> Option<u64> {
    filename
        .strip_prefix("rpc-log-")
        .and_then(|s| s.strip_suffix(".log"))
        .and_then(|s| s.parse::<u64>().ok())
}

fn generate_title_from_messages(log_path: &Path) -> String {
    if let Ok(file) = File::open(log_path) {
        let reader = BufReader::new(file);
        let mut first_user_message = String::new();

        for line in reader.lines().map_while(Result::ok) {
            if line.contains(r#""method":"session/prompt""#)
                && let Some(start) = line.find(r#""text":""#)
            {
                let start = start + 8;
                if let Some(end) = line[start..].find('"') {
                    first_user_message = line[start..start + end].to_string();
                    break;
                }
            }
        }

        if !first_user_message.is_empty() {
            let mut title = first_user_message;
            if title.chars().count() > 50 {
                title = title.chars().take(50).collect::<String>() + "...";
            }
            title
        } else {
            "Chat Session".to_string()
        }
    } else {
        "Chat Session".to_string()
    }
}

fn generate_enhanced_chat_info(
    log_path: &Path,
) -> (String, Option<String>, Vec<String>, u32, Option<String>) {
    let mut title = "Chat Session".to_string();
    let mut summary_parts = Vec::new();
    let mut tags = Vec::new();
    let mut tool_calls_count = 0u32;
    let mut last_activity = None;
    let mut file_refs = std::collections::HashSet::new();

    if let Ok(file) = File::open(log_path) {
        let reader = BufReader::new(file);
        let mut _message_count = 0;
        let mut is_first_user_msg = true;

        for line in reader.lines().map_while(Result::ok) {
            // Parse JSON line safely
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                // Update last activity timestamp
                if let Some(timestamp) = json.get("timestamp").and_then(|t| t.as_str()) {
                    last_activity = Some(timestamp.to_string());
                }

                // Extract first user message for title
                if is_first_user_msg
                    && line.contains(r#""method":"session/prompt""#)
                    && let Some(params) = json.get("params")
                    && let Some(prompt) = params.get("prompt").and_then(|p| p.as_array())
                {
                    for content_block in prompt {
                        if let Some(text) = content_block.get("text").and_then(|t| t.as_str()) {
                            title = if text.chars().count() > 50 {
                                format!("{}...", text.chars().take(50).collect::<String>())
                            } else {
                                text.to_string()
                            };
                            is_first_user_msg = false;
                            break;
                        }
                    }
                }

                // Count tool calls
                if line.contains(r#""method":"tool_call""#) {
                    tool_calls_count += 1;

                    // Extract tool names for tags
                    if let Some(params) = json.get("params")
                        && let Some(tool_name) = params.get("name").and_then(|n| n.as_str())
                    {
                        tags.push(format!("tool:{}", tool_name));
                    }
                }

                // Extract file references
                if let Some(params) = json.get("params") {
                    if let Some(path) = params.get("file_path").and_then(|p| p.as_str()) {
                        file_refs.insert(path.to_string());
                    }
                    if let Some(path) = params.get("path").and_then(|p| p.as_str()) {
                        file_refs.insert(path.to_string());
                    }
                }

                // Collect content for summary
                if let Some(method) = json.get("method").and_then(|m| m.as_str()) {
                    match method {
                        "session/prompt" => {
                            _message_count += 1;
                            if let Some(params) = json.get("params")
                                && let Some(prompt) =
                                    params.get("prompt").and_then(|p| p.as_array())
                            {
                                for content_block in prompt {
                                    if let Some(text) =
                                        content_block.get("text").and_then(|t| t.as_str())
                                    {
                                        if text.chars().count() > 20 {
                                            summary_parts.push(format!(
                                                "User: {}...",
                                                text.chars().take(20).collect::<String>()
                                            ));
                                        } else {
                                            summary_parts.push(format!("User: {}", text));
                                        }
                                    }
                                }
                            }
                        }
                        "agent_message_chunk" => {
                            if let Some(params) = json.get("params")
                                && let Some(text) = params.get("chunk").and_then(|c| c.as_str())
                                && text.chars().count() > 20
                                && !summary_parts.is_empty()
                            {
                                summary_parts.push(format!(
                                    "AI: {}...",
                                    text.chars().take(20).collect::<String>()
                                ));
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // Add file extension tags
    for file_ref in &file_refs {
        if let Some(ext) = std::path::Path::new(file_ref).extension()
            && let Some(ext_str) = ext.to_str()
        {
            tags.push(format!("file:{}", ext_str));
        }
    }

    // Generate summary
    let summary = if summary_parts.len() >= 2 {
        Some(summary_parts.join(" ▸ "))
    } else {
        None
    };

    tags.sort();
    tags.dedup();

    (title, summary, tags, tool_calls_count, last_activity)
}

fn count_messages_in_log(log_path: &Path) -> u32 {
    let mut user_count = 0;
    let mut assistant_count = 0;

    if let Ok(file) = File::open(log_path) {
        let reader = BufReader::new(file);
        for line in reader.lines().map_while(Result::ok) {
            // Count user messages (session/prompt requests)
            if line.contains(r#""method":"session/prompt""#) {
                user_count += 1;
            }
            // Count assistant responses by tracking result messages with stopReason
            // This ensures we count complete assistant messages, not individual chunks
            else if line.contains(r#""result":{"stopReason""#) {
                // This indicates the end of an assistant response
                assistant_count += 1;
            }
        }
    }

    // Return total of user messages and assistant responses
    user_count + assistant_count
}

pub async fn get_recent_chats() -> Result<Vec<RecentChat>> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let projects_dir = Path::new(&home)
        .join(".gemini-cli-desktop")
        .join("projects");

    let mut all_chats = Vec::new();

    if projects_dir.exists()
        && let Ok(projects) = std::fs::read_dir(&projects_dir)
    {
        for project in projects.flatten() {
            if project.path().is_dir() {
                let project_hash = project.file_name().to_string_lossy().to_string();

                // Only process valid 64-character hexadecimal project directories
                if project_hash.len() != 64 || !project_hash.chars().all(|c| c.is_ascii_hexdigit())
                {
                    continue;
                }

                if let Ok(logs) = std::fs::read_dir(project.path()) {
                    for log_entry in logs.flatten() {
                        let filename = log_entry.file_name().to_string_lossy().to_string();
                        if filename.starts_with("rpc-log-")
                            && filename.ends_with(".log")
                            && let Some(timestamp_ms) = parse_timestamp_from_filename(&filename)
                        {
                            let log_path = log_entry.path();
                            let _title = generate_title_from_messages(&log_path);
                            let message_count = count_messages_in_log(&log_path);

                            let datetime = DateTime::<Local>::from(
                                std::time::UNIX_EPOCH
                                    + std::time::Duration::from_millis(timestamp_ms),
                            );

                            let (enhanced_title, summary, tags, _tool_calls_count, last_activity) =
                                generate_enhanced_chat_info(&log_path);

                            all_chats.push(RecentChat {
                                id: format!("{project_hash}/{filename}"),
                                title: enhanced_title,
                                started_at_iso: datetime.to_rfc3339(),
                                message_count,
                                summary,
                                last_activity_iso: last_activity,
                                total_tokens: None, // Could be calculated if needed
                                tags,
                            });
                        }
                    }
                }
            }
        }
    }

    all_chats.sort_by(|a, b| b.started_at_iso.cmp(&a.started_at_iso));
    all_chats.truncate(20);

    Ok(all_chats)
}

pub async fn search_chats(
    query: String,
    filters: Option<SearchFilters>,
) -> Result<Vec<SearchResult>> {
    // Return empty results for empty query
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let projects_dir = Path::new(&home)
        .join(".gemini-cli-desktop")
        .join("projects");
    let mut results = Vec::new();

    let query_lower = query.to_lowercase();
    let max_results = filters.as_ref().and_then(|f| f.max_results).unwrap_or(50);
    let case_sensitive = filters
        .as_ref()
        .and_then(|f| f.case_sensitive)
        .unwrap_or(false);
    let include_thinking = filters
        .as_ref()
        .and_then(|f| f.include_thinking)
        .unwrap_or(false);

    if projects_dir.exists()
        && let Ok(projects) = std::fs::read_dir(&projects_dir)
    {
        for project in projects.flatten() {
            if project.path().is_dir() {
                let project_hash = project.file_name().to_string_lossy().to_string();

                // Only process valid 64-character hexadecimal project directories
                if project_hash.len() != 64 || !project_hash.chars().all(|c| c.is_ascii_hexdigit())
                {
                    continue;
                }

                if let Some(ref f) = filters
                    && let Some(ref filter_hash) = f.project_hash
                    && &project_hash != filter_hash
                {
                    continue;
                }

                if let Ok(logs) = std::fs::read_dir(project.path()) {
                    for log_entry in logs.flatten() {
                        let filename = log_entry.file_name().to_string_lossy().to_string();
                        if filename.starts_with("rpc-log-")
                            && filename.ends_with(".log")
                            && let Some(timestamp_ms) = parse_timestamp_from_filename(&filename)
                        {
                            let log_path = log_entry.path();
                            let mut matches = Vec::new();

                            if let Ok(file) = File::open(&log_path) {
                                let reader = BufReader::new(file);
                                let lines: Vec<String> =
                                    reader.lines().map_while(Result::ok).collect();

                                for (i, line) in lines.iter().enumerate() {
                                    // Extract timestamp prefix if present [ISO]
                                    let line_ts = if line.starts_with('[') {
                                        if let Some(end) = line.find(']') {
                                            line[1..end].to_string()
                                        } else {
                                            String::new()
                                        }
                                    } else {
                                        String::new()
                                    };

                                    // JSON part
                                    let json_start = line.find('{');
                                    let mut matched = false;
                                    // Track whether this line was parsed as JSON successfully.
                                    // If it was, we will not fall back to raw-line matching to avoid
                                    // surfacing internal JSON-RPC payloads in search results.
                                    let mut parsed_json = false;
                                    if let Some(start) = json_start
                                        && let Ok(json) = serde_json::from_str::<serde_json::Value>(
                                            &line[start..],
                                        )
                                    {
                                        parsed_json = true;
                                        // Default timestamp if line prefix missing
                                        let ts = if !line_ts.is_empty() {
                                            line_ts.clone()
                                        } else {
                                            // Fallback to file-based timestamp
                                            let dt = DateTime::<Local>::from(
                                                std::time::UNIX_EPOCH
                                                    + std::time::Duration::from_millis(
                                                        timestamp_ms,
                                                    ),
                                            );
                                            dt.to_rfc3339()
                                        };

                                        if let Some(method) =
                                            json.get("method").and_then(|m| m.as_str())
                                        {
                                            match method {
                                                "session/prompt" => {
                                                    if let Some(params) = json.get("params")
                                                        && let Some(prompt) = params
                                                            .get("prompt")
                                                            .and_then(|p| p.as_array())
                                                    {
                                                        for content_block in prompt {
                                                            if let Some(text) = content_block
                                                                .get("text")
                                                                .and_then(|t| t.as_str())
                                                            {
                                                                let hay = if case_sensitive {
                                                                    text.to_string()
                                                                } else {
                                                                    text.to_lowercase()
                                                                };
                                                                let needle = if case_sensitive {
                                                                    query.clone()
                                                                } else {
                                                                    query_lower.clone()
                                                                };
                                                                if hay.contains(&needle) {
                                                                    let snippet =
                                                                        if text.len() > 200 {
                                                                            format!(
                                                                                "{}...",
                                                                                &text[..200]
                                                                            )
                                                                        } else {
                                                                            text.to_string()
                                                                        };
                                                                    matches.push(MessageMatch {
                                                                        content_snippet: snippet,
                                                                        line_number: (i + 1) as u32,
                                                                        context_before: None,
                                                                        context_after: None,
                                                                        role: "user".to_string(),
                                                                        timestamp_iso: ts.clone(),
                                                                    });
                                                                    matched = true;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                "agent_message_chunk" => {
                                                    if let Some(params) = json.get("params")
                                                        && let Some(chunk) = params
                                                            .get("chunk")
                                                            .and_then(|c| c.as_str())
                                                    {
                                                        let hay = if case_sensitive {
                                                            chunk.to_string()
                                                        } else {
                                                            chunk.to_lowercase()
                                                        };
                                                        let needle = if case_sensitive {
                                                            query.clone()
                                                        } else {
                                                            query_lower.clone()
                                                        };
                                                        if hay.contains(&needle) {
                                                            let snippet = if chunk.len() > 200 {
                                                                format!("{}...", &chunk[..200])
                                                            } else {
                                                                chunk.to_string()
                                                            };
                                                            matches.push(MessageMatch {
                                                                content_snippet: snippet,
                                                                line_number: (i + 1) as u32,
                                                                context_before: None,
                                                                context_after: None,
                                                                role: "assistant".to_string(),
                                                                timestamp_iso: ts.clone(),
                                                            });
                                                            matched = true;
                                                        }
                                                    }
                                                }
                                                "session/update" => {
                                                    if let Some(params) = json.get("params")
                                                        && let Some(update) = params.get("update")
                                                        && let Some(session_update) = update
                                                            .get("sessionUpdate")
                                                            .and_then(|s| s.as_str())
                                                        && let Some(content) = update.get("content")
                                                        && let Some(text) = content
                                                            .get("text")
                                                            .and_then(|t| t.as_str())
                                                    {
                                                        // If this is a thought chunk, only include if explicitly enabled
                                                        if session_update == "agent_thought_chunk"
                                                            && !include_thinking
                                                        {
                                                            // Skip matching thought chunks unless requested
                                                        } else {
                                                            let hay = if case_sensitive {
                                                                text.to_string()
                                                            } else {
                                                                text.to_lowercase()
                                                            };
                                                            let needle = if case_sensitive {
                                                                query.clone()
                                                            } else {
                                                                query_lower.clone()
                                                            };
                                                            if hay.contains(&needle) {
                                                                let snippet = if text.len() > 200 {
                                                                    format!("{}...", &text[..200])
                                                                } else {
                                                                    text.to_string()
                                                                };
                                                                matches.push(MessageMatch {
                                                                    content_snippet: snippet,
                                                                    line_number: (i + 1) as u32,
                                                                    context_before: None,
                                                                    context_after: None,
                                                                    role: "assistant".to_string(),
                                                                    timestamp_iso: ts.clone(),
                                                                });
                                                                matched = true;
                                                            }
                                                        }
                                                    }
                                                }
                                                "agent_thought_chunk" => {
                                                    if include_thinking
                                                        && let Some(params) = json.get("params")
                                                        && let Some(chunk) = params
                                                            .get("chunk")
                                                            .and_then(|c| c.as_str())
                                                    {
                                                        let hay = if case_sensitive {
                                                            chunk.to_string()
                                                        } else {
                                                            chunk.to_lowercase()
                                                        };
                                                        let needle = if case_sensitive {
                                                            query.clone()
                                                        } else {
                                                            query_lower.clone()
                                                        };
                                                        if hay.contains(&needle) {
                                                            let snippet = if chunk.len() > 200 {
                                                                format!("{}...", &chunk[..200])
                                                            } else {
                                                                chunk.to_string()
                                                            };
                                                            matches.push(MessageMatch {
                                                                content_snippet: snippet,
                                                                line_number: (i + 1) as u32,
                                                                context_before: None,
                                                                context_after: None,
                                                                role: "assistant".to_string(),
                                                                timestamp_iso: ts.clone(),
                                                            });
                                                            matched = true;
                                                        }
                                                    }
                                                }
                                                _ => {}
                                            }
                                        }
                                    }

                                    // Fallback to raw line matching ONLY when the line is not JSON.
                                    // This prevents raw JSON-RPC logs from appearing in results.
                                    if !matched && !parsed_json {
                                        let hay = if case_sensitive {
                                            line.clone()
                                        } else {
                                            line.to_lowercase()
                                        };
                                        let needle = if case_sensitive {
                                            query.clone()
                                        } else {
                                            query_lower.clone()
                                        };
                                        if hay.contains(&needle) {
                                            let snippet = if line.len() > 200 {
                                                format!("{}...", &line[..200])
                                            } else {
                                                line.clone()
                                            };

                                            let context_before = if i > 0 {
                                                Some(lines[i - 1].clone())
                                            } else {
                                                None
                                            };
                                            let context_after = if i < lines.len() - 1 {
                                                Some(lines[i + 1].clone())
                                            } else {
                                                None
                                            };

                                            let dt = DateTime::<Local>::from(
                                                std::time::UNIX_EPOCH
                                                    + std::time::Duration::from_millis(
                                                        timestamp_ms,
                                                    ),
                                            );

                                            matches.push(MessageMatch {
                                                content_snippet: snippet,
                                                line_number: (i + 1) as u32,
                                                context_before,
                                                context_after,
                                                role: "unknown".to_string(),
                                                timestamp_iso: dt.to_rfc3339(),
                                            });
                                        }
                                    }
                                }
                            }

                            if !matches.is_empty() {
                                let title = generate_title_from_messages(&log_path);
                                let message_count = count_messages_in_log(&log_path);

                                let datetime = DateTime::<Local>::from(
                                    std::time::UNIX_EPOCH
                                        + std::time::Duration::from_millis(timestamp_ms),
                                );

                                let relevance_score = matches.len() as f32;

                                results.push(SearchResult {
                                    chat: RecentChat {
                                        id: format!("{project_hash}/{filename}"),
                                        title,
                                        started_at_iso: datetime.to_rfc3339(),
                                        message_count,
                                        summary: None,
                                        last_activity_iso: None,
                                        total_tokens: None,
                                        tags: vec![],
                                    },
                                    matches,
                                    relevance_score,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    results.sort_by(|a, b| b.relevance_score.partial_cmp(&a.relevance_score).unwrap());
    results.truncate(max_results as usize);

    Ok(results)
}

pub async fn get_project_discussions(project_id: &str) -> Result<Vec<RecentChat>> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let project_dir = Path::new(&home)
        .join(".gemini-cli-desktop")
        .join("projects")
        .join(project_id);

    let mut chats = Vec::new();

    if project_dir.exists()
        && let Ok(logs) = std::fs::read_dir(&project_dir)
    {
        for log_entry in logs.flatten() {
            let filename = log_entry.file_name().to_string_lossy().to_string();
            if filename.starts_with("rpc-log-")
                && filename.ends_with(".log")
                && let Some(timestamp_ms) = parse_timestamp_from_filename(&filename)
            {
                let log_path = log_entry.path();
                let _title = generate_title_from_messages(&log_path);
                let message_count = count_messages_in_log(&log_path);

                let datetime = DateTime::<Local>::from(
                    std::time::UNIX_EPOCH + std::time::Duration::from_millis(timestamp_ms),
                );

                let (enhanced_title, summary, tags, _tool_calls_count, last_activity) =
                    generate_enhanced_chat_info(&log_path);

                chats.push(RecentChat {
                    id: format!("{project_id}/{filename}"),
                    title: enhanced_title,
                    started_at_iso: datetime.to_rfc3339(),
                    message_count,
                    summary,
                    last_activity_iso: last_activity,
                    total_tokens: None,
                    tags,
                });
            }
        }
    }

    chats.sort_by(|a, b| b.started_at_iso.cmp(&a.started_at_iso));
    Ok(chats)
}

pub async fn get_detailed_conversation(chat_id: &str) -> Result<DetailedConversation> {
    let parts: Vec<&str> = chat_id.split('/').collect();
    if parts.len() != 2 {
        anyhow::bail!("Invalid chat ID format");
    }

    let project_hash = parts[0];
    let filename = parts[1];

    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let log_path = Path::new(&home)
        .join(".gemini-cli-desktop")
        .join("projects")
        .join(project_hash)
        .join(filename);

    if !log_path.exists() {
        anyhow::bail!("Chat log file not found");
    }

    // Parse timestamp from filename
    let timestamp_ms = parse_timestamp_from_filename(filename)
        .ok_or_else(|| anyhow::anyhow!("Invalid filename format"))?;

    let datetime = DateTime::<Local>::from(
        std::time::UNIX_EPOCH + std::time::Duration::from_millis(timestamp_ms),
    );

    let (title, summary, tags, tool_calls_count, last_activity) =
        generate_enhanced_chat_info(&log_path);
    let message_count = count_messages_in_log(&log_path);

    let chat = RecentChat {
        id: chat_id.to_string(),
        title,
        started_at_iso: datetime.to_rfc3339(),
        message_count,
        summary,
        last_activity_iso: last_activity,
        total_tokens: None,
        tags,
    };

    let mut messages = Vec::new();
    let mut file_references = std::collections::HashSet::new();
    let mut context_parts = Vec::new();

    if let Ok(file) = File::open(&log_path) {
        let reader = BufReader::new(file);
        let mut message_id_counter = 0;

        for line in reader.lines().map_while(Result::ok) {
            // Extract timestamp from log line prefix [2025-08-31T03:10:36.305Z]
            let line_timestamp = if line.starts_with('[') {
                if let Some(end_bracket) = line.find(']') {
                    &line[1..end_bracket]
                } else {
                    &datetime.to_rfc3339()
                }
            } else {
                &datetime.to_rfc3339()
            };

            // Find the JSON part of the line (after the timestamp and [Gemini] parts)
            let json_start = if let Some(pos) = line.find('{') {
                pos
            } else {
                continue; // Skip lines without JSON
            };

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line[json_start..]) {
                let timestamp = line_timestamp;

                if let Some(method) = json.get("method").and_then(|m| m.as_str()) {
                    match method {
                        "session/prompt" => {
                            if let Some(params) = json.get("params")
                                && let Some(prompt) =
                                    params.get("prompt").and_then(|p| p.as_array())
                            {
                                for content_block in prompt {
                                    if let Some(text) =
                                        content_block.get("text").and_then(|t| t.as_str())
                                    {
                                        messages.push(ConversationHistoryEntry {
                                            id: format!("msg_{}", message_id_counter),
                                            role: "user".to_string(),
                                            content: text.to_string(),
                                            timestamp_iso: timestamp.to_string(),
                                            message_type: "text".to_string(),
                                            metadata: Some(json.clone()),
                                        });
                                        message_id_counter += 1;
                                        context_parts.push(format!("User: {}", text));
                                    }
                                }
                            }
                        }
                        "session/update" => {
                            if let Some(params) = json.get("params")
                                && let Some(update) = params.get("update")
                                && let Some(session_update) =
                                    update.get("sessionUpdate").and_then(|s| s.as_str())
                            {
                                match session_update {
                                    "agent_message_chunk" => {
                                        if let Some(content) = update.get("content")
                                            && let Some(text) =
                                                content.get("text").and_then(|t| t.as_str())
                                        {
                                            // Aggregate chunks into complete messages
                                            if let Some(last_msg) = messages.last_mut()
                                                && last_msg.role == "assistant"
                                                && last_msg.message_type == "text"
                                            {
                                                last_msg.content.push_str(text);
                                                continue;
                                            }

                                            messages.push(ConversationHistoryEntry {
                                                id: format!("msg_{}", message_id_counter),
                                                role: "assistant".to_string(),
                                                content: text.to_string(),
                                                timestamp_iso: timestamp.to_string(),
                                                message_type: "text".to_string(),
                                                metadata: Some(json.clone()),
                                            });
                                            message_id_counter += 1;
                                            context_parts.push(format!("AI: {}", text));
                                        }
                                    }
                                    "agent_thought_chunk" => {
                                        if let Some(content) = update.get("content")
                                            && let Some(text) =
                                                content.get("text").and_then(|t| t.as_str())
                                        {
                                            // Add thinking content to messages for history
                                            messages.push(ConversationHistoryEntry {
                                                id: format!("msg_{}", message_id_counter),
                                                role: "assistant".to_string(),
                                                content: format!("*Thinking: {}*", text),
                                                timestamp_iso: timestamp.to_string(),
                                                message_type: "thinking".to_string(),
                                                metadata: Some(json.clone()),
                                            });
                                            message_id_counter += 1;
                                        }
                                    }
                                    "tool_call" => {
                                        if let Some(_tool_call_id) =
                                            update.get("toolCallId").and_then(|id| id.as_str())
                                            && let Some(title) =
                                                update.get("title").and_then(|t| t.as_str())
                                        {
                                            messages.push(ConversationHistoryEntry {
                                                id: format!("msg_{}", message_id_counter),
                                                role: "assistant".to_string(),
                                                content: format!("Called tool: {}", title),
                                                timestamp_iso: timestamp.to_string(),
                                                message_type: "tool_call".to_string(),
                                                metadata: Some(json.clone()),
                                            });
                                            message_id_counter += 1;

                                            // Extract file references from locations
                                            if let Some(locations) =
                                                update.get("locations").and_then(|l| l.as_array())
                                            {
                                                for location in locations {
                                                    if let Some(path) = location
                                                        .get("path")
                                                        .and_then(|p| p.as_str())
                                                    {
                                                        file_references.insert(path.to_string());
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    _ => {
                                        // Handle other session update types if needed
                                    }
                                }
                            }
                        }
                        "agent_message_chunk" => {
                            if let Some(params) = json.get("params")
                                && let Some(chunk) = params.get("chunk").and_then(|c| c.as_str())
                            {
                                // Aggregate chunks into complete messages
                                if let Some(last_msg) = messages.last_mut()
                                    && last_msg.role == "assistant"
                                    && last_msg.message_type == "text"
                                {
                                    last_msg.content.push_str(chunk);
                                    continue;
                                }

                                messages.push(ConversationHistoryEntry {
                                    id: format!("msg_{}", message_id_counter),
                                    role: "assistant".to_string(),
                                    content: chunk.to_string(),
                                    timestamp_iso: timestamp.to_string(),
                                    message_type: "text".to_string(),
                                    metadata: Some(json.clone()),
                                });
                                message_id_counter += 1;
                                context_parts.push(format!("AI: {}", chunk));
                            }
                        }
                        "tool_call" => {
                            if let Some(params) = json.get("params") {
                                let tool_name = params
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or("unknown");

                                let tool_args = params
                                    .get("arguments")
                                    .map(|a| a.to_string())
                                    .unwrap_or_default();

                                messages.push(ConversationHistoryEntry {
                                    id: format!("msg_{}", message_id_counter),
                                    role: "assistant".to_string(),
                                    content: format!(
                                        "Called tool: {} with args: {}",
                                        tool_name, tool_args
                                    ),
                                    timestamp_iso: timestamp.to_string(),
                                    message_type: "tool_call".to_string(),
                                    metadata: Some(json.clone()),
                                });
                                message_id_counter += 1;

                                // Extract file references
                                if let Some(file_path) =
                                    params.get("file_path").and_then(|p| p.as_str())
                                {
                                    file_references.insert(file_path.to_string());
                                }
                                if let Some(path) = params.get("path").and_then(|p| p.as_str()) {
                                    file_references.insert(path.to_string());
                                }
                            }
                        }
                        "tool_call_result" => {
                            if let Some(params) = json.get("params") {
                                let result_content = params
                                    .get("result")
                                    .map(|r| r.to_string())
                                    .unwrap_or_default();

                                messages.push(ConversationHistoryEntry {
                                    id: format!("msg_{}", message_id_counter),
                                    role: "system".to_string(),
                                    content: format!("Tool result: {}", result_content),
                                    timestamp_iso: timestamp.to_string(),
                                    message_type: "tool_result".to_string(),
                                    metadata: Some(json.clone()),
                                });
                                message_id_counter += 1;
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    let context_summary = if context_parts.len() > 2 {
        Some(format!(
            "Conversation summary: {}...",
            context_parts
                .iter()
                .take(3)
                .cloned()
                .collect::<Vec<_>>()
                .join(" ▸ ")
        ))
    } else {
        None
    };

    Ok(DetailedConversation {
        chat,
        messages,
        context_summary,
        file_references: file_references.into_iter().collect(),
        tool_calls_count,
    })
}

pub async fn export_conversation_history(chat_id: &str, format: &str) -> Result<String> {
    let detailed = get_detailed_conversation(chat_id).await?;

    match format.to_lowercase().as_str() {
        "json" => serde_json::to_string_pretty(&detailed)
            .context("Failed to serialize conversation to JSON"),
        "markdown" => {
            let mut md = String::new();
            md.push_str(&format!("# {}\n\n", detailed.chat.title));
            md.push_str(&format!("**Started:** {}\n", detailed.chat.started_at_iso));
            md.push_str(&format!("**Messages:** {}\n", detailed.chat.message_count));

            if let Some(summary) = &detailed.chat.summary {
                md.push_str(&format!("**Summary:** {}\n", summary));
            }

            if !detailed.chat.tags.is_empty() {
                md.push_str(&format!("**Tags:** {}\n", detailed.chat.tags.join(", ")));
            }

            md.push_str("\n## Conversation\n\n");

            for msg in &detailed.messages {
                match msg.role.as_str() {
                    "user" => md.push_str(&format!("**User:** {}\n\n", msg.content)),
                    "assistant" => md.push_str(&format!("**Assistant:** {}\n\n", msg.content)),
                    "system" => md.push_str(&format!("*System:* {}\n\n", msg.content)),
                    _ => md.push_str(&format!("**{}:** {}\n\n", msg.role, msg.content)),
                }
            }

            if !detailed.file_references.is_empty() {
                md.push_str("\n## File References\n\n");
                for file_ref in &detailed.file_references {
                    md.push_str(&format!("- `{}`\n", file_ref));
                }
            }

            Ok(md)
        }
        _ => anyhow::bail!("Unsupported export format: {}", format),
    }
}

pub async fn delete_conversation(chat_id: &str) -> Result<()> {
    let parts: Vec<&str> = chat_id.split('/').collect();
    if parts.len() != 2 {
        anyhow::bail!("Invalid chat ID format");
    }

    let project_hash = parts[0];
    let filename = parts[1];

    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

    let log_path = Path::new(&home)
        .join(".gemini-cli-desktop")
        .join("projects")
        .join(project_hash)
        .join(filename);

    if !log_path.exists() {
        // If the file doesn't exist, we can consider the operation successful.
        return Ok(());
    }

    std::fs::remove_file(&log_path)
        .with_context(|| format!("Failed to delete chat log file: {:?}", log_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{EnvGuard, TestDirManager, builders::*};
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_recent_chat_serialization() {
        let chat = RecentChatBuilder::new("test/log.log")
            .with_title("Test Chat")
            .with_message_count(5)
            .build();

        let json = serde_json::to_string(&chat).unwrap();
        let deserialized: RecentChat = serde_json::from_str(&json).unwrap();

        assert_eq!(chat.id, deserialized.id);
        assert_eq!(chat.title, deserialized.title);
        assert_eq!(chat.started_at_iso, deserialized.started_at_iso);
        assert_eq!(chat.message_count, deserialized.message_count);
    }

    #[test]
    fn test_message_match_serialization() {
        let match_item = MessageMatch {
            content_snippet: "test content".to_string(),
            line_number: 42,
            context_before: Some("before context".to_string()),
            context_after: Some("after context".to_string()),
            role: "user".to_string(),
            timestamp_iso: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&match_item).unwrap();
        let deserialized: MessageMatch = serde_json::from_str(&json).unwrap();

        assert_eq!(match_item.content_snippet, deserialized.content_snippet);
        assert_eq!(match_item.line_number, deserialized.line_number);
        assert_eq!(match_item.context_before, deserialized.context_before);
        assert_eq!(match_item.context_after, deserialized.context_after);
    }

    #[test]
    fn test_search_result_serialization() {
        let result = SearchResult {
            chat: RecentChatBuilder::new("test/log.log")
                .with_title("Test Chat")
                .with_message_count(5)
                .build(),
            matches: vec![MessageMatch {
                content_snippet: "test content".to_string(),
                line_number: 42,
                context_before: None,
                context_after: None,
                role: "assistant".to_string(),
                timestamp_iso: "2024-01-01T00:00:00Z".to_string(),
            }],
            relevance_score: 1.5,
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: SearchResult = serde_json::from_str(&json).unwrap();

        assert_eq!(result.chat.id, deserialized.chat.id);
        assert_eq!(result.matches.len(), deserialized.matches.len());
        assert_eq!(result.relevance_score, deserialized.relevance_score);
    }

    #[test]
    fn test_search_filters_default() {
        let filters = SearchFilters::default();
        assert!(filters.date_range.is_none());
        assert!(filters.project_hash.is_none());
        assert!(filters.max_results.is_none());
        assert!(filters.case_sensitive.is_none());
        assert!(filters.include_thinking.is_none());
    }

    #[test]
    fn test_search_filters_serialization() {
        let filters = SearchFilters {
            date_range: Some(("2023-01-01".to_string(), "2023-01-31".to_string())),
            project_hash: Some("abc123".to_string()),
            max_results: Some(25),
            case_sensitive: Some(true),
            include_thinking: Some(true),
        };

        let json = serde_json::to_string(&filters).unwrap();
        let deserialized: SearchFilters = serde_json::from_str(&json).unwrap();

        assert_eq!(filters.date_range, deserialized.date_range);
        assert_eq!(filters.project_hash, deserialized.project_hash);
        assert_eq!(filters.max_results, deserialized.max_results);
        assert_eq!(filters.case_sensitive, deserialized.case_sensitive);
        assert_eq!(filters.include_thinking, deserialized.include_thinking);
    }

    #[test]
    fn test_parse_timestamp_from_filename_valid() {
        assert_eq!(
            parse_timestamp_from_filename("rpc-log-1640995200000.log"),
            Some(1640995200000)
        );
        assert_eq!(
            parse_timestamp_from_filename("rpc-log-123456789.log"),
            Some(123456789)
        );
    }

    #[test]
    fn test_parse_timestamp_from_filename_invalid() {
        assert_eq!(parse_timestamp_from_filename("invalid.log"), None);
        assert_eq!(parse_timestamp_from_filename("rpc-log-invalid.log"), None);
        assert_eq!(parse_timestamp_from_filename("rpc-log-123.txt"), None);
        assert_eq!(parse_timestamp_from_filename("log-123.log"), None);
    }

    #[test]
    fn test_generate_title_from_messages_with_user_message() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let content = r#"{"method":"session/prompt","params":{"prompt":[{"text":"Hello, how can I help you today?"}]}}"#;
        fs::write(&log_path, content).unwrap();

        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, "Hello, how can I help you today?");
    }

    #[test]
    fn test_generate_title_from_messages_long_message() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let long_text = "a".repeat(100);
        let content = format!(
            r#"{{"method":"session/prompt","params":{{"prompt":[{{"text":"{}"}}]}}}}"#,
            long_text
        );
        fs::write(&log_path, content).unwrap();

        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, format!("{}...", "a".repeat(50)));
    }

    #[test]
    fn test_generate_title_from_messages_no_user_message() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let content = r#"{"method":"otherMethod","params":{"data":"some data"}}"#;
        fs::write(&log_path, content).unwrap();

        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, "Chat Session");
    }

    #[test]
    fn test_generate_title_from_messages_file_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("nonexistent.log");

        let title = generate_title_from_messages(&log_path);
        assert_eq!(title, "Chat Session");
    }

    #[test]
    fn test_count_messages_in_log_with_messages() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let content = r#"{"method":"session/prompt","params":{"prompt":[{"text":"Hello"}]}}
{"method":"session/update","params":{"update":{"content":{"text":"Hi there"}}}}
{"method":"session/prompt","params":{"prompt":[{"text":"How are you?"}]}}
{"result":{"stopReason":"endTurn"}}"#;
        fs::write(&log_path, content).unwrap();

        let count = count_messages_in_log(&log_path);
        assert_eq!(count, 3); // 2 user messages + 1 assistant chunk
    }

    #[test]
    fn test_count_messages_in_log_no_messages() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test.log");

        let content = r#"{"method":"otherMethod","params":{"data":"some data"}}
{"method":"anotherMethod","params":{"info":"more info"}}"#;
        fs::write(&log_path, content).unwrap();

        let count = count_messages_in_log(&log_path);
        assert_eq!(count, 0);
    }

    #[test]
    fn test_count_messages_in_log_file_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("nonexistent.log");

        let count = count_messages_in_log(&log_path);
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn test_get_recent_chats_no_home() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.remove("USERPROFILE");
        env_guard.set("HOME", ".");

        // Should not fail, but may return empty results if no projects directory exists
        let result = get_recent_chats().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_get_recent_chats_empty_directory() {
        let test_dir_manager = TestDirManager::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", test_dir_manager.path().to_string_lossy());

        // Create projects directory but leave it empty
        let _projects_dir = test_dir_manager.create_projects_structure().unwrap();

        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_get_recent_chats_with_logs() {
        let test_dir_manager = TestDirManager::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", test_dir_manager.path().to_string_lossy());

        // Create a log file with valid name and content
        let valid_project_hash = "c".repeat(64); // Use 64-character hex string
        let _log_file = test_dir_manager
            .create_log_file(
                &valid_project_hash,
                1640995200000,
                r#"{"method":"session/prompt","params":{"prompt":[{"text":"Test message"}]}}"#,
            )
            .unwrap();

        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].title, "Test message");
        assert_eq!(result[0].message_count, 1);
        assert!(result[0].id.contains(&valid_project_hash));
    }

    #[tokio::test]
    async fn test_get_recent_chats_sorts_by_date() {
        let test_dir_manager = TestDirManager::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", test_dir_manager.path().to_string_lossy());

        let content = r#"{"method":"session/prompt","params":{"prompt":[{"text":"Test"}]}}"#;
        let valid_project_hash = "d".repeat(64); // Use 64-character hex string

        // Create multiple log files with different timestamps
        test_dir_manager
            .create_log_file(&valid_project_hash, 1640995100000, content)
            .unwrap();
        test_dir_manager
            .create_log_file(&valid_project_hash, 1640995200000, content)
            .unwrap();

        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 2);
        // Newer chat should be first
        assert!(result[0].id.contains("1640995200000"));
        assert!(result[1].id.contains("1640995100000"));
    }

    #[tokio::test]
    async fn test_get_recent_chats_limits_to_20() {
        let test_dir_manager = TestDirManager::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", test_dir_manager.path().to_string_lossy());

        let content = r#"{"method":"session/prompt","params":{"prompt":[{"text":"Test"}]}}"#;
        let valid_project_hash = "e".repeat(64); // Use 64-character hex string

        // Create 25 log files
        for i in 0..25 {
            let timestamp = 1640995200000u64 + i as u64;
            test_dir_manager
                .create_log_file(&valid_project_hash, timestamp, content)
                .unwrap();
        }

        let result = get_recent_chats().await.unwrap();
        assert_eq!(result.len(), 20); // Should be limited to 20
    }

    #[tokio::test]
    async fn test_search_chats_empty_query() {
        let test_dir_manager = TestDirManager::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", test_dir_manager.path().to_string_lossy());

        // Create a log file with content that would match if query wasn't empty
        let content = r#"{"method":"session/prompt","params":{"prompt":[{"text":"Hello world"}]}}"#;
        let valid_project_hash = "f".repeat(64); // Use 64-character hex string
        test_dir_manager
            .create_log_file(&valid_project_hash, 1640995200000, content)
            .unwrap();

        let result = search_chats("".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 0); // Empty query should return no results
    }

    #[tokio::test]
    async fn test_search_chats_with_matches() {
        let test_dir_manager = TestDirManager::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", test_dir_manager.path().to_string_lossy());

        let content = r#"{"method":"session/prompt","params":{"prompt":[{"text":"Hello world"}]}}
This line contains search term
Another line with different content"#;

        let valid_project_hash = "1".repeat(64); // Use 64-character hex string
        test_dir_manager
            .create_log_file(&valid_project_hash, 1640995200000, content)
            .unwrap();

        let result = search_chats("search term".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].matches.len(), 1);
        assert!(result[0].matches[0].content_snippet.contains("search term"));
        assert_eq!(result[0].matches[0].line_number, 2);
        assert!(result[0].matches[0].context_before.is_some());
        assert!(result[0].matches[0].context_after.is_some());
    }

    #[tokio::test]
    async fn test_search_chats_case_insensitive() {
        let test_dir_manager = TestDirManager::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", test_dir_manager.path().to_string_lossy());

        let content = "This line contains SEARCH TERM";
        let valid_project_hash = "2".repeat(64); // Use 64-character hex string
        test_dir_manager
            .create_log_file(&valid_project_hash, 1640995200000, content)
            .unwrap();

        let result = search_chats("search term".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].matches.len(), 1);
    }

    #[tokio::test]
    async fn test_search_chats_with_project_filter() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-cli-desktop/projects");
        let project1_hash = "5".repeat(64); // Use 64-character hex string
        let project2_hash = "6".repeat(64); // Use 64-character hex string
        let project1_dir = projects_dir.join(&project1_hash);
        let project2_dir = projects_dir.join(&project2_hash);
        fs::create_dir_all(&project1_dir).unwrap();
        fs::create_dir_all(&project2_dir).unwrap();

        // Add matching content to both projects
        let content = "This contains the search term";
        let log1 = project1_dir.join("rpc-log-1640995200000.log");
        let log2 = project2_dir.join("rpc-log-1640995200000.log");
        fs::write(&log1, content).unwrap();
        fs::write(&log2, content).unwrap();

        let filters = SearchFilters {
            project_hash: Some(project1_hash.clone()),
            ..Default::default()
        };

        let result = search_chats("search term".to_string(), Some(filters))
            .await
            .unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].chat.id.contains(&project1_hash));
    }

    #[tokio::test]
    async fn test_search_chats_with_max_results_filter() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-cli-desktop/projects");
        let valid_project_hash = "7".repeat(64); // Use 64-character hex string
        let project_dir = projects_dir.join(&valid_project_hash);
        fs::create_dir_all(&project_dir).unwrap();

        let content = "This contains the search term";

        // Create multiple matching log files
        for i in 0..5 {
            let timestamp = 1640995200000u64 + i as u64;
            let log_file = project_dir.join(format!("rpc-log-{}.log", timestamp));
            fs::write(&log_file, content).unwrap();
        }

        let filters = SearchFilters {
            max_results: Some(2),
            ..Default::default()
        };

        let result = search_chats("search term".to_string(), Some(filters))
            .await
            .unwrap();
        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn test_search_chats_sorts_by_relevance() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-cli-desktop/projects");
        let valid_project_hash = "4".repeat(64); // Use 64-character hex string
        let project_dir = projects_dir.join(&valid_project_hash);
        fs::create_dir_all(&project_dir).unwrap();

        // Create log with 1 match
        let log1 = project_dir.join("rpc-log-1640995100000.log");
        let content1 = "This contains one match";
        fs::write(&log1, content1).unwrap();

        // Create log with 2 matches
        let log2 = project_dir.join("rpc-log-1640995200000.log");
        let content2 = "This contains match\nAnother line with match";
        fs::write(&log2, content2).unwrap();

        let result = search_chats("match".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 2);
        // Result with 2 matches should be first (higher relevance score)
        assert_eq!(result[0].matches.len(), 2);
        assert_eq!(result[1].matches.len(), 1);
        assert!(result[0].relevance_score > result[1].relevance_score);
    }

    #[tokio::test]
    async fn test_search_chats_truncates_long_snippets() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-cli-desktop/projects");
        let valid_project_hash = "3".repeat(64); // Use 64-character hex string
        let project_dir = projects_dir.join(&valid_project_hash);
        fs::create_dir_all(&project_dir).unwrap();

        let log_file = project_dir.join("rpc-log-1640995200000.log");
        let long_line = format!("{}search term{}", "a".repeat(100), "b".repeat(150));
        fs::write(&log_file, &long_line).unwrap();

        let result = search_chats("search term".to_string(), None).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].matches.len(), 1);
        assert!(result[0].matches[0].content_snippet.ends_with("..."));
        assert!(result[0].matches[0].content_snippet.len() <= 203); // 200 + "..."
    }

    #[tokio::test]
    async fn test_get_project_discussions_nonexistent_project() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let result = get_project_discussions("nonexistent").await.unwrap();
        assert_eq!(result.len(), 0);
    }

    #[tokio::test]
    async fn test_get_project_discussions_with_logs() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-cli-desktop/projects");
        let valid_project_hash = "8".repeat(64); // Use 64-character hex string
        let project_dir = projects_dir.join(&valid_project_hash);
        fs::create_dir_all(&project_dir).unwrap();

        // Create log files
        let log1 = project_dir.join("rpc-log-1640995100000.log");
        let log2 = project_dir.join("rpc-log-1640995200000.log");
        let content =
            r#"{"method":"session/prompt","params":{"prompt":[{"text":"Test message"}]}}"#;
        fs::write(&log1, content).unwrap();
        fs::write(&log2, content).unwrap();

        let result = get_project_discussions(&valid_project_hash).await.unwrap();
        assert_eq!(result.len(), 2);
        // Should be sorted by date descending
        assert!(result[0].id.contains("1640995200000"));
        assert!(result[1].id.contains("1640995100000"));
    }

    #[tokio::test]
    async fn test_get_project_discussions_ignores_invalid_files() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-cli-desktop/projects");
        let valid_project_hash = "9".repeat(64); // Use 64-character hex string
        let project_dir = projects_dir.join(&valid_project_hash);
        fs::create_dir_all(&project_dir).unwrap();

        // Create valid log file
        let valid_log = project_dir.join("rpc-log-1640995200000.log");
        let content = r#"{"method":"session/prompt","params":{"prompt":[{"text":"Test"}]}}"#;
        fs::write(&valid_log, content).unwrap();

        // Create invalid files
        let invalid_file = project_dir.join("not-a-log.txt");
        fs::write(&invalid_file, "invalid").unwrap();
        let invalid_log = project_dir.join("rpc-log-invalid.log");
        fs::write(&invalid_log, "invalid").unwrap();

        let result = get_project_discussions(&valid_project_hash).await.unwrap();
        assert_eq!(result.len(), 1); // Only the valid log should be included
    }
}
