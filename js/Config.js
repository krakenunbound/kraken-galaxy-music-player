/* Configuration Constants */
export const Config = {
    Colors: {
        Primary: 0x00ffff,
        Bg: 0x050505,
        Stars: [0xaaafff, 0xffffff, 0xffffaa, 0xffaa55, 0xff5533]
    },
    Galaxy: {
        Count: 150, // How many Albums?
        Radius: 400,
        SpiralTurns: 2
    },
    System: {
        OrbitSpeedMultiplier: 0.5, // Default orbit speed (0.05 = very slow, 2.0 = very fast)
        BaseOrbitRadius: 60,
        OrbitSpacing: 35
    },
    Camera: {
        FOV: 60,
        Near: 1,
        Far: 30000
    },
    Starfield: {
        Count: 2000,
        Radius: 15000,
        MinSize: 0.5,
        MaxSize: 2.0
    }
};