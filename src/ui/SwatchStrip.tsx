/**
 * The swatch strip (ui-contract column 2 item 1): the swatches in one row, the selection outlined.
 * With more than 6 swatches it breaks into two even rows when one row would make them smaller than
 * 44 px (decision 13). Swatches are user content and are never themed (spec 6.2). Hovering a
 * swatch with a fine pointer, or focusing it from the keyboard, shows its cluster map (spec 2.6).
 *
 * Swatch and marker are linked both ways (spec 3.7): pointing at a swatch (mouse or pen) or
 * focusing it from the keyboard sets `hoveredSwatchId`, and the swatch it names carries
 * `data-linked`, whether a swatch or its marker (M3-T12) set it.
 */
import { Lock, Pin, Plus, X } from "lucide-preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  addSwatch,
  canAdd,
  createSwatch,
  FULL_MESSAGE,
  moveSwatch,
  swatchHex,
  swatchLabel,
} from "../palette/model";
import { clusterFocus, clusterHover, shareText, shownCluster } from "../state/cluster";
import { startEyedropper } from "../state/eyedropper";
import { commit } from "../state/history";
import { removeSwatch } from "../state/remove-swatch";
import {
  activeTab,
  clusterMap,
  emptyRoles,
  extracting,
  hoveredSwatchId,
  imageLoading,
  outputPalette,
  palette,
  selectedSwatchId,
  selectSwatch,
  viewSettings,
} from "../state/signals";
import { viewShares } from "../state/view-result";
import { stripCells, stripColumns } from "./stripLayout";

/** Only a fine pointer hovers (spec 6.1 "No hover"); touch uses the Cluster map toggle. */
const hovers = (event: PointerEvent): boolean =>
  event.pointerType === "mouse" && window.matchMedia("(pointer: fine)").matches;

/** Keyboard focus only: a click that focuses a swatch doesn't leave its map showing. */
const keyboardFocus = (el: Element): boolean => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return false;
  }
};

/** Touch has no hover (spec 6.1): a tap selects instead. */
const points = (event: PointerEvent): boolean => event.pointerType !== "touch";

const clear = (target: typeof clusterHover, id: string): void => {
  if (target.peek() === id) target.value = null;
};

/** Reorder starts after 4 px of mouse movement, or a 300 ms touch press (plan D10). */
const MOUSE_SLOP = 4;
const HOLD_MS = 300;
/** A touch that moves this far before the hold ends is a scroll, not a reorder. */
const TOUCH_SLOP = 10;

/**
 * Focuses the HEX field of the color editor, when one is on screen. M3-T3 gives it the class
 * `hex-field`. On phones the editor is in the Palette tab, so there is nothing to focus.
 */
function focusHexField(): void {
  const fields = document.querySelectorAll<HTMLElement>(".hex-field");
  for (const field of fields) {
    if (field.checkVisibility()) {
      field.focus();
      return;
    }
  }
}

/** A mid-gray manual swatch with no point, unlocked (plan D12). */
export function addManualSwatch(): void {
  const swatch = createSwatch({ l: 0.5, a: 0, b: 0 }, { origin: "manual" });
  const next = addSwatch(palette.peek(), swatch);
  if (next === palette.peek()) return;
  palette.value = next;
  selectSwatch(swatch.id);
  commit("Add color");
  requestAnimationFrame(() => requestAnimationFrame(focusHexField));
}

interface Press {
  id: string;
  pointerId: number;
  touch: boolean;
  x: number;
  y: number;
  active: boolean;
  timer: number;
  before: typeof palette.value;
  map: typeof clusterMap.value;
  moved: boolean;
}

