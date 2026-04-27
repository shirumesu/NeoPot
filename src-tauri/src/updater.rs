//! Tauri v2 updater behavior is handled by the frontend updater window and
//! configured through `src-tauri/tauri.conf.json`.
//!
//! The active entry point is `src/window/Updater/index.tsx`, which calls the
//! v2 updater plugin on demand. Startup checks remain intentionally disabled
//! until release identity, endpoint ownership, and signing are decided.
