/*
  identity.ts — the single source of truth for MathSlice's switchable identity.

  The whole app is token-driven: every switchable visual property is a CSS custom
  property on :root (see src/styles/tokens.css). This module defines the *presets*,
  the function that writes a chosen identity onto :root (`applyIdentity`), and the
  persistence used by both the /visual-identity lab and the pre-paint ThemeBoot script.

  Nothing here touches the DOM at import time — safe to import from React islands and
  from plain modules alike. Color math (`contrast`, `wcagRating`) resolves any CSS
  color (including oklch) to sRGB via a canvas pixel read, so it is browser-only and
  guarded accordingly.
*/

export const STORAGE_KEY = "mathslice-identity";

export type ThemeMode = "light" | "dark" | "system";
export type Scheme = "light" | "dark";

export type TypographyPreset = {
  id: string;
  label: string;
  note: string;
  display: string;
  body: string;
  mono: string;
  tracking: number; // wordmark letter-spacing, em
  weight: number; // wordmark weight
};

type ColorSet = {
  bg: string;
  surface: string;
  ink: string;
  inkMuted: string;
  primary: string;
  primaryInk: string;
  accent: string;
  border: string;
};

export type Palette = {
  id: string;
  label: string;
  note: string;
  light: ColorSet;
  dark: ColorSet;
};

export type GlassLevel = {
  id: string;
  label: string;
  blur: number; // px
  opacityLight: number; // frost alpha in light theme
  opacityDark: number; // frost alpha in dark theme (lower — lets the moving bg glow through)
};

export type BackgroundMotif = "constellation" | "lattice" | "field" | "fluid";

/** Background motion. "auto" defers to OS reduce-motion (CSS handles it); the rest force a level. */
export type MotionLevel = "auto" | "off" | "calm" | "full";
export const MOTION_LEVELS: { id: MotionLevel; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "calm", label: "Calmo" },
  { id: "full", label: "Pleno" },
  { id: "off", label: "Off" },
];
const MOTION_VALUE: Record<MotionLevel, number | null> = {
  auto: null, // no inline token → CSS (incl. reduce-motion media query) governs
  off: 0,
  calm: 0.5,
  full: 1,
};

export type VoicePreset = {
  id: string;
  label: string;
  note: string;
  attrs: string[];
  say: string[];
  dont: string[];
  sample: { es: string; en: string };
};

export type IdentityState = {
  typography: string;
  palette: string;
  glass: string;
  radius: number; // rem
  motif: BackgroundMotif; // lab preview only; sections set their own
  voice: string;
  motion: MotionLevel;
};

/* ————————————————————————————— Presets ————————————————————————————— */

export const TYPOGRAPHY: TypographyPreset[] = [
  {
    id: "warm-serif",
    label: "Calidez con rigor",
    note: "Serif contemporánea (Fraunces) para titulares + sans humanista (Instrument) para lectura. Editorial, cálida, nada genérica.",
    display: '"Fraunces Variable", Georgia, serif',
    body: '"Instrument Sans Variable", system-ui, sans-serif',
    mono: '"JetBrains Mono Variable", ui-monospace, monospace',
    tracking: 0.12,
    weight: 600,
  },
  {
    id: "modern-sans",
    label: "Sistema moderno",
    note: "Un grotesco con carácter (Hanken) en todo. Más 'producto/app', limpio y técnico. Lo más seguro para UI densa.",
    display: '"Hanken Grotesk Variable", system-ui, sans-serif',
    body: '"Hanken Grotesk Variable", system-ui, sans-serif',
    mono: '"JetBrains Mono Variable", ui-monospace, monospace',
    tracking: 0.01,
    weight: 700,
  },
  {
    id: "expressive",
    label: "Alto carácter",
    note: "Serif de display apretada y con peso para grandes momentos tipográficos + grotesco de lectura. Marca fuerte; usar con disciplina.",
    display: '"Fraunces Variable", Georgia, serif',
    body: '"Hanken Grotesk Variable", system-ui, sans-serif',
    mono: '"JetBrains Mono Variable", ui-monospace, monospace',
    tracking: -0.01,
    weight: 700,
  },
];

