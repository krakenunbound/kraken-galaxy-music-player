# Changelog

## [1.1.0] - 2026-05-20

### Added
- **Info ticker** (~ menu): scrolling album, track, artist, and ID3 comment blurbs at the bottom; stays visible in streamer mode.
- **Tauri library scan** command for optional path-based playback (desktop).

### Changed
- **Galaxy Wanderer** rewritten: galaxy view → random album → random tracks → repeat.
- **Cinematic camera**: slow 360° orbit around the playing planet.
- Removed warp/scan transition sound effects.

### Fixed
- Audio context resume, overlapping playback on planet click, init button double-handler.
- GPU memory cleanup when changing albums; shuffle previous track; UI clicks no longer hit 3D scene.
- Streamer mode no longer hides the info ticker.

## [1.0.1] - 2025-12-07

### Fixed
- **Critical Crash**: Fixed an infinite error loop in `App.js` caused by accessing `this.gfx` instead of `this.engine`.
- **Star shader lighting artifact** on the dark side of stars.
