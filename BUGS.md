# Bug List

**Last updated:** 2026-05-20 (bug-fix pass)

**Restore point:** `kraken-galaxy-music-player-backup-20260520/` (full copy) and git branch `backup/pre-bugfix-20260520`

---

## Active Bugs

### Medium / limitations (not fixed in this pass)

- [ ] **Offline mode**: Three.js loaded from jsDelivr CDN — no network means no app. See `TODO.md`.
- [ ] **Root-level audio files**: Only subfolders (and nested subfolders) are scanned as albums; loose files in the library root are still ignored.
- [ ] **Codec vs. extension list**: Loader accepts `.flac` / `.m4a`; playback depends on WebView codecs (failures show in console).
- [ ] **IndexedDB folder handle**: Saved handles can lose permission; user may need to re-pick folder.

### Low / optional polish

- [ ] **No automated tests** in repo.
- [ ] **Artist metadata**: Scanned albums still show `"Unknown Artist"`.
- [ ] **No listener teardown** on window events (minor for desktop SPA).

---

## Fixed (2026-05-20)

- [x] **Audio context property mismatch** — `onDataLoaded()` uses `audio.ctx` / `audio.initialized`.
- [x] **Init button double handler** — `preloadedGalaxyData` + single `onInitClick()` path.
- [x] **Transition / wanderer timing** — `enterSystem()` returns a Promise; `warpGeneration` cancels stale warps; wanderer awaits completion.
- [x] **Play UI on failure** — `playAudioFile()` returns boolean; play button reflects actual state.
- [x] **UI clicks hit 3D scene** — `InputController` ignores media bar, loader, secret menu, etc.
- [x] **SFX restored** — `playSound()` wired to `sfxGain` in active `AudioController`.
- [x] **GPU leak on album change** — `disposeObject3D()` in `SystemView.clear()` and `GalaxyView.setData()`.
- [x] **Web Audio cleanup** — `disconnect()` on `MediaElementSource` in `cleanupAudio()`.
- [x] **Shuffle previous** — `shuffleHistory` stack for `prevTrack()` in shuffle mode.
- [x] **Nested album folders** — `scanAlbum()` recurses when a folder has no direct audio files.
- [x] **Track order** — Tracks sorted alphabetically after scan.
- [x] **Tauri `frontendDist`** — Points to project root (`..`) instead of missing `dist/`.
- [x] **Simulation fallback UI** — No false pause icon when `playTrackSim()` fails.
- [x] **Dead duplicate `AudioController`** — Removed `js/core/AudioController.js`.
- [x] **Orbit speed label** — Default label `0.50x`; slider fires `input` on bind.
- [x] **`stopTrack()` index** — No longer resets `currentTrackIndex` to 0.
- [x] **Version drift** — `package.json` set to `1.0.1`.
- [x] **README release URL** — Points to `kraken-galaxy-music-player` releases.
- [x] **Reticle null guard** — `updateReticle()` returns early if `#reticle` missing.

---

## Resolved Bugs (historical)

- [x] **Application Freeze**: `this.gfx.camera` → `this.engine.camera`.
- [x] **Star shader lighting artifact** (commit `656540a`).

---

## Known Limitations

- **Offline mode**: CDN dependency for Three.js (see active bugs above).
- **Data persistence**: Settings in `localStorage`; music folder via IndexedDB + File System Access API.
