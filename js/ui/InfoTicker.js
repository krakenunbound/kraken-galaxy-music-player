export class InfoTicker {
    constructor(appVersion) {
        this.version = appVersion;
        this.enabled = false;
        this.root = document.getElementById('info-ticker');
        this.track = this.root?.querySelector('.info-ticker-track');
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!this.root) return;
        this.root.classList.toggle('visible', enabled);
        if (enabled && !this.track?.textContent?.trim()) {
            this.showIdle();
        }
    }

    showIdle() {
        this.update({
            album: '—',
            track: '—',
            artist: '—',
            blurb: null
        });
    }

    update({ album, track, artist, blurb }) {
        if (!this.track) return;

        const fallback = `Kraken Audio Galaxy version ${this.version}`;
        const detail = (blurb && blurb.trim()) ? blurb.trim() : fallback;
        const line = `Album: ${album}   •   Track: ${track}   •   Artist: ${artist}   •   ${detail}`;

        this.track.textContent = '';
        const spanA = document.createElement('span');
        const spanB = document.createElement('span');
        spanA.textContent = line;
        spanB.textContent = line;
        spanB.setAttribute('aria-hidden', 'true');
        this.track.appendChild(spanA);
        this.track.appendChild(spanB);

        const duration = Math.max(18, line.length * 0.22);
        this.track.style.setProperty('--ticker-duration', `${duration}s`);
    }
}
