import { useEffect, useMemo, useState } from "react";
import PhysicsBackground from "@/components/backgrounds/PhysicsBackground";
import {
  TYPOGRAPHY,
  PALETTES,
  GLASS_LEVELS,
  MOTIFS,
  MOTION_LEVELS,
  VOICES,
  DEFAULT_IDENTITY,
  getTypography,
  getPalette,
  getVoice,
  resolveTokens,
  applyIdentity,
  applyTheme,
  buildStored,
  saveIdentity,
  loadIdentity,
  contrast,
  wcagRating,
  type IdentityState,
  type Scheme,
  type BackgroundMotif,
} from "@/lib/identity";

type Tab = "type" | "color" | "surface" | "voice" | "apps";
const TABS: { id: Tab; label: string }[] = [
  { id: "type", label: "Tipografía" },
  { id: "color", label: "Color" },
  { id: "surface", label: "Superficie" },
  { id: "voice", label: "Identidad verbal" },
  { id: "apps", label: "Aplicaciones" },
];

const RATING_LABEL: Record<string, string> = {
  AAA: "AAA",
  AA: "AA",
  "AA-large": "AA grande",
  fail: "Insuficiente",
};

export default function IdentityLab() {
  const [state, setState] = useState<IdentityState>(DEFAULT_IDENTITY);
  const [scheme, setScheme] = useState<Scheme>("light");
  const [tab, setTab] = useState<Tab>("type");
  const [sampleLang, setSampleLang] = useState<"es" | "en">("es");
  const [toast, setToast] = useState("");

  // Load any saved identity; sync preview scheme to the live theme.
  useEffect(() => {
    const stored = loadIdentity();
    if (stored) setState({ ...DEFAULT_IDENTITY, ...stored.state });
    setScheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  // Apply live on every change — the whole app re-themes as you tweak.
  useEffect(() => {
    applyIdentity(state, scheme);
  }, [state, scheme]);

  const set = <K extends keyof IdentityState>(k: K, v: IdentityState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const tokens = useMemo(() => resolveTokens(state, scheme), [state, scheme]);
  const setColorScheme = (next: Scheme) => {
    setScheme(next);
    document.documentElement.dataset.theme = next;
  };

  const persist = () => {
    const theme = scheme;
    applyTheme(theme, state);
    saveIdentity(buildStored(theme, state));
    setToast("Identidad guardada como predeterminada");
    setTimeout(() => setToast(""), 2400);
  };

  const reset = () => {
    setState(DEFAULT_IDENTITY);
    setToast("Restablecido (recuerda guardar)");
    setTimeout(() => setToast(""), 2000);
  };

  const copyManual = async () => {
    const t = getTypography(state.typography);
    const p = getPalette(state.palette);
    const v = getVoice(state.voice);
    const c = p[scheme];
    const manual = `MANUAL DE IDENTIDAD — MathSlice
Tipografía: ${t.label} — display ${t.display}, body ${t.body}
Paleta: ${p.label} (${scheme})
  bg ${c.bg} · surface ${c.surface} · ink ${c.ink}
  primary ${c.primary} · accent ${c.accent} · border ${c.border}
Radio: ${state.radius}rem · Glass: ${state.glass}
Motivo de fondo: ${state.motif}
Voz: ${v.label} — ${v.attrs.join(", ")}`;
    try {
      await navigator.clipboard.writeText(manual);
      setToast("Manual copiado al portapapeles");
    } catch {
      setToast("No se pudo copiar");
    }
    setTimeout(() => setToast(""), 2400);
  };

  const contrastRows = useMemo(() => {
    const c = getPalette(state.palette)[scheme];
    const checks: { label: string; fg: string; bg: string }[] = [
      { label: "Texto sobre fondo", fg: c.ink, bg: c.bg },
      { label: "Texto sobre superficie", fg: c.ink, bg: c.surface },
      { label: "Texto tenue sobre fondo", fg: c.inkMuted, bg: c.bg },
      { label: "Texto sobre primario (botón)", fg: c.primaryInk, bg: c.primary },
      { label: "Acento sobre fondo", fg: c.accent, bg: c.bg },
    ];
    return checks.map((ch) => {
      const ratio = contrast(ch.fg, ch.bg);
      return { ...ch, ratio, rating: wcagRating(ratio) };
    });
  }, [state.palette, scheme]);

  const voice = getVoice(state.voice);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      {/* ————— Controls ————— */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="glass flex gap-1 overflow-x-auto p-1">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === tb.id ? "bg-primary text-primary-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Scheme toggle — always visible */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">Vista</span>
          <div className="flex overflow-hidden rounded-[var(--radius-sm)] border border-border">
            {(["light", "dark"] as Scheme[]).map((sc) => (
              <button
                key={sc}
                onClick={() => setColorScheme(sc)}
                className={`px-3 py-1 text-sm font-medium ${
                  scheme === sc ? "bg-primary text-primary-ink" : "text-ink-muted"
                }`}
              >
                {sc === "light" ? "Claro" : "Oscuro"}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface/70 rounded-[var(--radius)] border border-border p-4">
          {tab === "type" && (
            <div className="space-y-4">
              <Field label="Dirección tipográfica">
                <div className="space-y-2">
                  {TYPOGRAPHY.map((t) => (
                    <SelectCard
                      key={t.id}
                      on={state.typography === t.id}
                      onClick={() => set("typography", t.id)}
                      title={t.label}
                      note={t.note}
                    />
                  ))}
                </div>
              </Field>
              <Field label={`Tracking del wordmark — ${getTypography(state.typography).tracking.toFixed(2)}em`}>
                <input
                  type="range"
                  min={-0.02}
                  max={0.3}
                  step={0.01}
                  value={getTypography(state.typography).tracking}
                  onChange={() => {}}
                  disabled
                  className="w-full accent-[var(--c-primary)]"
                />
                <p className="mt-1 text-xs text-ink-muted">
                  El tracking se define por preset; edítalo por preset si quieres otro valor.
                </p>
              </Field>
            </div>
          )}

          {tab === "color" && (
            <div className="space-y-4">
              <Field label="Paletas">
                <div className="space-y-2">
                  {PALETTES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => set("palette", p.id)}
                      className={`flex w-full items-center gap-3 rounded-[var(--radius-sm)] border p-2.5 text-left transition-colors ${
                        state.palette === p.id ? "border-primary ring-1 ring-primary" : "border-border"
                      }`}
                    >
                      <span className="flex shrink-0 overflow-hidden rounded-md">
                        {["bg", "surface", "primary", "accent", "ink"].map((role) => (
                          <i
                            key={role}
                            className="block h-6 w-4"
                            style={{ background: (p[scheme] as any)[role] }}
                          />
                        ))}
                      </span>
                      <span>
                        <b className="block text-sm text-ink">{p.label}</b>
                        <span className="block text-xs text-ink-muted">{p.note}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Contraste (WCAG 2.1)">
                <table className="w-full text-sm">
                  <tbody>
                    {contrastRows.map((r) => (
                      <tr key={r.label} className="border-b border-border last:border-0">
                        <td className="py-1.5 text-ink-muted">{r.label}</td>
                        <td className="py-1.5 text-right font-mono text-xs text-ink">
                          {r.ratio.toFixed(2)}:1
                        </td>
                        <td className="py-1.5 pl-2 text-right">
                          <Badge rating={r.rating} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Field>
            </div>
          )}

          {tab === "surface" && (
            <div className="space-y-4">
              <Field label={`Radio — ${state.radius.toFixed(2)}rem`}>
                <input
                  type="range"
                  min={0}
                  max={1.6}
                  step={0.05}
                  value={state.radius}
                  onChange={(e) => set("radius", Number(e.target.value))}
                  className="w-full accent-[var(--c-primary)]"
                />
              </Field>
              <Field label="Intensidad del glass">
                <div className="flex overflow-hidden rounded-[var(--radius-sm)] border border-border">
                  {GLASS_LEVELS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => set("glass", g.id)}
                      className={`flex-1 py-1.5 text-sm font-medium ${
                        state.glass === g.id ? "bg-primary text-primary-ink" : "text-ink-muted"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Motivo de fondo (por sección)">
                <div className="grid grid-cols-2 gap-2">
                  {MOTIFS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => set("motif", m.id as BackgroundMotif)}
                      className={`rounded-[var(--radius-sm)] border p-2 text-left text-sm ${
                        state.motif === m.id ? "border-primary ring-1 ring-primary" : "border-border"
                      }`}
                    >
                      <b className="block text-ink">{m.label}</b>
                      <span className="text-xs text-ink-muted">{m.section}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Movimiento del fondo">
                <div className="flex overflow-hidden rounded-[var(--radius-sm)] border border-border">
                  {MOTION_LEVELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => set("motion", m.id)}
                      className={`flex-1 py-1.5 text-sm font-medium ${
                        state.motion === m.id ? "bg-primary text-primary-ink" : "text-ink-muted"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  «Auto» respeta el ajuste de reduce-motion del sistema (calmo). «Pleno» siempre
                  al máximo; «Off» lo detiene.
                </p>
              </Field>
            </div>
          )}

          {tab === "voice" && (
            <div className="space-y-4">
              <Field label="Arquetipo de voz">
                <div className="space-y-2">
                  {VOICES.map((v) => (
                    <SelectCard
                      key={v.id}
                      on={state.voice === v.id}
                      onClick={() => set("voice", v.id)}
                      title={v.label}
                      note={v.note}
                    />
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">Decimos</p>
                  <ul className="space-y-1">
                    {voice.say.map((x) => (
                      <li key={x} className="text-ink-muted">• {x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">No decimos</p>
                  <ul className="space-y-1">
                    {voice.dont.map((x) => (
                      <li key={x} className="text-ink-muted">• {x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === "apps" && (
            <p className="text-sm text-ink-muted">
              Vista de aplicación a la derecha: navegación, tarjeta de lectura y barra móvil se
              redibujan con cada cambio. Es la prueba de fuego de la identidad.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={persist}
            className="rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-sm font-semibold text-primary-ink"
          >
            Guardar como predeterminada
          </button>
          <button
            onClick={copyManual}
            className="glass rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold text-ink"
          >
            Copiar manual
          </button>
          <button
            onClick={reset}
            className="rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Restablecer
          </button>
        </div>
      </div>

      {/* ————— Live preview ————— */}
      <div className="space-y-5">
        {/* Motif preview box */}
        <div className="relative h-40 overflow-hidden rounded-[var(--radius)] border border-border bg-bg">
          <PhysicsBackground key={state.motif + scheme} variant={state.motif} bounded opacity={0.9} />
          <div className="relative z-10 flex h-full items-end p-4">
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-muted">
              Fondo · {MOTIFS.find((m) => m.id === state.motif)?.label}
            </span>
          </div>
        </div>

        {/* Nav sample */}
        <div className="glass flex items-center justify-between rounded-[var(--radius)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-5 w-5 rounded-full"
              style={{ background: tokens["--c-primary"] }}
            />
            <span
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--f-display)", letterSpacing: "var(--wm-tracking)" }}
            >
              MathSlice
            </span>
          </div>
          <div className="hidden gap-4 text-sm text-ink-muted sm:flex">
            <span className="text-primary">Descubre</span>
            <span>Aprende</span>
            <span>Comunidad</span>
          </div>
        </div>

        {/* Reading surface — NOT glass, so math stays legible */}
        <article className="rounded-[var(--radius)] border border-border bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Axiomas · a-origins</p>
          <h2 className="mt-2 text-3xl font-semibold text-ink" style={{ fontFamily: "var(--f-display)" }}>
            El postulado de las paralelas
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setSampleLang(sampleLang === "es" ? "en" : "es")}
              className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-ink-muted"
            >
              {sampleLang.toUpperCase()}
            </button>
            <span className="text-xs text-ink-muted">voz: {voice.label}</span>
          </div>
          <p className="mt-3 leading-relaxed text-ink" style={{ fontFamily: "var(--f-body)" }}>
            {voice.sample[sampleLang]}
          </p>
          <pre className="mt-4 overflow-x-auto rounded-[var(--radius-sm)] border border-border bg-bg p-3 text-sm text-ink" style={{ fontFamily: "var(--f-mono)" }}>
{`const consistent = !exists(phi => derivable(phi) && derivable(not(phi)));`}
          </pre>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="rounded-[var(--radius-sm)] bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
              Ejecutar
            </button>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `color-mix(in oklch, ${tokens["--c-accent"]}, transparent 82%)`, color: tokens["--c-accent"] }}>
              Interactivo
            </span>
          </div>
        </article>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ————— small building blocks ————— */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

function SelectCard({
  on,
  onClick,
  title,
  note,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-[var(--radius-sm)] border p-3 text-left transition-colors ${
        on ? "border-primary ring-1 ring-primary" : "border-border hover:border-ink-muted"
      }`}
    >
      <b className="block text-sm text-ink">{title}</b>
      <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{note}</span>
    </button>
  );
}

function Badge({ rating }: { rating: string }) {
  const styles: Record<string, string> = {
    AAA: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    AA: "bg-lime-500/15 text-lime-700 dark:text-lime-400",
    "AA-large": "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    fail: "bg-red-500/15 text-red-600 dark:text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[rating]}`}>
      {RATING_LABEL[rating]}
    </span>
  );
}