export const PALETTES: Palette[] = [
  {
    id: "indigo-gold",
    label: "Índigo y oro",
    note: "Índigo profundo (rigor, confianza) con oro cálido de acento. Frío + cálido, complementarios.",
    light: {
      bg: "oklch(0.985 0.006 95)",
      surface: "oklch(1 0 0)",
      ink: "oklch(0.24 0.02 265)",
      inkMuted: "oklch(0.52 0.02 265)",
      primary: "oklch(0.52 0.16 265)",
      primaryInk: "oklch(0.99 0 0)",
      accent: "oklch(0.70 0.14 65)",
      border: "oklch(0.90 0.012 265)",
    },
    dark: {
      bg: "oklch(0.18 0.02 265)",
      surface: "oklch(0.225 0.025 265)",
      ink: "oklch(0.95 0.01 265)",
      inkMuted: "oklch(0.70 0.02 265)",
      primary: "oklch(0.70 0.15 265)",
      primaryInk: "oklch(0.17 0.02 265)",
      accent: "oklch(0.79 0.13 72)",
      border: "oklch(0.32 0.02 265)",
    },
  },
  {
    id: "forest",
    label: "Verde escribano",
    note: "Verde bosque profundo: patrimonio y crecimiento. Diferencial frente al mar de azules; oro apagado de acento.",
    light: {
      bg: "oklch(0.985 0.008 130)",
      surface: "oklch(1 0 0)",
      ink: "oklch(0.24 0.02 150)",
      inkMuted: "oklch(0.50 0.02 150)",
      primary: "oklch(0.46 0.11 155)",
      primaryInk: "oklch(0.99 0 0)",
      accent: "oklch(0.68 0.11 75)",
      border: "oklch(0.90 0.012 150)",
    },
    dark: {
      bg: "oklch(0.18 0.02 155)",
      surface: "oklch(0.225 0.022 155)",
      ink: "oklch(0.95 0.01 150)",
      inkMuted: "oklch(0.70 0.02 150)",
      primary: "oklch(0.68 0.12 155)",
      primaryInk: "oklch(0.17 0.02 155)",
      accent: "oklch(0.77 0.11 78)",
      border: "oklch(0.32 0.02 155)",
    },
  },
  {
    id: "mono",
    label: "Grafito",
    note: "Monocromo puro (chroma 0): del blanco al negro. Contraste alto y primario invertido — negro tinta sobre claro, blanco sobre oscuro. Sobrio, editorial, atemporal.",
    light: {
      bg: "oklch(0.982 0 0)",
      surface: "oklch(1 0 0)",
      ink: "oklch(0.20 0 0)",
      inkMuted: "oklch(0.50 0 0)",
      primary: "oklch(0.24 0 0)",
      primaryInk: "oklch(0.99 0 0)",
      accent: "oklch(0.55 0 0)",
      border: "oklch(0.89 0 0)",
    },
    dark: {
      bg: "oklch(0.17 0 0)",
      surface: "oklch(0.225 0 0)",
      ink: "oklch(0.96 0 0)",
      inkMuted: "oklch(0.70 0 0)",
      primary: "oklch(0.94 0 0)",
      primaryInk: "oklch(0.18 0 0)",
      accent: "oklch(0.68 0 0)",
      border: "oklch(0.33 0 0)",
    },
  },
  {
    id: "plum",
    label: "Vino y cobre",
    note: "Borgoña con cobre: tradición con temperatura. Distinguido sin ser sombrío.",
    light: {
      bg: "oklch(0.985 0.008 20)",
      surface: "oklch(1 0 0)",
      ink: "oklch(0.24 0.02 350)",
      inkMuted: "oklch(0.50 0.02 350)",
      primary: "oklch(0.44 0.14 5)",
      primaryInk: "oklch(0.99 0 0)",
      accent: "oklch(0.66 0.13 45)",
      border: "oklch(0.90 0.012 350)",
    },
    dark: {
      bg: "oklch(0.18 0.02 350)",
      surface: "oklch(0.225 0.024 350)",
      ink: "oklch(0.95 0.01 350)",
      inkMuted: "oklch(0.70 0.02 350)",
      primary: "oklch(0.66 0.15 8)",
      primaryInk: "oklch(0.17 0.02 350)",
      accent: "oklch(0.75 0.13 48)",
      border: "oklch(0.32 0.02 350)",
    },
  },
];

