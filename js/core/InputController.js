import * as THREE from 'three';

export class InputController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.element = domElement;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // State
        this.hoveredTarget = null;
        this.events = { onClick: null }; // External listener

        // DOM Elements
        this.reticle = document.getElementById('reticle');

        // Smooth reticle position
        this.reticlePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.reticleTarget = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.reticleSmoothing = 0.15;

        // Bindings
        window.addEventListener('mousemove', (e) => this.onMove(e));
        window.addEventListener('click', (e) => this.onClick(e));
    }

    onMove(e) {
        // Normalize mouse coordinates
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    onClick(e) {
        // Ignore clicks on UI
        if(e.target.closest('#ui-layer')) return;

        if (this.hoveredTarget && this.events.onClick) {
            this.events.onClick(this.hoveredTarget);
        }
    }

    // Call this every frame with an array of objects to interact with
    scan(interactables) {
        // 1. Precise Raycast
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(interactables);
        
        let bestTarget = null;

        if (intersects.length > 0) {
            bestTarget = intersects[0].object;
        } else {
            // 2. "Aim Assist" Proximity Check
            // Increased radius to 100px for easier catching of fast planets
            let minDist = 100; 
            
            interactables.forEach(obj => {
                if (!obj.visible) return;

                // Project 3D position to 2D screen space
                const pos = new THREE.Vector3();
                obj.getWorldPosition(pos);
                pos.project(this.camera);

                // Check if object is behind camera (Z < -1 or Z > 1 in NDC usually implies out of frustum depth)
                // For perspective camera, visible range is -1 to 1. 
                // However, objects behind the camera often project to Z > 1.
                if (pos.z > 1 || pos.z < -1) return;

                // Convert NDC to Screen Coordinates
                const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
                const y = -(pos.y * 0.5 - 0.5) * window.innerHeight;

                const mouseX = (this.mouse.x * 0.5 + 0.5) * window.innerWidth;
                const mouseY = -(this.mouse.y * 0.5 - 0.5) * window.innerHeight;

                const dist = Math.sqrt(Math.pow(x - mouseX, 2) + Math.pow(y - mouseY, 2));

                if (dist < minDist) {
                    minDist = dist;
                    bestTarget = obj;
                }
            });
        }

        this.hoveredTarget = bestTarget;
        this.updateReticle();

        return bestTarget;
    }

    updateReticle() {
        if (this.hoveredTarget) {
            this.reticle.style.display = 'block';
            this.reticle.classList.add('active');
            document.body.style.cursor = 'none';

            // Calculate target position
            const pos = new THREE.Vector3();
            this.hoveredTarget.getWorldPosition(pos);
            pos.project(this.camera);

            this.reticleTarget.x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            this.reticleTarget.y = -(pos.y * 0.5 - 0.5) * window.innerHeight;

            // Smooth interpolation
            this.reticlePos.x += (this.reticleTarget.x - this.reticlePos.x) * this.reticleSmoothing;
            this.reticlePos.y += (this.reticleTarget.y - this.reticlePos.y) * this.reticleSmoothing;

            this.reticle.style.left = `${this.reticlePos.x}px`;
            this.reticle.style.top = `${this.reticlePos.y}px`;
        } else {
            this.reticle.classList.remove('active');
            document.body.style.cursor = 'crosshair';

            // When no target, smoothly return reticle to center
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            this.reticlePos.x += (centerX - this.reticlePos.x) * 0.1;
            this.reticlePos.y += (centerY - this.reticlePos.y) * 0.1;
            this.reticle.style.left = `${this.reticlePos.x}px`;
            this.reticle.style.top = `${this.reticlePos.y}px`;
        }
    }
}