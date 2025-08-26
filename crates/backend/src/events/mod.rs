use anyhow::Result;
use serde::{Deserialize, Serialize};

pub trait EventEmitter: Send + Sync + Clone {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> Result<()>;
}

#[derive(Debug, Clone)]
pub enum InternalEvent {
    CliIo {
        session_id: String,
        payload: CliIoPayload,
    },
    GeminiOutput {
        session_id: String,
        payload: GeminiOutputPayload,
    },
    GeminiThought {
        session_id: String,
        payload: GeminiThoughtPayload,
    },
    // Legacy events - DEPRECATED: Use ACP events instead
    #[deprecated(note = "Use AcpSessionUpdate instead")]
    ToolCall {
        session_id: String,
        payload: ToolCallEvent,
    },
    #[deprecated(note = "Use AcpSessionUpdate instead")]
    ToolCallUpdate {
        session_id: String,
        payload: ToolCallUpdate,
    },
    #[deprecated(note = "Use AcpPermissionRequest instead")]
    ToolCallConfirmation {
        session_id: String,
        payload: ToolCallConfirmationRequest,
    },
    // Pure ACP events - the future
    AcpSessionUpdate {
        session_id: String,
        update: crate::acp::SessionUpdate,
    },
    AcpPermissionRequest {
        session_id: String,
        request_id: u64,
        request: crate::acp::SessionRequestPermissionParams,
    },
    GeminiTurnFinished {
        session_id: String,
    },
    Error {
        session_id: String,
        payload: ErrorPayload,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliIoPayload {
    #[serde(rename = "type")]
    pub io_type: CliIoType,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CliIoType {
    Input,
    Output,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiOutputPayload {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiThoughtPayload {
    pub thought: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorPayload {
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallEvent {
    pub id: u32,
    pub name: String,
    pub icon: String,
    pub label: String,
    pub locations: Vec<ToolCallLocation>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallUpdate {
    #[serde(rename = "toolCallId")]
    pub tool_call_id: String,
    pub status: String,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallConfirmationRequest {
    pub request_id: u32,
    pub session_id: String,
    pub label: String,
    pub icon: String,
    pub content: Option<ToolCallConfirmationContent>,
    pub confirmation: ToolCallConfirmation,
    pub locations: Vec<ToolCallLocation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallLocation {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmationContent {
    #[serde(rename = "type")]
    pub content_type: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(rename = "oldText", default)]
    pub old_text: Option<String>,
    #[serde(rename = "newText", default)]
    pub new_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallConfirmation {
    #[serde(rename = "type")]
    pub confirmation_type: String,
    #[serde(rename = "rootCommand", default)]
    pub root_command: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
}

#[cfg(test)]
use std::collections::HashMap;
#[cfg(test)]
use std::sync::{Arc, Mutex};

/// Enhanced MockEventEmitter for comprehensive testing
///
/// This replaces the simple MockEventEmitter to address the integration test gaps
/// identified in the audit. It captures events for verification and provides
/// utilities for testing event emission patterns.
#[cfg(test)]
#[derive(Debug)]
pub struct MockEventEmitter {
    events: Arc<Mutex<Vec<(String, serde_json::Value)>>>,
    event_counts: Arc<Mutex<HashMap<String, usize>>>,
}

#[cfg(test)]
impl MockEventEmitter {
    /// Create a new MockEventEmitter
    pub fn new() -> Self {
        Self {
            events: Arc::new(Mutex::new(Vec::new())),
            event_counts: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get all captured events
    pub fn get_events(&self) -> Vec<(String, serde_json::Value)> {
        self.events.lock().unwrap().clone()
    }

    /// Get events by name
    pub fn get_events_by_name(&self, event_name: &str) -> Vec<serde_json::Value> {
        self.events
            .lock()
            .unwrap()
            .iter()
            .filter(|(name, _)| name == event_name)
            .map(|(_, payload)| payload.clone())
            .collect()
    }

    /// Get the count of events by name
    pub fn get_event_count(&self, event_name: &str) -> usize {
        self.event_counts
            .lock()
            .unwrap()
            .get(event_name)
            .copied()
            .unwrap_or(0)
    }

    /// Get total number of events emitted
    pub fn total_events(&self) -> usize {
        self.events.lock().unwrap().len()
    }

    /// Clear all captured events
    pub fn clear(&self) {
        self.events.lock().unwrap().clear();
        self.event_counts.lock().unwrap().clear();
    }

    /// Check if a specific event was emitted
    pub fn has_event(&self, event_name: &str) -> bool {
        self.get_event_count(event_name) > 0
    }

    /// Wait for a specific number of events (useful for async testing)
    pub fn wait_for_events(&self, expected_count: usize, timeout_ms: u64) -> bool {
        use std::time::{Duration, Instant};
        let start = Instant::now();
        let timeout = Duration::from_millis(timeout_ms);

        while start.elapsed() < timeout {
            if self.total_events() >= expected_count {
                return true;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        false
    }

    /// Get the last event of a specific type
    pub fn get_last_event(&self, event_name: &str) -> Option<serde_json::Value> {
        self.events
            .lock()
            .unwrap()
            .iter()
            .rev()
            .find(|(name, _)| name == event_name)
            .map(|(_, payload)| payload.clone())
    }

    /// Verify event sequence (events in order)
    pub fn verify_event_sequence(&self, expected_events: &[&str]) -> bool {
        let events = self.events.lock().unwrap();
        if events.len() < expected_events.len() {
            return false;
        }

        for (i, expected) in expected_events.iter().enumerate() {
            if &events[i].0 != expected {
                return false;
            }
        }
        true
    }
}

#[cfg(test)]
impl EventEmitter for MockEventEmitter {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> Result<()> {
        // Serialize the payload to JSON for storage and comparison
        let json_payload = serde_json::to_value(payload)?;

        // Store the event
        self.events
            .lock()
            .unwrap()
            .push((event.to_string(), json_payload));

        // Update event count
        let mut counts = self.event_counts.lock().unwrap();
        *counts.entry(event.to_string()).or_insert(0) += 1;

        Ok(())
    }
}

#[cfg(test)]
impl Clone for MockEventEmitter {
    fn clone(&self) -> Self {
        Self {
            events: Arc::clone(&self.events),
            event_counts: Arc::clone(&self.event_counts),
        }
    }
}

#[cfg(test)]
impl Default for MockEventEmitter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_internal_event_debug() {
        let event = InternalEvent::CliIo {
            session_id: "test-session".to_string(),
            payload: CliIoPayload {
                io_type: CliIoType::Input,
                data: "test data".to_string(),
            },
        };

        let debug_str = format!("{:?}", event);
        assert!(debug_str.contains("CliIo"));
        assert!(debug_str.contains("test-session"));
        assert!(debug_str.contains("test data"));
    }

    #[test]
    fn test_internal_event_clone() {
        let event = InternalEvent::GeminiOutput {
            session_id: "test-session".to_string(),
            payload: GeminiOutputPayload {
                text: "Hello world".to_string(),
            },
        };

        let cloned_event = event.clone();
        match (&event, &cloned_event) {
            (
                InternalEvent::GeminiOutput {
                    session_id: s1,
                    payload: p1,
                },
                InternalEvent::GeminiOutput {
                    session_id: s2,
                    payload: p2,
                },
            ) => {
                assert_eq!(s1, s2);
                assert_eq!(p1.text, p2.text);
            }
            _ => panic!("Event types don't match"),
        }
    }

    #[test]
    fn test_cli_io_payload_serialization() {
        let payload = CliIoPayload {
            io_type: CliIoType::Input,
            data: "test input data".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: CliIoPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(payload.data, deserialized.data);
        match (payload.io_type, deserialized.io_type) {
            (CliIoType::Input, CliIoType::Input) => {}
            _ => panic!("IO types don't match"),
        }
    }

    #[test]
    fn test_cli_io_type_serialization() {
        let input_type = CliIoType::Input;
        let output_type = CliIoType::Output;

        let input_json = serde_json::to_string(&input_type).unwrap();
        let output_json = serde_json::to_string(&output_type).unwrap();

        assert_eq!(input_json, "\"input\"");
        assert_eq!(output_json, "\"output\"");

        let deserialized_input: CliIoType = serde_json::from_str("\"input\"").unwrap();
        let deserialized_output: CliIoType = serde_json::from_str("\"output\"").unwrap();

        match deserialized_input {
            CliIoType::Input => {}
            _ => panic!("Expected Input type"),
        }

        match deserialized_output {
            CliIoType::Output => {}
            _ => panic!("Expected Output type"),
        }
    }

    #[test]
    fn test_gemini_output_payload_serialization() {
        let payload = GeminiOutputPayload {
            text: "This is Gemini's response".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: GeminiOutputPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(payload.text, deserialized.text);
    }

    #[test]
    fn test_gemini_thought_payload_serialization() {
        let payload = GeminiThoughtPayload {
            thought: "I need to think about this".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: GeminiThoughtPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(payload.thought, deserialized.thought);
    }

    #[test]
    fn test_error_payload_serialization() {
        let payload = ErrorPayload {
            error: "Something went wrong".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        let deserialized: ErrorPayload = serde_json::from_str(&json).unwrap();

        assert_eq!(payload.error, deserialized.error);
    }

    #[test]
    fn test_tool_call_event_serialization() {
        let event = ToolCallEvent {
            id: 123,
            name: "test_tool".to_string(),
            icon: "🔧".to_string(),
            label: "Test Tool".to_string(),
            locations: vec![ToolCallLocation {
                path: "/test/path".to_string(),
            }],
            status: "pending".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        let deserialized: ToolCallEvent = serde_json::from_str(&json).unwrap();

        assert_eq!(event.id, deserialized.id);
        assert_eq!(event.name, deserialized.name);
        assert_eq!(event.icon, deserialized.icon);
        assert_eq!(event.label, deserialized.label);
        assert_eq!(event.status, deserialized.status);
        assert_eq!(event.locations.len(), deserialized.locations.len());
        assert_eq!(event.locations[0].path, deserialized.locations[0].path);
    }

    #[test]
    fn test_tool_call_update_serialization() {
        let update = ToolCallUpdate {
            tool_call_id: "456".to_string(),
            status: "completed".to_string(),
            content: Some(json!({"result": "success"})),
        };

        let json = serde_json::to_string(&update).unwrap();
        let deserialized: ToolCallUpdate = serde_json::from_str(&json).unwrap();

        assert_eq!(update.tool_call_id, deserialized.tool_call_id);
        assert_eq!(update.status, deserialized.status);
        assert_eq!(update.content, deserialized.content);

        // Test camelCase serialization
        assert!(json.contains("toolCallId"));
    }

    #[test]
    fn test_tool_call_update_without_content() {
        let update = ToolCallUpdate {
            tool_call_id: "789".to_string(),
            status: "failed".to_string(),
            content: None,
        };

        let json = serde_json::to_string(&update).unwrap();
        let deserialized: ToolCallUpdate = serde_json::from_str(&json).unwrap();

        assert_eq!(update.tool_call_id, deserialized.tool_call_id);
        assert_eq!(update.status, deserialized.status);
        assert!(deserialized.content.is_none());
    }

    #[test]
    fn test_tool_call_location_serialization() {
        let location = ToolCallLocation {
            path: "/home/user/project/file.rs".to_string(),
        };

        let json = serde_json::to_string(&location).unwrap();
        let deserialized: ToolCallLocation = serde_json::from_str(&json).unwrap();

        assert_eq!(location.path, deserialized.path);
    }

    #[test]
    fn test_tool_call_confirmation_content_serialization() {
        let content = ToolCallConfirmationContent {
            content_type: "edit".to_string(),
            path: Some("/test/file.rs".to_string()),
            old_text: Some("old code".to_string()),
            new_text: Some("new code".to_string()),
        };

        let json = serde_json::to_string(&content).unwrap();
        let deserialized: ToolCallConfirmationContent = serde_json::from_str(&json).unwrap();

        assert_eq!(content.content_type, deserialized.content_type);
        assert_eq!(content.path, deserialized.path);
        assert_eq!(content.old_text, deserialized.old_text);
        assert_eq!(content.new_text, deserialized.new_text);

        // Test field renaming
        assert!(json.contains("\"type\":"));
        assert!(json.contains("oldText"));
        assert!(json.contains("newText"));
    }

    #[test]
    fn test_tool_call_confirmation_content_with_defaults() {
        let content = ToolCallConfirmationContent {
            content_type: "create".to_string(),
            path: None,
            old_text: None,
            new_text: None,
        };

        let json = serde_json::to_string(&content).unwrap();
        let deserialized: ToolCallConfirmationContent = serde_json::from_str(&json).unwrap();

        assert_eq!(content.content_type, deserialized.content_type);
        assert!(deserialized.path.is_none());
        assert!(deserialized.old_text.is_none());
        assert!(deserialized.new_text.is_none());
    }

    #[test]
    fn test_tool_call_confirmation_serialization() {
        let confirmation = ToolCallConfirmation {
            confirmation_type: "execute".to_string(),
            root_command: Some("cargo".to_string()),
            command: Some("test".to_string()),
        };

        let json = serde_json::to_string(&confirmation).unwrap();
        let deserialized: ToolCallConfirmation = serde_json::from_str(&json).unwrap();

        assert_eq!(
            confirmation.confirmation_type,
            deserialized.confirmation_type
        );
        assert_eq!(confirmation.root_command, deserialized.root_command);
        assert_eq!(confirmation.command, deserialized.command);

        // Test field renaming
        assert!(json.contains("\"type\":"));
        assert!(json.contains("rootCommand"));
    }

    #[test]
    fn test_tool_call_confirmation_with_defaults() {
        let confirmation = ToolCallConfirmation {
            confirmation_type: "simple".to_string(),
            root_command: None,
            command: None,
        };

        let json = serde_json::to_string(&confirmation).unwrap();
        let deserialized: ToolCallConfirmation = serde_json::from_str(&json).unwrap();

        assert_eq!(
            confirmation.confirmation_type,
            deserialized.confirmation_type
        );
        assert!(deserialized.root_command.is_none());
        assert!(deserialized.command.is_none());
    }

    #[test]
    fn test_tool_call_confirmation_request_serialization() {
        let request = ToolCallConfirmationRequest {
            request_id: 42,
            session_id: "session-123".to_string(),
            label: "Delete File".to_string(),
            icon: "🗑️".to_string(),
            content: Some(ToolCallConfirmationContent {
                content_type: "delete".to_string(),
                path: Some("/tmp/file.txt".to_string()),
                old_text: None,
                new_text: None,
            }),
            confirmation: ToolCallConfirmation {
                confirmation_type: "simple".to_string(),
                root_command: None,
                command: None,
            },
            locations: vec![ToolCallLocation {
                path: "/tmp/file.txt".to_string(),
            }],
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ToolCallConfirmationRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.request_id, deserialized.request_id);
        assert_eq!(request.session_id, deserialized.session_id);
        assert_eq!(request.label, deserialized.label);
        assert_eq!(request.icon, deserialized.icon);
        assert!(deserialized.content.is_some());
        assert_eq!(request.locations.len(), deserialized.locations.len());

        // Test camelCase serialization
        assert!(json.contains("requestId"));
        assert!(json.contains("sessionId"));
    }

    #[test]
    fn test_tool_call_confirmation_request_without_content() {
        let request = ToolCallConfirmationRequest {
            request_id: 99,
            session_id: "session-456".to_string(),
            label: "Simple Action".to_string(),
            icon: "✅".to_string(),
            content: None,
            confirmation: ToolCallConfirmation {
                confirmation_type: "execute".to_string(),
                root_command: Some("npm".to_string()),
                command: Some("install".to_string()),
            },
            locations: vec![],
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: ToolCallConfirmationRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(request.request_id, deserialized.request_id);
        assert_eq!(request.session_id, deserialized.session_id);
        assert!(deserialized.content.is_none());
        assert_eq!(deserialized.locations.len(), 0);
    }

    #[test]
    #[allow(deprecated)]
    fn test_internal_event_variants() {
        let cli_io_event = InternalEvent::CliIo {
            session_id: "session1".to_string(),
            payload: CliIoPayload {
                io_type: CliIoType::Input,
                data: "input".to_string(),
            },
        };

        let output_event = InternalEvent::GeminiOutput {
            session_id: "session2".to_string(),
            payload: GeminiOutputPayload {
                text: "output".to_string(),
            },
        };

        let thought_event = InternalEvent::GeminiThought {
            session_id: "session3".to_string(),
            payload: GeminiThoughtPayload {
                thought: "thinking".to_string(),
            },
        };

        #[allow(deprecated)]
        let tool_call_event = InternalEvent::ToolCall {
            session_id: "session4".to_string(),
            payload: ToolCallEvent {
                id: 1,
                name: "tool".to_string(),
                icon: "🔧".to_string(),
                label: "Tool".to_string(),
                locations: vec![],
                status: "pending".to_string(),
            },
        };

        #[allow(deprecated)]
        let tool_update_event = InternalEvent::ToolCallUpdate {
            session_id: "session5".to_string(),
            payload: ToolCallUpdate {
                tool_call_id: "1".to_string(),
                status: "completed".to_string(),
                content: None,
            },
        };

        #[allow(deprecated)]
        let confirmation_event = InternalEvent::ToolCallConfirmation {
            session_id: "session6".to_string(),
            payload: ToolCallConfirmationRequest {
                request_id: 1,
                session_id: "session6".to_string(),
                label: "Confirm".to_string(),
                icon: "❓".to_string(),
                content: None,
                confirmation: ToolCallConfirmation {
                    confirmation_type: "simple".to_string(),
                    root_command: None,
                    command: None,
                },
                locations: vec![],
            },
        };

        let turn_finished_event = InternalEvent::GeminiTurnFinished {
            session_id: "session7".to_string(),
        };

        let error_event = InternalEvent::Error {
            session_id: "session8".to_string(),
            payload: ErrorPayload {
                error: "test error".to_string(),
            },
        };

        // Test that all variants can be created and match correctly
        match cli_io_event {
            InternalEvent::CliIo { session_id, .. } => assert_eq!(session_id, "session1"),
            _ => panic!("Expected CliIo event"),
        }

        match output_event {
            InternalEvent::GeminiOutput { session_id, .. } => assert_eq!(session_id, "session2"),
            _ => panic!("Expected GeminiOutput event"),
        }

        match thought_event {
            InternalEvent::GeminiThought { session_id, .. } => assert_eq!(session_id, "session3"),
            _ => panic!("Expected GeminiThought event"),
        }

        #[allow(deprecated)]
        match tool_call_event {
            InternalEvent::ToolCall { session_id, .. } => assert_eq!(session_id, "session4"),
            _ => panic!("Expected ToolCall event"),
        }

        #[allow(deprecated)]
        match tool_update_event {
            InternalEvent::ToolCallUpdate { session_id, .. } => assert_eq!(session_id, "session5"),
            _ => panic!("Expected ToolCallUpdate event"),
        }

        #[allow(deprecated)]
        match confirmation_event {
            InternalEvent::ToolCallConfirmation { session_id, .. } => {
                assert_eq!(session_id, "session6")
            }
            _ => panic!("Expected ToolCallConfirmation event"),
        }

        match turn_finished_event {
            InternalEvent::GeminiTurnFinished { session_id } => assert_eq!(session_id, "session7"),
            _ => panic!("Expected GeminiTurnFinished event"),
        }

        match error_event {
            InternalEvent::Error { session_id, .. } => assert_eq!(session_id, "session8"),
            _ => panic!("Expected Error event"),
        }
    }

    #[test]
    fn test_mock_event_emitter() {
        let emitter = MockEventEmitter::new();
        let cloned_emitter = emitter.clone();

        // Test that emit works without panicking
        let result = emitter.emit("test-event", "test-payload");
        assert!(result.is_ok());

        // Test with cloned emitter
        let result = cloned_emitter.emit("test-event-2", json!({"key": "value"}));
        assert!(result.is_ok());

        // Test with complex payload
        let payload = CliIoPayload {
            io_type: CliIoType::Output,
            data: "complex test data".to_string(),
        };
        let result = emitter.emit("cli-io", payload);
        assert!(result.is_ok());

        // Test event capture functionality
        assert_eq!(emitter.total_events(), 3);
        assert_eq!(emitter.get_event_count("test-event"), 1);
        assert_eq!(emitter.get_event_count("test-event-2"), 1);
        assert_eq!(emitter.get_event_count("cli-io"), 1);

        // Test event retrieval
        let events = emitter.get_events();
        assert_eq!(events.len(), 3);
        assert_eq!(events[0].0, "test-event");

        // Test event filtering
        let cli_events = emitter.get_events_by_name("cli-io");
        assert_eq!(cli_events.len(), 1);

        // Test has_event
        assert!(emitter.has_event("test-event"));
        assert!(!emitter.has_event("nonexistent-event"));

        // Test clear functionality
        emitter.clear();
        assert_eq!(emitter.total_events(), 0);
        assert!(!emitter.has_event("test-event"));
    }

    #[test]
    fn test_mock_event_emitter_advanced_features() {
        let emitter = MockEventEmitter::new();

        // Test event sequence
        emitter.emit("event-1", "payload-1").unwrap();
        emitter.emit("event-2", "payload-2").unwrap();
        emitter.emit("event-1", "payload-3").unwrap();

        // Test sequence verification
        assert!(emitter.verify_event_sequence(&["event-1", "event-2"]));
        assert!(!emitter.verify_event_sequence(&["event-2", "event-1"]));

        // Test last event retrieval
        let last_event_1 = emitter.get_last_event("event-1");
        assert!(last_event_1.is_some());
        assert_eq!(last_event_1.unwrap(), json!("payload-3"));

        let last_event_2 = emitter.get_last_event("event-2");
        assert!(last_event_2.is_some());
        assert_eq!(last_event_2.unwrap(), json!("payload-2"));

        // Test nonexistent event
        let nonexistent = emitter.get_last_event("nonexistent");
        assert!(nonexistent.is_none());
    }

    #[test]
    fn test_mock_event_emitter_wait_for_events() {
        let emitter = MockEventEmitter::new();

        // Test immediate success
        emitter.emit("test", "payload").unwrap();
        assert!(emitter.wait_for_events(1, 100));

        // Test timeout (should be fast since we're not actually waiting)
        assert!(!emitter.wait_for_events(10, 50));
    }

    #[test]
    fn test_event_emitter_trait_bounds() {
        fn test_emitter<T: EventEmitter>(emitter: T) -> Result<()> {
            emitter.emit("test", "payload")
        }

        let mock_emitter = MockEventEmitter::new();
        let result = test_emitter(mock_emitter);
        assert!(result.is_ok());
    }

    #[test]
    fn test_struct_cloning() {
        let location = ToolCallLocation {
            path: "/test/path".to_string(),
        };
        let cloned_location = location.clone();
        assert_eq!(location.path, cloned_location.path);

        let payload = GeminiOutputPayload {
            text: "test output".to_string(),
        };
        let cloned_payload = payload.clone();
        assert_eq!(payload.text, cloned_payload.text);

        let confirmation = ToolCallConfirmation {
            confirmation_type: "test".to_string(),
            root_command: Some("test_cmd".to_string()),
            command: None,
        };
        let cloned_confirmation = confirmation.clone();
        assert_eq!(
            confirmation.confirmation_type,
            cloned_confirmation.confirmation_type
        );
        assert_eq!(confirmation.root_command, cloned_confirmation.root_command);
        assert_eq!(confirmation.command, cloned_confirmation.command);
    }
}
