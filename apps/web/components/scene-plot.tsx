"use client";

import { useRef } from "react";
import type { SubjectScene } from "@/lib/api/client";
import styles from "./subject-workspace.module.css";

const WIDTH = 640;
const HEIGHT = 360;
const PAD = 36;

/** [x, y]; y is null where the function is undefined (a gap in the curve). */
type Point = readonly (number | null)[];

function scale(min: number, max: number, from: number, to: number) {
  return (value: number) => from + ((value - min) / (max - min)) * (to - from);
}

function curvePaths(
  points: readonly Point[],
  x: (value: number) => number,
  y: (value: number) => number,
): string[] {
  const paths: string[] = [];
  let current: string[] = [];
  for (const [px, py] of points) {
    if (px == null || py == null) {
      if (current.length > 1) paths.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${current.length === 0 ? "M" : "L"}${x(px).toFixed(1)},${y(py).toFixed(1)}`);
  }
  if (current.length > 1) paths.push(current.join(" "));
  return paths;
}

function clampLine(
  x0: number,
  y0: number,
  slope: number,
  xMin: number,
  xMax: number,
): [number, number, number, number] {
  return [xMin, y0 + slope * (xMin - x0), xMax, y0 + slope * (xMax - x0)];
}

function Plot2D({ scene }: Readonly<{ scene: SubjectScene }>) {
  const axes = scene.axes;
  const curve = scene.curve;
  if (!axes || !curve) return null;
  const x = scale(axes.x.min, axes.x.max, PAD, WIDTH - PAD / 2);
  const y = scale(axes.y.min, axes.y.max, HEIGHT - PAD, PAD / 2);
  const zeroX = axes.x.min <= 0 && axes.x.max >= 0 ? x(0) : null;
  const zeroY = axes.y.min <= 0 && axes.y.max >= 0 ? y(0) : null;
  const tangent = scene.tangent;
  const tangentLine = tangent
    ? clampLine(tangent.x0, tangent.y0, tangent.slope, axes.x.min, axes.x.max)
    : null;
  return (
    <g>
      <rect fill="none" height={HEIGHT} width={WIDTH} />
      {zeroY !== null ? (
        <line className={styles.axis} x1={PAD} x2={WIDTH - PAD / 2} y1={zeroY} y2={zeroY} />
      ) : null}
      {zeroX !== null ? (
        <line className={styles.axis} x1={zeroX} x2={zeroX} y1={PAD / 2} y2={HEIGHT - PAD} />
      ) : null}
      <text className={styles.axisLabel} x={PAD} y={HEIGHT - 8}>
        {axes.x.min.toFixed(2)}
      </text>
      <text className={styles.axisLabel} textAnchor="end" x={WIDTH - PAD / 2} y={HEIGHT - 8}>
        {axes.x.max.toFixed(2)}
      </text>
      {(scene.riemann ?? []).map((item) => (
        <rect
          className={styles.riemann}
          height={Math.abs(y(item.height) - y(0))}
          key={item.x}
          width={Math.max(0.5, x(item.x + item.width) - x(item.x))}
          x={x(item.x)}
          y={Math.min(y(item.height), y(0))}
        />
      ))}
      {scene.limitPoint != null ? (
        <line
          className={styles.guide}
          x1={x(scene.limitPoint)}
          x2={x(scene.limitPoint)}
          y1={PAD / 2}
          y2={HEIGHT - PAD}
        />
      ) : null}
      {scene.limitValue != null ? (
        <line
          className={styles.guide}
          x1={PAD}
          x2={WIDTH - PAD / 2}
          y1={y(scene.limitValue)}
          y2={y(scene.limitValue)}
        />
      ) : null}
      {curvePaths(curve.points, x, y).map((path) => (
        <path className={styles.curve} d={path} key={path} />
      ))}
      {tangent && tangentLine ? (
        <>
          <line
            className={styles.tangent}
            x1={x(tangentLine[0])}
            x2={x(tangentLine[2])}
            y1={y(tangentLine[1])}
            y2={y(tangentLine[3])}
          />
          <circle className={styles.tangentPoint} cx={x(tangent.x0)} cy={y(tangent.y0)} r={5} />
        </>
      ) : null}
    </g>
  );
}

function Heatmap({ scene }: Readonly<{ scene: SubjectScene }>) {
  const surface = scene.surface;
  if (!surface) return null;
  const n = surface.z.length;
  const cell = Math.min((WIDTH - 2 * PAD) / n, (HEIGHT - 2 * PAD) / n);
  const left = (WIDTH - cell * n) / 2;
  const top = (HEIGHT - cell * n) / 2;
  const { min, max } = surface.zRange;
  return (
    <g>
      {surface.z.map((row, i) =>
        row.map((value, j) => {
          const t = value === null ? null : Math.min(1, Math.max(0, (value - min) / (max - min)));
          return (
            <rect
              fill={t === null ? "#20323b" : `hsl(${210 - 170 * t} 70% ${30 + 30 * t}%)`}
              height={cell}
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed grid position.
              key={`${i}-${j}`}
              width={cell}
              x={left + i * cell}
              y={top + (n - 1 - j) * cell}
            />
          );
        }),
      )}
      <text className={styles.axisLabel} x={left} y={top + n * cell + 16}>
        x ∈ [{surface.x.min.toFixed(1)}, {surface.x.max.toFixed(1)}], y ∈ [
        {surface.y.min.toFixed(1)}, {surface.y.max.toFixed(1)}]
      </text>
    </g>
  );
}

/** Interactive-web export: an SVG drawn from the same scene spec as the video. */
export function ScenePlot({ scene }: Readonly<{ scene: SubjectScene }>) {
  const svgRef = useRef<SVGSVGElement>(null);
  if (scene.kind === "steps_only") return null;

  function downloadSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "graf.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  const description =
    scene.kind === "surface_3d"
      ? "Mapa hodnot funkce dvou proměnných; světlejší barva znamená vyšší hodnotu."
      : "Graf funkce v okolí řešeného bodu.";
  return (
    <figure className="m-0 grid gap-2">
      <svg
        aria-label={`${scene.title}. ${description}`}
        className={styles.plot}
        ref={svgRef}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {scene.kind === "surface_3d" ? <Heatmap scene={scene} /> : <Plot2D scene={scene} />}
      </svg>
      <figcaption className={styles.actions}>
        <span className={styles.hint}>{description}</span>
        <button className={styles.secondaryButton} onClick={downloadSvg} type="button">
          Stáhnout SVG
        </button>
      </figcaption>
    </figure>
  );
}
