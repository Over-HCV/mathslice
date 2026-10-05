import KatexMath from "./KatexMath";

/*
  Latex — KaTeX rendering. Used in MDX WITHOUT a client: directive, so Astro renders it to
  static HTML at build (zero JS shipped). `inline` for in-sentence math, otherwise a centered
  block on a reading surface.
*/
export default function Latex({
  math,
  children,
  inline = false,
}: {
  math?: string;
  children?: string;
  inline?: boolean;
}) {
  const src = (math ?? children ?? "").trim();
  if (inline) return <KatexMath math={src} />;
  return (
    <div className="my-5 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface px-4 py-5 text-center">
      <KatexMath math={src} block />
    </div>
  );
}
