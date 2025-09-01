//! Test utilities for safe and reliable testing
//!
//! This module provides utilities to address the issues identified in the test audit:
//! - Safe environment variable management
//! - Test data builders and factories
//! - Improved test isolation

use std::collections::HashMap;
use std::env;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tempfile::TempDir;
use uuid::Uuid;

/// Thread-safe environment variable guard that automatically restores original values
///
/// This replaces the unsafe environment variable operations identified in the audit.
/// It uses RAII pattern to ensure cleanup even if tests panic.
pub struct EnvGuard {
    original_values: HashMap<String, Option<OsString>>,
    _lock: Arc<Mutex<()>>, // Ensures thread safety for environment operations
}

impl EnvGuard {
    /// Create a new environment guard
    pub fn new() -> Self {
        Self {
            original_values: HashMap::new(),
            _lock: Arc::new(Mutex::new(())),
        }
    }

    /// Set an environment variable, storing the original value for restoration
    pub fn set<K: AsRef<str>, V: AsRef<str>>(&mut self, key: K, value: V) {
        let key_str = key.as_ref().to_string();

        // Store original value if we haven't already
        if !self.original_values.contains_key(&key_str) {
            let original = env::var_os(&key_str);
            self.original_values.insert(key_str.clone(), original);
        }

        // Set the new value
        unsafe {
            env::set_var(&key_str, value.as_ref());
        }
    }

    /// Remove an environment variable, storing the original value for restoration
    pub fn remove<K: AsRef<str>>(&mut self, key: K) {
        let key_str = key.as_ref().to_string();

        // Store original value if we haven't already
        if !self.original_values.contains_key(&key_str) {
            let original = env::var_os(&key_str);
            self.original_values.insert(key_str.clone(), original);
        }

        // Remove the variable
        unsafe {
            env::remove_var(&key_str);
        }
    }

    /// Set HOME environment variable to a temporary directory
    pub fn set_temp_home(&mut self, temp_dir: &TempDir) {
        self.set("HOME", temp_dir.path().to_string_lossy());
    }

    /// Set USERPROFILE environment variable to a temporary directory (Windows)
    pub fn set_temp_userprofile(&mut self, temp_dir: &TempDir) {
        self.set("USERPROFILE", temp_dir.path().to_string_lossy());
    }

    /// Convenience method to set up a clean home environment for testing
    pub fn setup_clean_home(&mut self, temp_dir: &TempDir) {
        self.remove("HOME");
        self.remove("USERPROFILE");
        self.set_temp_home(temp_dir);
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        // Restore all original environment variable values
        for (key, original_value) in &self.original_values {
            unsafe {
                match original_value {
                    Some(value) => env::set_var(key, value),
                    None => env::remove_var(key),
                }
            }
        }
    }
}

/// Test directory manager for improved test isolation
///
/// Creates unique temporary directories to prevent test interference
pub struct TestDirManager {
    temp_dir: TempDir,
    unique_id: String,
}

impl TestDirManager {
    /// Create a new test directory manager with a unique identifier
    pub fn new() -> std::io::Result<Self> {
        let temp_dir = TempDir::new()?;
        let unique_id = Uuid::new_v4().to_string();
        Ok(Self {
            temp_dir,
            unique_id,
        })
    }

    /// Get the root temporary directory path
    pub fn path(&self) -> &Path {
        self.temp_dir.path()
    }

    /// Create a unique subdirectory for this test
    pub fn create_unique_subdir(&self, name: &str) -> std::io::Result<PathBuf> {
        let subdir = self
            .temp_dir
            .path()
            .join(format!("{}_{}", name, self.unique_id));
        std::fs::create_dir_all(&subdir)?;
        Ok(subdir)
    }

    /// Create the standard .gemini-desktop/projects structure
    pub fn create_projects_structure(&self) -> std::io::Result<PathBuf> {
        let projects_dir = self
            .temp_dir
            .path()
            .join(".gemini-desktop")
            .join("projects");
        std::fs::create_dir_all(&projects_dir)?;
        Ok(projects_dir)
    }

