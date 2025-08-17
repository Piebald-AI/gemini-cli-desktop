use crate::events::ToolCallLocation;
use serde::de::{Deserializer, Error as DeError};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SendUserMessageParams {
    pub chunks: Vec<MessageChunk>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageChunk {
    Text { text: String },
    Path { path: String },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StreamAssistantMessageChunkParams {
    pub chunk: AssistantChunk,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssistantChunk {
    pub thought: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallParams {
    pub icon: String,
    pub label: String,
    #[serde(deserialize_with = "deserialize_locations")]
    pub locations: Vec<ToolCallLocation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PushToolCallResult {
    pub id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateToolCallParams {
    #[serde(rename = "toolCallId")]
    #[serde(alias = "tool_call_id")]
    pub tool_call_id: String,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationParams {
    pub label: String,
    pub icon: String,
    #[serde(default, deserialize_with = "deserialize_content")]
    pub content: Option<crate::events::ToolCallConfirmationContent>,
    #[serde(deserialize_with = "deserialize_confirmation")]
    pub confirmation: crate::events::ToolCallConfirmation,
    #[serde(deserialize_with = "deserialize_locations")]
    pub locations: Vec<ToolCallLocation>,
}

// Support both ["path1", "path2"] and [{"path": "path1"}, ...]
fn deserialize_locations<'de, D>(deserializer: D) -> Result<Vec<ToolCallLocation>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum LocOrStr {
        Str(String),
        Obj(ToolCallLocation),
    }

    let raw: Vec<LocOrStr> = Vec::<LocOrStr>::deserialize(deserializer)?;
    Ok(raw
        .into_iter()
        .map(|v| match v {
            LocOrStr::Str(s) => ToolCallLocation { path: s },
            LocOrStr::Obj(o) => o,
        })
        .collect())
}

fn deserialize_content<'de, D>(
    deserializer: D,
) -> Result<Option<crate::events::ToolCallConfirmationContent>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum ContentOrStringOrNull {
        Null,
        Str(String),
        Obj(crate::events::ToolCallConfirmationContent),
    }

    match ContentOrStringOrNull::deserialize(deserializer)? {
        ContentOrStringOrNull::Null => Ok(None),
        ContentOrStringOrNull::Str(s) => Ok(Some(crate::events::ToolCallConfirmationContent {
            content_type: "text".to_string(),
            path: None,
            old_text: None,
            new_text: Some(s),
        })),
        ContentOrStringOrNull::Obj(o) => Ok(Some(o)),
    }
}

fn deserialize_confirmation<'de, D>(
    deserializer: D,
) -> Result<crate::events::ToolCallConfirmation, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum ConfirmOrBool {
        Bool(bool),
        Obj(crate::events::ToolCallConfirmation),
    }

    match ConfirmOrBool::deserialize(deserializer)? {
        ConfirmOrBool::Obj(o) => Ok(o),
        ConfirmOrBool::Bool(true) => Ok(crate::events::ToolCallConfirmation {
            confirmation_type: "simple".to_string(),
            root_command: None,
            command: None,
        }),
        ConfirmOrBool::Bool(false) => Err(DeError::custom("confirmation false is unsupported")),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestToolCallConfirmationResult {
    pub id: String,
    pub outcome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub command: String,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::{ToolCallConfirmation, ToolCallConfirmationContent, ToolCallLocation};
    use serde_json::json;

    #[test]
    fn test_message_chunk_text_serialization() {
        let chunk = MessageChunk::Text {
            text: "Hello, world!".to_string(),
        };

        let json = serde_json::to_string(&chunk).unwrap();
        let deserialized: MessageChunk = serde_json::from_str(&json).unwrap();

        match deserialized {
            MessageChunk::Text { text } => assert_eq!(text, "Hello, world!"),
            _ => panic!("Expected Text chunk"),
        }
    }

    #[test]
    fn test_message_chunk_path_serialization() {
        let chunk = MessageChunk::Path {
            path: "/home/user/file.txt".to_string(),
        };

        let json = serde_json::to_string(&chunk).unwrap();
        let deserialized: MessageChunk = serde_json::from_str(&json).unwrap();

        match deserialized {
            MessageChunk::Path { path } => assert_eq!(path, "/home/user/file.txt"),
            _ => panic!("Expected Path chunk"),
        }
    }

    #[test]
    fn test_message_chunk_untagged_deserialization() {
        // Test that the untagged enum correctly deserializes both variants
        let text_json = json!({"text": "Some text"});
        let path_json = json!({"path": "/some/path"});

        let text_chunk: MessageChunk = serde_json::from_value(text_json).unwrap();
        let path_chunk: MessageChunk = serde_json::from_value(path_json).unwrap();

        match text_chunk {
            MessageChunk::Text { text } => assert_eq!(text, "Some text"),
            _ => panic!("Expected Text chunk"),
        }

        match path_chunk {
            MessageChunk::Path { path } => assert_eq!(path, "/some/path"),
            _ => panic!("Expected Path chunk"),
        }
    }

    #[test]
    fn test_send_user_message_params_serialization() {
        let params = SendUserMessageParams {
            chunks: vec![
                MessageChunk::Text {
                    text: "Please analyze".to_string(),
                },
                MessageChunk::Path {
                    path: "/project/src/main.rs".to_string(),
                },
            ],
        };

        let json = serde_json::to_string(&params).unwrap();
        let deserialized: SendUserMessageParams = serde_json::from_str(&json).unwrap();

        assert_eq!(params.chunks.len(), deserialized.chunks.len());

        match (&params.chunks[0], &deserialized.chunks[0]) {
            (MessageChunk::Text { text: t1 }, MessageChunk::Text { text: t2 }) => {
                assert_eq!(t1, t2);
            }
            _ => panic!("Expected matching Text chunks"),
        }

        match (&params.chunks[1], &deserialized.chunks[1]) {
            (MessageChunk::Path { path: p1 }, MessageChunk::Path { path: p2 }) => {
                assert_eq!(p1, p2);
            }
            _ => panic!("Expected matching Path chunks"),
        }
    }

    #[test]
    fn test_assistant_chunk_serialization() {
        let chunk = AssistantChunk {
            thought: Some("I should think about this".to_string()),
            text: Some("Here's my response".to_string()),
        };

        let json = serde_json::to_string(&chunk).unwrap();
        let deserialized: AssistantChunk = serde_json::from_str(&json).unwrap();

        assert_eq!(chunk.thought, deserialized.thought);
        assert_eq!(chunk.text, deserialized.text);
    }

    #[test]
    fn test_assistant_chunk_partial_serialization() {
        let thought_only = AssistantChunk {
            thought: Some("Just thinking".to_string()),
            text: None,
        };

        let text_only = AssistantChunk {
            thought: None,
            text: Some("Just text".to_string()),
        };

        let thought_json = serde_json::to_string(&thought_only).unwrap();
        let text_json = serde_json::to_string(&text_only).unwrap();

        let thought_deserialized: AssistantChunk = serde_json::from_str(&thought_json).unwrap();
        let text_deserialized: AssistantChunk = serde_json::from_str(&text_json).unwrap();

        assert_eq!(
            thought_deserialized.thought,
            Some("Just thinking".to_string())
        );
        assert!(thought_deserialized.text.is_none());

        assert!(text_deserialized.thought.is_none());
        assert_eq!(text_deserialized.text, Some("Just text".to_string()));
    }

    #[test]
    fn test_stream_assistant_message_chunk_params_serialization() {
        let params = StreamAssistantMessageChunkParams {
            chunk: AssistantChunk {
                thought: Some("Processing request".to_string()),
                text: Some("Processing...".to_string()),
            },
        };

        let json = serde_json::to_string(&params).unwrap();
        let deserialized: StreamAssistantMessageChunkParams = serde_json::from_str(&json).unwrap();

        assert_eq!(params.chunk.thought, deserialized.chunk.thought);
        assert_eq!(params.chunk.text, deserialized.chunk.text);
    }

    #[test]
    fn test_push_tool_call_params_serialization() {
        let params = PushToolCallParams {
            icon: "🔧".to_string(),
            label: "Code Editor".to_string(),
            locations: vec![
                ToolCallLocation {
                    path: "/src/main.rs".to_string(),
                },
                ToolCallLocation {
                    path: "/src/lib.rs".to_string(),
                },
            ],
        };

        let json = serde_json::to_string(&params).unwrap();
        let deserialized: PushToolCallParams = serde_json::from_str(&json).unwrap();

        assert_eq!(params.icon, deserialized.icon);
        assert_eq!(params.label, deserialized.label);
        assert_eq!(params.locations.len(), deserialized.locations.len());
        assert_eq!(params.locations[0].path, deserialized.locations[0].path);
        assert_eq!(params.locations[1].path, deserialized.locations[1].path);
    }

    #[test]
    fn test_push_tool_call_result_serialization() {
        let result = PushToolCallResult { id: 12345 };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: PushToolCallResult = serde_json::from_str(&json).unwrap();

        assert_eq!(result.id, deserialized.id);
    }

    #[test]
    fn test_update_tool_call_params_serialization() {
        let params = UpdateToolCallParams {
            tool_call_id: 987,
            status: "completed".to_string(),
            content: Some(json!({"result": "success", "data": [1, 2, 3]})),
        };

        let json = serde_json::to_string(&params).unwrap();
        let deserialized: UpdateToolCallParams = serde_json::from_str(&json).unwrap();

        assert_eq!(params.tool_call_id, deserialized.tool_call_id);
        assert_eq!(params.status, deserialized.status);
        assert_eq!(params.content, deserialized.content);

        // Test camelCase field name
        assert!(json.contains("toolCallId"));
    }

    #[test]
    fn test_update_tool_call_params_without_content() {
        let params = UpdateToolCallParams {
            tool_call_id: 456,
            status: "failed".to_string(),
            content: None,
        };

        let json = serde_json::to_string(&params).unwrap();
        let deserialized: UpdateToolCallParams = serde_json::from_str(&json).unwrap();

        assert_eq!(params.tool_call_id, deserialized.tool_call_id);
        assert_eq!(params.status, deserialized.status);
        assert!(deserialized.content.is_none());
    }

    #[test]
    fn test_update_tool_call_params_deserialize_string_id() {
        // Test that tool_call_id can be deserialized from both string and number
        let json_with_number = json!({
            "toolCallId": 123,
            "status": "pending",
            "content": null
        });

        let json_with_string = json!({
            "toolCallId": "456",
            "status": "running",
            "content": null
        });

        let from_number: UpdateToolCallParams = serde_json::from_value(json_with_number).unwrap();
        let from_string: UpdateToolCallParams = serde_json::from_value(json_with_string).unwrap();

        assert_eq!(from_number.tool_call_id, 123);
        assert_eq!(from_number.status, "pending");

        assert_eq!(from_string.tool_call_id, 456);
        assert_eq!(from_string.status, "running");
    }

    #[test]
    fn test_update_tool_call_params_invalid_string_id() {
        let json_with_invalid_string = json!({
            "toolCallId": "not_a_number",
            "status": "pending",
            "content": null
        });

        let result: Result<UpdateToolCallParams, _> =
            serde_json::from_value(json_with_invalid_string);
        assert!(result.is_err());
    }

    #[test]
    fn test_request_tool_call_confirmation_params_serialization() {
        let params = RequestToolCallConfirmationParams {
            label: "Delete Files".to_string(),
            icon: "🗑️".to_string(),
            content: Some(ToolCallConfirmationContent {
                content_type: "bulk_delete".to_string(),
                path: Some("/tmp/files".to_string()),
                old_text: None,
                new_text: None,
            }),
            confirmation: ToolCallConfirmation {
                confirmation_type: "dangerous".to_string(),
                root_command: Some("rm".to_string()),
                command: Some("-rf /tmp/files/*".to_string()),
            },
            locations: vec![
                ToolCallLocation {
                    path: "/tmp/files/file1.txt".to_string(),
                },
                ToolCallLocation {
                    path: "/tmp/files/file2.txt".to_string(),
                },
            ],
        };

        let json = serde_json::to_string(&params).unwrap();
        let deserialized: RequestToolCallConfirmationParams = serde_json::from_str(&json).unwrap();

        assert_eq!(params.label, deserialized.label);
        assert_eq!(params.icon, deserialized.icon);
        assert!(deserialized.content.is_some());
        assert_eq!(params.locations.len(), deserialized.locations.len());

        let content = deserialized.content.unwrap();
        assert_eq!(content.content_type, "bulk_delete");
        assert_eq!(content.path, Some("/tmp/files".to_string()));

        assert_eq!(deserialized.confirmation.confirmation_type, "dangerous");
        assert_eq!(
            deserialized.confirmation.root_command,
            Some("rm".to_string())
        );
        assert_eq!(
            deserialized.confirmation.command,
            Some("-rf /tmp/files/*".to_string())
        );
    }

    #[test]
    fn test_request_tool_call_confirmation_params_minimal() {
        let params = RequestToolCallConfirmationParams {
            label: "Simple Action".to_string(),
            icon: "✅".to_string(),
            content: None,
            confirmation: ToolCallConfirmation {
                confirmation_type: "simple".to_string(),
                root_command: None,
                command: None,
            },
            locations: vec![],
        };

        let json = serde_json::to_string(&params).unwrap();
        let deserialized: RequestToolCallConfirmationParams = serde_json::from_str(&json).unwrap();

        assert_eq!(params.label, deserialized.label);
        assert_eq!(params.icon, deserialized.icon);
        assert!(deserialized.content.is_none());
        assert_eq!(deserialized.locations.len(), 0);

        assert_eq!(deserialized.confirmation.confirmation_type, "simple");
        assert!(deserialized.confirmation.root_command.is_none());
        assert!(deserialized.confirmation.command.is_none());
    }

    #[test]
    fn test_request_tool_call_confirmation_result_serialization() {
        let result = RequestToolCallConfirmationResult {
            id: "confirmation-123".to_string(),
            outcome: "approved".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: RequestToolCallConfirmationResult = serde_json::from_str(&json).unwrap();

        assert_eq!(result.id, deserialized.id);
        assert_eq!(result.outcome, deserialized.outcome);
    }

    #[test]
    fn test_command_result_serialization() {
        let result = CommandResult {
            command: "cargo build".to_string(),
            success: true,
            output: Some("Finished dev [unoptimized + debuginfo] target(s)".to_string()),
            error: None,
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: CommandResult = serde_json::from_str(&json).unwrap();

        assert_eq!(result.command, deserialized.command);
        assert_eq!(result.success, deserialized.success);
        assert_eq!(result.output, deserialized.output);
        assert!(deserialized.error.is_none());
    }

    #[test]
    fn test_command_result_with_error() {
        let result = CommandResult {
            command: "cargo test".to_string(),
            success: false,
            output: None,
            error: Some("test failed".to_string()),
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: CommandResult = serde_json::from_str(&json).unwrap();

        assert_eq!(result.command, deserialized.command);
        assert!(!deserialized.success);
        assert!(deserialized.output.is_none());
        assert_eq!(result.error, deserialized.error);
    }

    #[test]
    fn test_command_result_clone() {
        let result = CommandResult {
            command: "echo hello".to_string(),
            success: true,
            output: Some("hello".to_string()),
            error: None,
        };

        let cloned = result.clone();
        assert_eq!(result.command, cloned.command);
        assert_eq!(result.success, cloned.success);
        assert_eq!(result.output, cloned.output);
        assert_eq!(result.error, cloned.error);
    }

    #[test]
    fn test_update_tool_call_params_clone() {
        let params = UpdateToolCallParams {
            tool_call_id: 789,
            status: "in_progress".to_string(),
            content: Some(json!({"progress": 50})),
        };

        let cloned = params.clone();
        assert_eq!(params.tool_call_id, cloned.tool_call_id);
        assert_eq!(params.status, cloned.status);
        assert_eq!(params.content, cloned.content);
    }

    #[test]
    fn test_debug_formatting() {
        let chunk = MessageChunk::Text {
            text: "debug test".to_string(),
        };
        let debug_str = format!("{:?}", chunk);
        assert!(debug_str.contains("Text"));
        assert!(debug_str.contains("debug test"));

        let params = SendUserMessageParams {
            chunks: vec![chunk],
        };
        let debug_str = format!("{:?}", params);
        assert!(debug_str.contains("SendUserMessageParams"));

        let assistant_chunk = AssistantChunk {
            thought: Some("debug thought".to_string()),
            text: None,
        };
        let debug_str = format!("{:?}", assistant_chunk);
        assert!(debug_str.contains("AssistantChunk"));
        assert!(debug_str.contains("debug thought"));

        let result = CommandResult {
            command: "debug command".to_string(),
            success: true,
            output: None,
            error: None,
        };
        let debug_str = format!("{:?}", result);
        assert!(debug_str.contains("CommandResult"));
        assert!(debug_str.contains("debug command"));
    }

    #[test]
    fn test_empty_collections() {
        let params = SendUserMessageParams { chunks: vec![] };
        let json = serde_json::to_string(&params).unwrap();
        let deserialized: SendUserMessageParams = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.chunks.len(), 0);

        let tool_params = PushToolCallParams {
            icon: "🔧".to_string(),
            label: "Empty Tool".to_string(),
            locations: vec![],
        };
        let json = serde_json::to_string(&tool_params).unwrap();
        let deserialized: PushToolCallParams = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.locations.len(), 0);
    }
}
