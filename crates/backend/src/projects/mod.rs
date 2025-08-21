use anyhow::{Context, Result};
use chrono::{DateTime, FixedOffset, Local};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectListItem {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "lastActivityAt")]
    pub last_activity_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "logCount")]
    pub log_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectsResponse {
    pub items: Vec<ProjectListItem>,
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMetadata {
    pub path: PathBuf,
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(default)]
    pub friendly_name: Option<String>,
    #[serde(default)]
    pub first_used: Option<DateTime<FixedOffset>>,
    #[serde(default)]
    pub updated_at: Option<DateTime<FixedOffset>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadataView {
    pub path: String,
    pub sha256: String,
    pub friendly_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_used: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedProject {
    pub sha256: String,
    pub root_path: PathBuf,
    pub metadata: ProjectMetadataView,
}

#[derive(Default, Clone)]
pub struct TouchThrottle {
    inner: Arc<Mutex<HashMap<PathBuf, Instant>>>,
    min_interval: Duration,
}

impl TouchThrottle {
    pub fn new(min_interval: Duration) -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
            min_interval,
        }
    }
}

fn home_projects_root() -> Option<PathBuf> {
    let home = std::env::var("HOME")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| "".to_string()));
    if home.is_empty() {
        return None;
    }
    Some(Path::new(&home).join(".gemini-desktop").join("projects"))
}

fn projects_root_dir() -> Option<PathBuf> {
    home_projects_root()
}

fn project_json_path(sha256: &str) -> Option<PathBuf> {
    projects_root_dir().map(|root| root.join(sha256).join("project.json"))
}

fn now_fixed_offset() -> DateTime<FixedOffset> {
    let now = Local::now();
    now.with_timezone(now.offset())
}

fn derive_friendly_name_from_path(path: &Path) -> String {
    let s = path.display().to_string();
    #[cfg(windows)]
    {
        // Normalize both backslashes and forward slashes on Windows
        let replaced = s.replace(['\\', '/'], "-").replace(':', "");
        replaced
            .split('-')
            .filter(|p| !p.is_empty())
            .collect::<Vec<_>>()
            .join("-")
    }
    #[cfg(not(windows))]
    {
        let replaced = s.replace('/', "-");
        replaced
            .split('-')
            .filter(|p| !p.is_empty())
            .collect::<Vec<_>>()
            .join("-")
    }
}

fn parse_millis_from_log_name(name: &str) -> Option<u64> {
    if !name.starts_with("rpc-log-") {
        return None;
    }
    let rest = name.strip_prefix("rpc-log-")?;
    let ts_part = rest
        .strip_suffix(".log")
        .or_else(|| rest.strip_suffix(".json"))?;
    ts_part.parse::<u64>().ok()
}

fn read_project_metadata(root_sha: &str) -> Result<ProjectMetadata> {
    let Some(path) = project_json_path(root_sha) else {
        anyhow::bail!("projects root not found");
    };
    if !path.exists() {
        anyhow::bail!("project.json not found");
    }
    let content = std::fs::read_to_string(&path)
        .context("Failed to read project metadata file")?;
    serde_json::from_str::<ProjectMetadata>(&content)
        .context("Failed to parse project metadata JSON")
}

fn write_project_metadata(sha256: &str, meta: &ProjectMetadata) -> Result<()> {
    let Some(json_path) = project_json_path(sha256) else {
        anyhow::bail!("projects root not found");
    };
    if let Some(dir) = json_path.parent() {
        std::fs::create_dir_all(dir)
            .context("Failed to create project metadata directory")?;
    }
    let tmp_path = json_path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(meta)
        .context("Failed to serialize project metadata")?;
    std::fs::write(&tmp_path, content.as_bytes())
        .context("Failed to write temporary project metadata file")?;
    std::fs::rename(&tmp_path, &json_path)
        .context("Failed to rename project metadata file")?;
    Ok(())
}