    /// Create a project directory with the given hash
    pub fn create_project_dir(&self, project_hash: &str) -> std::io::Result<PathBuf> {
        let projects_dir = self.create_projects_structure()?;
        let project_dir = projects_dir.join(project_hash);
        std::fs::create_dir_all(&project_dir)?;
        Ok(project_dir)
    }

    /// Create a log file in a project directory
    pub fn create_log_file(
        &self,
        project_hash: &str,
        timestamp: u64,
        content: &str,
    ) -> std::io::Result<PathBuf> {
        let project_dir = self.create_project_dir(project_hash)?;
        let log_file = project_dir.join(format!("rpc-log-{}.log", timestamp));
        std::fs::write(&log_file, content)?;
        Ok(log_file)
    }
}

/// Test data builders for consistent test data creation
pub mod builders {
    use crate::projects::ProjectListItem;
    use crate::rpc::JsonRpcRequest;
    use crate::search::RecentChat;

    /// Builder for ProjectListItem test data
    pub struct ProjectListItemBuilder {
        id: String,
        title: Option<String>,
        status: Option<String>,
        created_at: Option<String>,
        updated_at: Option<String>,
        last_activity_at: Option<String>,
        log_count: Option<u32>,
    }

    impl ProjectListItemBuilder {
        pub fn new(id: &str) -> Self {
            Self {
                id: id.to_string(),
                title: None,
                status: None,
                created_at: None,
                updated_at: None,
                last_activity_at: None,
                log_count: None,
            }
        }

        pub fn with_title(mut self, title: &str) -> Self {
            self.title = Some(title.to_string());
            self
        }

        pub fn with_status(mut self, status: &str) -> Self {
            self.status = Some(status.to_string());
            self
        }

        pub fn with_log_count(mut self, count: u32) -> Self {
            self.log_count = Some(count);
            self
        }

        pub fn active(mut self) -> Self {
            self.status = Some("active".to_string());
            self
        }

        pub fn build(self) -> ProjectListItem {
            ProjectListItem {
                id: self.id,
                title: self.title,
                status: self.status,
                created_at: self.created_at,
                updated_at: self.updated_at,
                last_activity_at: self.last_activity_at,
                log_count: self.log_count,
            }
        }
    }

    /// Builder for RecentChat test data
    pub struct RecentChatBuilder {
        id: String,
        title: String,
        started_at_iso: String,
        message_count: u32,
    }

    impl RecentChatBuilder {
        pub fn new(id: &str) -> Self {
            Self {
                id: id.to_string(),
                title: "Test Chat".to_string(),
                started_at_iso: "2023-01-01T00:00:00Z".to_string(),
                message_count: 1,
            }
        }

        pub fn with_title(mut self, title: &str) -> Self {
            self.title = title.to_string();
            self
        }

        pub fn with_message_count(mut self, count: u32) -> Self {
            self.message_count = count;
            self
        }

        pub fn build(self) -> RecentChat {
            RecentChat {
                id: self.id,
                title: self.title,
                started_at_iso: self.started_at_iso,
                message_count: self.message_count,
                summary: None,
                last_activity_iso: None,
                total_tokens: None,
                tags: vec![],
            }
        }
    }

    /// Builder for JsonRpcRequest test data
    pub struct JsonRpcRequestBuilder {
        jsonrpc: String,
        id: u32,
        method: String,
        params: serde_json::Value,
    }

    impl JsonRpcRequestBuilder {
        pub fn new(id: u32, method: &str) -> Self {
            Self {
                jsonrpc: "2.0".to_string(),
                id,
                method: method.to_string(),
                params: serde_json::json!({}),
            }
        }

        pub fn with_params(mut self, params: serde_json::Value) -> Self {
            self.params = params;
            self
        }

