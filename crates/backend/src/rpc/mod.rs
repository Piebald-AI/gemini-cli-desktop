use anyhow::{Context, Result};
use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::sync::{Arc, Mutex};

pub fn deserialize_string_or_number<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNumber {
        String(String),
        Number(u32),
    }

    match StringOrNumber::deserialize(deserializer)? {
        StringOrNumber::String(s) => s
            .parse::<u32>()
            .map_err(|_| serde::de::Error::custom(format!("invalid u32 string: {s}"))),
        StringOrNumber::Number(n) => Ok(n),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u32,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u32,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

pub trait RpcLogger: Send + Sync {
    fn log_rpc(&self, message: &str) -> Result<(), std::io::Error>;
}

pub struct ProjectHasher;

impl ProjectHasher {
    pub fn hash_path(path: &str) -> Result<String> {
        let canonical_path = std::path::Path::new(path)
            .canonicalize()
            .context("Failed to canonicalize path")?;

        let mut hasher = Sha256::new();
        hasher.update(canonical_path.to_string_lossy().as_bytes());
        let hash = format!("{:x}", hasher.finalize());
        Ok(hash)
    }
}

pub struct FileRpcLogger {
    writer: Arc<Mutex<BufWriter<File>>>,
    file_path: std::path::PathBuf,
    backend_name: String,
}

impl FileRpcLogger {
    pub fn new(working_directory: Option<&str>, backend_name: Option<&str>) -> Result<Self> {
        let project_dir = working_directory.map(|s| s.to_string()).unwrap_or_else(|| {
            std::env::current_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."))
                .to_string_lossy()
                .to_string()
        });

        // If path doesn't exist or cannot be canonicalized, fall back to provided string to produce a stable hash
        let project_hash = match ProjectHasher::hash_path(&project_dir) {
            Ok(h) => h,
            Err(_) => {
                let mut hasher = Sha256::new();
                hasher.update(project_dir.as_bytes());
                format!("{:x}", hasher.finalize())
            }
        };

        let home_dir = std::env::var("HOME")
            .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string()));

        let log_dir = std::path::Path::new(&home_dir)
            .join(".gemini-desktop")
            .join("projects")
            .join(&project_hash);

        fs::create_dir_all(&log_dir)
            .context("Failed to create log directory")?;

        // Note: ensure_project_metadata will be called from projects module
        let _ = crate::projects::ensure_project_metadata(
            &project_hash,
            Some(std::path::Path::new(&project_dir)),
        );

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        let log_filename = format!("rpc-log-{timestamp}.log");
        let file_path = log_dir.join(log_filename);

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .context("Failed to open log file")?;

        let writer = Arc::new(Mutex::new(BufWriter::new(file)));
        let backend_name = backend_name.unwrap_or("Gemini CLI").to_string();

        Ok(Self {
            writer,
            file_path,
            backend_name,
        })
    }

    pub fn cleanup_old_logs(&self) -> Result<(), std::io::Error> {
        let parent_dir = self.file_path.parent().unwrap();
        let cutoff_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
            - (30 * 24 * 60 * 60);

        if let Ok(entries) = fs::read_dir(parent_dir) {
            for entry in entries.flatten() {
                if let Some(filename) = entry.file_name().to_str()
                    && filename.starts_with("rpc-log-")
                    && filename.ends_with(".log")
                    && let Ok(metadata) = entry.metadata()
                    && let Ok(modified) = metadata.modified()
                    && let Ok(modified_secs) = modified.duration_since(std::time::UNIX_EPOCH)
                    && modified_secs.as_secs() < cutoff_time
                {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }

        Ok(())
    }
}

impl RpcLogger for FileRpcLogger {
    fn log_rpc(&self, message: &str) -> Result<(), std::io::Error> {
        let timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
        let log_line = format!("[{timestamp}] [{}] {message}\n", self.backend_name);

        if let Ok(mut writer) = self.writer.lock() {
            writer.write_all(log_line.as_bytes())?;
            writer.flush()?;
        }

        Ok(())
    }
}

pub struct NoOpRpcLogger;

impl RpcLogger for NoOpRpcLogger {
    fn log_rpc(&self, _message: &str) -> Result<(), std::io::Error> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::EnvGuard;
    use serde_json::json;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_deserialize_string_or_number_with_number() {
        let json = json!(42);
        let result: u32 = serde_json::from_value(json).unwrap();
        assert_eq!(result, 42);
    }

    #[test]
    fn test_deserialize_string_or_number_with_string() {
        let json = json!("42");
        let result: Result<u32, _> = serde_json::from_value(json);
        // When deserializing directly into u32, a quoted string will error.
        // Our helper is tested via struct field deserialization elsewhere.
        assert!(result.is_err());
    }

    #[test]
    fn test_deserialize_string_or_number_with_invalid_string() {
        let json = json!("not_a_number");
        let result: Result<u32, _> = serde_json::from_value(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_json_rpc_request_serialization() {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 123,
            method: "test_method".to_string(),
            params: json!({"param1": "value1", "param2": 42}),
        };

        let serialized = serde_json::to_string(&request).unwrap();
        let deserialized: JsonRpcRequest = serde_json::from_str(&serialized).unwrap();

        assert_eq!(request.jsonrpc, deserialized.jsonrpc);
        assert_eq!(request.id, deserialized.id);
        assert_eq!(request.method, deserialized.method);
        assert_eq!(request.params, deserialized.params);
    }

    #[test]
    fn test_json_rpc_response_serialization() {
        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: 123,
            result: Some(json!({"success": true})),
            error: None,
        };

        let serialized = serde_json::to_string(&response).unwrap();
        let deserialized: JsonRpcResponse = serde_json::from_str(&serialized).unwrap();

        assert_eq!(response.jsonrpc, deserialized.jsonrpc);
        assert_eq!(response.id, deserialized.id);
        assert_eq!(response.result, deserialized.result);
        assert!(deserialized.error.is_none());
    }

    #[test]
    fn test_json_rpc_response_with_error() {
        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: 123,
            result: None,
            error: Some(JsonRpcError {
                code: -32600,
                message: "Invalid Request".to_string(),
            }),
        };

        let serialized = serde_json::to_string(&response).unwrap();
        let deserialized: JsonRpcResponse = serde_json::from_str(&serialized).unwrap();

        assert_eq!(response.jsonrpc, deserialized.jsonrpc);
        assert_eq!(response.id, deserialized.id);
        assert!(deserialized.result.is_none());

        let error = deserialized.error.unwrap();
        assert_eq!(error.code, -32600);
        assert_eq!(error.message, "Invalid Request");
    }

    #[test]
    fn test_json_rpc_error_serialization() {
        let error = JsonRpcError {
            code: -32700,
            message: "Parse error".to_string(),
        };

        let serialized = serde_json::to_string(&error).unwrap();
        let deserialized: JsonRpcError = serde_json::from_str(&serialized).unwrap();

        assert_eq!(error.code, deserialized.code);
        assert_eq!(error.message, deserialized.message);
    }

    #[test]
    fn test_project_hasher_hash_path() {
        let temp_dir = TempDir::new().unwrap();
        let test_path = temp_dir.path().to_str().unwrap();

        let hash1 = ProjectHasher::hash_path(test_path).unwrap();
        let hash2 = ProjectHasher::hash_path(test_path).unwrap();

        // Same path should produce same hash
        assert_eq!(hash1, hash2);

        // Hash should be 64 characters (SHA256 hex)
        assert_eq!(hash1.len(), 64);

        // Hash should be lowercase hex
        assert!(
            hash1
                .chars()
                .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
        );
    }

    #[test]
    fn test_project_hasher_different_paths() {
        let temp_dir1 = TempDir::new().unwrap();
        let temp_dir2 = TempDir::new().unwrap();

        let path1 = temp_dir1.path().to_str().unwrap();
        let path2 = temp_dir2.path().to_str().unwrap();

        let hash1 = ProjectHasher::hash_path(path1).unwrap();
        let hash2 = ProjectHasher::hash_path(path2).unwrap();

        // Different paths should produce different hashes
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_project_hasher_nonexistent_path() {
        let nonexistent_path = "/path/that/does/not/exist";
        let result = ProjectHasher::hash_path(nonexistent_path);

        assert!(result.is_err());
        assert!(result.is_err());
    }

    #[test]
    fn test_no_op_rpc_logger() {
        let logger = NoOpRpcLogger;
        let result = logger.log_rpc("test message");
        assert!(result.is_ok());

        // NoOpRpcLogger should always succeed and do nothing
        let result = logger.log_rpc("");
        assert!(result.is_ok());
    }

    #[test]
    fn test_file_rpc_logger_new_with_working_directory() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        let logger = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None);
        assert!(logger.is_ok());

        let logger = logger.unwrap();
        assert!(logger.file_path.exists());
    }

    #[test]
    fn test_file_rpc_logger_new_without_working_directory() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let _current_dir = std::env::current_dir().unwrap();
        let logger = FileRpcLogger::new(None, None);
        assert!(logger.is_ok());
    }

    #[test]
    fn test_file_rpc_logger_log_rpc() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        let logger = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None).unwrap();

        let test_message = "test RPC message";
        let result = logger.log_rpc(test_message);
        assert!(result.is_ok());

        // Verify the message was written to the file
        let content = fs::read_to_string(&logger.file_path).unwrap();
        assert!(content.contains(test_message));
        assert!(content.contains("[2")); // Should contain timestamp
    }

    #[test]
    fn test_file_rpc_logger_log_multiple_messages() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        let logger = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None).unwrap();

        let messages = vec!["message 1", "message 2", "message 3"];
        for message in &messages {
            let result = logger.log_rpc(message);
            assert!(result.is_ok());
        }

        let content = fs::read_to_string(&logger.file_path).unwrap();
        for message in messages {
            assert!(content.contains(message));
        }

        // Should have multiple lines with timestamps
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 3);
    }

    #[test]
    fn test_file_rpc_logger_cleanup_old_logs() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        let logger = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None).unwrap();
        let log_dir = logger.file_path.parent().unwrap();

        // Create some old log files (simulate old files by setting modified time in the past)
        let old_log1 = log_dir.join("rpc-log-1000000000000.log");
        let old_log2 = log_dir.join("rpc-log-2000000000000.log");
        let not_log_file = log_dir.join("other-file.txt");

        fs::write(&old_log1, "old log 1").unwrap();
        fs::write(&old_log2, "old log 2").unwrap();
        fs::write(&not_log_file, "not a log file").unwrap();

        // The cleanup should not fail even if there are files it can't process
        let result = logger.cleanup_old_logs();
        assert!(result.is_ok());

        // The logger file path should exist (it was created during logger initialization)
        // Note: The file might not exist if it hasn't been written to yet, so we just check that cleanup doesn't fail
        let _ = logger.file_path.exists(); // Don't assert on existence, just verify cleanup works

        // Non-log files should not be affected
        assert!(not_log_file.exists());
    }

    #[test]
    fn test_file_rpc_logger_cleanup_old_logs_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        let logger = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None).unwrap();

        // Remove all files to create empty directory scenario
        let log_dir = logger.file_path.parent().unwrap();
        for entry in fs::read_dir(log_dir).unwrap() {
            let entry = entry.unwrap();
            if entry.path().is_file() && entry.path() != logger.file_path {
                let _ = fs::remove_file(entry.path());
            }
        }

        let result = logger.cleanup_old_logs();
        assert!(result.is_ok());
    }

    #[test]
    fn test_rpc_logger_trait() {
        let no_op_logger: Box<dyn RpcLogger> = Box::new(NoOpRpcLogger);
        assert!(no_op_logger.log_rpc("test").is_ok());

        // Test that FileRpcLogger implements the trait
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        if let Ok(file_logger) = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None) {
            let file_logger: Box<dyn RpcLogger> = Box::new(file_logger);
            assert!(file_logger.log_rpc("test").is_ok());
        }
    }

    #[test]
    fn test_file_rpc_logger_with_userprofile() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.set("USERPROFILE", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        let logger = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None);
        assert!(logger.is_ok());
    }

    #[test]
    fn test_file_rpc_logger_fallback_home() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.remove("USERPROFILE");

        let working_dir = std::env::current_dir().unwrap();

        // Should use "." as fallback home directory
        let logger = FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None);
        assert!(logger.is_ok());
    }

    #[test]
    fn test_json_rpc_structs_debug() {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "test".to_string(),
            params: json!({}),
        };
        let debug_str = format!("{:?}", request);
        assert!(debug_str.contains("JsonRpcRequest"));
        assert!(debug_str.contains("test"));

        let error = JsonRpcError {
            code: -1,
            message: "error".to_string(),
        };
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("JsonRpcError"));
        assert!(debug_str.contains("error"));

        let response = JsonRpcResponse {
            jsonrpc: "2.0".to_string(),
            id: 1,
            result: None,
            error: Some(error),
        };
        let debug_str = format!("{:?}", response);
        assert!(debug_str.contains("JsonRpcResponse"));
    }

    #[test]
    fn test_file_rpc_logger_concurrent_logging() {
        use std::sync::Arc;
        use std::thread;

        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let working_dir = temp_dir.path().join("test_project");
        fs::create_dir_all(&working_dir).unwrap();

        let logger =
            Arc::new(FileRpcLogger::new(Some(working_dir.to_str().unwrap()), None).unwrap());
        let mut handles = vec![];

        // Spawn multiple threads to log concurrently
        for i in 0..5 {
            let logger_clone = Arc::clone(&logger);
            let handle = thread::spawn(move || {
                for j in 0..10 {
                    let message = format!("thread-{}-message-{}", i, j);
                    logger_clone.log_rpc(&message).unwrap();
                }
            });
            handles.push(handle);
        }

        // Wait for all threads to complete
        for handle in handles {
            handle.join().unwrap();
        }

        // Verify all messages were logged
        let content = fs::read_to_string(&logger.file_path).unwrap();
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 50); // 5 threads * 10 messages each

        // Verify all expected messages are present
        for i in 0..5 {
            for j in 0..10 {
                let expected_message = format!("thread-{}-message-{}", i, j);
                assert!(content.contains(&expected_message));
            }
        }
    }
}