/** The "+" tile and its menu: "Pick from image" and "Type a color" (decision 5b). */
function AddTile({ alone, full }: { alone: boolean; full: boolean }) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"start" | "end">("end");
  const root = useRef<HTMLDivElement>(null);
  const tile = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const away = (e: Event) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    if (full) setOpen(false);
  }, [full]);
  const toggle = () => {
    if (!open) {
      const el = root.current;
      const bar = el?.closest("fieldset")?.getBoundingClientRect();
      const me = el?.getBoundingClientRect();
      if (bar && me) setAlign(me.left + me.width / 2 < bar.left + bar.width / 2 ? "start" : "end");
    }
    setOpen(!open);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) tile.current?.focus();
  };
  return (
    <div ref={root} class="strip-add" data-alone={alone ? "" : undefined}>
      <button
        ref={tile}
        type="button"
        class="strip-add__tile"
        data-testid="add-swatch"
        aria-label="Add a color"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-describedby={full ? "strip-full-note" : undefined}
        disabled={full}
        onClick={toggle}
      >
        <Plus aria-hidden="true" />
      </button>
      {open && (
        <div
          class="strip-menu"
          role="menu"
          aria-label="Add a color"
          data-align={align}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close(true);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const items = [
                ...(root.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []),
              ];
              const at = items.indexOf(document.activeElement as HTMLElement);
              const step = e.key === "ArrowDown" ? 1 : -1;
              items[(at + step + items.length) % items.length]?.focus();
            } else if (e.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          <button
            ref={first}
            type="button"
            role="menuitem"
            class="strip-menu__item"
            onClick={() => {
              setOpen(false);
              // The image is on the Source tab below 1024 px, where the "+" tile no longer is
              // (M3 decision 32): go there to pick.
              activeTab.value = "source";
              startEyedropper();
            }}
          >
            Pick from image
          </button>
          <button
            type="button"
            role="menuitem"
            class="strip-menu__item"
            onClick={() => {
              setOpen(false);
              addManualSwatch();
            }}
          >
            Type a color
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * With `showAdd` false the strip shows only the swatches: no "+" tile and no 12-color note. The
 * Source tab below 1024 px does this (M3 decision 32).
 */
export function SwatchStrip({ showAdd = true }: { showAdd?: boolean } = {}) {
  const swatches = outputPalette.value;
  const selected = selectedSwatchId.value;
  const linked = hoveredSwatchId.value;
  const strip = useRef<HTMLFieldSetElement>(null);
  const [size, setSize] = useState({ width: 0, gap: 0 });
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);
  const shown = swatches.length > 0;
  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => {
      const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
      setSize({ width: el.clientWidth, gap });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  if (!shown) return null;
  // The "+" tile is a cell of the same row as the swatches, which shrink to make room and wrap
  // only when 44 px no longer fits (decisions 13, 29). At 12 it is disabled, on a row of its own.
  const full = !canAdd(swatches);
  const columns = stripColumns(stripCells(swatches.length), size.width, size.gap);
  const aloneRow = full;

  const announce = (id: string, to: number) => {
    const list = palette.peek();
    const swatch = list.find((s) => s.id === id);
    if (!swatch) return;
    const name = swatch.name || swatchHex(swatch);
    setAnnouncement(`${name} moved to position ${to + 1} of ${list.length}`);
  };

  /** Moves a swatch to a place, live while dragging. */
  const moveTo = (id: string, to: number): boolean => {
    const list = palette.peek();
    const from = list.findIndex((s) => s.id === id);
    const next = moveSwatch(list, from, to);
    if (next === list) return false;
    palette.value = next;
    // The cluster map labels pixels by palette index, so it no longer matches (spec 2.6).
    clusterMap.value = null;
    return true;
  };

  const endPress = () => {
    const p = press.current;
    if (!p) return;
    clearTimeout(p.timer);
    press.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("touchmove", onTouchMove);
    setDragging(null);
  };
  stop.current = endPress;

  const restore = () => {
    const p = press.current;
    if (!p) return;
    if (p.moved) {
      palette.value = p.before;
      clusterMap.value = p.map;
    }
    endPress();
  };

  function onTouchMove(e: TouchEvent) {
    // Once the hold has begun a reorder the finger must not scroll the page.
    if (press.current?.active && e.cancelable) e.preventDefault();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !press.current?.active) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    restore();
  }
  function onCancel(e: PointerEvent) {
    if (e.pointerId === press.current?.pointerId) restore();
  }
  function onUp(e: PointerEvent) {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (p.active) {
      // The release's click must not select; a reorder is one undo step.
      suppressClick.current = true;
      setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      if (p.moved) {
        commit("Reorder");
        announce(
          p.id,
          palette.peek().findIndex((s) => s.id === p.id),
        );
      }
    }
    endPress();
  }
  function onMove(e: PointerEvent) {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (!p.active) {
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.touch) {
        // Moving before the hold ends is a scroll: leave the gesture to the browser.
        if (dist > TOUCH_SLOP) endPress();
        return;
      }
      if (dist < MOUSE_SLOP) return;
      p.active = true;
      setDragging(p.id);
    }
    const over = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-swatch]");
    const target = over?.dataset.swatchId;
    if (!over || !target || target === p.id || !strip.current?.contains(over)) return;
    const to = palette.peek().findIndex((s) => s.id === target);
    if (moveTo(p.id, to)) p.moved = true;
  }

  const startPress = (e: PointerEvent, id: string) => {
    if (press.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const touchLike = e.pointerType === "touch";
    const p: Press = {
      id,
      pointerId: e.pointerId,
      touch: touchLike,
      x: e.clientX,
      y: e.clientY,
      active: false,
      timer: 0,
      before: palette.peek(),
      map: clusterMap.peek(),
      moved: false,
    };
    if (touchLike) {
      p.timer = window.setTimeout(() => {
        p.active = true;
        setDragging(id);
      }, HOLD_MS);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
    }
    press.current = p;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
  };

  /** Removes a swatch and gives focus to the one that is selected after it (decision 38). */
  const remove = (id: string) => {
    removeSwatch(id);
    const now = selectedSwatchId.peek();
    requestAnimationFrame(() => {
      const next = now
        ? strip.current?.querySelector<HTMLElement>(`[data-swatch-id="${now}"]`)
        : strip.current?.querySelector<HTMLElement>("[data-testid=add-swatch]");
      next?.focus();
    });
  };

  const onSwatchKey = (e: KeyboardEvent, id: string) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      remove(id);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const index = palette.peek().findIndex((s) => s.id === id);
    const to = index + (e.key === "ArrowRight" ? 1 : -1);
    if (!moveTo(id, to)) return;
    commit("Reorder");
    announce(id, to);
    // A moved node can lose focus; give it back once the strip has re-rendered.
    requestAnimationFrame(() =>
      strip.current?.querySelector<HTMLElement>(`[data-swatch-id="${id}"]`)?.focus(),
    );
  };
  // Each swatch's share of the image from the cluster map (spec 2.6), when it matches the palette.
  const map = clusterMap.value;
  const shares = map && map.shares.length === swatches.length ? map.shares : null;
  return (
    <>
      <fieldset
        ref={strip}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        class="swatch-strip"
        data-testid="swatch-strip"
        data-busy={extracting.value || imageLoading.value || undefined}
      >
        <legend class="visually-hidden">Palette swatches</legend>
        {swatches.map((swatch, i) => {
          const hex = swatchHex(swatch);
          return (
            <div key={swatch.id} class="swatch-cell">
              <button
                type="button"
                class="swatch"
                data-swatch=""
                data-user-content=""
                data-swatch-id={swatch.id}
                data-origin={swatch.origin}
                data-dragging={swatch.id === dragging ? "" : undefined}
                data-share={shares?.[i]}
                aria-label={`${swatchLabel(swatches, swatch.id)}, ${hex}`}
                aria-description={swatch.locked ? "Locked" : swatch.pinned ? "Pinned" : undefined}
                data-locked={swatch.locked ? "" : undefined}
                data-pinned={swatch.pinned ? "" : undefined}
                aria-pressed={swatch.id === selected}
                data-linked={swatch.id === linked ? "" : undefined}
                style={{ backgroundColor: hex }}
                onClick={() => {
                  if (!suppressClick.current) selectSwatch(swatch.id);
                }}
                onContextMenu={(e) => {
                  if (press.current?.touch) e.preventDefault();
                }}
                onPointerDown={(e) => startPress(e, swatch.id)}
                onKeyDown={(e) => onSwatchKey(e, swatch.id)}
                onPointerEnter={(e) => {
                  if (press.current?.active) return;
                  if (hovers(e)) clusterHover.value = swatch.id;
                  if (points(e)) hoveredSwatchId.value = swatch.id;
                }}
                onPointerLeave={() => {
                  clear(clusterHover, swatch.id);
                  clear(hoveredSwatchId, swatch.id);
                }}
                onFocus={(e) => {
                  if (!keyboardFocus(e.currentTarget)) return;
                  clusterFocus.value = swatch.id;
                  hoveredSwatchId.value = swatch.id;
                }}
                onBlur={() => {
                  clear(clusterFocus, swatch.id);
                  clear(hoveredSwatchId, swatch.id);
                }}
              >
                {(swatch.locked || swatch.pinned) && (
                  <span class="swatch__badge" aria-hidden="true">
                    {swatch.locked ? <Lock /> : <Pin />}
                  </span>
                )}
              </button>
              {swatch.id === selected && (
                <button
                  type="button"
                  class="swatch-remove"
                  data-testid="remove-swatch"
                  aria-label={`Remove swatch ${i + 1}`}
                  onClick={() => remove(swatch.id)}
                >
                  <span class="swatch-remove__chip" aria-hidden="true">
                    <X />
                  </span>
                </button>
              )}
            </div>
          );
        })}
        {showAdd && <AddTile alone={aloneRow} full={full} />}
      </fieldset>
      <div class="live-region" role="status">
        {showAdd && full && (
          <p class="hint" id="strip-full-note" data-testid="strip-full-note">
            {FULL_MESSAGE}
          </p>
        )}
      </div>
      <p class="visually-hidden" role="status" data-testid="strip-announce">
        {announcement}
      </p>
    </>
  );
}

