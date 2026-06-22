"use client";

import { useState, useEffect, useRef } from "react";
import type { StopData } from "@/app/actions";
import { lines } from "@/lib/stops";
import { StopCard } from "./StopCard";

// ── Static lookups built from stops.ts ───────────────────────────────────────

const stopBranches = new Map<
  string,
  Array<{ branchId: string; stopId: string; lineColor: string }>
>();
const stopPrimary = new Map<
  string,
  { branchId: string; stopId: string; stopName: string; lineName: string; lineColor: string }
>();

for (const line of lines) {
  const groups = [
    ...(line.trunk ? [{ id: line.trunk.id, stops: line.trunk.stops }] : []),
    ...line.branches,
  ];
  for (const g of groups) {
    for (const stop of g.stops) {
      const arr = stopBranches.get(stop.id) ?? [];
      arr.push({ branchId: g.id, stopId: stop.id, lineColor: line.color });
      stopBranches.set(stop.id, arr);
      if (!stopPrimary.has(stop.id)) {
        stopPrimary.set(stop.id, {
          branchId: g.id, stopId: stop.id,
          stopName: stop.name, lineName: line.name, lineColor: line.color,
        });
      }
    }
  }
}

const LINE_IDS = ["line-red", "line-orange", "line-blue", "line-green"] as const;

const DARK_FILL: Record<string, string> = {
  "#DA291C": "#892216",
  "#ED8B00": "#B26B19",
  "#003DA5": "#172C55",
  "#00843D": "#1B5826",
};

const LIGHT_FILL: Record<string, string> = {
  "#DA291C": "#FFB2A8",
  "#ED8B00": "#F6BD7C",
  "#003DA5": "#6885BE",
  "#00843D": "#8FD09A",
};

// Returns dark color if visited, light color if restaurant added, null if empty
function getCircleColor(
  slug: string,
  picks: Map<string, StopData>,
  overrides: Map<string, boolean>
): string | null {
  let lightColor: string | null = null;
  for (const { branchId, stopId, lineColor } of stopBranches.get(slug) ?? []) {
    const key = `${branchId}:${stopId}`;
    const data = picks.get(key);
    const visited = overrides.has(key) ? overrides.get(key)! : (data?.visited ?? false);
    if (visited) return DARK_FILL[lineColor] ?? lineColor;
    if (data?.restaurant && !lightColor) lightColor = LIGHT_FILL[lineColor] ?? lineColor;
  }
  return lightColor;
}

