export type Point = { x: number; y: number };
export type Branch = { sx: number; sy: number; cx: number; cy: number; ex: number; ey: number };

export const LEAF = "M-44,0 C-26,-22 26,-22 44,0 C26,22 -26,22 -44,0 Z";
export const LEAF_COLORS = ["#0F5C33", "#2E7A4A", "#4F7F36", "#B85C2E", "#9A6A12"] as const;
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const ease = (value: number) => 1 - Math.pow(1 - value, 3);
export const spring = (value: number) => {
  const coefficient = 1.70158;
  return value <= 0 ? 0 : 1 + (coefficient + 1) * Math.pow(value - 1, 3) + coefficient * Math.pow(value - 1, 2);
};

export function point(branch: Branch, progress: number): Point {
  const remaining = 1 - progress;
  return {
    x: remaining * remaining * branch.sx + 2 * remaining * progress * branch.cx + progress * progress * branch.ex,
    y: remaining * remaining * branch.sy + 2 * remaining * progress * branch.cy + progress * progress * branch.ey,
  };
}

export function tangent(branch: Branch, progress: number): Point {
  const dx = 2 * (1 - progress) * (branch.cx - branch.sx) + 2 * progress * (branch.ex - branch.cx);
  const dy = 2 * (1 - progress) * (branch.cy - branch.sy) + 2 * progress * (branch.ey - branch.cy);
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

/** A filled, tapered quadratic branch, matching the supplied baobab geometry. */
export function taper(branch: Branch, growth: number, initialWidth: number, endWidth: number): string {
  const left: string[] = [];
  const right: string[] = [];
  for (let index = 0; index <= 18; index += 1) {
    const progress = growth * index / 18;
    const position = point(branch, progress);
    const direction = tangent(branch, progress);
    const halfWidth = (initialWidth + (endWidth - initialWidth) * progress) / 2;
    left.push(`${(position.x - direction.y * halfWidth).toFixed(1)},${(position.y + direction.x * halfWidth).toFixed(1)}`);
    right.push(`${(position.x + direction.y * halfWidth).toFixed(1)},${(position.y - direction.x * halfWidth).toFixed(1)}`);
  }
  return `M${left.join(" L")} L${right.reverse().join(" L")} Z`;
}

export function segment(start: Point, end: Point, bend: number): Branch {
  return {
    sx: start.x, sy: start.y,
    cx: (start.x + end.x) / 2 - (end.y - start.y) * bend,
    cy: (start.y + end.y) / 2 + (end.x - start.x) * bend,
    ex: end.x, ey: end.y,
  };
}
