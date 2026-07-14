/** Saturated neon-bright marker hues only — no yellows or pale/washed tones. */
const MARKER_PALETTE = [
  "#FF1744", // vivid red
  "#FF3D00", // neon orange-red
  "#FF6D00", // bright orange
  "#FF9100", // vivid amber-orange
  "#76FF03", // neon lime
  "#00E676", // bright green
  "#1DE9B6", // aqua mint
  "#00E5FF", // electric cyan
  "#00B0FF", // vivid sky
  "#2979FF", // bright blue
  "#448AFF", // royal blue
  "#651FFF", // vivid violet
  "#7C4DFF", // indigo flash
  "#D500F9", // magenta
  "#E040FB", // fuchsia
  "#F50057", // rose
  "#FF4081", // hot pink
  "#FF5252", // coral red
  "#18FFFF", // turquoise
  "#69F0AE", // mint neon
  "#B2FF59", // lime punch
  "#AA00FF", // electric purple
  "#C51162", // deep pink
  "#0091EA", // vivid azure
];

export function colorForKey(key) {
  const s = String(key || "unknown");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return MARKER_PALETTE[h % MARKER_PALETTE.length];
}

/** Prefer IP so nearby/same-country markers stay visually distinct. */
export function colorForLocation(loc) {
  return colorForKey(loc?.ip || loc?.country || "x");
}