export const GLASS_LEVELS: GlassLevel[] = [
  { id: "subtle", label: "Sutil", blur: 14, opacityLight: 0.22, opacityDark: 0.06 },
  { id: "medium", label: "Medio", blur: 20, opacityLight: 0.3, opacityDark: 0.09 },
  { id: "heavy", label: "Intenso", blur: 28, opacityLight: 0.42, opacityDark: 0.15 },
];

export const MOTIFS: { id: BackgroundMotif; label: string; section: string }[] = [
  { id: "constellation", label: "Constelación", section: "Inicio" },
  { id: "lattice", label: "Retícula", section: "Descubre" },
  { id: "field", label: "Campo de flujo", section: "Aprende" },
  { id: "fluid", label: "Fluido", section: "Comunidad" },
];

export const VOICES: VoicePreset[] = [
  {
    id: "warm-mentor",
    label: "Mentor cercano",
    note: "Riguroso pero alentador. Habla en primera persona plural, invita a la curiosidad. Accesible sin infantilizar.",
    attrs: ["Cálido", "Riguroso", "Plural («exploremos»)", "Curioso"],
    say: [
      "«Miremos por qué esto tiene que ser cierto.»",
      "«Cambiar un solo axioma no lo rompe: da otra geometría.»",
      "«Prueba esto tú mismo — el código corre aquí.»",
    ],
    dont: ["«Trivialmente, se sigue que…»", "Jerga sin desempacar", "Tono de examen o de regaño"],
    sample: {
      es: "Durante 2000 años se intentó demostrar el 5º postulado. La respuesta llegó al revés: construyendo un mundo donde no vale — y funciona igual de bien.",
      en: "For 2000 years people tried to prove the 5th postulate. The answer came backwards: by building a world where it fails — and it works just as well.",
    },
  },
  {
    id: "rigorous",
    label: "Preciso",
    note: "Habla como matemático serio. Terminología exacta, confía en el lector, sin diluir.",
    attrs: ["Exacto", "Sobrio", "Denso", "Confiado"],
    say: ["«Sea φ una fórmula bien formada.»", "Enunciados y pruebas primero", "Notación precisa"],
    dont: ["Analogías blandas de más", "Emojis", "«Fácil», «obvio», «solo»"],
    sample: {
      es: "Un sistema de axiomas es consistente si no existe φ tal que φ y ¬φ sean ambos derivables. La independencia del 5º postulado se prueba exhibiendo un modelo de su negación.",
      en: "An axiom system is consistent iff no φ makes both φ and ¬φ derivable. The 5th postulate's independence is proved by exhibiting a model of its negation.",
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    note: "Energía de manifiesto. Frases con fuerza, cada tema es una historia que vale la pena contar.",
    attrs: ["Audaz", "Narrativo", "Opinado", "Memorable"],
    say: ["«Esto lo cambió todo.»", "Grandes momentos tipográficos", "Una idea por página"],
    dont: ["Muros de texto plano", "Neutralidad tibia", "Listas sin tensión"],
    sample: {
      es: "Dos mil años. Ese es el tiempo que la humanidad pasó intentando demostrar algo que, resultó, no necesitaba demostración — necesitaba desobediencia.",
      en: "Two thousand years. That's how long humanity spent trying to prove something that, it turned out, didn't need proof — it needed disobedience.",
    },
  },
];

export const DEFAULT_IDENTITY: IdentityState = {
  typography: "warm-serif",
  palette: "indigo-gold",
  glass: "medium",
  radius: 0.9,
  motif: "constellation",
  voice: "warm-mentor",
  motion: "auto",
};

/* ————————————————————————————— Lookups ————————————————————————————— */

const byId = <T extends { id: string }>(list: T[], id: string, fallback: T): T =>
  list.find((x) => x.id === id) ?? fallback;

export const getTypography = (id: string) => byId(TYPOGRAPHY, id, TYPOGRAPHY[0]);
export const getPalette = (id: string) => byId(PALETTES, id, PALETTES[0]);
export const getGlass = (id: string) => byId(GLASS_LEVELS, id, GLASS_LEVELS[1]);
export const getVoice = (id: string) => byId(VOICES, id, VOICES[0]);

/* ——————————————————————— Token resolution / apply ——————————————————————— */

/** Flat map of CSS custom property → value for a given identity + color scheme. */
export function resolveTokens(state: IdentityState, scheme: Scheme): Record<string, string> {
  const t = getTypography(state.typography);
  const c = getPalette(state.palette)[scheme];
  const g = getGlass(state.glass);
  const map: Record<string, string> = {
    "--f-display": t.display,
    "--f-body": t.body,
    "--f-mono": t.mono,
    "--wm-tracking": `${t.tracking}em`,
    "--wm-weight": String(t.weight),
    "--c-bg": c.bg,
    "--c-surface": c.surface,
    "--c-ink": c.ink,
    "--c-ink-muted": c.inkMuted,
    "--c-primary": c.primary,
    "--c-primary-ink": c.primaryInk,
    "--c-accent": c.accent,
    "--c-border": c.border,
    "--radius": `${state.radius}rem`,
    "--glass-blur": `${g.blur}px`,
    "--glass-opacity": String(scheme === "dark" ? g.opacityDark : g.opacityLight),
  };
  const motion = MOTION_VALUE[state.motion];
  // != null catches undefined too (older saved states may lack `motion`) so we never write "undefined".
  if (motion != null) map["--motion-level"] = String(motion);
  return map;
}

/** Write an identity onto :root live. Returns the flat token map (for persistence). */
export function applyIdentity(
  state: IdentityState,
  scheme: Scheme,
  root: HTMLElement = document.documentElement,
): Record<string, string> {
  const tokens = resolveTokens(state, scheme);
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
  // "auto" motion omits the token so the CSS reduce-motion media query governs — clear any stale inline value.
  if (!("--motion-level" in tokens)) root.style.removeProperty("--motion-level");
  return tokens;
}

/* ————————————————————————————— Persistence ————————————————————————————— */

/* Bump when the token model changes so stale saves (with old token values, e.g. the pre-M2
   glass-opacity model) are discarded instead of overriding the new defaults. */
export const IDENTITY_VERSION = 2;

export type StoredIdentity = {
  version: number;
  theme: ThemeMode;
  state: IdentityState;
  /* Pre-resolved token maps for both schemes, so the pre-paint ThemeBoot script can
     apply them instantly without importing the preset tables. */
  varsLight: Record<string, string>;
  varsDark: Record<string, string>;
};

/** Build the full persisted payload (state + both resolved token maps) from a state. */
export function buildStored(theme: ThemeMode, state: IdentityState): StoredIdentity {
  return {
    version: IDENTITY_VERSION,
    theme,
    state,
    varsLight: resolveTokens(state, "light"),
    varsDark: resolveTokens(state, "dark"),
  };
}

export function loadIdentity(): StoredIdentity | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIdentity;
    if (parsed.version !== IDENTITY_VERSION) {
      localStorage.removeItem(STORAGE_KEY); // discard stale schema
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdentity(stored: StoredIdentity) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function currentScheme(theme: ThemeMode): Scheme {
  if (theme === "system") {
    return typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

/** Apply a theme mode: set [data-theme] and re-resolve palette for that scheme. */
export function applyTheme(theme: ThemeMode, state: IdentityState) {
  const scheme = currentScheme(theme);
  const root = document.documentElement;
  root.dataset.theme = scheme;
  applyIdentity(state, scheme, root);
}

/* ——————————————————————— Color math (WCAG, browser-only) ——————————————————————— */

let _probe: CanvasRenderingContext2D | null = null;
function probe(): CanvasRenderingContext2D | null {
  if (_probe) return _probe;
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  _probe = cv.getContext("2d", { willReadFrequently: true });
  return _probe;
}

/** Resolve ANY CSS color (hex, rgb, oklch, named) to sRGB [r,g,b] 0..255. */
export function resolveRgb(css: string): [number, number, number] {
  const ctx = probe();
  if (!ctx) return [0, 0, 0];
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css; // invalid input silently keeps previous (#000)
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG 2.1 contrast ratio between two CSS colors. */
export function contrast(a: string, b: string): number {
  const l1 = relLuminance(resolveRgb(a));
  const l2 = relLuminance(resolveRgb(b));
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagRating = "AAA" | "AA" | "AA-large" | "fail";
export function wcagRating(ratio: number): WcagRating {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA-large";
  return "fail";
}