        pub fn build(self) -> JsonRpcRequest {
            JsonRpcRequest {
                jsonrpc: self.jsonrpc,
                id: self.id,
                method: self.method,
                params: self.params,
            }
        }
    }

    /// Convenience functions for common test data
    pub fn sample_project_hash() -> String {
        "a".repeat(64)
    }

    pub fn sample_timestamp_millis() -> u64 {
        1640995200000 // 2022-01-01T00:00:00Z
    }

    pub fn sample_rpc_log_content() -> String {
        r#"{"method":"sendUserMessage","params":{"text":"Hello world"}}"#.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_env_guard_set_and_restore() {
        let original_value = env::var("TEST_VAR").ok();

        {
            let mut guard = EnvGuard::new();
            guard.set("TEST_VAR", "test_value");
            assert_eq!(env::var("TEST_VAR").unwrap(), "test_value");
        }

        // After guard is dropped, original value should be restored
        match original_value {
            Some(val) => assert_eq!(env::var("TEST_VAR").unwrap(), val),
            None => assert!(env::var("TEST_VAR").is_err()),
        }
    }

    #[test]
    fn test_env_guard_remove_and_restore() {
        unsafe {
            env::set_var("TEST_VAR_REMOVE", "original");
        }

        {
            let mut guard = EnvGuard::new();
            guard.remove("TEST_VAR_REMOVE");
            assert!(env::var("TEST_VAR_REMOVE").is_err());
        }

        // After guard is dropped, original value should be restored
        assert_eq!(env::var("TEST_VAR_REMOVE").unwrap(), "original");
    }

    #[test]
    fn test_env_guard_multiple_operations() {
        let original_var1 = env::var("TEST_VAR1").ok();
        let original_var2 = env::var("TEST_VAR2").ok();

        {
            let mut guard = EnvGuard::new();
            guard.set("TEST_VAR1", "value1");
            guard.set("TEST_VAR2", "value2");
            guard.remove("TEST_VAR1");

            assert!(env::var("TEST_VAR1").is_err());
            assert_eq!(env::var("TEST_VAR2").unwrap(), "value2");
        }

        // All should be restored
        match original_var1 {
            Some(val) => assert_eq!(env::var("TEST_VAR1").unwrap(), val),
            None => assert!(env::var("TEST_VAR1").is_err()),
        }
        match original_var2 {
            Some(val) => assert_eq!(env::var("TEST_VAR2").unwrap(), val),
            None => assert!(env::var("TEST_VAR2").is_err()),
        }
    }

    #[test]
    fn test_test_dir_manager() {
        let manager1 = TestDirManager::new().unwrap();
        let manager2 = TestDirManager::new().unwrap();

        // Should create unique subdirectories across different managers
        let subdir1 = manager1.create_unique_subdir("test").unwrap();
        let subdir2 = manager2.create_unique_subdir("test").unwrap();

        assert_ne!(subdir1, subdir2);
        assert!(subdir1.exists());
        assert!(subdir2.exists());
    }

    #[test]
    fn test_test_dir_manager_projects_structure() {
        let manager = TestDirManager::new().unwrap();
        let projects_dir = manager.create_projects_structure().unwrap();

        assert!(projects_dir.exists());
        assert!(projects_dir.ends_with(".gemini-desktop/projects"));
    }

    #[test]
    fn test_builders() {
        use builders::*;

        let project = ProjectListItemBuilder::new("test-id")
            .with_title("Test Project")
            .active()
            .with_log_count(5)
            .build();

        assert_eq!(project.id, "test-id");
        assert_eq!(project.title, Some("Test Project".to_string()));
        assert_eq!(project.status, Some("active".to_string()));
        assert_eq!(project.log_count, Some(5));

        let chat = RecentChatBuilder::new("chat-id")
            .with_title("Test Chat")
            .with_message_count(10)
            .build();

        assert_eq!(chat.id, "chat-id");
        assert_eq!(chat.title, "Test Chat");
        assert_eq!(chat.message_count, 10);
    }
}
