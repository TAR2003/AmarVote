/** Bright, high-chroma marker hues — one color per location (by IP). */
const MARKER_PALETTE = [
  "#FF1744", // vivid red
  "#FF9100", // bright orange
  "#FFEA00", // electric yellow
  "#76FF03", // neon lime
  "#00E676", // bright green
  "#1DE9B6", // aqua mint
  "#00E5FF", // cyan
  "#2979FF", // bright blue
  "#651FFF", // vivid violet
  "#D500F9", // magenta
  "#FF4081", // hot pink
  "#F50057", // rose
  "#FF6D00", // amber orange
  "#C6FF00", // chartreuse
  "#00B0FF", // sky
  "#AEEA00", // yellow-green
  "#FF3D00", // deep orange
  "#E040FB", // fuchsia
  "#40C4FF", // light cyan-blue
  "#69F0AE", // mint
  "#FFAB00", // gold
  "#7C4DFF", // indigo flash
  "#18FFFF", // turquoise
  "#FF80AB", // soft pink
  "#B2FF59", // lime punch
  "#82B1FF", // periwinkle
  "#FFD740", // sunflower
  "#EA80FC", // orchid
  "#64FFDA", // teal bright
  "#FF5252", // coral red
  "#448AFF", // royal blue
  "#EEFF41", // lemon
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
