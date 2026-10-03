/** Presentation clock only: lighting never changes combat or fog-of-war rules. */
export function daylight(time: number) {
  const hour = (((time / 10 + 8) % 24) + 24) % 24;
  const phase =
    hour < 5 || hour >= 20
      ? "Night"
      : hour < 7
        ? "Dawn"
        : hour < 17
          ? "Day"
          : "Dusk";
  const night = Math.max(
    0,
    Math.min(1, (Math.cos(((hour - 1) / 24) * Math.PI * 2) + 0.15) / 0.8),
  );
  return { hour, phase, night };
}
