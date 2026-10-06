const PLAYED_PATH =
  "M14 1.5C7.6 1.5 2.5 6.6 2.5 13c0 8.2 11.5 20.2 11.5 20.2S25.5 21.2 25.5 13C25.5 6.6 20.4 1.5 14 1.5z";
const OPEN_PATH = "M12 2.2 21.8 12 12 21.8 2.2 12 Z";

export function PlayedPinGlyph() {
  return (
    <svg className="pin-glyph" width="16" height="21" viewBox="0 0 28 36" aria-hidden="true">
      <path d={PLAYED_PATH} fill="#1c6b3a" stroke="#0e3d20" strokeWidth="1.6" />
      <circle cx="14" cy="13" r="3.4" fill="#fffdf8" />
    </svg>
  );
}

export function OpenPinGlyph() {
  return (
    <svg className="pin-glyph" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d={OPEN_PATH} fill="#fffdf8" stroke="#1b2418" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function playedMarkerHtml(): string {
  return `<svg width="32" height="42" viewBox="0 0 28 36" aria-hidden="true"><path d="${PLAYED_PATH}" fill="#1c6b3a" stroke="#0e3d20" stroke-width="1.6"/><circle cx="14" cy="13" r="3.4" fill="#fffdf8"/></svg>`;
}

export function openMarkerHtml(): string {
  return `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="${OPEN_PATH}" fill="#fffdf8" stroke="#1b2418" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
