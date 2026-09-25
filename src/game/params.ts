export type ParamGroup = "Smoke" | "Blow" | "Motion" | "Look";

export interface SimParams {
  vorticity: number;
  buoyancy: number;
  smokeWeight: number;
  velDecay: number;
  smokeDecay: number;
  solverIters: number;
  dyeInject: number;
  turbulence: number;
  sharpen: number;
  blowForce: number;
  blowRadius: number;
  growRate: number;
  maxRadius: number;
  gravity: number;
  lift: number;
  drag: number;
  wind: number;
  filmDrain: number;
  iridescence: number;
  refraction: number;
  gloss: number;
  glassBody: number;
  filmBands: number;
}

export interface ParamField {
  key: keyof SimParams;
  label: string;
  group: ParamGroup;
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_PARAMS: SimParams = {
  vorticity: 6,
  buoyancy: 26,
  smokeWeight: 2,
  velDecay: 0.16,
  smokeDecay: 0.14,
  solverIters: 40,
  dyeInject: 0.42,
  turbulence: 2,
  sharpen: 0,
  blowForce: 120,
  blowRadius: 6,
  growRate: 42,
  maxRadius: 96,
  gravity: 18,
  lift: 42,
  drag: 1.6,
  wind: 6,
  filmDrain: 14,
  iridescence: 0.4,
  refraction: 0.2,
  gloss: 0.4,
  glassBody: 0.05,
  filmBands: 0.2,
};

export const PARAM_FIELDS: ParamField[] = [
  { key: "vorticity", label: "Vorticity", group: "Smoke", min: 0, max: 80, step: 1 },
  { key: "buoyancy", label: "Buoyancy", group: "Smoke", min: 0, max: 80, step: 1 },
  { key: "smokeWeight", label: "Weight", group: "Smoke", min: 0, max: 30, step: 1 },
  { key: "velDecay", label: "Vel decay", group: "Smoke", min: 0, max: 2, step: 0.01 },
  { key: "smokeDecay", label: "Smoke decay", group: "Smoke", min: 0, max: 2, step: 0.01 },
  { key: "solverIters", label: "Solver steps", group: "Smoke", min: 8, max: 48, step: 1 },
  { key: "dyeInject", label: "Dye inject", group: "Smoke", min: 0, max: 1.5, step: 0.05 },
  { key: "turbulence", label: "Turbulence", group: "Smoke", min: 0, max: 40, step: 1 },
  { key: "sharpen", label: "Sharpen", group: "Smoke", min: 0, max: 0.35, step: 0.01 },
  { key: "blowForce", label: "Blow force", group: "Blow", min: 20, max: 600, step: 5 },
  { key: "blowRadius", label: "Jet radius", group: "Blow", min: 3, max: 24, step: 1 },
  { key: "growRate", label: "Grow speed", group: "Blow", min: 10, max: 120, step: 1 },
  { key: "maxRadius", label: "Max size", group: "Blow", min: 40, max: 160, step: 1 },
  { key: "gravity", label: "Gravity", group: "Motion", min: 0, max: 80, step: 1 },
  { key: "lift", label: "Lift", group: "Motion", min: 0, max: 100, step: 1 },
  { key: "drag", label: "Drag", group: "Motion", min: 0.05, max: 5, step: 0.05 },
  { key: "wind", label: "Wind", group: "Motion", min: 0, max: 40, step: 1 },
  { key: "filmDrain", label: "Film drain", group: "Motion", min: 0, max: 60, step: 1 },
  { key: "iridescence", label: "Iridescence", group: "Look", min: 0, max: 2.5, step: 0.05 },
  { key: "refraction", label: "Refraction", group: "Look", min: 0, max: 1.5, step: 0.01 },
  { key: "gloss", label: "Gloss", group: "Look", min: 0, max: 2.5, step: 0.05 },
  { key: "glassBody", label: "Glass body", group: "Look", min: 0, max: 1, step: 0.01 },
  { key: "filmBands", label: "Film bands", group: "Look", min: 0, max: 2.5, step: 0.05 },
];

export const PARAM_GROUPS: ParamGroup[] = ["Smoke", "Blow", "Motion", "Look"];

const STORE_KEY = "fume-params-v8";
const PRESET_KEY = "fume-preset-kept";

function clampParam(field: ParamField, n: number): number {
  const v = Math.min(field.max, Math.max(field.min, n));
  if (field.step >= 1) return Math.round(v);
  const d = Math.round(v / field.step) * field.step;
  return Number(d.toFixed(4));
}

export function clampParams(input: Partial<SimParams> | null | undefined): SimParams {
  const next: SimParams = { ...DEFAULT_PARAMS };
  if (!input) return next;
  for (const field of PARAM_FIELDS) {
    const raw = input[field.key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      next[field.key] = clampParam(field, raw);
    }
  }
  return next;
}

export function loadParams(): SimParams {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_PARAMS };
    return clampParams(JSON.parse(raw) as Partial<SimParams>);
  } catch {
    return { ...DEFAULT_PARAMS };
  }
}

export function saveParams(params: SimParams) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(clampParams(params)));
  } catch {
    /* private mode */
  }
}

/** The tuned look, frozen. Reset returns here unless the user keeps a new one. */
export function loadPreset(): SimParams {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) {
      savePreset(DEFAULT_PARAMS);
      return { ...DEFAULT_PARAMS };
    }
    return clampParams(JSON.parse(raw) as Partial<SimParams>);
  } catch {
    return { ...DEFAULT_PARAMS };
  }
}

export function savePreset(params: SimParams) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(clampParams(params)));
  } catch {
    /* private mode */
  }
}

export function formatParam(n: number, step: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) n = 0;
  if (step >= 1) return String(Math.round(n));
  const digits = Math.max(0, Math.ceil(-Math.log10(step)));
  return n.toFixed(digits);
}

export function randomizeField(field: ParamField): number {
  const raw = field.min + Math.random() * (field.max - field.min);
  return clampParam(field, raw);
}

export function randomizeParams(params: SimParams, keys?: readonly (keyof SimParams)[]): SimParams {
  const next: SimParams = { ...params };
  const fields = keys ? PARAM_FIELDS.filter((f) => keys.includes(f.key)) : PARAM_FIELDS;
  for (const field of fields) {
    next[field.key] = randomizeField(field);
  }
  return next;
}

export function randomizeGroup(params: SimParams, group: ParamGroup): SimParams {
  return randomizeParams(
    params,
    PARAM_FIELDS.filter((f) => f.group === group).map((f) => f.key),
  );
}
