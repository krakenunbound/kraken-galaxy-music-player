import * as THREE from 'three';

export class FileSystemLoader {
    constructor() {
        this.rootHandle = null;
        this.galaxyData = [];
        this.dbName = 'AudioGalaxyDB';
        this.storeName = 'handles';
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async saveHandle(handle) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.put(handle, 'rootDirectory');
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    async getHandle() {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get('rootDirectory');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async pickDirectory(autoLoad = false) {
        try {
            if (autoLoad) {
                // Try to load existing handle
                const savedHandle = await this.getHandle();
                if (savedHandle) {
                    // Verify permission
                    const opts = { mode: 'read' };
                    if ((await savedHandle.queryPermission(opts)) === 'granted') {
                        this.rootHandle = savedHandle;
                        return await this.scanGalaxy(this.rootHandle);
                    }
                    // If permission is 'prompt', we typically need a gesture. 
                    // But we return 'need_gesture' so UI can show a specific button like "Resume Last Session"
                    if ((await savedHandle.requestPermission(opts)) === 'granted') {
                        this.rootHandle = savedHandle;
                        return await this.scanGalaxy(this.rootHandle);
                    }
                }
            }

            // Fallback to picker
            this.rootHandle = await window.showDirectoryPicker();
            await this.saveHandle(this.rootHandle); // Save for next time
            return await this.scanGalaxy(this.rootHandle);
        } catch (err) {
            console.error("Error picking directory:", err);
            return null;
        }
    }

    async scanGalaxy(dirHandle) {
        this.galaxyData = [];
        let albumId = 0;

        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'directory') {
                const albumData = await this.scanAlbum(entry, albumId++);
                if (albumData.tracks.length > 0) {
                    this.galaxyData.push(albumData);
                }
            }
        }
        return this.galaxyData;
    }

