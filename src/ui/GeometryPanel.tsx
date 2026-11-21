/**
 * The Geometry chevron row (spec 4.3; plan M4-T6, D21, D24): only the rows for the current type
 * (6.6 rule 2). Linear: Angle (dial, field, presets every 45 degrees). Radial: Shape, Size, Center.
 * Conic: Start angle and Center. Every type: Reverse and Mirror. A row that differs from its default
 * shows a reset icon; the header shows a count and a reset-all (M3 decision 58). Every change is one
 * undo step, and a dial drag is one step.
 */
import { RotateCcw } from "lucide-preact";
import { ANGLE_PRESETS } from "../gradient/geometry";
import { DEFAULT_GRADIENT } from "../state/defaults";
import { setGradient } from "../state/gradient";
import { begin, end } from "../state/history";
import { gradient } from "../state/signals";
import type { Geometry, GradientType } from "../types";
import { AngleDial } from "./AngleDial";
import { ChevronRow } from "./ChevronRow";
import { NumberField } from "./NumberField";
import { SettingRow } from "./SettingRow";
import { Select } from "./SettingsControls";
import { Slider } from "./Slider";
import { Toggle } from "./Toggle";

const DEFAULTS: Geometry = DEFAULT_GRADIENT.geometry;

/** A geometry row: which fields it owns, so it can tell whether it differs and reset itself. */
interface GeometryRowSpec {
  key: string;
  label: string;
  types: readonly GradientType[];
  reset: (g: Geometry) => Geometry;
}

const ALL: readonly GradientType[] = ["linear", "radial", "conic"];

const ROWS: readonly GeometryRowSpec[] = [
  {
    key: "angle",
    label: "Angle",
    types: ["linear"],
    reset: (g) => ({ ...g, angle: DEFAULTS.angle }),
  },
  {
    key: "from",
    label: "Start angle",
    types: ["conic"],
    reset: (g) => ({ ...g, from: DEFAULTS.from }),
  },
  {
    key: "shape",
    label: "Shape",
    types: ["radial"],
    reset: (g) => ({ ...g, shape: DEFAULTS.shape }),
  },
  { key: "size", label: "Size", types: ["radial"], reset: (g) => ({ ...g, size: DEFAULTS.size }) },
  {
    key: "center-x",
    label: "Center X",
    types: ["radial", "conic"],
    reset: (g) => ({ ...g, center: { ...g.center, x: DEFAULTS.center.x } }),
  },
  {
    key: "center-y",
    label: "Center Y",
    types: ["radial", "conic"],
    reset: (g) => ({ ...g, center: { ...g.center, y: DEFAULTS.center.y } }),
  },
  {
    key: "reverse",
    label: "Reverse",
    types: ALL,
    reset: (g) => ({ ...g, reverse: DEFAULTS.reverse }),
  },
  { key: "mirror", label: "Mirror", types: ALL, reset: (g) => ({ ...g, mirror: DEFAULTS.mirror }) },
];

const rowOf = (key: string): GeometryRowSpec => ROWS.find((r) => r.key === key) as GeometryRowSpec;

const differs = (row: GeometryRowSpec, g: Geometry): boolean =>
  JSON.stringify(row.reset(g)) !== JSON.stringify(g);

/** The rows shown for `type` whose value differs from the default. */
export function changedGeometryRows(type: GradientType, g: Geometry): string[] {
  return ROWS.filter((r) => r.types.includes(type) && differs(r, g)).map((r) => r.key);
}

function change(patch: Partial<Geometry>, label: string): void {
  const g = gradient.peek();
  const next = { ...g.geometry, ...patch };
  if (JSON.stringify(next) === JSON.stringify(g.geometry)) return;
  setGradient({ geometry: next }, label);
}

function resetRows(type: GradientType): void {
  const g = gradient.peek();
  let next = g.geometry;
  for (const row of ROWS) if (row.types.includes(type)) next = row.reset(next);
  if (JSON.stringify(next) === JSON.stringify(g.geometry)) return;
  setGradient({ geometry: next }, "Reset geometry");
}

function ResetButton({ rowKey }: { rowKey: string }) {
  const row = rowOf(rowKey);
  if (!differs(row, gradient.value.geometry)) return null;
  return (
    <button
      type="button"
      class="reset-icon"
      data-testid="geometry-reset-row"
      data-row-key={rowKey}
      aria-label={`Reset ${row.label}`}
      onClick={() => {
        const g = gradient.peek();
        const next = row.reset(g.geometry);
        setGradient({ geometry: next }, `Reset ${row.label}`);
      }}
    >
      <RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} />
    </button>
  );
}

function AngleRow({ field, label }: { field: "angle" | "from"; label: string }) {
  const value = gradient.value.geometry[field];
  const id = `geometry-${field}`;
  const name = field === "angle" ? "Angle" : "Start angle";
  return (
    <SettingRow label={label} htmlFor={`${id}-field`} reset={<ResetButton rowKey={field} />}>
      <span class="angle-control">
        <AngleDial
          id={`${id}-dial`}
          label={`${name} dial`}
          value={value}
          onChange={(angle) => change({ [field]: angle }, name)}
          onDragStart={begin}
          onDragEnd={() => end()}
        />
        <NumberField
          id={`${id}-field`}
          value={value}
          min={0}
          max={360}
          deferred
          onCommit={(n) => change({ [field]: n % 360 }, name)}
        />
      </span>
    </SettingRow>
  );
}

