/**
 * The angle dial (spec 4.3 "angle with dial"; plan M4-T6, D21): a round slider with a needle, 0 at
 * the top and turning clockwise as in CSS. Pointer drag with pointer capture (one undo step per drag,
 * through `onDragStart` and `onDragEnd`), arrow keys of 1 degree and Shift+arrow of 15. The target is
 * at least 44 px; `touch-action: none` keeps a touch drag from scrolling the page.
 */
import { useRef } from "preact/hooks";
import { angleFromVector, normalizeAngle } from "../gradient/geometry";

export function AngleDial({
  id,
  label,
  value,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  id: string;
  label: string;
  value: number;
  /** Every new value in whole degrees, live while dragging. */
  onChange: (angle: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const dragging = useRef<number | null>(null);
  const finish = () => {
    if (dragging.current === null) return;
    dragging.current = null;
    onDragEnd?.();
  };
  const fromEvent = (event: PointerEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    if (dx === 0 && dy === 0) return;
    onChange(Math.round(angleFromVector(dx, dy)) % 360);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 15 : 1;
    let delta = 0;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") delta = step;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") delta = -step;
    else return;
    event.preventDefault();
    onChange(normalizeAngle(value + delta));
  };
  return (
    <div
      id={id}
      class="angle-dial"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={value}
      aria-valuetext={`${value}°`}
      data-testid={id}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        const el = event.currentTarget as HTMLElement;
        el.focus({ preventScroll: true });
        el.setPointerCapture(event.pointerId);
        dragging.current = event.pointerId;
        onDragStart?.();
        fromEvent(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current === event.pointerId) fromEvent(event);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
    >
      <span
        class="angle-dial__needle"
        style={{ transform: `rotate(${value}deg)` }}
        aria-hidden="true"
      />
    </div>
  );
}
