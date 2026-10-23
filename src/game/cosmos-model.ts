/** Deterministic, continuous-depth stars, turbulent nebulae and stellar nurseries. */
export const COSMOS_STARS = 14000;
export const COSMOS_DUST = 190000;
export const COSMOS_COUNT = COSMOS_STARS + COSMOS_DUST;

function hash(x: number, y: number, z: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}
function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = (a: number) => a * a * (3 - 2 * a);
  const u = smooth(x - ix), v = smooth(y - iy), w = smooth(z - iz);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), u), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u), v),
    mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u), v), w,
  );
}
function turbulence(x: number, y: number, z: number) {
  return noise(x, y, z) * 0.5 + noise(x * 2.1 + 8, y * 2.1, z * 2.1) * 0.27 +
    noise(x * 4.3, y * 4.3 + 13, z * 4.3) * 0.15 + noise(x * 9.2, y * 9.2, z * 9.2 + 4) * 0.08;
}

// Unequal volumes have separate origins, orientations, cavities and palettes.
// They are cloud bodies, not stacked strips or translated backdrop images.
const CLOUDS = [
  { center: [-32, -8, 58], scale: [46, 35, 6], angle: -0.55, color: [0.25, 0.65, 0.83] },
  { center: [41, -18, 84], scale: [24, 29, 7], angle: 0.7, color: [0.78, 0.32, 0.59] },
  { center: [-37, 29, 44], scale: [27, 25, 5], angle: 0.25, color: [0.93, 0.58, 0.29] },
  { center: [5, -36, 82], scale: [43, 29, 8], angle: -0.8, color: [0.39, 0.45, 0.86] },
];

export function buildCosmosPoints(): Float32Array {
  let seed = 0x51a7c05;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), 0.00001))) * Math.cos(random() * Math.PI * 2);
  const points = new Float32Array(COSMOS_COUNT * 8);
  for (let i = 0; i < COSMOS_COUNT; i++) {
    const o = i * 8;
    if (i < COSMOS_STARS) {
      const z = 5 + Math.pow(random(), 0.55) * 155;
      const bright = Math.pow(random(), 5);
      const warm = random() < 0.18;
      let x = (random() - 0.5) * z * 5.8;
      let y = (random() - 0.5) * z * 3.2;
      // A few stellar nurseries form irregular compact constellations amid the clouds.
      if (i % 7 === 0) {
        const c = CLOUDS[i % CLOUDS.length];
        x = (c.center[0] + normal() * 7) * z / c.center[2];
        y = (c.center[1] + normal() * 6) * z / c.center[2];
      }
      points.set([x, y, z, 0.28 + bright * 1.1,
        (warm ? 1 : 0.7) * (0.22 + bright * 0.78),
        (warm ? 0.8 : 0.85) * (0.22 + bright * 0.78),
        (warm ? 0.62 : 1) * (0.22 + bright * 0.78), 0], o);
    } else if ((i - COSMOS_STARS) % 5 === 0) {
      // A tilted spiral disc with a compact stellar bulge, winding arms,
      // broken star-forming knots and genuine depth through the disc.
      const bulge = random() < 0.2;
      const radius = bulge ? Math.pow(random(), 2.4) * 4.5 : Math.pow(random(), 0.7) * 23;
      const arm = Math.floor(random() * 3);
      const theta = arm * Math.PI * 2 / 3 + radius * 0.23 + normal() * (bulge ? 2.5 : 0.18 + radius * 0.009);
      const a = Math.cos(theta) * radius;
      const b = Math.sin(theta) * radius;
      const rotation = -0.6;
      const x = 8 + a * Math.cos(rotation) - b * 0.68 * Math.sin(rotation);
      const y = -18 + a * Math.sin(rotation) + b * 0.68 * Math.cos(rotation);
      const z = 61 + b * 0.55 + normal() * (bulge ? 1.5 : 0.35);
      const strength = (bulge ? 0.18 : 0.32) * (0.4 + random() * 0.6);
      const cold = Math.min(1, radius / 10);
      const knot = 0.7 + Math.pow(noise(a * 0.4, b * 0.4, 17), 2) * 1.8;
      points.set([x, y, z, 0.65 + random() * 0.45,
        strength * (1.2 - cold * 0.52) * knot,
        strength * (0.83 + cold * 0.12) * knot,
        strength * (0.55 + cold * 0.9) * knot, 1], o);
    } else {
      let x = 0, y = 0, z = 0, density = 0, ridge = 0;
      // One connected turbulent field, with bent dark lanes running through
      // it. Its outline continues beyond the viewport; no four round clouds.
      for (let attempt = 0; attempt < 90; attempt++) {
        x = random() * 160 - 80;
        y = random() * 108 - 54;
        z = 65 + Math.sin(x * 0.065) * 9 + Math.cos(y * 0.075) * 6 + normal() * 2.2;
        const nx = x * 0.065, ny = y * 0.065, nz = z * 0.045;
        const wx = nx + (noise(nx * 0.55, ny * 0.55, nz) - 0.5) * 3.5;
        const wy = ny + (noise(nx * 0.55 + 21, ny * 0.55, nz) - 0.5) * 3.5;
        const coarse = turbulence(wx, wy, nz);
        ridge = Math.pow(1 - Math.abs(2 * noise(wx * 2.5, wy * 2.5, nz) - 1), 5);
        const envelope = Math.min(1,
          Math.exp(-Math.pow((x + 28) / 73, 2) - Math.pow((y - 16) / 42, 2)) +
          0.65 * Math.exp(-Math.pow((x - 18) / 48, 2) - Math.pow((y + 34) / 25, 2)));
        const laneA = y - (Math.sin(x * 0.075) * 15 + x * 0.12 - 2);
        const laneB = x - (Math.sin(y * 0.09) * 11 + y * 0.45 + 5);
        const cavities = (1 - Math.exp(-laneA * laneA / 24)) *
          (1 - Math.exp(-laneB * laneB / 18));
        density = Math.pow(Math.max(0, coarse - 0.27), 1.1) *
          (0.3 + ridge * 0.7) * envelope * cavities;
        if (random() < density * 2.8) break;
      }
      const diffuse = (i - COSMOS_STARS) % 5 === 1;
      const radius = diffuse ? 3.0 + random() * 2.0 : 0.5 + random() * 0.55;
      const brightness = Math.pow(density, 0.65) * (diffuse ? 0.12 : 1.2) *
        (0.5 + random() * 0.5);
      const copper = Math.max(0, Math.min(1, 0.5 + y * 0.025 + ridge * 0.2));
      const hot = Math.max(0, density - 0.22) * 2;
      points.set([x, y, z, radius,
        brightness * (0.22 + copper * 0.92 + hot),
        brightness * (0.58 + copper * 0.14 + hot),
        brightness * (0.91 - copper * 0.45 + hot), diffuse ? 1 : 2], o);
    }
  }
  return points;
}

/** Shared projection for the native 8K illustration and depth/parallax checks. */
export function projectCosmosPoint(x: number, y: number, z: number, width: number, height: number, cameraX = 0, cameraY = 0) {
  return {
    x: width * 0.5 + ((x - cameraX) / z) * height * 0.725,
    y: height * 0.5 + ((y - cameraY) / z) * height * 0.725,
  };
}
