# Visual Enhancements for OBS / YouTube Streaming

**Goal**: Enhance the visual "life" of the galaxy (especially during cinematic orbit and Galaxy Wanderer) while keeping OBS capture clean at 2K 60fps and minimizing compression artifacts on YouTube. All new features must be toggleable from the `~` secret menu.

## Current Status

### Fully implemented

#### 1. Secret menu — Visual Effects (OBS Safe) (`index.html`)

New section under **Visual Effects (OBS Safe)** with these toggles:

| Toggle | Element ID | Wired | Default |
|--------|------------|-------|---------|
| Orbital Dust | `orbital-dust-enabled` | **Yes** | off |
| OBS Safe Bloom | `obs-safe-bloom` | No | on |
| Audio Reactive Glow | `audio-reactive-glow` | No | on |
| Rich Background Dust | `rich-background` | No | off |
| OBS Safe Mode (Master) | `obs-safe-mode` | No | off |

#### 2. Orbital Dust (`js/scenes/SystemView.js` + `js/App.js`)

- Subtle point-cloud dust (40 particles per planet) along each orbit ring
- Gray, low opacity (`0.35`), no additive blending — tuned for OBS/YouTube compression
- `createOrbitalDust()` builds dust when an album loads (only if dust is enabled)
- `setDustEnabled(enabled)` — public toggle; hides dust immediately when off
- `clear()` preserves `dustContainer` so dust is not destroyed when switching albums
- **Live toggle**: `#orbital-dust-enabled` → `App.js` → `system.setDustEnabled()`
- **Persistence**: saved in `localStorage` as `galaxy_settings.orbitalDustEnabled`

**Enable mid-session**: turning dust **on** during an album requires reloading that album (or picking another) for particles to spawn. Turning it **off** hides existing dust immediately.

### Not yet implemented (UI only)

These checkboxes exist in the secret menu but have **no engine logic** yet:

- **OBS Safe Bloom** — planned: cap bloom strength/radius for streaming
- **Audio Reactive Glow** — planned: audio-driven planet/star glow (conservative for OBS)
- **Rich Background Dust** — planned: faint galaxy-wide background particles
- **OBS Safe Mode (Master)** — planned: one-click preset (reduce bloom, disable heavy effects)

Existing bloom sliders (`bloom-threshold`, `bloom-strength`, `bloom-radius`) still work independently.

## Design Principles

- **OBS / YouTube first** — effects must survive compression; avoid heavy bloom bleed, bright additive halos, and high-frequency noise
- **Toggle everything** — every new visual feature gets an off switch
- **True black preservation** — especially important for HDR viewers
- **Documentation** — commit messages, this file, and inline `// OBS` / `// ===` comments in code

## Restore Points

If visual experiments regress core playback or camera behavior:

| Restore point | Location |
|---------------|----------|
| Pre–visual-effects (v1.1.0) | Git tag `v1.1.0` @ `c796e5a` |
| Pre–visual-effects branch | `backup/pre-grok-20260520` |
| Local folder backup | `kraken-galaxy-music-player-backup-pre-grok-20260520` (sibling to repo) |

## Commit History (visual work)

| Commit | Summary |
|--------|---------|
| `e09c81b` | Secret menu Visual Effects section (HTML toggles) |
| `476f13b` | Orbital Dust foundation in `SystemView.js` |
| `5a8d363` | `setDustEnabled()`, orbit integration, animation |
| `2933050` | Initial `VISUAL_ENHANCEMENTS.md` (Grok) |

## Planned Next Steps

1. Wire **OBS Safe Mode** master toggle (bloom cap + disable heavy effects)
2. Implement **OBS Safe Bloom** checkbox behavior (or fold into master mode)
3. Orbital Dust: spawn on live enable without album reload
4. Add **audio-reactive glow** and **rich background dust** (conservative defaults, off when OBS Safe Mode is on)

## Notes for Local AI / Future Work

- Primary files: `index.html`, `js/scenes/SystemView.js`, `js/App.js` (`bindSecretMenu`, `saveSettings`, `loadSettings`)
- Search for `// === ORBITAL DUST` and `// OBS` in `SystemView.js`
- Dust uses `THREE.Points` with low count — intentionally conservative for streaming
- Do not break v1.1.0 core behavior: wanderer, ticker, cinematic orbit, single-track playback, streamer mode
