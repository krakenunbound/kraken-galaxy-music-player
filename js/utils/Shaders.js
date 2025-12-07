export const AtmosphereShader = {
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform vec3 color;
        uniform float power;
        uniform float intensity;

        void main() {
            vec3 viewDir = normalize(vViewPosition);
            float rim = 1.0 - abs(dot(vNormal, viewDir));
            float intensityVal = pow(rim, power) * intensity;
            // Clamp to prevent bloom artifacts
            intensityVal = clamp(intensityVal, 0.0, 0.5);
            gl_FragColor = vec4(color * intensityVal, intensityVal);
        }
    `
};

export const StarShader = {
    vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
            vPosition = position;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        uniform float time;
        uniform vec3 color;

        // 3D Simplex noise - avoids UV seam issues
        vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise3D(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);

            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;

            i = mod(i, 289.0);
            vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

            float n_ = 1.0/7.0;
            vec3 ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);

            vec4 x = x_ * ns.x + ns.yyyy;
            vec4 y = y_ * ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
            // Use 3D position for noise - seamless on sphere
            vec3 pos = normalize(vPosition);

            // Multiple octaves of animated noise for turbulent surface
            float n1 = snoise3D(pos * 4.0 + time * 0.3);
            float n2 = snoise3D(pos * 8.0 - time * 0.2);
            float n3 = snoise3D(pos * 16.0 + time * 0.5);

            // Combine noise octaves
            float noise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
            float intensity = 0.7 + 0.3 * noise;

            // Limb darkening in correct View Space
            vec3 viewDir = normalize(vViewPosition);
            float limb = dot(vNormal, viewDir);
            limb = pow(max(limb, 0.0), 0.4);

            // Hot spots / granulation
            float granulation = snoise3D(pos * 20.0 + time * 0.1);
            granulation = smoothstep(0.3, 0.7, granulation * 0.5 + 0.5);

            // Base color with temperature variation
            vec3 hotColor = color * 1.3;
            vec3 coolColor = color * 0.8;
            vec3 surfaceColor = mix(coolColor, hotColor, granulation);

            // Final color with limb darkening
            vec3 finalColor = surfaceColor * intensity * limb * 2.0;

            // Bright core boost
            finalColor += color * pow(limb, 2.0) * 0.5;

            // Clamp for bloom
            finalColor = clamp(finalColor, 0.0, 3.0);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

export const PlanetShader = {
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        uniform vec3 color1; // Deep/Base
        uniform vec3 color2; // Mid/Land
        uniform vec3 color3; // High/Mountain
        uniform float time;
        uniform float type; // 0=Rocky, 1=Ocean, 2=Gas, 3=Lava, 4=Ice
        uniform float hasClouds;
        uniform float seed; 

        // Lighting
        uniform vec3 ambientLightColor;
        
        // Simplex Noise 3D
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) { 
            const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;

            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );

            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;

            i = mod289(i); 
            vec4 p = permute( permute( permute( 
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                    + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

            float n_ = 0.142857142857; 
            vec3  ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ ); 

            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);

            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;

            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        // FBM
        float fbm(vec3 x, int octaves) {
            float v = 0.0;
            float a = 0.5;
            vec3 shift = vec3(100.0);
            for (int i = 0; i < 6; ++i) { 
                if(i >= octaves) break;
                v += a * snoise(x);
                x = x * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }

        void main() {
            vec3 coord = vPosition * 2.5 + vec3(seed * 10.0);

            vec3 finalColor = color1;
            float roughness = 0.8;
            
            // Standard N dot L (fake sun at 0,0,0)
            // But vNormal is in view space if using normalMatrix? No normalMatrix transforms to View Space.
            // If we want world space lighting from 0,0,0:
            // This shader is tricky without world coordinates passed in.
            // For now, simple directional light from "upper left" relative to view to show off the relief.
            vec3 lightDir = normalize(vec3(1.0, 0.5, 1.0));
            float diff = max(dot(vNormal, lightDir), 0.1);

            // --- GENERATION ---
            if (type < 0.5) { // Rocky
                float n = fbm(coord, 6) + 0.5;
                if(n < 0.45) finalColor = color1;
                else if (n < 0.6) finalColor = mix(color1, color2, (n-0.45)/0.15);
                else finalColor = mix(color2, color3, (n-0.6)/0.4);

            } else if (type < 1.5) { // Ocean
                float continents = fbm(coord * 0.8, 4);
                if (continents > 0.1) {
                    float detail = fbm(coord * 3.0, 3);
                    finalColor = mix(color2, color3, detail + 0.5);
                } else {
                    finalColor = color1 * (0.8 + 0.2 * fbm(coord * 5.0 + time * 0.1, 2));
                    roughness = 0.2;
                }
            
            } else if (type < 2.5) { // Gas
                float band = snoise(vec3(0.0, coord.y * 3.0, seed));
                float turb = fbm(coord, 4);
                float n = (band + turb * 0.5) * 0.5 + 0.5;
                if(n < 0.33) finalColor = mix(color2, color1, n/0.33);
                else if(n < 0.66) finalColor = mix(color1, color3, (n-0.33)/0.33);
                else finalColor = mix(color3, vec3(1.0), (n-0.66)/0.34);
                float drift = snoise(coord + vec3(time * 0.2, 0.0, 0.0));
                finalColor += drift * 0.05;

            } else if (type < 3.5) { // Lava
                float n = fbm(coord, 5);
                float cracks = pow(n + 0.5, 3.0);
                if(cracks > 0.7) {
                    finalColor = vec3(1.0, 0.5 * (cracks-0.7)/0.3, 0.0); // Hot
                    diff = 1.0; // Glowing
                } else {
                    finalColor = vec3(0.1, 0.05, 0.05); // Cool rock
                }

            } else { // Ice
                float n = fbm(coord * 2.0, 4);
                finalColor = mix(color1, color2, n + 0.5);
                float glint = step(0.8, snoise(coord * 5.0 + vec3(time*0.1)));
                finalColor += glint * 0.2;
                roughness = 0.1;
            }

            // Clouds
            if (hasClouds > 0.5) {
                float c = fbm(coord * 1.5 + vec3(time * 0.05, 0.0, 0.0), 4);
                if(c > 0.2) {
                    float alpha = (c - 0.2) * 2.0;
                    finalColor = mix(finalColor, vec3(1.0), clamp(alpha, 0.0, 0.8));
                }
            }
            
            gl_FragColor = vec4(finalColor * diff, 1.0);
        }
    `
};
