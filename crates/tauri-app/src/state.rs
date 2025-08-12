use crate::event_emitter::TauriEventEmitter;
use backend::GeminiBackend;
use std::sync::Arc;

pub struct AppState {
    pub backend: Arc<GeminiBackend<TauriEventEmitter>>,
}
