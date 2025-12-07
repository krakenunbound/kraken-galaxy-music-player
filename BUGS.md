# Bug List

## Active Bugs
*None currently known.*

## Resolved Bugs
- [x] **Application Freeze**: Fixed critical crash in `App.js` where `this.gfx.camera` was accessed instead of `this.engine.camera`.

## Known Limitations
- **Offline Mode**: The application currently loads Three.js libraries from a CDN (jsdelivr). It will not function correctly without an active internet connection. To fix this, Three.js should be installed via npm and bundled, or the local scripts should be referenced.
