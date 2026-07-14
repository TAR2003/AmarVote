/** Distinct marker hues on Deep Indigo — avoids Aurora Teal (verified-only). */
const MARKER_PALETTE = [
  "#8B7FE8",
  "#5C9EAD",
  "#E8A87C",
  "#C38D9E",
  "#85C1E9",
  "#A8DADC",
  "#F2A65A",
  "#9B5DE5",
  "#00BBF9",
  "#E27D60",
  "#7BDFF2",
  "#F4A261",
  "#90BE6D",
  "#577590",
  "#F72585",
  "#4CC9F0",
];

export function colorForKey(key) {
  const s = String(key || "unknown");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return MARKER_PALETTE[h % MARKER_PALETTE.length];
}

export function colorForLocation(loc) {
  return colorForKey(loc?.country || loc?.ip || "x");
}
