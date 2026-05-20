/**
 * Read ID3/Vorbis/etc. tags from a local audio File or FileSystemFileHandle.
 * Requires jsmediatags (loaded globally from index.html).
 */
function pickBlurb(tags) {
    const candidates = [
        tags.comment?.text,
        tags.comment,
        tags.description,
        tags.unsynchronisedLyrics,
        tags.lyrics,
        tags.subtitle
    ];

    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
        if (c && typeof c.text === 'string' && c.text.trim()) return c.text.trim();
    }
    return null;
}

async function fileFromPath(path) {
    if (!window.__TAURI__?.core?.convertFileSrc) return null;

    const url = window.__TAURI__.core.convertFileSrc(path);
    const res = await fetch(url);
    if (!res.ok) return null;

    const blob = await res.blob();
    const name = path.split(/[/\\]/).pop() || 'track.mp3';
    return new File([blob], name, { type: blob.type || 'audio/mpeg' });
}

export async function readTrackMetadata(fileOrHandleOrPath) {
    if (!window.jsmediatags) return {};

    try {
        let file;
        if (typeof fileOrHandleOrPath === 'string') {
            file = await fileFromPath(fileOrHandleOrPath);
            if (!file) return {};
        } else {
            file = fileOrHandleOrPath instanceof File
                ? fileOrHandleOrPath
                : await fileOrHandleOrPath.getFile();
        }

        return await new Promise((resolve) => {
            window.jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const tags = tag.tags || {};
                    resolve({
                        title: tags.title || null,
                        artist: tags.artist || tags.albumartist || null,
                        album: tags.album || null,
                        blurb: pickBlurb(tags)
                    });
                },
                onError: () => resolve({})
            });
        });
    } catch {
        return {};
    }
}
