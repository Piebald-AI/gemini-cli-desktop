use thiserror::Error;

pub type BackendResult<T> = Result<T, BackendError>;

#[derive(Error, Debug)]
pub enum BackendError {
    #[error("Session initialization failed: {0}")]
    SessionInitFailed(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Process not found")]
    ProcessNotFound,

    #[error("Command not allowed for security reasons")]
    CommandNotAllowed,

    #[error("Command execution failed: {0}")]
    CommandExecutionFailed(String),

    #[error("JSON serialization error: {0}")]
    JsonError(String),

    #[error("Channel communication error")]
    ChannelError,

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Path error: {0}")]
    PathError(String),

    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::error::Error as StdError;
    use std::io::{Error, ErrorKind};

    #[test]
    fn test_backend_error_display() {
        let error = BackendError::SessionInitFailed("test session".to_string());
        assert_eq!(
            error.to_string(),
            "Session initialization failed: test session"
        );
    }

    #[test]
    fn test_session_not_found_error() {
        let error = BackendError::SessionNotFound("session_123".to_string());
        assert_eq!(error.to_string(), "Session not found: session_123");
    }

    #[test]
    fn test_process_not_found_error() {
        let error = BackendError::ProcessNotFound;
        assert_eq!(error.to_string(), "Process not found");
    }

    #[test]
    fn test_command_not_allowed_error() {
        let error = BackendError::CommandNotAllowed;
        assert_eq!(
            error.to_string(),
            "Command not allowed for security reasons"
        );
    }

    #[test]
    fn test_command_execution_failed_error() {
        let error = BackendError::CommandExecutionFailed("exit code 1".to_string());
        assert_eq!(error.to_string(), "Command execution failed: exit code 1");
    }

    #[test]
    fn test_json_error() {
        let error = BackendError::JsonError("invalid JSON".to_string());
        assert_eq!(error.to_string(), "JSON serialization error: invalid JSON");
    }

    #[test]
    fn test_channel_error() {
        let error = BackendError::ChannelError;
        assert_eq!(error.to_string(), "Channel communication error");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_error = Error::new(ErrorKind::NotFound, "file not found");
        let backend_error = BackendError::IoError(io_error);
        assert_eq!(backend_error.to_string(), "IO error: file not found");
    }

    #[test]
    fn test_path_error() {
        let error = BackendError::PathError("invalid path".to_string());
        assert_eq!(error.to_string(), "Path error: invalid path");
    }

    #[test]
    fn test_project_not_found_error() {
        let error = BackendError::ProjectNotFound("project_abc".to_string());
        assert_eq!(error.to_string(), "Project not found: project_abc");
    }

    #[test]
    fn test_config_error() {
        let error = BackendError::ConfigError("missing config file".to_string());
        assert_eq!(
            error.to_string(),
            "Configuration error: missing config file"
        );
    }

    #[test]
    fn test_backend_result_ok() {
        let result: BackendResult<i32> = Ok(42);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_backend_result_err() {
        let result: BackendResult<i32> = Err(BackendError::ProcessNotFound);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().to_string(), "Process not found");
    }

    #[test]
    fn test_error_debug_formatting() {
        let error = BackendError::SessionInitFailed("debug test".to_string());
        let debug_str = format!("{:?}", error);
        assert!(debug_str.contains("SessionInitFailed"));
        assert!(debug_str.contains("debug test"));
    }

    #[test]
    fn test_error_source_chain() {
        let io_error = Error::new(ErrorKind::PermissionDenied, "access denied");
        let backend_error = BackendError::IoError(io_error);

        assert!(backend_error.source().is_some());
        let source = backend_error.source().unwrap();
        assert_eq!(source.to_string(), "access denied");
    }

    #[test]
    fn test_all_error_variants_are_covered() {
        // Test that we can construct all error variants
        let errors = vec![
            BackendError::SessionInitFailed("test".to_string()),
            BackendError::SessionNotFound("test".to_string()),
            BackendError::ProcessNotFound,
            BackendError::CommandNotAllowed,
            BackendError::CommandExecutionFailed("test".to_string()),
            BackendError::JsonError("test".to_string()),
            BackendError::ChannelError,
            BackendError::IoError(Error::new(ErrorKind::Other, "test")),
            BackendError::PathError("test".to_string()),
            BackendError::ProjectNotFound("test".to_string()),
            BackendError::ConfigError("test".to_string()),
        ];

        for error in errors {
            // Ensure all variants can be displayed and debugged
            let _display = error.to_string();
            let _debug = format!("{:?}", error);
        }
    }
}
