import {
  redLineCoords,    redLinePaths,    redLineStops,
  orangeLineCoords, orangeLinePaths, orangeLineStops,
  blueLineCoords,   blueLinePaths,   blueLineStops,
  greenLineCoords,  greenLinePaths,  greenLineStops,
  type StopPoint,
} from "@/lib/mapCoords";
import type { StopData } from "@/app/actions";

const RED    = "#DA291C";
const ORANGE = "#ED8B00";
const BLUE   = "#003DA5";
const GREEN  = "#00843D";

function toPoints(
  keys: string[],
  coords: Record<string, { x: number; y: number }>
): string {
  return keys.map((k) => `${coords[k].x},${coords[k].y}`).join(" ");
}

function renderLine(
  paths: Record<string, string[]>,
  coords: Record<string, { x: number; y: number }>,
  stops: StopPoint[],
  color: string,
  picks: Map<string, StopData>
) {
  return (
    <g>
      {Object.values(paths).map((path, i) => (
        <polyline
          key={i}
          points={toPoints(path, coords)}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {stops.map(({ key, name, labelSide }) => {
        const { x, y } = coords[key];
        const visited = picks.get(key)?.visited ?? false;
        let label: React.ReactNode;
        if (labelSide === "up") {
          label = (
            <text transform={`translate(${x},${y - 10}) rotate(-45)`}
              textAnchor="start" fontSize={14} fill="#374151">{name}</text>
          );
        } else if (labelSide === "down") {
          label = (
            <text transform={`translate(${x},${y + 10}) rotate(45)`}
              textAnchor="start" fontSize={14} fill="#374151">{name}</text>
          );
        } else {
          label = (
            <text
              x={x + (labelSide === "right" ? 12 : -12)} y={y} dy="0.35em"
              textAnchor={labelSide === "right" ? "start" : "end"}
              fontSize={14} fill="#374151">{name}</text>
          );
        }
        return (
          <g key={key}>
            <circle cx={x} cy={y} r={6}
              fill={visited ? color : "white"} stroke={color} strokeWidth={2} />
            {label}
          </g>
        );
      })}
    </g>
  );
}

export function SubwayMap({ picks }: { picks: Map<string, StopData> }) {
  return (
    <div className="overflow-auto bg-white rounded-xl border border-gray-200 p-4">
      {/* viewBox spans x=-700..700, y=0..1290 */}
      <svg viewBox="-700 0 1400 1290" className="w-full block" style={{ minWidth: 900 }}>
        {renderLine(greenLinePaths,  greenLineCoords,  greenLineStops,  GREEN,  picks)}
        {renderLine(redLinePaths,    redLineCoords,    redLineStops,    RED,    picks)}
        {renderLine(orangeLinePaths, orangeLineCoords, orangeLineStops, ORANGE, picks)}
        {renderLine(blueLinePaths,   blueLineCoords,   blueLineStops,   BLUE,   picks)}
      </svg>
    </div>
  );
}
