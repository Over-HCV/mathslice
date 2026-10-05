/*
  i18n — minimal, typed UI dictionary. Content lives in Content Collections; this is only
  the shell chrome (nav, toggles, section blurbs). Slugs are shared across locales (Spanish
  slugs) so routing stays simple; only the visible strings differ. Voice = "warm mentor".
*/
import type { AtomKind } from "@/lib/notes/model";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export type SectionKey = "home" | "explore" | "community" | "notes" | "faq" | "engine";

/** Shared route slug per section (same for every locale). Home is the locale root. */
/*
  The three levels of abstraction every leaf topic is written in — see
  media/maths/CONTENT-FRAMEWORK.md. Reading order is know → info → data (high to low), which is
  the reverse of the file numbering (00-data, 01-info, 02-know): the files are numbered bottom-up
  because that is how the substrate builds, the reader arrives top-down.
*/
export const LEVELS = ["know", "info", "data"] as const;
export type Level = (typeof LEVELS)[number];

/** The entry level has no slug of its own — it IS the topic URL. */
export const LEVEL_SLUG: Record<Level, string> = {
  know: "",
  info: "informacion",
  data: "dato",
};

/** Which file in a topic folder holds each level. */
export const LEVEL_FILE: Record<Level, string> = {
  know: "02-know.md",
  info: "01-info.md",
  data: "00-data.md",
};

export const SECTION_SLUG: Record<Exclude<SectionKey, "home">, string> = {
  explore: "explorar",
  community: "comunidad",
  notes: "anotaciones",
  faq: "faq",
  engine: "motor",
};

type Dict = {
  brand: string;
  tagline: string;
  nav: Record<SectionKey, string>;
  sections: Record<SectionKey, { title: string; blurb: string }>;
  ui: {
    theme: string;
    language: string;
    menu: string;
    comingSoon: string;
    readTopic: string;
    skipToContent: string;
    tabTopics: string;
    tabProblems: string;
    newDoc: string;
    noDocs: string;
  };
  /*
    /motor — the engine's capability tree. Capability names themselves never pass through
    here: they come in English from the capability inventory and are the id that joins the
    corpus to engine/docs/. Only the chrome is translated.
  */
  engine: {
    coverage: string;
    ofTotal: string;
    capabilities: string;
    /** Singular and plural: "1 caso" reads wrong as "1 casos". */
    case: string;
    cases: string;
    noCases: string;
    run: string;
    running: string;
    matches: string;
    mismatch: string;
    expected: string;
    got: string;
    reindexedNote: string;
    backToIndex: string;
  };
  /*
    Topic pages and the notes editor render the SAME documents, so the vocabulary of a document
    lives here rather than in either host — otherwise an atom would be labelled "Definición" in
    one and something else in the other. Level names are the three of CONTENT-FRAMEWORK.md.
  */
  topic: {
    levels: Record<Level, string>;
    /** Shown under the level name: what the reader gets by descending. */
    levelBlurbs: Record<Level, string>;
    atomKinds: Record<AtomKind, string>;
    /** The page is rendered in the default locale because this one has no file yet. */
    untranslated: string;
    /** Heading over an atom's prerequisites. */
    needs: string;
    /** Back from an atom's own page to the level it was declared in. */
    inLevel: string;
    /** The peek panel's chrome. Passed to the island as a prop rather than baked into every peek
     *  JSON: seven short strings once per page, not once per document. */
    peek: {
      /** Accessible name of the panel itself. */
      title: string;
      close: string;
      back: string;
      /** The ⤢ control: leave the panel, open the whole page. */
      expand: string;
      loading: string;
      /** Shown when the document behind a ref could not be fetched. */
      error: string;
    };
  };
};

