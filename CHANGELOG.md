# Changelog

## [Unreleased] - 2025-12-07

### Fixed
- **Critical Crash**: Fixed an infinite error loop in `App.js` (line 608) caused by accessing the undefined `this.gfx` property instead of `this.engine`. This resolved the application freeze during the "System View" render loop.
- **Stability**: The application now correctly renders the system view without generating console errors.