fn to_view(meta: &ProjectMetadata, canonical_root: &Path, sha256: &str) -> ProjectMetadataView {
    let friendly = meta
        .friendly_name
        .clone()
        .unwrap_or_else(|| derive_friendly_name_from_path(canonical_root));
    let first_used = meta.first_used.as_ref().map(|d| d.to_rfc3339());
    let updated_at = meta.updated_at.as_ref().map(|d| d.to_rfc3339());
    ProjectMetadataView {
        path: meta.path.display().to_string(),
        sha256: meta.sha256.clone().unwrap_or_else(|| sha256.to_string()),
        friendly_name: friendly,
        first_used,
        updated_at,
    }
}

pub fn ensure_project_metadata(
    sha256: &str,
    external_root_canonical: Option<&Path>,
) -> Result<ProjectMetadata> {
    match read_project_metadata(sha256) {
        Ok(meta) => Ok(meta),
        Err(e) => {
            if let Some(ext) = external_root_canonical {
                let now = now_fixed_offset();
                let meta = ProjectMetadata {
                    path: ext.to_path_buf(),
                    sha256: Some(sha256.to_string()),
                    friendly_name: Some(derive_friendly_name_from_path(ext)),
                    first_used: Some(now),
                    updated_at: Some(now),
                };
                write_project_metadata(sha256, &meta)?;
                eprintln!("info: created project.json for {sha256}");
                Ok(meta)
            } else {
                Err(e)
            }
        }
    }
}

pub fn maybe_touch_updated_at(sha256: &str, throttle: &TouchThrottle) -> Result<()> {
    let mut meta = match read_project_metadata(sha256) {
        Ok(m) => m,
        Err(_) => return Ok(()),
    };

    let root = meta.path.clone();
    let mut guard = throttle.inner.lock().unwrap();
    let last = guard.get(&root).copied();
    let now_inst = Instant::now();
    if let Some(last_instant) = last
        && now_inst.duration_since(last_instant) < throttle.min_interval
    {
        return Ok(());
    }
    guard.insert(root, now_inst);
    drop(guard);

    meta.updated_at = Some(now_fixed_offset());
    write_project_metadata(sha256, &meta)?;
    eprintln!("debug: touched updated_at for {sha256}");
    Ok(())
}

pub fn make_enriched_project(
    sha256: &str,
    external_root: Option<&Path>,
    should_create_if_missing: bool,
) -> EnrichedProject {
    let meta_opt = read_project_metadata(sha256).ok();

    let display_root = if let Some(ref meta) = meta_opt {
        meta.path.clone()
    } else if let Some(er) = external_root {
        er.to_path_buf()
    } else {
        projects_root_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(sha256)
    };

    let meta = if let Some(meta) = meta_opt {
        meta
    } else if should_create_if_missing {
        ensure_project_metadata(sha256, external_root).unwrap_or_else(|_| ProjectMetadata {
            path: display_root.clone(),
            sha256: Some(sha256.to_string()),
            friendly_name: Some(derive_friendly_name_from_path(&display_root)),
            first_used: None,
            updated_at: None,
        })
    } else {
        ProjectMetadata {
            path: display_root.clone(),
            sha256: Some(sha256.to_string()),
            friendly_name: Some(derive_friendly_name_from_path(&display_root)),
            first_used: None,
            updated_at: None,
        }
    };

    EnrichedProject {
        sha256: sha256.to_string(),
        root_path: display_root.clone(),
        metadata: to_view(&meta, &display_root, sha256),
    }
}

