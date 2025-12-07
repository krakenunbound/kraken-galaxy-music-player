# Tauri Setup for Audio Galaxy

This document explains how to run Audio Galaxy as a native desktop app using Tauri.

## Prerequisites

### 1. Install Rust

Open PowerShell and run:
```powershell
winget install Rustlang.Rustup
```

After installation, restart your terminal and run:
```bash
rustup default stable
```

Verify installation:
```bash
rustc --version
```

### 2. Install Node.js dependencies

```bash
npm install
```

## Running the App

### Development Mode

For development, you have two options:

**Option A: With hot reload (requires Python server)**
```bash
# Terminal 1: Start the dev server
npm run serve

# Terminal 2: Start Tauri in dev mode
npm run tauri:dev
```

**Option B: Direct file serving (no hot reload)**

Edit `src-tauri/tauri.conf.json` and change:
```json
"devUrl": "http://localhost:8000"
```
to:
```json
"devUrl": "../index.html"
```

Then just run:
```bash
npm run tauri:dev
```

### Building for Production

```bash
npm run tauri:build
```

This creates an installer in `src-tauri/target/release/bundle/`.

## What's Different from Browser

| Browser | Tauri |
|---------|-------|
| Need to start Python server | Just double-click the app |
| Browser chrome (tabs, URL bar) | Clean app window |
| ~150MB with Electron | ~30MB with Tauri |
| Runs in browser sandbox | Native app with OS access |

## File System Access

The app uses the File System Access API (`showDirectoryPicker`). This works in:
- ✅ Chrome/Chromium browsers
- ✅ Edge WebView2 (what Tauri uses on Windows)
- ❌ Firefox, Safari

If you encounter issues with file picking on non-Windows platforms, we may need to implement Tauri's native dialog API as a fallback.

## Troubleshooting

### "rustc: command not found"
Restart your terminal after installing Rust, or run:
```bash
source ~/.cargo/env  # Linux/Mac
# or restart terminal on Windows
```

### WebView2 not found (Windows)
Tauri will automatically prompt to download WebView2 if needed. Most Windows 10/11 systems have it pre-installed.

### Build errors about missing icons
The `src-tauri/icons/` folder needs icon files. You can generate them from your favicon:
```bash
npm run tauri icon favicon.ico
```

## Project Structure

```
audio-galaxy/
├── index.html          # Your existing web app
├── css/
├── js/
├── src-tauri/          # Tauri-specific files
│   ├── Cargo.toml      # Rust dependencies
│   ├── tauri.conf.json # Tauri configuration
│   ├── src/
│   │   └── main.rs     # Rust entry point
│   └── icons/          # App icons
└── package.json        # npm scripts
```