function computeProgress(picks: Map<string, StopData>) {
  return lines.map(line => {
    const seen = new Set<string>();
    const visited = new Set<string>();
    const groups = [
      ...(line.trunk ? [{ id: line.trunk.id, stops: line.trunk.stops }] : []),
      ...line.branches,
    ];
    for (const g of groups) {
      for (const stop of g.stops) {
        seen.add(stop.id);
        if (picks.get(`${g.id}:${stop.id}`)?.visited) visited.add(stop.id);
      }
    }
    return { line, total: seen.size, visited: visited.size };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MapView({ picks }: { picks: Map<string, StopData> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapRef   = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml]       = useState("");
  const [mapReady, setMapReady]     = useState(false);
  const [activeLine, setActiveLine] = useState<string | null>(null);
  const [activeStop, setActiveStop] = useState<string | null>(null);
  const [visitedOverrides, setVisitedOverrides] = useState<Map<string, boolean>>(new Map());

  const tfRef    = useRef({ x: 0, y: 0, scale: 0.45 });
  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });
  const didDrag  = useRef(false);

  const applyTransform = () => {
    if (!svgWrapRef.current) return;
    const { x, y, scale } = tfRef.current;
    svgWrapRef.current.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  };

  // ── Fetch SVG ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/mbta-map.svg").then(r => r.text()).then(setSvgHtml);
  }, []);

  // ── Inject SVG once via ref — React never touches this div's innerHTML again ─
  useEffect(() => {
    if (!svgHtml || !svgWrapRef.current) return;
    svgWrapRef.current.innerHTML = svgHtml;
  }, [svgHtml]);

  // ── Centre on first load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgHtml || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const scale = Math.min(width / 2041, height / 1781) * 0.85;
    tfRef.current = {
      scale,
      x: (width  - 2041 * scale) / 2,
      y: (height - 1781 * scale) / 2,
    };
    applyTransform();
    setMapReady(true);
  }, [svgHtml]);

  // ── One-time SVG setup: store original attrs, set cursors ────────────────────
  useEffect(() => {
    if (!svgHtml || !svgWrapRef.current) return;
    const svg = svgWrapRef.current.querySelector("svg");
    if (!svg) return;

    svg.querySelectorAll<SVGCircleElement>("circle[id^='stop-']").forEach(circle => {
      circle.dataset.origFill   = circle.getAttribute("fill")   ?? "white";
      circle.dataset.origStroke = circle.getAttribute("stroke") ?? "";
    });

    for (const lineId of LINE_IDS) {
      const el = svg.querySelector<SVGElement>(`[id="${lineId}"]`);
      if (el) el.style.cursor = "pointer";
    }
    svg.querySelectorAll<SVGGElement>("g[id^='stop-group-']").forEach(el => {
      el.style.cursor = "pointer";
    });
  }, [svgHtml]);

  // ── Update circle fills whenever visited state changes ───────────────────────
  useEffect(() => {
    if (!svgHtml || !svgWrapRef.current) return;
    const svg = svgWrapRef.current.querySelector("svg");
    if (!svg) return;

    svg.querySelectorAll<SVGCircleElement>("circle[id^='stop-']").forEach(circle => {
      const slug  = circle.id.slice("stop-".length);
      const color = getCircleColor(slug, picks, visitedOverrides);
      if (color) {
        circle.setAttribute("fill", color);
        circle.setAttribute("stroke", color);
      } else {
        circle.setAttribute("fill", circle.dataset.origFill ?? "white");
        const orig = circle.dataset.origStroke ?? "";
        if (orig) circle.setAttribute("stroke", orig);
        else circle.removeAttribute("stroke");
      }
    });
  }, [svgHtml, picks, visitedOverrides]);

  // ── Line opacity ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgWrapRef.current) return;
    const svg = svgWrapRef.current.querySelector("svg");
    if (!svg) return;
    for (const lineId of LINE_IDS) {
      const el = svg.querySelector<SVGElement>(`[id="${lineId}"]`);
      if (!el) continue;
      const name = lineId.replace("line-", "");
      el.style.opacity = activeLine === null ? "1" : activeLine === name ? "1" : "0.1";
    }
  }, [activeLine, svgHtml]);

  // ── Escape key ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setActiveLine(null); setActiveStop(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const tf = tfRef.current;
      const newScale = Math.min(4, Math.max(0.1, tf.scale * factor));
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      tfRef.current = {
        scale: newScale,
        x: cx - (cx - tf.x) * (newScale / tf.scale),
        y: cy - (cy - tf.y) * (newScale / tf.scale),
      };
      applyTransform();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Pan ──────────────────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    didDrag.current  = false;
    lastPos.current  = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    tfRef.current.x += dx;
    tfRef.current.y += dy;
    applyTransform();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    e.currentTarget.style.cursor = "grab";
    requestAnimationFrame(() => { didDrag.current = false; });
  };

  // ── Single React onClick — traverse DOM up from click target ─────────────────
  const onMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (didDrag.current) return;
    let target: Element | null = e.target as Element;
    while (target && target !== e.currentTarget) {
      if (target.id?.startsWith("stop-group-")) {
        const slug = target.id.slice("stop-group-".length);
        setActiveStop(prev => prev === slug ? null : slug);
        return;
      }
      if ((LINE_IDS as readonly string[]).includes(target.id)) {
        const name = target.id.replace("line-", "");
        setActiveLine(prev => prev === name ? null : name);
        return;
      }
      target = target.parentElement;
    }
    setActiveLine(null);
    setActiveStop(null);
  };

  // ── Derived data ──────────────────────────────────────────────────────────────
  const progress       = computeProgress(picks);
  const overallTotal   = progress.reduce((s, p) => s + p.total,   0);
  const overallVisited = progress.reduce((s, p) => s + p.visited, 0);
  const panelLine  = activeLine ? lines.find(l => l.id === activeLine) ?? null : null;
  const activeMeta = activeStop  ? stopPrimary.get(activeStop) ?? null : null;
  const activeData = activeMeta
    ? picks.get(`${activeMeta.branchId}:${activeMeta.stopId}`) ?? null
    : null;

  const panelProgress = (() => {
    if (!panelLine) return { visited: 0, total: 0 };
    const seen = new Set<string>();
    let visitedCount = 0;
    const groups = [
      ...(panelLine.trunk ? [{ id: panelLine.trunk.id, stops: panelLine.trunk.stops }] : []),
      ...panelLine.branches,
    ];
    for (const g of groups) {
      for (const stop of g.stops) {
        if (seen.has(stop.id)) continue;
        seen.add(stop.id);
        const key = `${g.id}:${stop.id}`;
        const visited = visitedOverrides.has(key)
          ? visitedOverrides.get(key)!
          : (picks.get(key)?.visited ?? false);
        if (visited) visitedCount++;
      }
    }
    return { visited: visitedCount, total: seen.size };
  })();

  const makeOnVisitedChange = (key: string) => (visited: boolean) =>
    setVisitedOverrides(prev => new Map(prev).set(key, visited));

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#FDFCF7]">

      {/* ── Map canvas ─────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="absolute inset-0 select-none"
        style={{ cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onMapClick}
      >
        {/* SVG injected imperatively — React does not manage this div's innerHTML */}
        <div
          ref={svgWrapRef}
          style={{
            transformOrigin: "0 0",
            willChange: "transform",
            visibility: mapReady ? "visible" : "hidden",
          }}
        />
      </div>

      {/* ── Progress overlay — top-left ───────────────────────────────────── */}
      <div
        className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 min-w-[200px] pointer-events-none"
        style={{ maxWidth: 240 }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800">
            {overallVisited} / {overallTotal}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            {overallTotal > 0 ? Math.round((overallVisited / overallTotal) * 100) : 0}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex mb-3">
          {progress.map(({ line, visited }) =>
            visited > 0 ? (
              <div
                key={line.id}
                className="h-full"
                style={{ width: `${(visited / overallTotal) * 100}%`, backgroundColor: line.color }}
              />
            ) : null
          )}
        </div>
        <div className="space-y-1.5">
          {progress.map(({ line, visited, total }) => {
            const pct = total > 0 ? Math.round((visited / total) * 100) : 0;
            return (
              <div key={line.id} className="flex items-center gap-2">
                <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} />
                <span className="text-xs text-gray-500 w-14 shrink-0">
                  {line.name.replace(" Line", "")}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: line.color }}
                  />
                </div>
                <span className="text-xs text-gray-400 tabular-nums">{visited}/{total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Left slide-in panel ────────────────────────────────────────────── */}
      <div
        className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl flex flex-col z-20 transition-transform duration-300"
        style={{
          transform: panelLine ? "translateX(0)" : "translateX(-100%)",
          borderRight: panelLine ? `4px solid ${panelLine.color}` : "none",
        }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {panelLine && (
          <>
            <div className="shrink-0 px-4 pt-4 pb-3" style={{ backgroundColor: panelLine.color }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-white text-base leading-tight">{panelLine.name}</p>
                  <p className="text-white/80 text-xs mt-0.5">
                    {panelProgress.visited} / {panelProgress.total} visited
                  </p>
                </div>
                <button
                  onClick={() => { setActiveLine(null); setActiveStop(null); }}
                  className="text-white/70 hover:text-white text-xl leading-none mt-0.5"
                >×</button>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.25)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: panelProgress.total > 0
                      ? `${(panelProgress.visited / panelProgress.total) * 100}%`
                      : "0%",
                    backgroundColor: "rgba(255,255,255,0.85)",
                  }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {panelLine.trunk && panelLine.trunk.stops.map(stop => {
                const key = `${panelLine.trunk!.id}:${stop.id}`;
                return (
                  <StopCard
                    key={key}
                    branchId={panelLine.trunk!.id}
                    stopId={stop.id}
                    stopName={stop.name}
                    lineName={panelLine.name}
                    initialData={picks.get(key) ?? null}
                    onVisitedChange={makeOnVisitedChange(key)}
                  />
                );
              })}
              {panelLine.branches.map(branch => (
                <div key={branch.id}>
                  <p className="text-xs text-gray-400 font-medium px-1 pt-3 pb-1">{branch.name}</p>
                  <div className="space-y-2">
                    {branch.stops.map(stop => {
                      const key = `${branch.id}:${stop.id}`;
                      return (
                        <StopCard
                          key={key}
                          branchId={branch.id}
                          stopId={stop.id}
                          stopName={stop.name}
                          lineName={panelLine.name}
                          initialData={picks.get(key) ?? null}
                          onVisitedChange={makeOnVisitedChange(key)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Stop card — bottom-right overlay ───────────────────────────────── */}
      <div
        className={`absolute bottom-4 right-4 z-30 w-80 transition-all duration-200 ${
          activeMeta
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-3 pointer-events-none"
        }`}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        {activeMeta && (
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="px-3 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: activeMeta.lineColor }}>
                {activeMeta.lineName}
              </span>
              <button
                onClick={() => setActiveStop(null)}
                className="text-gray-400 hover:text-gray-600 text-base leading-none"
              >×</button>
            </div>
            <div className="p-2">
              <StopCard
                branchId={activeMeta.branchId}
                stopId={activeMeta.stopId}
                stopName={activeMeta.stopName}
                lineName={activeMeta.lineName}
                initialData={activeData}
                onVisitedChange={makeOnVisitedChange(`${activeMeta.branchId}:${activeMeta.stopId}`)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
