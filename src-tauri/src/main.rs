// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, Clone)]
struct RawTrack {
    id: u32,
    title: String,
    path: String,
    #[serde(rename = "type")]
    track_type: String,
}

#[derive(Serialize)]
struct RawAlbum {
    name: String,
    tracks: Vec<RawTrack>,
}

fn is_audio_file(name: &str) -> bool {
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    matches!(ext.as_str(), "mp3" | "wav" | "ogg" | "m4a" | "flac")
}

fn strip_extension(name: &str) -> String {
    Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(name)
        .to_string()
}

fn scan_album_dir(dir: &Path, id: u32) -> Vec<RawAlbum> {
    let mut tracks: Vec<RawTrack> = Vec::new();
    let mut subdirs: Vec<PathBuf> = Vec::new();
    let mut track_id = 0u32;

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if is_audio_file(name) {
                    tracks.push(RawTrack {
                        id: track_id,
                        title: strip_extension(name),
                        path: path.to_string_lossy().to_string(),
                        track_type: "track".to_string(),
                    });
                    track_id += 1;
                }
            }
        } else if path.is_dir() {
            subdirs.push(path);
        }
    }

    if !tracks.is_empty() {
        tracks.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
        let name = dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown Album")
            .to_string();
        return vec![RawAlbum { name, tracks }];
    }

    if subdirs.is_empty() {
        return vec![];
    }

    let mut nested = Vec::new();
    for (i, sub) in subdirs.iter().enumerate() {
        let sub_id = id.saturating_mul(1000).saturating_add(i as u32);
        nested.extend(scan_album_dir(sub, sub_id));
    }
    nested
}

fn scan_galaxy_root(root: &Path) -> Vec<RawAlbum> {
    let mut albums = Vec::new();
    let mut album_id = 0u32;

    let entries = match fs::read_dir(root) {
        Ok(e) => e,
        Err(err) => {
            eprintln!("scan_music_library: cannot read {:?}: {}", root, err);
            return albums;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let scanned = scan_album_dir(&path, album_id);
            for album in scanned {
                if !album.tracks.is_empty() {
                    albums.push(album);
                    album_id = album_id.saturating_add(1);
                }
            }
        }
    }

    albums
}

#[tauri::command]
fn scan_music_library(root: String) -> Result<Vec<RawAlbum>, String> {
    let path = PathBuf::from(&root);
    if !path.is_dir() {
        return Err(format!("Music library path not found: {}", root));
    }
    Ok(scan_galaxy_root(&path))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![scan_music_library])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