    async scanAlbum(dirHandle, id) {
        const tracks = [];
        let trackId = 0;

        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                if (this.isAudioFile(entry.name)) {
                    tracks.push({
                        id: trackId++,
                        title: entry.name.replace(/\.[^/.]+$/, ""), // Remove extension
                        handle: entry,
                        type: 'track'
                    });
                }
            }
        }

        // Generate procedural data for the visual representation (stars, planets)
        // We mix real data (tracks) with procedural visuals
        return this.enrichAlbumData(id, dirHandle.name, tracks);
    }

    isAudioFile(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        return ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext);
    }

    // Seeded random for consistent planet generation
    seededRandom(seed) {
        const x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
    }

    enrichAlbumData(id, name, tracks) {
        const starColors = [0xaaafff, 0xffffff, 0xffffaa, 0xffaa55, 0xff5533];
        const starColorHex = starColors[Math.floor(this.seededRandom(id * 7) * starColors.length)];

        // Planet type definitions with properties
        const planetTypes = [
            { type: 'rocky', weight: 25, sizeRange: [0.8, 1.8], colors: ['#8B7355', '#A0522D', '#696969', '#8B4513', '#CD853F'] },
            { type: 'ocean', weight: 15, sizeRange: [1.2, 2.2], colors: ['#1E90FF', '#4169E1', '#00CED1', '#20B2AA', '#5F9EA0'] },
            { type: 'forest', weight: 12, sizeRange: [1.0, 2.0], colors: ['#228B22', '#2E8B57', '#3CB371', '#006400', '#32CD32'] },
            { type: 'ice', weight: 12, sizeRange: [0.9, 1.8], colors: ['#E0FFFF', '#B0E0E6', '#87CEEB', '#ADD8E6', '#F0FFFF'] },
            { type: 'lava', weight: 8, sizeRange: [0.8, 1.6], colors: ['#8B0000', '#B22222', '#CD5C5C', '#FF4500', '#DC143C'] },
            { type: 'desert', weight: 10, sizeRange: [0.9, 1.7], colors: ['#DEB887', '#D2B48C', '#F4A460', '#DAA520', '#CD853F'] },
            { type: 'gas', weight: 15, sizeRange: [2.5, 4.5], colors: ['#DEB887', '#D2691E', '#BC8F8F', '#F5DEB3', '#FFDAB9'] },
            { type: 'ice_giant', weight: 3, sizeRange: [2.2, 3.8], colors: ['#00CED1', '#48D1CC', '#40E0D0', '#7FFFD4', '#00FFFF'] }
        ];

        const totalWeight = planetTypes.reduce((sum, p) => sum + p.weight, 0);

        const enrichedTracks = tracks.map((track, i) => {
            // Use seeded random for consistency
            const seed = id * 1000 + i;
            const rand1 = this.seededRandom(seed);
            const rand2 = this.seededRandom(seed + 1);
            const rand3 = this.seededRandom(seed + 2);
            const rand4 = this.seededRandom(seed + 3);
            const rand5 = this.seededRandom(seed + 4);
            const rand6 = this.seededRandom(seed + 5);

            // Distance from star - outer planets more likely to be gas giants
            const currentDist = 60 + (i * 35) + (rand1 * 20 - 10);

            // Select planet type - bias toward gas giants for outer planets
            let typeRoll = rand2 * totalWeight;
            if (currentDist > 200) typeRoll = Math.min(typeRoll + 30, totalWeight - 1); // Bias outer planets to gas

            let selectedType = planetTypes[0];
            let cumWeight = 0;
            for (const pt of planetTypes) {
                cumWeight += pt.weight;
                if (typeRoll < cumWeight) {
                    selectedType = pt;
                    break;
                }
            }

            // Size within type's range
            const sizeMin = selectedType.sizeRange[0];
            const sizeMax = selectedType.sizeRange[1];
            const size = sizeMin + rand3 * (sizeMax - sizeMin);

            // Color from type's palette
            const colorIndex = Math.floor(rand4 * selectedType.colors.length);
            const baseColor = selectedType.colors[colorIndex];

            // Rings - more common on gas giants and ice giants
            const ringChance = (selectedType.type === 'gas' || selectedType.type === 'ice_giant') ? 0.4 : 0.08;
            const hasRings = rand5 < ringChance;

            // Ring color based on planet type
            let ringColor = '#AAAAAA';
            if (hasRings) {
                if (selectedType.type === 'ice_giant') ringColor = '#87CEEB';
                else if (selectedType.type === 'gas') ringColor = '#D2B48C';
                else ringColor = '#A0A0A0';
            }

            // Atmosphere properties
            const hasAtmosphere = ['ocean', 'forest', 'gas', 'ice_giant'].includes(selectedType.type);
            const atmosphereColor = selectedType.type === 'ocean' ? '#4169E1' :
                selectedType.type === 'forest' ? '#90EE90' :
                    selectedType.type === 'gas' ? '#DEB887' :
                        selectedType.type === 'ice_giant' ? '#00CED1' : null;

            // Cloud coverage for applicable types
            const hasClouds = ['ocean', 'forest', 'gas', 'ice_giant'].includes(selectedType.type) && rand6 > 0.3;

            return {
                ...track,
                trackNumber: i + 1,
                duration: "--:--",
                planetType: selectedType.type,
                dist: currentDist,
                size: size,
                speed: (100 / Math.pow(currentDist, 1.5)) * 0.2,
                angle: rand1 * Math.PI * 2,
                color: baseColor,
                hasRings: hasRings,
                ringColor: ringColor,
                hasAtmosphere: hasAtmosphere,
                atmosphereColor: atmosphereColor,
                hasClouds: hasClouds,
                seed: seed // For texture generation
            };
        });

        // Determine star properties based on track count
        const trackCount = tracks.length;
        let sizeClass = 'Normal';
        let starType = 'main_sequence';
        let starRadius = 15;

        if (trackCount < 5) {
            sizeClass = 'BlackHole';
            starType = 'black_hole';
            starRadius = 8;
        } else if (trackCount < 10) {
            sizeClass = 'Dwarf';
            starType = 'dwarf';
            starRadius = 10;
        } else if (trackCount >= 20) {
            sizeClass = 'SuperGiant';
            starType = 'giant';
            starRadius = 25 + this.seededRandom(id * 11) * 15;
        } else {
            starRadius = 12 + this.seededRandom(id * 13) * 8;
        }

        return {
            id: id,
            title: name,
            artist: "Unknown Artist",
            year: "202X",
            sizeClass: sizeClass,
            star: {
                radius: starRadius,
                color: new THREE.Color(starColorHex),
                type: starType
            },
            tracks: enrichedTracks
        };
    }
}