export const STRINGS: Record<Locale, Dict> = {
  es: {
    brand: "MathSlice",
    tagline: "Las matemáticas, para tocarlas.",
    nav: {
      home: "Inicio",
      explore: "Explorar",
      community: "Comunidad",
      notes: "Anotaciones",
      faq: "FAQ",
      engine: "Motor",
    },
    sections: {
      home: {
        title: "Las matemáticas, para tocarlas",
        blurb:
          "Cada idea explicada con artefactos que puedes ejecutar, mover y comprobar — no solo leer.",
      },
      explore: {
        title: "Explora las matemáticas",
        blurb: "El árbol vivo de temas y los problemas diarios para aprender resolviendo.",
      },
      community: {
        title: "Comunidad",
        blurb: "Explicaciones creadas por otras personas. Pronto podrás crear las tuyas.",
      },
      notes: {
        title: "Anotaciones",
        blurb: "Crea tus propios documentos explicativos con artefactos: texto, LaTeX, código, gráficas.",
      },
      faq: {
        title: "Preguntas frecuentes",
        blurb: "Qué es MathSlice, cómo funciona y hacia dónde va.",
      },
      engine: {
        title: "El motor, capacidad a capacidad",
        blurb:
          "Qué sabe calcular ya el motor y qué no, con los casos que lo prueban corriendo aquí mismo.",
      },
    },
    ui: {
      theme: "Tema",
      language: "Idioma",
      menu: "Menú",
      comingSoon: "En construcción",
      readTopic: "Leer tema",
      skipToContent: "Saltar al contenido",
      tabTopics: "Temas",
      tabProblems: "Problemas",
      newDoc: "Nuevo documento",
      noDocs: "Aún no tienes documentos. Crea el primero.",
    },
    engine: {
      coverage: "Cobertura",
      ofTotal: "de",
      capabilities: "capacidades",
      case: "caso",
      cases: "casos",
      noCases: "Sin casos aún",
      run: "Ejecutar",
      running: "Ejecutando…",
      matches: "Coincide",
      mismatch: "No coincide",
      expected: "Se esperaba",
      got: "Salió",
      reindexedNote:
        "Índice curricular: re-etiqueta por grado capacidades ya contadas en las demás categorías, así que no suma al total.",
      backToIndex: "← Todas las categorías",
    },
    topic: {
      levels: { know: "Conocimiento", info: "Información", data: "Dato" },
      levelBlurbs: {
        know: "La historia, el porqué y para qué sirve.",
        info: "Las relaciones: cómo una pieza se sigue de otra.",
        data: "Las definiciones exactas, una por una.",
      },
      untranslated: "Todavía sin traducir — se muestra la versión en español.",
      needs: "Necesita",
      inLevel: "Declarado en",
      peek: {
        title: "Vista rápida",
        close: "Cerrar",
        back: "Volver",
        expand: "Abrir la página completa",
        loading: "Cargando…",
        error: "No se pudo cargar esto aquí.",
      },
      atomKinds: {
        definition: "Definición",
        axiom: "Axioma",
        theorem: "Teorema",
        lemma: "Lema",
        property: "Propiedad",
        notation: "Notación",
        example: "Ejemplo",
      },
    },
  },
  en: {
    brand: "MathSlice",
    tagline: "Mathematics, made tangible.",
    nav: {
      home: "Home",
      explore: "Explore",
      community: "Community",
      notes: "Notes",
      faq: "FAQ",
      engine: "Engine",
    },
    sections: {
      home: {
        title: "Mathematics, made tangible",
        blurb:
          "Every idea explained with artifacts you can run, drag and verify — not just read.",
      },
      explore: {
        title: "Explore mathematics",
        blurb: "The living topic tree and daily problems to learn by solving.",
      },
      community: {
        title: "Community",
        blurb: "Explanations made by other people. Soon you'll create your own.",
      },
      notes: {
        title: "Notes",
        blurb: "Create your own explanatory documents with artifacts: text, LaTeX, code, graphs.",
      },
      faq: {
        title: "FAQ",
        blurb: "What MathSlice is, how it works and where it's headed.",
      },
      engine: {
        title: "The engine, capability by capability",
        blurb:
          "What the engine can already compute and what it cannot, with the cases that prove it running right here.",
      },
    },
    ui: {
      theme: "Theme",
      language: "Language",
      menu: "Menu",
      comingSoon: "Under construction",
      readTopic: "Read topic",
      skipToContent: "Skip to content",
      tabTopics: "Topics",
      tabProblems: "Problems",
      newDoc: "New document",
      noDocs: "No documents yet. Create your first one.",
    },
    engine: {
      coverage: "Coverage",
      ofTotal: "of",
      capabilities: "capabilities",
      case: "case",
      cases: "cases",
      noCases: "No cases yet",
      run: "Run",
      running: "Running…",
      matches: "Matches",
      mismatch: "Mismatch",
      expected: "Expected",
      got: "Got",
      reindexedNote:
        "Curricular index: it re-labels by school grade capabilities already counted in the other categories, so it does not add to the total.",
      backToIndex: "← All categories",
    },
    topic: {
      levels: { know: "Knowledge", info: "Information", data: "Data" },
      levelBlurbs: {
        know: "The story, the why and what it is for.",
        info: "The relations: how one piece follows from another.",
        data: "The exact definitions, one at a time.",
      },
      untranslated: "Not translated yet — showing the Spanish version.",
      needs: "Needs",
      inLevel: "Declared in",
      peek: {
        title: "Quick look",
        close: "Close",
        back: "Back",
        expand: "Open the full page",
        loading: "Loading…",
        error: "This could not be loaded here.",
      },
      atomKinds: {
        definition: "Definition",
        axiom: "Axiom",
        theorem: "Theorem",
        lemma: "Lemma",
        property: "Property",
        notation: "Notation",
        example: "Example",
      },
    },
  },
};

export function t(locale: string | undefined): Dict {
  return STRINGS[(locale as Locale) in STRINGS ? (locale as Locale) : DEFAULT_LOCALE];
}

/** Path for a section in a given locale. Home → locale root. */
export function sectionPath(section: SectionKey, locale: Locale): string {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  if (section === "home") return prefix || "/";
  return `${prefix}/${SECTION_SLUG[section]}`;
}
