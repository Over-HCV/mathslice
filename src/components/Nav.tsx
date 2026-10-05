import { useEffect, useState } from "react";
import {
  loadIdentity,
  saveIdentity,
  buildStored,
  applyTheme,
  currentScheme,
  DEFAULT_IDENTITY,
  type ThemeMode,
} from "@/lib/identity";

type SectionKey = "home" | "explore" | "community" | "notes" | "faq" | "engine";

type NavSection = {
  key: SectionKey;
  label: string;
  href: string;
  active: boolean;
};

type Props = {
  brand: string;
  sections: NavSection[];
  altLocaleHref: string;
  altLocaleCode: string; // e.g. "EN"
  themeLabel: string;
  languageLabel: string;
};

/* Bespoke marks (React twins of Icon.astro), currentColor, 22px. */
function Mark({ name }: { name: SectionKey }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
          <path d="M12 9.6V4M12 14.4V20M9.6 12H4M14.4 12H20" />
          <path d="M10.3 10.3 6.5 6.5M13.7 13.7l3.8 3.8M13.7 10.3l3.8-3.8M10.3 13.7 6.5 17.5" opacity="0.5" />
        </svg>
      );
    case "explore":
      // a root node branching into columns — echoes the column tree
      return (
        <svg {...common}>
          <circle cx="4.5" cy="12" r="1.8" fill="currentColor" stroke="none" />
          <path d="M6.3 12h4M14 12h4" opacity="0.6" />
          <path d="M10.3 12v-4h1.4M10.3 12v4h1.4" opacity="0.6" />
          <rect x="17.6" y="4.5" width="4" height="4" rx="1" />
          <rect x="17.6" y="10" width="4" height="4" rx="1" />
          <rect x="17.6" y="15.5" width="4" height="4" rx="1" />
        </svg>
      );
    case "notes":
      // a document with a nib — authoring
      return (
        <svg {...common}>
          <path d="M6 3.5h7.5L18 8v12.5H6z" />
          <path d="M13.5 3.5V8H18" opacity="0.5" />
          <path d="M8.5 12h5M8.5 15.5h4" opacity="0.7" />
          <path d="M15.5 16.5l3.5-3.5 1.5 1.5-3.5 3.5H15.5z" fill="currentColor" stroke="none" opacity="0.9" />
        </svg>
      );
    case "community":
      return (
        <svg {...common}>
          <circle cx="6" cy="8" r="2.2" />
          <circle cx="18" cy="8" r="2.2" />
          <circle cx="12" cy="17" r="2.2" />
          <path d="M8 9l2.5 6.2M16 9l-2.5 6.2M8 8h8" opacity="0.6" />
        </svg>
      );
    case "faq":
      return (
        <svg {...common}>
          <path d="M15.5 8.5a3.5 3.5 0 1 0-1 5C11 15 12 17 12 18" />
          <circle cx="12" cy="21" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "engine":
      // a checklist of capabilities: two done, one still open
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="5" height="5" rx="1.2" fill="currentColor" stroke="none" />
          <rect x="3.5" y="14.5" width="5" height="5" rx="1.2" />
          <path d="M11.5 7h9M11.5 17h6" opacity="0.6" />
        </svg>
      );
  }
}

function SunMoon({ dark }: { dark: boolean }) {
  return dark ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export default function Nav({
  brand,
  sections,
  altLocaleHref,
  altLocaleCode,
  themeLabel,
  languageLabel,
}: Props) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = loadIdentity();
    const theme: ThemeMode = stored?.theme ?? "system";
    setDark(currentScheme(theme) === "dark");
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const stored = loadIdentity();
    const state = stored?.state ?? DEFAULT_IDENTITY;
    const next: ThemeMode = dark ? "light" : "dark";
    applyTheme(next, state);
    saveIdentity(buildStored(next, state));
    setDark(!dark);
  };

  const homeHref = sections.find((s) => s.key === "home")?.href ?? "/";

  return (
    <>
      {/* Desktop: floating vertical glass rail on the left, with margin (not edge-glued). */}
      <nav
        aria-label="Secciones"
        className="glass fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-[var(--radius)] p-2 md:flex"
      >
        <a href={homeHref} aria-label={brand} className="group relative flex h-11 w-11 items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-primary" aria-hidden>
            <circle cx="12" cy="12" r="9" opacity="0.35" />
            <path d="M12 12 L12 3 A9 9 0 0 1 20.5 15 Z" fill="currentColor" stroke="none" opacity="0.9" />
          </svg>
        </a>
        <span className="my-1 h-px w-7 bg-border" />

        {sections
          .filter((s) => s.key !== "home")
          .map((s) => (
            <a
              key={s.key}
              href={s.href}
              aria-current={s.active ? "page" : undefined}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
                s.active ? "bg-primary/12 text-primary" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Mark name={s.key} />
              <span className="glass pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium text-ink opacity-0 transition-opacity group-hover:opacity-100">
                {s.label}
              </span>
            </a>
          ))}

        <span className="mt-auto my-1 h-px w-7 bg-border" />
        <a
          href={altLocaleHref}
          aria-label={languageLabel}
          className="flex h-9 w-11 items-center justify-center rounded-[var(--radius-sm)] font-mono text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {altLocaleCode}
        </a>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={themeLabel}
          style={{ opacity: mounted ? 1 : 0 }}
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-ink-muted transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <SunMoon dark={dark} />
        </button>
      </nav>

      {/* Mobile: floating glass pill at the bottom, with margin (not glued to the edge). */}
      <nav
        aria-label="Secciones"
        className="glass fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-around gap-0.5 rounded-full px-1.5 py-1 md:hidden"
      >
        {sections.map((s) => (
          <a
            key={s.key}
            href={s.href}
            aria-current={s.active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[9px] font-medium transition-colors ${
              s.active ? "text-primary" : "text-ink-muted"
            }`}
          >
            <Mark name={s.key} />
            {s.label}
          </a>
        ))}
        <span className="mx-0.5 h-6 w-px bg-border" />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={themeLabel}
          style={{ opacity: mounted ? 1 : 0 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted"
        >
          <SunMoon dark={dark} />
        </button>
        <a
          href={altLocaleHref}
          aria-label={languageLabel}
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold text-ink-muted"
        >
          {altLocaleCode}
        </a>
      </nav>
    </>
  );
}
