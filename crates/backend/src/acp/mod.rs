use serde::{Deserialize, Serialize};

/// ACP Protocol Types
/// Based on the ACP specification for structured JSON-RPC communication
///
/// Initialize request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u32,
}

/// Initialize response result
#[derive(Debug, Serialize, Deserialize)]
pub struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u32,
    #[serde(rename = "authMethods")]
    pub auth_methods: Vec<AuthMethod>,
    #[serde(rename = "agentCapabilities")]
    pub agent_capabilities: AgentCapabilities,
}

/// Authentication method
#[derive(Debug, Serialize, Deserialize)]
pub struct AuthMethod {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

/// Agent capabilities
#[derive(Debug, Serialize, Deserialize)]
pub struct AgentCapabilities {
    #[serde(rename = "loadSession")]
    pub load_session: bool,
}

/// Authenticate request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct AuthenticateParams {
    #[serde(rename = "methodId")]
    pub method_id: String,
}

/// Session/new request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionNewParams {
    pub cwd: String,
    #[serde(rename = "mcpServers")]
    pub mcp_servers: Vec<McpServer>,
}

/// MCP Server configuration
#[derive(Debug, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
}

/// Session/new response result
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionNewResult {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

/// Session/prompt request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionPromptParams {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub prompt: Vec<ContentBlock>,
}

/// Content block for prompts and responses
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text { text: String },
    Image { data: String, mime_type: String },
    Audio { data: String, mime_type: String },
    ResourceLink { uri: String, name: String },
    Resource { resource: ResourceInfo },
}

/// Resource information for embedded resources
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceInfo {
    pub uri: String,
    pub text: String,
}

/// Session/update notification parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionUpdateParams {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub update: SessionUpdate,
}

/// Session update types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "sessionUpdate", rename_all = "snake_case")]
pub enum SessionUpdate {
    #[serde(rename = "agent_message_chunk")]
    AgentMessageChunk { content: ContentBlock },
    #[serde(rename = "agent_thought_chunk")]
    AgentThoughtChunk { content: ContentBlock },
    #[serde(rename = "tool_call")]
    ToolCall {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        status: ToolCallStatus,
        title: String,
        content: Vec<ToolCallContentItem>,
        locations: Vec<Location>,
        kind: ToolCallKind,
    },
    #[serde(rename = "tool_call_update")]
    ToolCallUpdate {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        status: ToolCallStatus,
        content: Vec<ToolCallContentItem>,
    },
}

/// Tool call status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolCallStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

/// Tool call kind
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolCallKind {
    Read,
    Edit,
    Execute,
    Search,
    Fetch,
    Other,
}

/// Tool call content item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolCallContentItem {
    Content {
        content: ContentBlock,
    },
    Diff {
        path: String,
        #[serde(rename = "oldText")]
        old_text: String,
        #[serde(rename = "newText")]
        new_text: String,
    },
}

/// Location information for tool calls
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub path: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

/// Session/request_permission notification parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRequestPermissionParams {
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub options: Vec<PermissionOption>,
    #[serde(rename = "toolCall")]
    pub tool_call: PermissionToolCall,
}

/// Permission option for user selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionOption {
    #[serde(rename = "optionId")]
    pub option_id: String,
    pub name: String,
    pub kind: PermissionOptionKind,
}

/// Permission option kinds
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionOptionKind {
    AllowOnce,
    AllowAlways,
    RejectOnce,
    RejectAlways,
}

/// Tool call information in permission request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionToolCall {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: String,
    pub status: ToolCallStatus,
    pub title: String,
    pub content: Vec<ToolCallContentItem>,
    pub locations: Vec<Location>,
    pub kind: ToolCallKind,
}

/// Permission response result
#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionResult {
    pub outcome: PermissionOutcome,
}

/// Permission outcome
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum PermissionOutcome {
    Selected {
        #[serde(rename = "optionId")]
        option_id: String,
    },
    Cancelled,
}

/// Session/prompt response result
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionPromptResult {
    #[serde(rename = "stopReason")]
    pub stop_reason: String,
}

/// File system read request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct FsReadTextFileParams {
    pub path: String,
}

/// File system read response result
#[derive(Debug, Serialize, Deserialize)]
pub struct FsReadTextFileResult {
    pub content: String,
}

/// File system write request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct FsWriteTextFileParams {
    pub path: String,
    pub content: String,
}

/// File system write response result
#[derive(Debug, Serialize, Deserialize)]
pub struct FsWriteTextFileResult {
    pub success: bool,
    pub bytes_written: Option<usize>,
}

/// Session/cancel request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionCancelParams {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

/// Common ACP error codes
pub mod error_codes {
    pub const PARSE_ERROR: i32 = -32700;
    pub const INVALID_REQUEST: i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS: i32 = -32602;
    pub const INTERNAL_ERROR: i32 = -32603;

