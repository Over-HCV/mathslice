import { useMemo } from "react";
import { Mafs, Coordinates, Plot, useMovablePoint } from "mafs";
import "mafs/core.css";

/*
  MafsGraph — first-party interactive plot (replaces the old Recharts GraphBlock, which was a
  business-charting tool). `expr` is author-trusted JS of x (we write the MDX), so evaluating it
  is fine here — this is NOT the untrusted-code path (that's CodeRunner's sandbox). Island.
*/
export default function MafsGraph({
  expr = "Math.sin(x)",
  domain = [-4, 4] as [number, number],
}: {
  expr?: string;
  domain?: [number, number];
}) {
  const fn = useMemo<(x: number) => number>(() => {
    try {
      // eslint-disable-next-line no-new-func
      return new Function("x", `return (${expr});`) as (x: number) => number;
    } catch {
      return () => 0;
    }
  }, [expr]);

  const point = useMovablePoint([1, fn(1)]);

  return (
    <div className="my-6 overflow-hidden rounded-[var(--radius-md)] border border-border">
      <Mafs height={320} viewBox={{ x: domain, y: [-2.5, 2.5] }}>
        <Coordinates.Cartesian subdivisions={2} />
        <Plot.OfX y={(x) => fn(x)} color="var(--c-primary)" />
        {point.element}
      </Mafs>
    </div>
  );
}