/**
 * A muted label naming the selection, such as "Swatch 3" (ui-contract column 2 item 2). While a
 * cluster map shows, it names that swatch with its share: "Swatch 3 · 0.5% of the image" (spec 2.6,
 * M2 decision 13c).
 */
export function SelectionLabel() {
  const shown = shownCluster.value;
  const label = swatchLabel(outputPalette.value, shown?.id ?? selectedSwatchId.value);
  if (!label) return null;
  // In the Palette view the label gives the selected swatch's share (spec 3.8; M3-T14).
  const view = viewShares.value;
  const index = outputPalette.value.findIndex((s) => s.id === selectedSwatchId.value);
  const viewShare =
    viewSettings.value.mode === "palette" && view?.mode === "palette" ? view.shares[index] : null;
  const share = shown ? shown.share : viewShare;
  return (
    <p class="selection-label" data-testid="selection-label">
      {share === null || share === undefined
        ? label
        : `${label} · ${shareText(share)} of the image`}
    </p>
  );
}

/**
 * The sentence naming the swatch roles an extraction left empty (M2 decision 10b), such as "No
 * color fits the Dark vibrant or Light vibrant roles." Empty when every role is filled.
 */
export function emptyRolesText(roles: readonly string[]): string {
  if (roles.length === 0) return "";
  const names =
    roles.length === 1
      ? (roles[0] ?? "")
      : `${roles.slice(0, -1).join(", ")} or ${roles[roles.length - 1] ?? ""}`;
  return `No color fits the ${names} role${roles.length === 1 ? "" : "s"}.`;
}

/** A muted note under the strip naming the empty swatch roles; the strip leaves them out. */
export function EmptyRolesNote() {
  const text = emptyRolesText(emptyRoles.value);
  if (!text) return null;
  return (
    <p class="hint" data-testid="empty-roles">
      {text}
    </p>
  );
}
