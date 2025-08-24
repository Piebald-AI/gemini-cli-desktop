// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use gemini_desktop_lib::run;

fn main() {
    let _ = fix_path_env::fix_all_vars();
    run();
}
