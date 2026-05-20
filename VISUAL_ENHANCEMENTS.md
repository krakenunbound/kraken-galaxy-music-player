# Visual Enhancements for OBS / YouTube Streaming

**Goal**: Enhance the visual "life" of the galaxy (especially during cinematic orbit and Galaxy Wanderer) while keeping OBS capture clean at 2K 60fps and minimizing compression artifacts on YouTube. All new features must be toggleable.

## Current Status (as of latest commits)

### Implemented

**1. Secret Menu Updates (`index.html`)**
- Added new **"Visual Effects (OBS Safe)"** section in the `~` secret menu.
- New toggles added:
  - `Orbital Dust`
  - `OBS Safe Bloom` (checked by default)
  - `Audio Reactive Glow`
  - `Rich Background Dust`
  - `OBS Safe Mode (Master)`

**2. Orbital Dust System (`js/scenes/SystemView.js`)**
- Added foundation for subtle orbital dust particles.
- Created `createOrbitalDust()` helper (low particle count, subtle gray dust — streaming safe).
- Added `setDustEnabled()` public method.
- Dust is created per planet when loading an album (if enabled).
- Proper cleanup in `clear()`.
- Visibility is controlled via `this.dustEnabled`.

### Not Yet Wired
- The new checkboxes in the secret menu are **not yet connected** to functionality.
- `OBS Safe Mode` does not yet control other effects.
- Dust does not yet react live to the checkbox toggle (only on album load).

## Design Principles

- **OBS / YouTube First**: Effects must survive compression. Avoid heavy bloom bleed, bright additive glows that halo, and high-frequency noise.
- **Toggle Everything**: Every new visual feature must have an off switch.
- **True Black Preservation**: Especially important for HDR viewers.
- **Documentation**: All changes include clear commit messages and inline comments.

## Planned Next Steps

1. Wire secret menu toggles to actual behavior (starting with dust + master OBS Safe Mode).
2. Make `OBS Safe Mode` automatically reduce bloom intensity and disable heavier effects.
3. Improve Orbital Dust (gentle movement, better visual integration, live toggle support).
4. Add more safe enhancements (refined audio-reactive glow, faint background dust, etc.).

## Notes for Local AI / Future Work

- All changes are on `master`.
- Look for comments starting with `// ===` or `// OBS` for context.
- The dust system is intentionally conservative (low particle count) to stay streaming-friendly.