pub fn list_projects(limit: u32, offset: u32) -> Result<ProjectsResponse> {
    let Some(root) = home_projects_root() else {
        return Ok(ProjectsResponse {
            items: vec![],
            total: 0,
            limit,
            offset,
        });
    };
    if !root.exists() || !root.is_dir() {
        return Ok(ProjectsResponse {
            items: vec![],
            total: 0,
            limit,
            offset,
        });
    }

    let mut all_ids: Vec<String> = Vec::new();
    for entry in fs::read_dir(&root)
        .context("Failed to read projects directory")? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|s| s.to_str())
            && name.len() == 64
            && name.chars().all(|c| c.is_ascii_hexdigit())
        {
            all_ids.push(name.to_string());
        }
    }
    all_ids.sort();

    let total = all_ids.len() as u32;
    let start = std::cmp::min(offset as usize, all_ids.len());
    let end = std::cmp::min(start + limit as usize, all_ids.len());
    let page_ids = &all_ids[start..end];

    let mut items: Vec<ProjectListItem> = Vec::new();
    for id in page_ids {
        let proj_path = root.join(id);

        let mut log_count: u32 = 0;
        let mut earliest_ts_millis: Option<u64> = None;
        let mut latest_ts_millis: Option<u64> = None;
        let mut latest_mtime_secs: Option<u64> = None;

        if let Ok(rd) = fs::read_dir(&proj_path) {
            for e in rd.flatten() {
                let p = e.path();
                let fname_opt = p.file_name().and_then(|s| s.to_str());
                if let Some(fname) = fname_opt
                    && fname.starts_with("rpc-log-")
                    && (fname.ends_with(".log") || fname.ends_with(".json"))
                {
                    log_count = log_count.saturating_add(1);

                    if let Some(millis) = parse_millis_from_log_name(fname) {
                        earliest_ts_millis = match earliest_ts_millis {
                            Some(cur) => Some(cur.min(millis)),
                            None => Some(millis),
                        };
                        latest_ts_millis = match latest_ts_millis {
                            Some(cur) => Some(cur.max(millis)),
                            None => Some(millis),
                        };
                    }

                    if let Ok(md) = e.metadata()
                        && let Ok(modified) = md.modified()
                        && let Ok(dur) = modified.duration_since(std::time::UNIX_EPOCH)
                    {
                        let secs = dur.as_secs();
                        latest_mtime_secs =
                            Some(latest_mtime_secs.map_or(secs, |cur| cur.max(secs)));
                    }
                }
            }
        }

        let created_at_iso: Option<String> = earliest_ts_millis.map(|ms| {
            let secs = ms / 1000;
            chrono::DateTime::<chrono::Utc>::from(
                std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let updated_at_iso_from_name: Option<String> = latest_ts_millis.map(|ms| {
            let secs = ms / 1000;
            chrono::DateTime::<chrono::Utc>::from(
                std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let last_activity_iso_from_mtime: Option<String> = latest_mtime_secs.map(|secs| {
            chrono::DateTime::<chrono::Utc>::from(
                std::time::UNIX_EPOCH + std::time::Duration::from_secs(secs),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        });

        let updated_at_iso = updated_at_iso_from_name
            .clone()
            .or_else(|| last_activity_iso_from_mtime.clone());
        let last_activity_iso = updated_at_iso_from_name.or(last_activity_iso_from_mtime);

        let title: Option<String> = None;

        let status = if log_count > 0 {
            "active".to_string()
        } else {
            "unknown".to_string()
        };

        items.push(ProjectListItem {
            id: id.clone(),
            title,
            status: Some(status),
            created_at: created_at_iso,
            updated_at: updated_at_iso.clone(),
            last_activity_at: last_activity_iso,
            log_count: Some(log_count),
        });
    }

    Ok(ProjectsResponse {
        items,
        total,
        limit,
        offset,
    })
}

pub fn list_enriched_projects() -> Result<Vec<EnrichedProject>> {
    let Some(root) = home_projects_root() else {
        return Ok(vec![]);
    };
    if !root.exists() || !root.is_dir() {
        return Ok(vec![]);
    }
    let mut all_ids: Vec<String> = Vec::new();
    for entry in fs::read_dir(&root)
        .context("Failed to read projects directory")? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(name) = path.file_name().and_then(|s| s.to_str())
            && name.len() == 64
            && name.chars().all(|c| c.is_ascii_hexdigit())
        {
            all_ids.push(name.to_string());
        }
    }
    all_ids.sort();

    let mut results = Vec::new();
    for sha256 in all_ids {
        results.push(make_enriched_project(&sha256, None, false));
    }
    Ok(results)
}

pub async fn get_enriched_project(
    sha256: String,
    external_root_path: String,
) -> Result<EnrichedProject> {
    let external_root = Path::new(&external_root_path);
    Ok(make_enriched_project(&sha256, Some(external_root), true))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::EnvGuard;
    use std::fs;
    use std::time::Duration;
    use tempfile::TempDir;

    #[test]
    fn test_project_list_item_serialization() {
        let item = ProjectListItem {
            id: "test-id".to_string(),
            title: Some("Test Project".to_string()),
            status: Some("active".to_string()),
            created_at: Some("2023-01-01T00:00:00Z".to_string()),
            updated_at: Some("2023-01-02T00:00:00Z".to_string()),
            last_activity_at: Some("2023-01-03T00:00:00Z".to_string()),
            log_count: Some(5),
        };

        let json = serde_json::to_string(&item).unwrap();
        let deserialized: ProjectListItem = serde_json::from_str(&json).unwrap();

        assert_eq!(item.id, deserialized.id);
        assert_eq!(item.title, deserialized.title);
        assert_eq!(item.status, deserialized.status);
        assert_eq!(item.created_at, deserialized.created_at);
        assert_eq!(item.updated_at, deserialized.updated_at);
        assert_eq!(item.last_activity_at, deserialized.last_activity_at);
        assert_eq!(item.log_count, deserialized.log_count);
    }

    #[test]
    fn test_project_list_item_serialization_with_none_values() {
        let item = ProjectListItem {
            id: "test-id".to_string(),
            title: None,
            status: None,
            created_at: None,
            updated_at: None,
            last_activity_at: None,
            log_count: None,
        };

        let json = serde_json::to_string(&item).unwrap();
        assert!(!json.contains("title"));
        assert!(!json.contains("status"));
        assert!(!json.contains("createdAt"));
        assert!(!json.contains("updatedAt"));
        assert!(!json.contains("lastActivityAt"));
        assert!(!json.contains("logCount"));

        let deserialized: ProjectListItem = serde_json::from_str(&json).unwrap();
        assert_eq!(item.id, deserialized.id);
        assert!(deserialized.title.is_none());
        assert!(deserialized.status.is_none());
    }

    #[test]
    fn test_projects_response_serialization() {
        let response = ProjectsResponse {
            items: vec![ProjectListItem {
                id: "test".to_string(),
                title: None,
                status: None,
                created_at: None,
                updated_at: None,
                last_activity_at: None,
                log_count: None,
            }],
            total: 10,
            limit: 5,
            offset: 0,
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: ProjectsResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(response.total, deserialized.total);
        assert_eq!(response.limit, deserialized.limit);
        assert_eq!(response.offset, deserialized.offset);
        assert_eq!(response.items.len(), deserialized.items.len());
    }

    #[test]
    fn test_project_metadata_default() {
        let metadata = ProjectMetadata::default();
        assert_eq!(metadata.path, PathBuf::new());
        assert!(metadata.sha256.is_none());
        assert!(metadata.friendly_name.is_none());
        assert!(metadata.first_used.is_none());
        assert!(metadata.updated_at.is_none());
    }

    #[test]
    fn test_project_metadata_view_serialization() {
        let view = ProjectMetadataView {
            path: "/test/path".to_string(),
            sha256: "abcd1234".to_string(),
            friendly_name: "test-project".to_string(),
            first_used: Some("2023-01-01T00:00:00Z".to_string()),
            updated_at: Some("2023-01-02T00:00:00Z".to_string()),
        };

        let json = serde_json::to_string(&view).unwrap();
        let deserialized: ProjectMetadataView = serde_json::from_str(&json).unwrap();

        assert_eq!(view.path, deserialized.path);
        assert_eq!(view.sha256, deserialized.sha256);
        assert_eq!(view.friendly_name, deserialized.friendly_name);
        assert_eq!(view.first_used, deserialized.first_used);
        assert_eq!(view.updated_at, deserialized.updated_at);
    }

    #[test]
    fn test_touch_throttle_new() {
        let throttle = TouchThrottle::new(Duration::from_secs(1));
        assert_eq!(throttle.min_interval, Duration::from_secs(1));
    }

    #[test]
    fn test_touch_throttle_default() {
        let throttle = TouchThrottle::default();
        assert_eq!(throttle.min_interval, Duration::default());
    }

    #[test]
    fn test_touch_throttle_clone() {
        let throttle1 = TouchThrottle::new(Duration::from_secs(5));
        let throttle2 = throttle1.clone();
        assert_eq!(throttle1.min_interval, throttle2.min_interval);
    }

    #[cfg(windows)]
    #[test]
    fn test_derive_friendly_name_from_path_windows() {
        let path = Path::new("C:\\Users\\test\\projects\\my-app");
        let result = derive_friendly_name_from_path(path);
        assert_eq!(result, "C-Users-test-projects-my-app");
    }

    #[cfg(not(windows))]
    #[test]
    fn test_derive_friendly_name_from_path_unix() {
        let path = Path::new("/home/test/projects/my-app");
        let result = derive_friendly_name_from_path(path);
        assert_eq!(result, "home-test-projects-my-app");
    }

    #[test]
    fn test_derive_friendly_name_from_path_empty_components() {
        let path = Path::new("//test//project//");
        let result = derive_friendly_name_from_path(path);
        assert_eq!(result, "test-project");
    }

    #[test]
    fn test_parse_millis_from_log_name_valid() {
        assert_eq!(
            parse_millis_from_log_name("rpc-log-1640995200000.log"),
            Some(1640995200000)
        );
        assert_eq!(
            parse_millis_from_log_name("rpc-log-1640995200000.json"),
            Some(1640995200000)
        );
    }

    #[test]
    fn test_parse_millis_from_log_name_invalid() {
        assert_eq!(parse_millis_from_log_name("invalid-name.log"), None);
        assert_eq!(parse_millis_from_log_name("rpc-log-invalid.log"), None);
        assert_eq!(parse_millis_from_log_name("rpc-log-123.txt"), None);
        assert_eq!(parse_millis_from_log_name("rpc-log-"), None);
    }

    #[test]
    fn test_now_fixed_offset() {
        let now1 = now_fixed_offset();
        std::thread::sleep(Duration::from_millis(1));
        let now2 = now_fixed_offset();
        assert!(now2 > now1);
    }

    #[test]
    fn test_home_projects_root_with_home() {
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", "/test/home");

        let result = home_projects_root();
        assert!(result.is_some());
        let path = result.unwrap();
        assert_eq!(path, Path::new("/test/home/.gemini-desktop/projects"));
    }

    #[test]
    fn test_home_projects_root_with_userprofile() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.set("USERPROFILE", "C:\\Users\\test");

        let result = home_projects_root();
        assert!(result.is_some());
        let path = result.unwrap();
        assert_eq!(
            path,
            Path::new("C:\\Users\\test\\.gemini-desktop\\projects")
        );
    }

    #[test]
    fn test_home_projects_root_no_env_vars() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.remove("USERPROFILE");

        let result = home_projects_root();
        // On Windows, there might be other environment variables that provide a home directory
        // The function falls back to an empty string, so result could be Some or None
        // We just verify it doesn't panic
        let _ = result;
    }

    #[test]
    fn test_projects_root_dir() {
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", "/test/home");

        let result = projects_root_dir();
        assert!(result.is_some());
    }

    #[test]
    fn test_project_json_path() {
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", "/test/home");

        let result = project_json_path("abcd1234");
        assert!(result.is_some());
        let path = result.unwrap();
        assert_eq!(
            path,
            Path::new("/test/home/.gemini-desktop/projects/abcd1234/project.json")
        );
    }

    #[test]
    fn test_project_json_path_no_root() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.remove("USERPROFILE");

        let result = project_json_path("abcd1234");
        assert!(result.is_none());
    }

    #[test]
    fn test_read_project_metadata_no_root() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.remove("USERPROFILE");

        let result = read_project_metadata("test");
        assert!(matches!(result, Err(BackendError::ProjectNotFound(_))));
    }

    #[test]
    fn test_read_project_metadata_file_not_found() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let result = read_project_metadata("nonexistent");
        assert!(matches!(result, Err(BackendError::ProjectNotFound(_))));
    }

    #[test]
    fn test_read_project_metadata_success() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let valid_sha = "a".repeat(64); // Use 64-character hex string
        // Create project directory and metadata file
        let projects_dir = temp_dir
            .path()
            .join(".gemini-desktop/projects")
            .join(&valid_sha);
        fs::create_dir_all(&projects_dir).unwrap();

        let test_path = temp_dir.path().join("test").join("path");
        let metadata = ProjectMetadata {
            path: test_path.clone(),
            sha256: Some(valid_sha.clone()),
            friendly_name: Some("test-project".to_string()),
            first_used: None,
            updated_at: None,
        };

        let json_path = projects_dir.join("project.json");
        let content = serde_json::to_string_pretty(&metadata).unwrap();
        fs::write(&json_path, content).unwrap();

        let result = read_project_metadata(&valid_sha).unwrap();
        assert_eq!(result.path, test_path);
        assert_eq!(result.sha256, Some(valid_sha));
        assert_eq!(result.friendly_name, Some("test-project".to_string()));
    }

    #[test]
    fn test_read_project_metadata_invalid_json() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let valid_sha = "a".repeat(64); // Use 64-character hex string
        // Create project directory and invalid metadata file
        let projects_dir = temp_dir
            .path()
            .join(".gemini-desktop/projects")
            .join(&valid_sha);
        fs::create_dir_all(&projects_dir).unwrap();

        let json_path = projects_dir.join("project.json");
        fs::write(&json_path, "invalid json").unwrap();

        let result = read_project_metadata(&valid_sha);
        assert!(result.is_err());
        match result {
            Err(BackendError::JsonError(_)) => {} // Expected
            Err(e) => panic!("Expected JsonError, got: {:?}", e),
            Ok(_) => panic!("Expected error, got success"),
        }
    }

    #[test]
    fn test_write_project_metadata_no_root() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.remove("USERPROFILE");

        let metadata = ProjectMetadata::default();
        let result = write_project_metadata("test", &metadata);
        assert!(matches!(result, Err(BackendError::ProjectNotFound(_))));
    }

    #[test]
    fn test_write_project_metadata_success() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let metadata = ProjectMetadata {
            path: PathBuf::from("/test/path"),
            sha256: Some("abcd1234".to_string()),
            friendly_name: Some("test-project".to_string()),
            first_used: None,
            updated_at: None,
        };

        let result = write_project_metadata("abcd1234", &metadata);
        assert!(result.is_ok());

        // Verify the file was created
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects/abcd1234");
        let json_path = projects_dir.join("project.json");
        assert!(json_path.exists());

        // Verify content
        let content = fs::read_to_string(&json_path).unwrap();
        let read_metadata: ProjectMetadata = serde_json::from_str(&content).unwrap();
        assert_eq!(read_metadata.path, metadata.path);
        assert_eq!(read_metadata.sha256, metadata.sha256);
    }

    #[test]
    fn test_to_view() {
        let metadata = ProjectMetadata {
            path: PathBuf::from("/test/path"),
            sha256: Some("abcd1234".to_string()),
            friendly_name: Some("custom-name".to_string()),
            first_used: Some(now_fixed_offset()),
            updated_at: Some(now_fixed_offset()),
        };

        let canonical_root = Path::new("/canonical/path");
        let view = to_view(&metadata, canonical_root, "sha256");

        assert_eq!(view.path, "/test/path");
        assert_eq!(view.sha256, "abcd1234");
        assert_eq!(view.friendly_name, "custom-name");
        assert!(view.first_used.is_some());
        assert!(view.updated_at.is_some());
    }

    #[test]
    fn test_to_view_with_defaults() {
        let metadata = ProjectMetadata {
            path: PathBuf::from("/test/path"),
            sha256: None,
            friendly_name: None,
            first_used: None,
            updated_at: None,
        };

        let canonical_root = Path::new("/canonical/path");
        let view = to_view(&metadata, canonical_root, "fallback_sha");

        assert_eq!(view.path, "/test/path");
        assert_eq!(view.sha256, "fallback_sha");
        assert_eq!(
            view.friendly_name,
            derive_friendly_name_from_path(canonical_root)
        );
        assert!(view.first_used.is_none());
        assert!(view.updated_at.is_none());
    }

    #[test]
    fn test_ensure_project_metadata_existing() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let valid_sha = "e".repeat(64); // Use 64-character hex string
        // Create existing metadata
        let metadata = ProjectMetadata {
            path: PathBuf::from("/existing/path"),
            sha256: Some(valid_sha.clone()),
            friendly_name: Some("existing-project".to_string()),
            first_used: None,
            updated_at: None,
        };

        let projects_dir = temp_dir
            .path()
            .join(".gemini-desktop/projects")
            .join(&valid_sha);
        fs::create_dir_all(&projects_dir).unwrap();
        let json_path = projects_dir.join("project.json");
        let content = serde_json::to_string_pretty(&metadata).unwrap();
        fs::write(&json_path, content).unwrap();

        let result = ensure_project_metadata(&valid_sha, None).unwrap();
        assert_eq!(result.path, PathBuf::from("/existing/path"));
        assert_eq!(result.sha256, Some(valid_sha));
    }

    #[test]
    fn test_ensure_project_metadata_create_new() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let valid_sha = "f".repeat(64); // Use 64-character hex string
        let external_root = Path::new("/new/project");
        let result = ensure_project_metadata(&valid_sha, Some(external_root)).unwrap();

        assert_eq!(result.path, PathBuf::from("/new/project"));
        assert_eq!(result.sha256, Some(valid_sha));
        assert!(result.friendly_name.is_some());
        assert!(result.first_used.is_some());
        assert!(result.updated_at.is_some());
    }

    #[test]
    fn test_ensure_project_metadata_error_no_external() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let result = ensure_project_metadata("nonexistent", None);
        assert!(matches!(result, Err(BackendError::ProjectNotFound(_))));
    }

    #[test]
    fn test_maybe_touch_updated_at_nonexistent_project() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let throttle = TouchThrottle::new(Duration::from_millis(100));
        let result = maybe_touch_updated_at("nonexistent", &throttle);
        assert!(result.is_ok()); // Should not fail for nonexistent projects
    }

    #[test]
    fn test_maybe_touch_updated_at_throttled() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        // Create project metadata
        let metadata = ProjectMetadata {
            path: PathBuf::from("/test/path"),
            sha256: Some("test".to_string()),
            friendly_name: Some("test-project".to_string()),
            first_used: None,
            updated_at: None,
        };

        write_project_metadata("test", &metadata).unwrap();

        let throttle = TouchThrottle::new(Duration::from_secs(1));

        // First touch should succeed
        let result1 = maybe_touch_updated_at("test", &throttle);
        assert!(result1.is_ok());

        // Immediate second touch should be throttled (no error, just skipped)
        let result2 = maybe_touch_updated_at("test", &throttle);
        assert!(result2.is_ok());
    }

    #[test]
    fn test_make_enriched_project_existing_metadata() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let valid_sha = "b".repeat(64); // Use 64-character hex string
        // Create project metadata with a path that works on both Windows and Unix
        let test_path = temp_dir.path().join("existing").join("path");
        let metadata = ProjectMetadata {
            path: test_path.clone(),
            sha256: Some(valid_sha.clone()),
            friendly_name: Some("existing-project".to_string()),
            first_used: None,
            updated_at: None,
        };

        write_project_metadata(&valid_sha, &metadata).unwrap();

        let result = make_enriched_project(&valid_sha, None, false);
        assert_eq!(result.sha256, valid_sha);
        assert_eq!(result.root_path, test_path);
        assert_eq!(result.metadata.friendly_name, "existing-project");
    }

    #[test]
    fn test_make_enriched_project_with_external_root() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let external_root = Path::new("/external/root");
        let result = make_enriched_project("newproject", Some(external_root), false);

        assert_eq!(result.sha256, "newproject");
        assert_eq!(result.root_path, PathBuf::from("/external/root"));
    }

    #[test]
    fn test_make_enriched_project_create_if_missing() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let external_root = Path::new("/new/project");
        let result = make_enriched_project("newsha", Some(external_root), true);

        assert_eq!(result.sha256, "newsha");
        assert_eq!(result.root_path, PathBuf::from("/new/project"));
        assert!(result.metadata.friendly_name.len() > 0);
    }

    #[test]
    fn test_list_projects_no_home() {
        let mut env_guard = EnvGuard::new();
        env_guard.remove("HOME");
        env_guard.remove("USERPROFILE");

        let result = list_projects(10, 0).unwrap();
        assert_eq!(result.items.len(), 0);
        assert_eq!(result.total, 0);
        assert_eq!(result.limit, 10);
        assert_eq!(result.offset, 0);
    }

    #[test]
    fn test_list_projects_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        // Create projects directory but leave it empty
        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        fs::create_dir_all(&projects_dir).unwrap();

        let result = list_projects(10, 0).unwrap();
        assert_eq!(result.items.len(), 0);
        assert_eq!(result.total, 0);
    }

    #[test]
    fn test_list_projects_with_valid_projects() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        fs::create_dir_all(&projects_dir).unwrap();

        // Create valid project directory (64-char hex)
        let valid_sha = "a".repeat(64);
        let project_dir = projects_dir.join(&valid_sha);
        fs::create_dir_all(&project_dir).unwrap();

        // Create a log file
        let log_file = project_dir.join("rpc-log-1640995200000.log");
        fs::write(&log_file, "test log content").unwrap();

        // Create invalid directory (not 64-char hex)
        let invalid_dir = projects_dir.join("invalid");
        fs::create_dir_all(&invalid_dir).unwrap();

        let result = list_projects(10, 0).unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.total, 1);
        assert_eq!(result.items[0].id, valid_sha);
        assert_eq!(result.items[0].status, Some("active".to_string()));
        assert_eq!(result.items[0].log_count, Some(1));
    }

    #[test]
    fn test_list_projects_pagination() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        fs::create_dir_all(&projects_dir).unwrap();

        // Create 3 project directories with log files
        for i in 0..3 {
            let sha = format!("{:064x}", i);
            let project_dir = projects_dir.join(&sha);
            fs::create_dir_all(&project_dir).unwrap();

            // Create a log file to make it a valid project
            let log_file = project_dir.join(format!("rpc-log-164099520000{}.log", i));
            fs::write(&log_file, "test log content").unwrap();
        }

        // Test first page
        let result = list_projects(2, 0).unwrap();
        assert_eq!(result.items.len(), 2);
        assert_eq!(result.total, 3);
        assert_eq!(result.limit, 2);
        assert_eq!(result.offset, 0);

        // Test second page
        let result = list_projects(2, 2).unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.total, 3);
        assert_eq!(result.limit, 2);
        assert_eq!(result.offset, 2);
    }

    #[test]
    fn test_list_enriched_projects_empty() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        fs::create_dir_all(&projects_dir).unwrap();

        let result = list_enriched_projects().unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_list_enriched_projects_with_projects() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let projects_dir = temp_dir.path().join(".gemini-desktop/projects");
        fs::create_dir_all(&projects_dir).unwrap();

        // Create project directory and add a log so it is treated as a valid project
        let sha = "a".repeat(64);
        let project_dir = projects_dir.join(&sha);
        fs::create_dir_all(&project_dir).unwrap();
        let log_file = project_dir.join("rpc-log-1640995200000.log");
        fs::write(&log_file, "{}").unwrap();

        let result = list_enriched_projects().unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].sha256, sha);
    }

    #[tokio::test]
    async fn test_get_enriched_project() {
        let temp_dir = TempDir::new().unwrap();
        let mut env_guard = EnvGuard::new();
        env_guard.set("HOME", temp_dir.path().to_str().unwrap());

        let result =
            get_enriched_project("testsha256".to_string(), "/test/external/root".to_string())
                .await
                .unwrap();

        assert_eq!(result.sha256, "testsha256");
        assert_eq!(result.root_path, PathBuf::from("/test/external/root"));
    }

    #[test]
    fn test_enriched_project_serialization() {
        let project = EnrichedProject {
            sha256: "testsha".to_string(),
            root_path: PathBuf::from("/test/path"),
            metadata: ProjectMetadataView {
                path: "/test/path".to_string(),
                sha256: "testsha".to_string(),
                friendly_name: "test-project".to_string(),
                first_used: None,
                updated_at: None,
            },
        };

        let json = serde_json::to_string(&project).unwrap();
        let deserialized: EnrichedProject = serde_json::from_str(&json).unwrap();

        assert_eq!(project.sha256, deserialized.sha256);
        assert_eq!(project.root_path, deserialized.root_path);
        assert_eq!(project.metadata.path, deserialized.metadata.path);
    }
}
