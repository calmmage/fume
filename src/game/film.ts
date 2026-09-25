/**
 * Thin-film interference for a soap bubble (air | soap | air).
 *
 * Light reflecting from the front surface picks up a π phase shift
 * (low-to-high index). The back surface does not. Result: a vanishingly
 * thin film is dark (Newton's black film), and visible wavelengths
 * construct / destruct as thickness changes — the rainbow.
 *
 * Optical path ≈ 2 n d. Intensity ~ sin²(2π n d / λ).
 */

const N_SOAP = 1.33;
const THICKNESS_MAX_NM = 1400;

export const FILM_LUT_SIZE = 512;
export const FILM_THICKNESS_MAX = THICKNESS_MAX_NM;

/** Piecewise linear approximation of CIE RGB, returned in linear space. */
function wavelengthRgb(lambda: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (lambda >= 380 && lambda < 440) {
    r = -(lambda - 440) / (440 - 380);
    b = 1;
  } else if (lambda >= 440 && lambda < 490) {
    g = (lambda - 440) / (490 - 440);
    b = 1;
  } else if (lambda >= 490 && lambda < 510) {
    g = 1;
    b = -(lambda - 510) / (510 - 490);
  } else if (lambda >= 510 && lambda < 580) {
    r = (lambda - 510) / (580 - 510);
    g = 1;
  } else if (lambda >= 580 && lambda < 645) {
    r = 1;
    g = -(lambda - 645) / (645 - 580);
  } else if (lambda >= 645 && lambda <= 780) {
    r = 1;
  }

  let falloff = 1;
  if (lambda > 700) falloff = 0.3 + (0.7 * (780 - lambda)) / 80;
  else if (lambda < 420) falloff = 0.3 + (0.7 * (lambda - 380)) / 40;

  return [r * falloff, g * falloff, b * falloff];
}

function soapLinearRgb(thicknessNm: number): [number, number, number] {
  if (thicknessNm < 6) return [0, 0, 0];

  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let lambda = 380; lambda <= 700; lambda += 5) {
    const [sr, sg, sb] = wavelengthRgb(lambda);
    const phase = (4 * Math.PI * N_SOAP * thicknessNm) / lambda;
    const s = Math.sin(phase * 0.5);
    const intensity = s * s;
    r += intensity * sr;
    g += intensity * sg;
    b += intensity * sb;
    weight += 1;
  }
  r /= weight;
  g /= weight;
  b /= weight;

  const absorb = Math.exp(-thicknessNm / 2200);
  r *= absorb;
  g *= absorb * 0.97;
  b *= absorb * 0.9;

  r *= 1.45;
  g *= 1.45;
  b *= 1.45;

  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = 1.95;
  r = lum + (r - lum) * sat;
  g = lum + (g - lum) * sat;
  b = lum + (b - lum) * sat;
  return [r, g, b];
}

function toneMap(c: number): number {
  const x = c / (1 + c * 0.28);
  return Math.min(1, Math.max(0, x));
}

export function soapSrgb(thicknessNm: number): [number, number, number] {
  const [r, g, b] = soapLinearRgb(thicknessNm);
  const gamma = 1 / 2.2;
  return [toneMap(r) ** gamma, toneMap(g) ** gamma, toneMap(b) ** gamma];
}

/** 512×1 RGBA8 lookup, u = thickness / FILM_THICKNESS_MAX. */
export function buildFilmLut(): Uint8Array {
  const data = new Uint8Array(FILM_LUT_SIZE * 4);
  for (let i = 0; i < FILM_LUT_SIZE; i++) {
    const d = (i / (FILM_LUT_SIZE - 1)) * THICKNESS_MAX_NM;
    const [r, g, b] = soapSrgb(d);
    const o = i * 4;
    data[o] = Math.round(r * 255);
    data[o + 1] = Math.round(g * 255);
    data[o + 2] = Math.round(b * 255);
    data[o + 3] = 255;
  }
  return data;
}
