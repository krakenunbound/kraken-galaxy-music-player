import * as THREE from 'three';
import { Config } from '../Config.js';
import { TextureFactory } from '../utils/Utils.js';

export class GalaxyView {
    constructor(scene) {
        this.scene = scene;
        this.container = new THREE.Group();
        this.interactables = [];

        this.scene.add(this.container);
        this.init();
    }

    init() {
        // Background dust
        const bgGeo = new THREE.BufferGeometry();
        const bgPos = [];
        for (let i = 0; i < 5000; i++) {
            bgPos.push(
                (Math.random() - 0.5) * 10000,
                (Math.random() - 0.5) * 10000,
                (Math.random() - 0.5) * 10000
            );
        }
        bgGeo.setAttribute('position', new THREE.Float32BufferAttribute(bgPos, 3));
        const bgMat = new THREE.PointsMaterial({ color: 0x666666, size: 2, sizeAttenuation: false });
        this.container.add(new THREE.Points(bgGeo, bgMat));
    }

    // Seeded random for consistent positions
    seededRandom(seed) {
        const x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
    }

    setData(galaxyData) {
        // Clear existing
        this.interactables.forEach(sprite => {
            this.container.remove(sprite);
        });
        this.interactables = [];

        const numArms = 4;
        const armSpread = 0.4; // How much stars spread from arm center
        const rotationFactor = 2.5; // How tightly wound the spiral is

        // Create Systems from Data
        galaxyData.forEach((albumData, i) => {
            // Assign to a spiral arm based on index
            const armIndex = i % numArms;
            const positionInArm = Math.floor(i / numArms);

            // Base angle for this arm
            const armOffset = (armIndex / numArms) * Math.PI * 2;

            // Distance from center increases with position
            const dist = 80 + (positionInArm * 25) + this.seededRandom(i * 7) * 60;

            // Angle wraps around as distance increases (spiral effect)
            const spiralAngle = armOffset + (dist / 100) * rotationFactor;

            // Add some spread perpendicular to the arm
            const spread = (this.seededRandom(i * 13) - 0.5) * armSpread * dist * 0.3;
            const spreadAngle = spiralAngle + Math.PI / 2;

            const x = Math.cos(spiralAngle) * dist + Math.cos(spreadAngle) * spread;
            const z = Math.sin(spiralAngle) * dist + Math.sin(spreadAngle) * spread;
            const y = (this.seededRandom(i * 17) - 0.5) * 40 * (1 - dist / 1500); // Flatter at edges

            // Determine Visual Scale based on Size Class (calculated in loader)
            // If sizeClass is missing, infer from track count
            let sizeClass = albumData.sizeClass || 'Normal';
            if (!albumData.sizeClass) {
                if (albumData.tracks.length < 5) sizeClass = 'BlackHole';
                else if (albumData.tracks.length > 20) sizeClass = 'SuperGiant';
            }

            let sScale = 20;
            let texType = 'normal';

            if (sizeClass === 'SuperGiant') {
                sScale = 50;
            } else if (sizeClass === 'BlackHole') {
                sScale = 10;
                texType = 'black_hole';
            } else if (sizeClass === 'Dwarf') {
                sScale = 15;
            }

            const material = new THREE.SpriteMaterial({
                map: TextureFactory.createStar(
                    albumData.star.color.getStyle ? albumData.star.color.getStyle() : albumData.star.color,
                    texType,
                    sizeClass
                ),
                color: albumData.star.color,
                blending: THREE.AdditiveBlending
            });
            const sprite = new THREE.Sprite(material);

            sprite.position.set(x, y, z);
            sprite.scale.set(sScale, sScale, 1);

            sprite.userData = {
                type: 'album',
                data: albumData
            };

            this.container.add(sprite);
            this.interactables.push(sprite);
        });
    }

    update(dt) {
        this.container.rotation.y += 0.0005;
    }

    show() { this.container.visible = true; }
    hide() { this.container.visible = false; }
}