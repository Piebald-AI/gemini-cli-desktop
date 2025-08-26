use anyhow::Result;
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::fs;
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

pub async fn validate_directory(path: String) -> Result<bool> {
    let path = Path::new(&path);
    Ok(path.exists() && path.is_dir())
}

pub async fn is_home_directory(path: String) -> Result<bool> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    let home_path = Path::new(&home);
    let check_path = Path::new(&path);

    Ok(home_path == check_path)
}

pub async fn get_home_directory() -> Result<String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    Ok(home)
}

pub async fn get_parent_directory(path: String) -> Result<Option<String>> {
    let path = Path::new(&path);
    Ok(path.parent().map(|p| p.to_string_lossy().to_string()))
}

pub async fn list_directory_contents(path: String) -> Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    let dir_path = Path::new(&path);

    if !dir_path.exists() || !dir_path.is_dir() {
        return Ok(entries);
    }

    // Use the ignore crate's WalkBuilder for proper gitignore support
    let mut builder = WalkBuilder::new(dir_path);
    builder
        .max_depth(Some(1)) // Only list immediate children (not recursive)
        .git_ignore(true) // Respect .gitignore files
        .git_global(true) // Respect global git ignore
        .git_exclude(true) // Respect .git/info/exclude
        .hidden(false) // Show hidden files/directories (except .git which is handled by git_ignore)
        .parents(true); // Respect gitignore files in parent directories

    // Collect entries using the ignore crate
    for result in builder.build() {
        match result {
            Ok(entry) => {
                let entry_path = entry.path();

                // Skip the root directory itself
                if entry_path == dir_path {
                    continue;
                }

                // Only process immediate children (depth 1)
                if entry_path.parent() != Some(dir_path) {
                    continue;
                }

                let metadata = match entry_path.metadata() {
                    Ok(metadata) => metadata,
                    Err(_) => continue, // Skip files we can't read metadata for
                };

                let file_name = entry_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let full_path = entry_path.to_string_lossy().to_string();

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
                    fs::read_link(entry_path)
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
            Err(_) => continue, // Skip entries we can't read
        }
    }

    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

pub async fn list_files_recursive(
    path: String,
    max_depth: Option<usize>,
) -> Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    let root_path = Path::new(&path);

    if !root_path.exists() || !root_path.is_dir() {
        return Ok(entries);
    }

    let effective_max_depth = max_depth.unwrap_or(2);

    // Use the ignore crate's WalkBuilder for proper gitignore support
    let mut builder = WalkBuilder::new(root_path);
    builder
        .max_depth(Some(effective_max_depth))
        .git_ignore(true) // Respect .gitignore files
        .git_global(true) // Respect global git ignore
        .git_exclude(true) // Respect .git/info/exclude
        .hidden(true) // Hide hidden files/directories (like .git)
        .parents(true); // Respect gitignore files in parent directories

    // Collect entries using the ignore crate
    for result in builder.build() {
        match result {
            Ok(entry) => {
                let entry_path = entry.path();

                // Skip the root directory itself
                if entry_path == root_path {
                    continue;
                }

                let metadata = match entry_path.metadata() {
                    Ok(metadata) => metadata,
                    Err(_) => continue, // Skip files we can't read metadata for
                };

                let file_name = entry_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let full_path = entry_path.to_string_lossy().to_string();

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
                    fs::read_link(entry_path)
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
            Err(_) => continue, // Skip entries we can't read
        }
    }

    // Sort entries: directories first, then files, alphabetically within each group
    entries.sort_by(|a, b| match (a.is_directory, b.is_directory) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

pub async fn list_volumes() -> Result<Vec<DirEntry>> {
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

pub async fn get_git_info(directory: String) -> Result<Option<GitInfo>> {
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
    async fn test_list_directory_contents_respects_gitignore() {
        let temp_dir = TempDir::new().unwrap();
        let root_path = temp_dir.path();

        // Initialize a git repository for the ignore crate to work properly
        std::process::Command::new("git")
            .args(&["init"])
            .current_dir(root_path)
            .output()
            .expect("Failed to initialize git repo");

        // Create .gitignore that ignores *.log files and the build/ directory
        fs::write(root_path.join(".gitignore"), "*.log\nbuild/\n").unwrap();

        // Create files and directories
        fs::write(root_path.join("file1.txt"), "content").unwrap();
        fs::write(root_path.join("file2.log"), "log content").unwrap(); // Should be ignored
        fs::write(root_path.join("README.md"), "readme").unwrap();

        let build_dir = root_path.join("build");
        fs::create_dir(&build_dir).unwrap(); // Should be ignored
        fs::write(build_dir.join("output.txt"), "build output").unwrap();

        let src_dir = root_path.join("src");
        fs::create_dir(&src_dir).unwrap(); // Should be visible
        fs::write(src_dir.join("main.rs"), "fn main() {}").unwrap();

        // List directory contents
        let result = list_directory_contents(root_path.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        let entry_names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();

        // Should include:
        assert!(entry_names.contains(&"file1.txt"));
        assert!(entry_names.contains(&"README.md"));
        assert!(entry_names.contains(&"src"));
        assert!(entry_names.contains(&".gitignore")); // .gitignore itself should be visible

        // Should NOT include (filtered by gitignore):
        assert!(!entry_names.contains(&"file2.log")); // Filtered by *.log pattern
        assert!(!entry_names.contains(&"build")); // Filtered by build/ pattern
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

    #[tokio::test]
    async fn test_hierarchical_gitignore_retroactive_filtering() {
        let temp_dir = TempDir::new().unwrap();
        let root_path = temp_dir.path();

        // Initialize a git repository for the ignore crate to work properly
        std::process::Command::new("git")
            .args(&["init"])
            .current_dir(root_path)
            .output()
            .expect("Failed to initialize git repo");

        // Create directory structure:
        // root/
        //   ├── .gitignore (ignores "*.log")
        //   ├── file1.txt
        //   ├── file1.log
        //   └── frontend/
        //       ├── .gitignore (ignores "dist")
        //       ├── src/
        //       │   └── main.js
        //       └── dist/
        //           └── bundle.js

        // Create root .gitignore
        fs::write(root_path.join(".gitignore"), "*.log\n").unwrap();

        // Create files
        fs::write(root_path.join("file1.txt"), "content").unwrap();
        fs::write(root_path.join("file1.log"), "log content").unwrap();

        // Create frontend directory structure
        let frontend_dir = root_path.join("frontend");
        fs::create_dir(&frontend_dir).unwrap();
        fs::write(frontend_dir.join(".gitignore"), "dist\n").unwrap();

        let src_dir = frontend_dir.join("src");
        fs::create_dir(&src_dir).unwrap();
        fs::write(src_dir.join("main.js"), "console.log('hello')").unwrap();

        let dist_dir = frontend_dir.join("dist");
        fs::create_dir(&dist_dir).unwrap();
        fs::write(dist_dir.join("bundle.js"), "minified code").unwrap();

        // Run list_files_recursive
        let result = list_files_recursive(root_path.to_string_lossy().to_string(), Some(3)).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        let entry_paths: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();

        // Should include:
        assert!(entry_paths.contains(&"file1.txt"));
        assert!(entry_paths.contains(&"frontend"));
        assert!(entry_paths.contains(&"src"));
        assert!(entry_paths.contains(&"main.js"));

        // Should NOT include (filtered by gitignore):
        assert!(!entry_paths.contains(&"file1.log")); // Filtered by root .gitignore
        assert!(!entry_paths.contains(&"dist")); // Filtered by frontend/.gitignore
        assert!(!entry_paths.contains(&"bundle.js")); // Inside ignored dist directory
    }

    #[tokio::test]
    async fn test_gitignore_hierarchy_pattern_scope() {
        let temp_dir = TempDir::new().unwrap();
        let root_path = temp_dir.path();

        // Initialize git repo
        std::process::Command::new("git")
            .args(&["init"])
            .current_dir(root_path)
            .output()
            .expect("Failed to initialize git repo");

        // Create structure:
        // root/
        //   ├── temp.txt (should be kept)
        //   └── subdir/
        //       ├── .gitignore (ignores "temp.txt")
        //       └── temp.txt (should be ignored)

        fs::write(root_path.join("temp.txt"), "root temp file").unwrap();

        let subdir = root_path.join("subdir");
        fs::create_dir(&subdir).unwrap();
        fs::write(subdir.join(".gitignore"), "temp.txt\n").unwrap();
        fs::write(subdir.join("temp.txt"), "subdir temp file").unwrap();

        let result = list_files_recursive(root_path.to_string_lossy().to_string(), Some(2)).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        let full_paths: Vec<&str> = entries.iter().map(|e| e.full_path.as_str()).collect();

        // Root temp.txt should be included
        assert!(
            full_paths
                .iter()
                .any(|path| path.ends_with("temp.txt") && path.contains("root")
                    || !path.contains("subdir"))
        );

        // Subdir temp.txt should be excluded
        assert!(
            !full_paths
                .iter()
                .any(|path| path.ends_with("temp.txt") && path.contains("subdir"))
        );

        // Subdir itself should be included
        assert!(full_paths.iter().any(|path| path.ends_with("subdir")));
    }

    #[tokio::test]
    async fn test_nested_gitignore_cascade() {
        let temp_dir = TempDir::new().unwrap();
        let root_path = temp_dir.path();

        // Initialize git repo
        std::process::Command::new("git")
            .args(&["init"])
            .current_dir(root_path)
            .output()
            .expect("Failed to initialize git repo");

        // Create deeply nested structure with multiple .gitignore files
        // root/
        //   ├── .gitignore (ignores "*.tmp")
        //   ├── level1/
        //   │   ├── .gitignore (ignores "secret*")
        //   │   ├── file.tmp (ignored by root)
        //   │   ├── secret.txt (ignored by level1)
        //   │   ├── public.txt
        //   │   └── level2/
        //   │       ├── .gitignore (ignores "cache/")
        //   │       ├── file.tmp (ignored by root)
        //   │       ├── secret.log (ignored by level1)
        //   │       ├── normal.txt
        //   │       └── cache/
        //   │           └── data.json (ignored by level2)

        // Create root .gitignore
        fs::write(root_path.join(".gitignore"), "*.tmp\n").unwrap();

        // Create level1
        let level1 = root_path.join("level1");
        fs::create_dir(&level1).unwrap();
        fs::write(level1.join(".gitignore"), "secret*\n").unwrap();
        fs::write(level1.join("file.tmp"), "temp").unwrap();
        fs::write(level1.join("secret.txt"), "secret").unwrap();
        fs::write(level1.join("public.txt"), "public").unwrap();

        // Create level2
        let level2 = level1.join("level2");
        fs::create_dir(&level2).unwrap();
        fs::write(level2.join(".gitignore"), "cache/\n").unwrap();
        fs::write(level2.join("file.tmp"), "temp2").unwrap();
        fs::write(level2.join("secret.log"), "secret log").unwrap();
        fs::write(level2.join("normal.txt"), "normal").unwrap();

        // Create cache directory
        let cache = level2.join("cache");
        fs::create_dir(&cache).unwrap();
        fs::write(cache.join("data.json"), "cached data").unwrap();

        let result = list_files_recursive(root_path.to_string_lossy().to_string(), Some(4)).await;
        assert!(result.is_ok());

        let entries = result.unwrap();
        let entry_names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();

        // Should include:
        assert!(entry_names.contains(&"level1"));
        assert!(entry_names.contains(&"public.txt"));
        assert!(entry_names.contains(&"level2"));
        assert!(entry_names.contains(&"normal.txt"));

        // Should NOT include:
        assert!(!entry_names.contains(&"file.tmp")); // Ignored by root *.tmp
        assert!(!entry_names.contains(&"secret.txt")); // Ignored by level1 secret*
        assert!(!entry_names.contains(&"secret.log")); // Ignored by level1 secret*
        assert!(!entry_names.contains(&"cache")); // Ignored by level2 cache/
        assert!(!entry_names.contains(&"data.json")); // Inside ignored cache directory
    }

    #[test]
    fn test_ignore_crate_basic_functionality() {
        let temp_dir = TempDir::new().unwrap();
        let root_path = temp_dir.path();

        // Create a simple directory structure
        fs::write(root_path.join("included.txt"), "content").unwrap();
        fs::write(root_path.join("README.md"), "readme").unwrap();

        // Create a subdirectory
        let sub_dir = root_path.join("subdir");
        fs::create_dir(&sub_dir).unwrap();
        fs::write(sub_dir.join("nested.txt"), "nested content").unwrap();

        // Use WalkBuilder to traverse
        let mut builder = WalkBuilder::new(root_path);
        builder.max_depth(Some(2));

        let mut found_files = Vec::new();
        for result in builder.build() {
            if let Ok(entry) = result {
                if entry.path() != root_path {
                    found_files.push(entry.path().to_string_lossy().to_string());
                }
            }
        }

        // Should find all files since there's no .gitignore
        assert!(found_files.len() >= 3); // At least the files we created
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
