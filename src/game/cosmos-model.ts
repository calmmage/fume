/** A seeded volume of individual stars and luminous galactic dust, in world units. */
export const COSMOS_STARS = 14000;
export const COSMOS_DUST = 38000;
export const COSMOS_COUNT = COSMOS_STARS + COSMOS_DUST;

export function buildCosmosPoints(): Float32Array {
  let seed = 0x51a7c05;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const normal = () =>
    Math.sqrt(-2 * Math.log(Math.max(random(), 0.00001))) * Math.cos(random() * Math.PI * 2);
  const points = new Float32Array(COSMOS_COUNT * 8);
  for (let i = 0; i < COSMOS_COUNT; i++) {
    const o = i * 8;
    if (i < COSMOS_STARS) {
      // Continuous distance, rather than the same picture translated on a few planes.
      const z = 5 + Math.pow(random(), 0.55) * 155;
      const bright = Math.pow(random(), 5);
      const warm = random() < 0.18;
      points.set(
        [
          (random() - 0.5) * z * 5.8,
          (random() - 0.5) * z * 3.2,
          z,
          0.32 + bright * 1.38,
          (warm ? 1.0 : 0.7) * (0.3 + bright * 0.7),
          (warm ? 0.8 : 0.85) * (0.3 + bright * 0.7),
          (warm ? 0.62 : 1.0) * (0.3 + bright * 0.7),
          0,
        ],
        o,
      );
    } else {
      const t = random() * 2 - 1;
      const branch = Math.floor(random() * 3) - 1;
      const width = 0.55 + Math.pow(Math.sin(t * 3.4 + 0.4), 2) * 1.5;
      const ribbon = normal() * width;
      // Folded filaments occupy a 30-unit depth range. Cavities between them
      // remain black, giving the smoke a quiet central area and the sky detail.
      const x = t * 68 + normal() * 1.5;
      const y = -t * 21 + Math.sin(t * 5.6) * 3.0 + branch * 2.5 + ribbon;
      const z = 54 + Math.cos(t * 4.4 + branch * 1.3) * 12 + normal() * 2.1;
      const luminous = Math.pow(random(), 2) * 0.1;
      const hue = 0.5 + 0.5 * Math.sin(t * 3.2 + branch);
      points.set(
        [
          x,
          y,
          z,
          0.7 + random() * 2.0,
          luminous * (0.44 + hue * 0.5),
          luminous * (0.58 + (1 - hue) * 0.35),
          luminous * 1.25,
          1,
        ],
        o,
      );
    }
  }
  return points;
}

/** Shared projection for the 8K illustration and depth/parallax verification. */
export function projectCosmosPoint(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  cameraX = 0,
  cameraY = 0,
) {
  return {
    x: width * 0.5 + ((x - cameraX) / z) * height * 0.725,
    y: height * 0.5 + ((y - cameraY) / z) * height * 0.725,
  };
}