    // ACP-specific error codes
    pub const SESSION_NOT_FOUND: i32 = -32001;
    pub const AUTHENTICATION_FAILED: i32 = -32002;
    pub const PERMISSION_DENIED: i32 = -32003;
    pub const TOOL_EXECUTION_FAILED: i32 = -32004;
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_initialize_params_serialization() {
        let params = InitializeParams {
            protocol_version: 1,
        };

        let serialized = serde_json::to_value(&params).unwrap();
        let expected = json!({
            "protocolVersion": 1
        });

        assert_eq!(serialized, expected);
    }

    #[test]
    fn test_session_update_tool_call_serialization() {
        let update = SessionUpdate::ToolCall {
            tool_call_id: "test_001".to_string(),
            status: ToolCallStatus::InProgress,
            title: "Read file: config.json".to_string(),
            content: vec![ToolCallContentItem::Content {
                content: ContentBlock::Text {
                    text: "Reading file...".to_string(),
                },
            }],
            locations: vec![Location {
                path: "config.json".to_string(),
                line: None,
                column: None,
            }],
            kind: ToolCallKind::Read,
        };

        let serialized = serde_json::to_value(&update).unwrap();
        assert!(serialized.get("sessionUpdate").is_some());
        assert_eq!(serialized["sessionUpdate"], "tool_call");
        assert_eq!(serialized["toolCallId"], "test_001");
        assert_eq!(serialized["status"], "in_progress");
        assert_eq!(serialized["kind"], "read");
    }

    #[test]
    fn test_session_update_agent_thought_chunk_serialization() {
        let update = SessionUpdate::AgentThoughtChunk {
            content: ContentBlock::Text {
                text: "**Acknowledging the Greeting**\n\nI recognize the prompt. The user provided a simple greeting, and I will now return the courtesy.".to_string(),
            },
        };

        let serialized = serde_json::to_value(&update).unwrap();
        assert!(serialized.get("sessionUpdate").is_some());
        assert_eq!(serialized["sessionUpdate"], "agent_thought_chunk");
        assert_eq!(serialized["content"]["type"], "text");
        assert!(
            serialized["content"]["text"]
                .as_str()
                .unwrap()
                .contains("Acknowledging the Greeting")
        );
    }

    #[test]
    fn test_permission_outcome_serialization() {
        let outcome = PermissionOutcome::Selected {
            option_id: "proceed_once".to_string(),
        };

        let serialized = serde_json::to_value(&outcome).unwrap();
        let expected = json!({
            "outcome": "selected",
            "optionId": "proceed_once"
        });

        assert_eq!(serialized, expected);
    }

    #[test]
    fn test_content_block_variants() {
        let text_block = ContentBlock::Text {
            text: "Hello world".to_string(),
        };
        let serialized = serde_json::to_value(&text_block).unwrap();
        assert_eq!(serialized["type"], "text");
        assert_eq!(serialized["text"], "Hello world");

        let resource_block = ContentBlock::ResourceLink {
            uri: "file:///test.py".to_string(),
            name: "test.py".to_string(),
        };
        let serialized = serde_json::to_value(&resource_block).unwrap();
        assert_eq!(serialized["type"], "resource_link");
        assert_eq!(serialized["uri"], "file:///test.py");
    }

    #[test]
    fn test_tool_call_content_item_variants() {
        let content_item = ToolCallContentItem::Diff {
            path: "src/main.rs".to_string(),
            old_text: "old code".to_string(),
            new_text: "new code".to_string(),
        };

        let serialized = serde_json::to_value(&content_item).unwrap();
        assert_eq!(serialized["type"], "diff");
        assert_eq!(serialized["path"], "src/main.rs");
        assert_eq!(serialized["old_text"], "old code");
        assert_eq!(serialized["new_text"], "new code");
    }

    #[test]
    fn test_session_prompt_params_serialization() {
        let params = SessionPromptParams {
            session_id: "test-session-123".to_string(),
            prompt: vec![
                ContentBlock::Text {
                    text: "Hello, world!".to_string(),
                },
                ContentBlock::ResourceLink {
                    uri: "file:///test.py".to_string(),
                    name: "test.py".to_string(),
                },
            ],
        };

        let serialized = serde_json::to_value(&params).unwrap();
        assert_eq!(serialized["sessionId"], "test-session-123");
        assert_eq!(serialized["prompt"][0]["type"], "text");
        assert_eq!(serialized["prompt"][0]["text"], "Hello, world!");
        assert_eq!(serialized["prompt"][1]["type"], "resource_link");
        assert_eq!(serialized["prompt"][1]["uri"], "file:///test.py");
    }

