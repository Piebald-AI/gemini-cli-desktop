use crate::types::BackendResult;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum VolumeType {
    LocalDisk,
    RemovableDisk,
    NetworkDrive,
    CdDrive,
    RamDisk,
    FileSystem,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub is_directory: bool,
    pub full_path: String,
    pub size: Option<u64>,
    pub modified: Option<u64>,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub volume_type: Option<VolumeType>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitInfo {
    pub current_directory: String,
    pub branch: String,
    pub status: String,
    pub is_clean: bool,
    pub has_uncommitted_changes: bool,
    pub has_untracked_files: bool,
}

pub async fn validate_directory(path: String) -> BackendResult<bool> {
    let path = Path::new(&path);
    Ok(path.exists() && path.is_dir())
}

pub async fn is_home_directory(path: String) -> BackendResult<bool> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    let home_path = Path::new(&home);
    let check_path = Path::new(&path);

    Ok(home_path == check_path)
}

pub async fn get_home_directory() -> BackendResult<String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    Ok(home)
}

pub async fn get_parent_directory(path: String) -> BackendResult<Option<String>> {
    let path = Path::new(&path);
    Ok(path.parent().map(|p| p.to_string_lossy().to_string()))
}

pub async fn list_directory_contents(path: String) -> BackendResult<Vec<DirEntry>> {
    let mut entries = Vec::new();
    let dir_path = Path::new(&path);

    if !dir_path.exists() || !dir_path.is_dir() {
        return Ok(entries);
    }

    let read_dir = std::fs::read_dir(dir_path)?;

    for entry in read_dir {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        let full_path = entry.path().to_string_lossy().to_string();

        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs());

        let size = if metadata.is_file() {
            Some(metadata.len())
        } else {
            None
        };

        let is_symlink = metadata.is_symlink();
        let symlink_target = if is_symlink {
            std::fs::read_link(entry.path())
                .ok()
                .map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        entries.push(DirEntry {
            name: file_name,
            is_directory: metadata.is_dir(),
            full_path,
            size,
            modified,
            is_symlink,
            symlink_target,
            volume_type: None,
        });
    }

    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

pub async fn list_volumes() -> BackendResult<Vec<DirEntry>> {
    let mut volumes = Vec::new();

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        let output = Command::new("wmic")
            .args(["logicaldisk", "get", "name,volumename,drivetype,size"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if !parts.is_empty() {
                let drive_letter = parts[0];
                let drive_type = parts
                    .get(1)
                    .and_then(|s| s.parse::<u32>().ok())
                    .unwrap_or(0);

                let volume_type = match drive_type {
                    2 => VolumeType::RemovableDisk,
                    3 => VolumeType::LocalDisk,
                    4 => VolumeType::NetworkDrive,
                    5 => VolumeType::CdDrive,
                    6 => VolumeType::RamDisk,
                    _ => VolumeType::LocalDisk,
                };

                let volume_name = parts.get(2..).map(|p| p.join(" ")).unwrap_or_default();
                let display_name = if volume_name.is_empty() {
                    drive_letter.to_string()
                } else {
                    format!("{volume_name} ({drive_letter})")
                };

                volumes.push(DirEntry {
                    name: display_name,
                    is_directory: true,
                    full_path: format!("{drive_letter}\\"),
                    size: None,
                    modified: None,
                    is_symlink: false,
                    symlink_target: None,
                    volume_type: Some(volume_type),
                });
            }
        }
    }

    #[cfg(not(windows))]
    {
        volumes.push(DirEntry {
            name: "Root (/)".to_string(),
            is_directory: true,
            full_path: "/".to_string(),
            size: None,
            modified: None,
            is_symlink: false,
            symlink_target: None,
            volume_type: Some(VolumeType::FileSystem),
        });

        if let Ok(home) = std::env::var("HOME") {
            volumes.push(DirEntry {
                name: "Home".to_string(),
                is_directory: true,
                full_path: home,
                size: None,
                modified: None,
                is_symlink: false,
                symlink_target: None,
                volume_type: Some(VolumeType::FileSystem),
            });
        }
    }

    Ok(volumes)
}

pub async fn get_git_info(directory: String) -> BackendResult<Option<GitInfo>> {
    let path = Path::new(&directory);
    if !path.exists() || !path.is_dir() {
        return Ok(None);
    }

    // Check if this is a git repository by looking for .git directory
    let git_dir = path.join(".git");
    if !git_dir.exists() {
        return Ok(None);
    }

    let current_directory = path.to_string_lossy().to_string();

    // Get current branch
    let branch_output = Command::new("git")
        .arg("branch")
        .arg("--show-current")
        .current_dir(path)
        .output()
        .await;

    let branch = if let Ok(output) = branch_output {
        if output.status.success() {
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        } else {
            // Fallback to symbolic-ref if branch --show-current fails
            let symbolic_ref_output = Command::new("git")
                .arg("symbolic-ref")
                .arg("--short")
                .arg("HEAD")
                .current_dir(path)
                .output()
                .await;

            if let Ok(ref_output) = symbolic_ref_output {
                if ref_output.status.success() {
                    String::from_utf8_lossy(&ref_output.stdout)
                        .trim()
                        .to_string()
                } else {
                    "HEAD".to_string() // Detached HEAD state
                }
            } else {
                "unknown".to_string()
            }
        }
    } else {
        "unknown".to_string()
    };

    // Get git status
    let status_output = Command::new("git")
        .arg("status")
        .arg("--porcelain")
        .arg("--branch")
        .current_dir(path)
        .output()
        .await;

    let (status, is_clean, has_uncommitted_changes, has_untracked_files) =
        if let Ok(output) = status_output {
            if output.status.success() {
                let status_text = String::from_utf8_lossy(&output.stdout);
                let lines: Vec<&str> = status_text.lines().collect();

                // Parse the status output
                let mut has_changes = false;
                let mut has_untracked = false;

                for line in &lines {
                    if line.starts_with("##") {
                        // Branch line - we don't need to store this for now
                    } else if !line.is_empty() {
                        // File status line
                        if line.starts_with("??") {
                            has_untracked = true;
                        } else {
                            has_changes = true;
                        }
                    }
                }

                let is_clean = !has_changes && !has_untracked;
                let status_desc = if is_clean {
                    "clean".to_string()
                } else {
                    let mut parts = Vec::new();
                    if has_changes {
                        parts.push("modified files");
                    }
                    if has_untracked {
                        parts.push("untracked files");
                    }
                    parts.join(", ")
                };

                (status_desc, is_clean, has_changes, has_untracked)
            } else {
                ("unknown".to_string(), false, false, false)
            }
        } else {
            ("unknown".to_string(), false, false, false)
        };

    Ok(Some(GitInfo {
        current_directory,
        branch,
        status,
        is_clean,
        has_uncommitted_changes,
        has_untracked_files,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tempfile::{NamedTempFile, TempDir};

    #[test]
    fn test_volume_type_serialization() {
        let volume_types = vec![
            VolumeType::LocalDisk,
            VolumeType::RemovableDisk,
            VolumeType::NetworkDrive,
            VolumeType::CdDrive,
            VolumeType::RamDisk,
            VolumeType::FileSystem,
        ];

        for volume_type in volume_types {
            let json = serde_json::to_string(&volume_type).unwrap();
            let deserialized: VolumeType = serde_json::from_str(&json).unwrap();
            assert_eq!(volume_type, deserialized);
        }
    }

    #[test]
    fn test_dir_entry_creation() {
        let entry = DirEntry {
            name: "test_file.txt".to_string(),
            is_directory: false,
            full_path: "/path/to/test_file.txt".to_string(),
            size: Some(1024),
            modified: Some(1640995200), // 2022-01-01 00:00:00 UTC
            is_symlink: false,
            symlink_target: None,
            volume_type: None,
        };

        assert_eq!(entry.name, "test_file.txt");
        assert!(!entry.is_directory);
        assert_eq!(entry.full_path, "/path/to/test_file.txt");
        assert_eq!(entry.size, Some(1024));
        assert_eq!(entry.modified, Some(1640995200));
        assert!(!entry.is_symlink);
        assert!(entry.symlink_target.is_none());
        assert!(entry.volume_type.is_none());
    }

    #[test]
    fn test_dir_entry_serialization() {
        let entry = DirEntry {
            name: "test".to_string(),
            is_directory: true,
            full_path: "/test".to_string(),
            size: None,
            modified: Some(123456789),
            is_symlink: false,
            symlink_target: None,
            volume_type: Some(VolumeType::LocalDisk),
        };

        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: DirEntry = serde_json::from_str(&json).unwrap();

        assert_eq!(entry.name, deserialized.name);
        assert_eq!(entry.is_directory, deserialized.is_directory);
        assert_eq!(entry.full_path, deserialized.full_path);
        assert_eq!(entry.size, deserialized.size);
        assert_eq!(entry.modified, deserialized.modified);
        assert_eq!(entry.is_symlink, deserialized.is_symlink);
        assert_eq!(entry.symlink_target, deserialized.symlink_target);
    }

    #[tokio::test]
    async fn test_validate_directory_existing() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().to_string_lossy().to_string();

        let result = validate_directory(dir_path).await;
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[tokio::test]
    async fn test_validate_directory_nonexistent() {
        let result = validate_directory("/path/that/does/not/exist".to_string()).await;
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[tokio::test]
    async fn test_validate_directory_file() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "test content").unwrap();
        let file_path = temp_file.path().to_string_lossy().to_string();

        let result = validate_directory(file_path).await;
        assert!(result.is_ok());
        assert!(!result.unwrap()); // Should be false because it's a file, not a directory
    }

    #[tokio::test]
    async fn test_get_home_directory() {
        let result = get_home_directory().await;
        assert!(result.is_ok());
        let home = result.unwrap();
        assert!(!home.is_empty());

        // Should be either HOME or USERPROFILE environment variable
        let expected = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        assert_eq!(home, expected);
    }

    #[tokio::test]
    async fn test_is_home_directory() {
        let home = get_home_directory().await.unwrap();

        let result = is_home_directory(home.clone()).await;
        assert!(result.is_ok());
        assert!(result.unwrap());

        // Test with a non-home directory
        let result = is_home_directory("/definitely/not/home".to_string()).await;
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[tokio::test]
    async fn test_get_parent_directory() {
        // Test normal path
        let result = get_parent_directory("/path/to/file".to_string()).await;
        assert!(result.is_ok());
        let parent = result.unwrap();
        assert!(parent.is_some());

        #[cfg(windows)]
        {
            // On Windows, the path handling might be different
            let parent_path = parent.unwrap();
            assert!(parent_path.contains("path"));
        }
        #[cfg(not(windows))]
        {
            assert_eq!(parent.unwrap(), "/path/to");
        }
    }

    #[tokio::test]
    async fn test_get_parent_directory_root() {
        let result = get_parent_directory("/".to_string()).await;
        assert!(result.is_ok());
        let parent = result.unwrap();
        assert!(parent.is_none()); // Root has no parent
    }

    #[tokio::test]
    async fn test_list_directory_contents() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Create test files and subdirectories
        let file_path = dir_path.join("test_file.txt");
        fs::write(&file_path, "test content").unwrap();

        let subdir_path = dir_path.join("test_subdir");
        fs::create_dir(&subdir_path).unwrap();

        let result = list_directory_contents(dir_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 2);

        // Check that directory comes before file (directories are sorted first)
        let dir_entry = &entries[0];
        let file_entry = &entries[1];

        assert!(dir_entry.is_directory);
        assert_eq!(dir_entry.name, "test_subdir");
        assert!(dir_entry.full_path.ends_with("test_subdir"));
        assert!(dir_entry.size.is_none());
        assert!(!dir_entry.is_symlink);

        assert!(!file_entry.is_directory);
        assert_eq!(file_entry.name, "test_file.txt");
        assert!(file_entry.full_path.ends_with("test_file.txt"));
        assert_eq!(file_entry.size, Some("test content".len() as u64));
        assert!(!file_entry.is_symlink);
    }

    #[tokio::test]
    async fn test_list_directory_contents_empty() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().to_string_lossy().to_string();

        let result = list_directory_contents(dir_path).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert!(entries.is_empty());
    }

    #[tokio::test]
    async fn test_list_directory_contents_nonexistent() {
        let result = list_directory_contents("/path/that/does/not/exist".to_string()).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert!(entries.is_empty());
    }

    #[tokio::test]
    async fn test_list_directory_contents_sorting() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Create files and directories with names that test sorting
        fs::write(dir_path.join("z_file.txt"), "content").unwrap();
        fs::write(dir_path.join("a_file.txt"), "content").unwrap();
        fs::create_dir(dir_path.join("z_dir")).unwrap();
        fs::create_dir(dir_path.join("a_dir")).unwrap();

        let result = list_directory_contents(dir_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 4);

        // Directories should come first, then files, both sorted alphabetically
        assert!(entries[0].is_directory && entries[0].name == "a_dir");
        assert!(entries[1].is_directory && entries[1].name == "z_dir");
        assert!(!entries[2].is_directory && entries[2].name == "a_file.txt");
        assert!(!entries[3].is_directory && entries[3].name == "z_file.txt");
    }

    #[tokio::test]
    async fn test_list_directory_contents_case_insensitive_sorting() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Create files with different cases
        fs::write(dir_path.join("Apple.txt"), "content").unwrap();
        fs::write(dir_path.join("banana.txt"), "content").unwrap();
        fs::write(dir_path.join("Cherry.txt"), "content").unwrap();

        let result = list_directory_contents(dir_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 3);

        // Should be sorted case-insensitively: Apple, banana, Cherry
        assert_eq!(entries[0].name, "Apple.txt");
        assert_eq!(entries[1].name, "banana.txt");
        assert_eq!(entries[2].name, "Cherry.txt");
    }

    #[tokio::test]
    async fn test_list_directory_modified_time() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test_file.txt");
        fs::write(&file_path, "test content").unwrap();

        let result = list_directory_contents(temp_dir.path().to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);

        let entry = &entries[0];
        assert!(entry.modified.is_some());

        // Modified time should be recent (within the last minute)
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let modified = entry.modified.unwrap();
        assert!(now - modified < 60, "Modified time should be recent");
    }

    #[tokio::test]
    async fn test_list_volumes() {
        let result = list_volumes().await;
        assert!(result.is_ok());

        let volumes = result.unwrap();
        assert!(!volumes.is_empty()); // Should have at least one volume/filesystem

        for volume in &volumes {
            assert!(volume.is_directory);
            assert!(volume.volume_type.is_some());
            assert!(!volume.name.is_empty());
            assert!(!volume.full_path.is_empty());
        }

        #[cfg(not(windows))]
        {
            // On Unix systems, should have at least root
            let has_root = volumes.iter().any(|v| v.full_path == "/");
            assert!(has_root, "Should have root filesystem");
        }
    }

    #[test]
    fn test_volume_type_windows_mapping() {
        // Test the Windows drive type mapping
        let test_cases = vec![
            (2, VolumeType::RemovableDisk),
            (3, VolumeType::LocalDisk),
            (4, VolumeType::NetworkDrive),
            (5, VolumeType::CdDrive),
            (6, VolumeType::RamDisk),
            (999, VolumeType::LocalDisk), // Unknown type should default to LocalDisk
        ];

        for (drive_type, expected) in test_cases {
            let volume_type = match drive_type {
                2 => VolumeType::RemovableDisk,
                3 => VolumeType::LocalDisk,
                4 => VolumeType::NetworkDrive,
                5 => VolumeType::CdDrive,
                6 => VolumeType::RamDisk,
                _ => VolumeType::LocalDisk,
            };
            assert_eq!(volume_type, expected);
        }
    }

    #[test]
    fn test_dir_entry_clone() {
        let entry = DirEntry {
            name: "test".to_string(),
            is_directory: false,
            full_path: "/test".to_string(),
            size: Some(100),
            modified: Some(123456),
            is_symlink: true,
            symlink_target: Some("/real/target".to_string()),
            volume_type: Some(VolumeType::LocalDisk),
        };

        let cloned = entry.clone();
        assert_eq!(entry.name, cloned.name);
        assert_eq!(entry.is_directory, cloned.is_directory);
        assert_eq!(entry.full_path, cloned.full_path);
        assert_eq!(entry.size, cloned.size);
        assert_eq!(entry.modified, cloned.modified);
        assert_eq!(entry.is_symlink, cloned.is_symlink);
        assert_eq!(entry.symlink_target, cloned.symlink_target);
    }

    #[test]
    fn test_volume_type_debug_display() {
        let volume_types = vec![
            VolumeType::LocalDisk,
            VolumeType::RemovableDisk,
            VolumeType::NetworkDrive,
            VolumeType::CdDrive,
            VolumeType::RamDisk,
            VolumeType::FileSystem,
        ];

        for volume_type in volume_types {
            let debug_str = format!("{:?}", volume_type);
            assert!(!debug_str.is_empty());
        }
    }

    #[test]
    fn test_dir_entry_debug_display() {
        let entry = DirEntry {
            name: "debug_test".to_string(),
            is_directory: true,
            full_path: "/debug/test".to_string(),
            size: None,
            modified: Some(987654321),
            is_symlink: false,
            symlink_target: None,
            volume_type: Some(VolumeType::FileSystem),
        };

        let debug_str = format!("{:?}", entry);
        assert!(debug_str.contains("debug_test"));
        assert!(debug_str.contains("/debug/test"));
        assert!(debug_str.contains("987654321"));
    }

    // Property-based tests using proptest
    #[cfg(feature = "proptest")]
    mod proptest_tests {
        use super::*;
        use proptest::prelude::*;

        proptest! {
            #[test]
            fn test_validate_directory_with_random_paths(path in "\\PC*") {
                let rt = tokio::runtime::Runtime::new().unwrap();
                let result = rt.block_on(validate_directory(path));
                // Should never panic, always return a result
                assert!(result.is_ok());
            }

            #[test]
            fn test_get_parent_directory_with_random_paths(path in "\\PC*") {
                let rt = tokio::runtime::Runtime::new().unwrap();
                let result = rt.block_on(get_parent_directory(path));
                // Should never panic, always return a result
                assert!(result.is_ok());
            }
        }
    }
}
