import * as THREE from 'three';

export class DataGenerator {
    static generateAlbum(id) {
        // 1. Determine Collection Size (Simulated)
        // In a real app, this comes from your file system
        const r = Math.random();
        let trackCount;
        let sizeClass = 'Normal';
        
        if (r < 0.1) { 
            // Tiny EP / Single (Black Hole)
            trackCount = 1 + Math.floor(Math.random() * 4); 
            sizeClass = 'BlackHole'; 
        } 
        else if (r < 0.3) { 
            // Small EP (Dwarf Star)
            trackCount = 5 + Math.floor(Math.random() * 5); 
            sizeClass = 'Dwarf'; 
        } 
        else if (r < 0.8) { 
            // Standard Album (Main Sequence)
            trackCount = 10 + Math.floor(Math.random() * 20); 
            sizeClass = 'Normal'; 
        } 
        else { 
            // Huge Anthology (Super Giant)
            trackCount = 50 + Math.floor(Math.random() * 100); 
            sizeClass = 'SuperGiant'; 
        }

        // 2. Define Star Properties based on Size
        let starRadius = 15;
        let starColorHex = 0xffffaa;
        let starType = 'main_sequence';

        if (sizeClass === 'BlackHole') {
            starRadius = 8;
            starColorHex = 0x000000;
            starType = 'black_hole';
        } else if (sizeClass === 'Dwarf') {
            starRadius = 8;
            starColorHex = 0xff5533; // Red
            starType = 'dwarf';
        } else if (sizeClass === 'SuperGiant') {
            starRadius = 50 + Math.random() * 30; // Massive
            starColorHex = Math.random() > 0.5 ? 0x5555ff : 0xff3333; // Blue or Red Giant
            starType = 'giant';
        }

        // 3. Generate Tracks (Planets)
        const tracks = [];
        let currentDist = starRadius * 2 + 40;

        // Planet type definitions
        const planetTypes = [
            { type: 'rocky',   weight: 25, sizeRange: [0.8, 1.8],  colors: ['#8B7355', '#A0522D', '#696969', '#8B4513', '#CD853F'] },
            { type: 'ocean',   weight: 15, sizeRange: [1.2, 2.2],  colors: ['#1E90FF', '#4169E1', '#00CED1', '#20B2AA', '#5F9EA0'] },
            { type: 'forest',  weight: 12, sizeRange: [1.0, 2.0],  colors: ['#228B22', '#2E8B57', '#3CB371', '#006400', '#32CD32'] },
            { type: 'ice',     weight: 12, sizeRange: [0.9, 1.8],  colors: ['#E0FFFF', '#B0E0E6', '#87CEEB', '#ADD8E6', '#F0FFFF'] },
            { type: 'lava',    weight: 8,  sizeRange: [0.8, 1.6],  colors: ['#8B0000', '#B22222', '#CD5C5C', '#FF4500', '#DC143C'] },
            { type: 'desert',  weight: 10, sizeRange: [0.9, 1.7],  colors: ['#DEB887', '#D2B48C', '#F4A460', '#DAA520', '#CD853F'] },
            { type: 'gas',     weight: 15, sizeRange: [2.5, 4.5],  colors: ['#DEB887', '#D2691E', '#BC8F8F', '#F5DEB3', '#FFDAB9'] },
            { type: 'ice_giant', weight: 3, sizeRange: [2.2, 3.8], colors: ['#00CED1', '#48D1CC', '#40E0D0', '#7FFFD4', '#00FFFF'] }
        ];
        const totalWeight = planetTypes.reduce((sum, p) => sum + p.weight, 0);

        const seededRandom = (seed) => {
            const x = Math.sin(seed * 9999) * 10000;
            return x - Math.floor(x);
        };

        for (let i = 0; i < trackCount; i++) {
            const seed = id * 1000 + i;
            const rand1 = seededRandom(seed);
            const rand2 = seededRandom(seed + 1);
            const rand3 = seededRandom(seed + 2);
            const rand4 = seededRandom(seed + 3);
            const rand5 = seededRandom(seed + 4);
            const rand6 = seededRandom(seed + 5);

            currentDist += 30 + (rand1 * 25);

            // Select planet type - bias toward gas giants for outer planets
            let typeRoll = rand2 * totalWeight;
            if (currentDist > 300) typeRoll = Math.min(typeRoll + 35, totalWeight - 1);

            let selectedType = planetTypes[0];
            let cumWeight = 0;
            for (const pt of planetTypes) {
                cumWeight += pt.weight;
                if (typeRoll < cumWeight) {
                    selectedType = pt;
                    break;
                }
            }

            const sizeMin = selectedType.sizeRange[0];
            const sizeMax = selectedType.sizeRange[1];
            const size = sizeMin + rand3 * (sizeMax - sizeMin);

            const colorIndex = Math.floor(rand4 * selectedType.colors.length);
            const baseColor = selectedType.colors[colorIndex];

            const ringChance = (selectedType.type === 'gas' || selectedType.type === 'ice_giant') ? 0.4 : 0.08;
            const hasRings = rand5 < ringChance;

            let ringColor = '#AAAAAA';
            if (hasRings) {
                if (selectedType.type === 'ice_giant') ringColor = '#87CEEB';
                else if (selectedType.type === 'gas') ringColor = '#D2B48C';
            }

            const hasAtmosphere = ['ocean', 'forest', 'gas', 'ice_giant'].includes(selectedType.type);
            const atmosphereColor = selectedType.type === 'ocean' ? '#4169E1' :
                                   selectedType.type === 'forest' ? '#90EE90' :
                                   selectedType.type === 'gas' ? '#DEB887' :
                                   selectedType.type === 'ice_giant' ? '#00CED1' : null;

            const hasClouds = hasAtmosphere && rand6 > 0.3;

            tracks.push({
                id: `${id}-${i}`,
                trackNumber: i + 1,
                title: `Track ${id}-${i + 1}`,
                artist: `Artist ${String.fromCharCode(65 + (id % 26))}`,
                duration: "3:45",
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
                seed: seed
            });
        }

        return {
            id: id, 
            title: `Collection Vol ${id}`, 
            artist: `Simulated Artist`,
            sizeClass: sizeClass,
            star: { 
                radius: starRadius, 
                color: new THREE.Color(starColorHex), 
                type: starType 
            }, 
            tracks: tracks
        };
    }
}