/**
 * Colours for the international UV-index scale (WHO bands), the same ones
 * DMI's own site colours its UV badge by. Kept as fixed hex values rather
 * than theme tokens: these are a recognised traffic-light convention, not a
 * brand colour, and need to read the same regardless of light/dark mode.
 */
export function uvColor(max: number): string {
  if (max < 3) return "#22c55e"; // low
  if (max < 6) return "#eab308"; // moderate
  if (max < 8) return "#f97316"; // high
  if (max < 11) return "#ef4444"; // very high
  return "#a855f7"; // extreme
}
