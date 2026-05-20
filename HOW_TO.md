# Audio Galaxy - User Manual

## Getting Started
1. Launch the application.
2. Click **INITIALIZE ENGINE** (or **ENTER GALAXY** if a previous session was remembered).
3. Choose your music library folder in the picker when it appears.
   - Each subfolder is an album (star in the galaxy).
   - Audio files inside are tracks (planets).
   - Supported: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`
4. The app remembers your folder for next time (browser: File System Access API; desktop: same picker flow).

## Controls

### Navigation
- **Mouse Drag**: Rotate Camera.
- **Scroll Wheel**: Zoom In/Out.
- **Click Object**:
  - Click a Star to enter that Album/System.
  - Click a Planet to play that track.

### Playback Control
- **Spacebar**: Play / Pause.
- **Left Arrow**: Previous Track.
- **Right Arrow**: Next Track.
- **Esc**: Exit System / Go Back to Galaxy View.

### Secret Menu
Press **`** (Tilde key, usually above Tab) to open the Settings Menu.
- **Orbit Speed**: Adjust how fast planets orbit.
- **Streamer Mode**: Hide HUD and media bar for recording. The info ticker (if enabled) keeps scrolling at the bottom.
- **Info Ticker**: Scrolling bar at the bottom with album folder name, track, artist, and embedded file comments (or a default Kraken Audio Galaxy version string).
- **Galaxy Wanderer**: Auto-travel between albums — returns to the galaxy starfield, picks a random album (never the one just finished), warps in, plays random tracks, then moves on after the set number of songs per album.
- **Graphics**: Adjust bloom, brightness, and starfield density.

## Features
- **Procedural Generation**: Every planet looks different based on the track's seed.
- **Audio Reactivity**: Planets pulse and effects respond to the music (if playing real audio).
- **Wanderer Mode**: Sit back and relax while the ship explores your music library automatically.
