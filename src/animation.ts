export type Direction = "NE" | "SE" | "SW" | "NW";
export type Animation<T> = {
  fps?: number;
  loop?: boolean;
  directions?: string[];
  frames: Record<string, T[]>;
};
export function facing(dx: number, dy: number): Direction {
  return dx - dy >= 0
    ? dx + dy >= 0
      ? "SE"
      : "NE"
    : dx + dy >= 0
      ? "SW"
      : "NW";
}
export function sampleAnimation<T>(
  animation: Animation<T> | undefined,
  direction: string,
  seconds: number,
): T | undefined {
  if (!animation) return;
  const frames =
    animation.frames[direction] ??
    animation.frames[
      animation.directions?.[0] ?? Object.keys(animation.frames)[0]
    ];
  if (!frames?.length) return;
  const index = Math.floor(Math.max(0, seconds) * (animation.fps ?? 10));
  return frames[
    animation.loop ? index % frames.length : Math.min(index, frames.length - 1)
  ];
}
