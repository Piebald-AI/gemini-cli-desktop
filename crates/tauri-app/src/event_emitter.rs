use anyhow::{Context, Result};
use backend::EventEmitter;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone)]
pub struct TauriEventEmitter {
    app_handle: AppHandle,
}

impl TauriEventEmitter {
    pub const fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }
}

impl EventEmitter for TauriEventEmitter {
    fn emit<S: Serialize + Clone>(&self, event: &str, payload: S) -> Result<()> {
        self.app_handle
            .emit(event, payload)
            .context("Failed to emit event through Tauri")?;
        Ok(())
    }
}