function Presets() {
  const angle = gradient.value.geometry.angle;
  return (
    <fieldset class="angle-presets" data-testid="angle-presets">
      <legend class="visually-hidden">Angle presets</legend>
      {ANGLE_PRESETS.map((p) => (
        <button
          key={p}
          type="button"
          class="chip"
          aria-pressed={angle === p}
          onClick={() => change({ angle: p }, "Angle")}
        >
          {`${p}°`}
        </button>
      ))}
    </fieldset>
  );
}

const SIZES: ReadonlyArray<{ value: Geometry["size"]; label: string }> = [
  { value: "closest-side", label: "Closest side" },
  { value: "closest-corner", label: "Closest corner" },
  { value: "farthest-side", label: "Farthest side" },
  { value: "farthest-corner", label: "Farthest corner" },
];

function CenterRows() {
  const g = gradient.value.geometry;
  return (
    <>
      {(["x", "y"] as const).map((axis) => (
        <SettingRow
          key={axis}
          label={`Center ${axis.toUpperCase()} %`}
          htmlFor={`geometry-center-${axis}`}
          reset={<ResetButton rowKey={`center-${axis}`} />}
        >
          <Slider
            id={`geometry-center-${axis}`}
            label={`Center ${axis.toUpperCase()} slider`}
            value={Math.round(g.center[axis] * 100)}
            min={0}
            max={100}
            deferred
            onChange={(v) =>
              change({ center: { ...gradient.peek().geometry.center, [axis]: v / 100 } }, "Center")
            }
            onDragStart={begin}
            onDragEnd={() => end()}
          />
        </SettingRow>
      ))}
    </>
  );
}

export function GeometryPanel() {
  const g = gradient.value;
  const geo = g.geometry;
  return (
    <div class="geometry-panel" data-testid="geometry-panel" data-type={g.type}>
      {g.type === "linear" && (
        <>
          <AngleRow field="angle" label="Angle" />
          <Presets />
        </>
      )}
      {g.type === "radial" && (
        <>
          <SettingRow label="Shape" reset={<ResetButton rowKey="shape" />}>
            <fieldset class="segmented">
              <legend class="visually-hidden">Shape</legend>
              {(["circle", "ellipse"] as const).map((shape) => (
                <button
                  key={shape}
                  type="button"
                  class="segment"
                  aria-pressed={geo.shape === shape}
                  onClick={() => change({ shape }, "Shape")}
                >
                  {shape === "circle" ? "Circle" : "Ellipse"}
                </button>
              ))}
            </fieldset>
          </SettingRow>
          <SettingRow label="Size" htmlFor="geometry-size" reset={<ResetButton rowKey="size" />}>
            <Select
              id="geometry-size"
              value={geo.size}
              options={SIZES}
              onChange={(size) => change({ size }, "Size")}
            />
          </SettingRow>
          <CenterRows />
        </>
      )}
      {g.type === "conic" && (
        <>
          <AngleRow field="from" label="Start angle" />
          <CenterRows />
        </>
      )}
      <SettingRow
        label="Reverse"
        htmlFor="geometry-reverse"
        reset={<ResetButton rowKey="reverse" />}
      >
        <Toggle
          id="geometry-reverse"
          checked={geo.reverse}
          onChange={(reverse) => change({ reverse }, "Reverse")}
        />
      </SettingRow>
      <SettingRow label="Mirror" htmlFor="geometry-mirror" reset={<ResetButton rowKey="mirror" />}>
        <Toggle
          id="geometry-mirror"
          checked={geo.mirror}
          onChange={(mirror) => change({ mirror }, "Mirror")}
        />
      </SettingRow>
    </div>
  );
}

/** The Geometry header's reset-all icon (M3 decision 58). */
function GeometryHeaderExtras() {
  const g = gradient.value;
  if (changedGeometryRows(g.type, g.geometry).length === 0) return null;
  return (
    <button
      type="button"
      class="reset-icon"
      data-testid="geometry-reset-all"
      aria-label="Reset geometry"
      onClick={(event) => {
        event.stopPropagation();
        resetRows(gradient.peek().type);
      }}
    >
      <RotateCcw aria-hidden="true" size={18} strokeWidth={1.5} />
    </button>
  );
}

export function GeometryRow() {
  const g = gradient.value;
  const count = changedGeometryRows(g.type, g.geometry).length;
  return (
    <ChevronRow
      id="geometry"
      label="Geometry"
      badge={count > 0 ? { count, name: `Geometry, ${count} changed` } : null}
      summaryExtra={<GeometryHeaderExtras />}
    >
      <GeometryPanel />
    </ChevronRow>
  );
}