    #[test]
    fn test_session_request_permission_params_serialization() {
        let params = SessionRequestPermissionParams {
            session_id: "test-session-456".to_string(),
            options: vec![
                PermissionOption {
                    option_id: "allow_once".to_string(),
                    name: "Allow Once".to_string(),
                    kind: PermissionOptionKind::AllowOnce,
                },
                PermissionOption {
                    option_id: "deny".to_string(),
                    name: "Deny".to_string(),
                    kind: PermissionOptionKind::RejectOnce,
                },
            ],
            tool_call: PermissionToolCall {
                tool_call_id: "write_001".to_string(),
                status: ToolCallStatus::Pending,
                title: "Write to file".to_string(),
                content: vec![ToolCallContentItem::Content {
                    content: ContentBlock::Text {
                        text: "File content".to_string(),
                    },
                }],
                locations: vec![Location {
                    path: "/tmp/test.txt".to_string(),
                    line: Some(10),
                    column: Some(5),
                }],
                kind: ToolCallKind::Edit,
            },
        };

        let serialized = serde_json::to_value(&params).unwrap();
        assert_eq!(serialized["sessionId"], "test-session-456");
        assert_eq!(serialized["options"].as_array().unwrap().len(), 2);
        assert_eq!(serialized["options"][0]["optionId"], "allow_once");
        assert_eq!(serialized["options"][0]["kind"], "allow_once");
        assert_eq!(serialized["toolCall"]["toolCallId"], "write_001");
        assert_eq!(serialized["toolCall"]["status"], "pending");
        assert_eq!(serialized["toolCall"]["kind"], "edit");
        assert_eq!(
            serialized["toolCall"]["locations"][0]["path"],
            "/tmp/test.txt"
        );
        assert_eq!(serialized["toolCall"]["locations"][0]["line"], 10);
    }

    #[test]
    fn test_authenticate_params_serialization() {
        let params = AuthenticateParams {
            method_id: "gemini-api-key".to_string(),
        };

        let serialized = serde_json::to_value(&params).unwrap();
        assert_eq!(serialized["methodId"], "gemini-api-key");
    }

    #[test]
    fn test_session_new_params_serialization() {
        let params = SessionNewParams {
            cwd: "/home/user/project".to_string(),
            mcp_servers: vec![McpServer {
                name: "database".to_string(),
                command: "db-server".to_string(),
                args: vec!["--port".to_string(), "5432".to_string()],
            }],
        };

        let serialized = serde_json::to_value(&params).unwrap();
        assert_eq!(serialized["cwd"], "/home/user/project");
        assert_eq!(serialized["mcpServers"].as_array().unwrap().len(), 1);
        assert_eq!(serialized["mcpServers"][0]["name"], "database");
        assert_eq!(serialized["mcpServers"][0]["command"], "db-server");
        assert_eq!(serialized["mcpServers"][0]["args"][0], "--port");
    }

    #[test]
    fn test_fs_read_write_params() {
        let read_params = FsReadTextFileParams {
            path: "/tmp/test.txt".to_string(),
        };
        let serialized = serde_json::to_value(&read_params).unwrap();
        assert_eq!(serialized["path"], "/tmp/test.txt");

        let write_params = FsWriteTextFileParams {
            path: "/tmp/output.txt".to_string(),
            content: "Hello, world!".to_string(),
        };
        let serialized = serde_json::to_value(&write_params).unwrap();
        assert_eq!(serialized["path"], "/tmp/output.txt");
        assert_eq!(serialized["content"], "Hello, world!");
    }

    #[test]
    fn test_full_acp_handshake_sequence() {
        // Test the complete handshake sequence message structure

        // 1. Initialize
        let init_params = InitializeParams {
            protocol_version: 1,
        };

        let init_serialized = serde_json::to_value(&init_params).unwrap();
        assert_eq!(init_serialized["protocolVersion"], 1);

        // 2. Authenticate
        let auth_params = AuthenticateParams {
            method_id: "gemini-api-key".to_string(),
        };

        let auth_serialized = serde_json::to_value(&auth_params).unwrap();
        assert_eq!(auth_serialized["methodId"], "gemini-api-key");

        // 3. Session/new
        let session_params = SessionNewParams {
            cwd: "/project".to_string(),
            mcp_servers: vec![],
        };

        let session_serialized = serde_json::to_value(&session_params).unwrap();
        assert_eq!(session_serialized["cwd"], "/project");
        assert_eq!(
            session_serialized["mcpServers"].as_array().unwrap().len(),
            0
        );

        // 4. Session/prompt
        let prompt_params = SessionPromptParams {
            session_id: "session-123".to_string(),
            prompt: vec![ContentBlock::Text {
                text: "Test prompt".to_string(),
            }],
        };

        let prompt_serialized = serde_json::to_value(&prompt_params).unwrap();
        assert_eq!(prompt_serialized["sessionId"], "session-123");
        assert_eq!(prompt_serialized["prompt"][0]["text"], "Test prompt");
    }
}
