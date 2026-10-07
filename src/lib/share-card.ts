export type ShareCardCopy = {
  brand: string;
  provinceLabel: string;
  provincePercent: string;
  provinceCount: string;
  canadaLabel: string;
  canadaPercent: string;
  canadaCount: string;
  firstLine: string;
  tagline: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Landscape graphic for Open Graph / Facebook link previews. */
export function shareCardSvg(copy: ShareCardCopy): string {
  const c = {
    brand: escapeXml(copy.brand),
    provinceLabel: escapeXml(copy.provinceLabel),
    provincePercent: escapeXml(copy.provincePercent),
    provinceCount: escapeXml(copy.provinceCount),
    canadaLabel: escapeXml(copy.canadaLabel),
    canadaPercent: escapeXml(copy.canadaPercent),
    canadaCount: escapeXml(copy.canadaCount),
    firstLine: escapeXml(copy.firstLine),
    tagline: escapeXml(copy.tagline),
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a2f18"/>
      <stop offset="55%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#1c6b3a"/>
    </linearGradient>
    <linearGradient id="fairway" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3efe4" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#f3efe4" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <path d="M0 420 C220 340 380 500 620 390 C860 280 980 450 1200 360 L1200 630 L0 630 Z" fill="url(#fairway)"/>
  <circle cx="980" cy="120" r="160" fill="#f3efe4" fill-opacity="0.06"/>
  <circle cx="1040" cy="80" r="70" fill="#f3efe4" fill-opacity="0.08"/>
  <text x="72" y="92" font-family="Palatino, Iowan Old Style, Georgia, serif" font-size="48" fill="#f3efe4">${c.brand}</text>
  <text x="72" y="140" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" fill="#d5e5d8">${c.tagline}</text>
  <text x="72" y="310" font-family="Palatino, Iowan Old Style, Georgia, serif" font-size="168" fill="#f3efe4">${c.canadaPercent}</text>
  <text x="72" y="370" font-family="Avenir Next, Segoe UI, sans-serif" font-size="34" fill="#e8f0e9">${c.canadaLabel}</text>
  <text x="72" y="418" font-family="Avenir Next, Segoe UI, sans-serif" font-size="24" fill="#b9cdb9">${c.canadaCount}</text>
  <rect x="72" y="460" width="72" height="3" fill="#f3efe4" fill-opacity="0.45"/>
  <text x="72" y="520" font-family="Avenir Next, Segoe UI, sans-serif" font-size="28" fill="#f3efe4">${c.provinceLabel} · ${c.provincePercent}</text>
  <text x="72" y="562" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" fill="#b9cdb9">${c.provinceCount} · ${c.firstLine}</text>
</svg>`;
}

/** Vertical graphic sized for Instagram Stories / Reels covers. */
export function shareStorySvg(copy: ShareCardCopy): string {
  const c = {
    brand: escapeXml(copy.brand),
    provinceLabel: escapeXml(copy.provinceLabel),
    provincePercent: escapeXml(copy.provincePercent),
    provinceCount: escapeXml(copy.provinceCount),
    canadaLabel: escapeXml(copy.canadaLabel),
    canadaPercent: escapeXml(copy.canadaPercent),
    canadaCount: escapeXml(copy.canadaCount),
    firstLine: escapeXml(copy.firstLine),
    tagline: escapeXml(copy.tagline),
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#082414"/>
      <stop offset="45%" stop-color="#14532d"/>
      <stop offset="100%" stop-color="#1c6b3a"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#sky)"/>
  <circle cx="860" cy="280" r="260" fill="#f3efe4" fill-opacity="0.07"/>
  <path d="M0 1280 C240 1180 420 1400 620 1260 C860 1100 940 1360 1080 1240 L1080 1920 L0 1920 Z" fill="#f3efe4" fill-opacity="0.1"/>
  <text x="80" y="220" font-family="Palatino, Iowan Old Style, Georgia, serif" font-size="72" fill="#f3efe4">${c.brand}</text>
  <text x="80" y="290" font-family="Avenir Next, Segoe UI, sans-serif" font-size="30" fill="#d5e5d8">${c.tagline}</text>
  <text x="80" y="780" font-family="Palatino, Iowan Old Style, Georgia, serif" font-size="260" fill="#f3efe4">${c.canadaPercent}</text>
  <text x="80" y="880" font-family="Avenir Next, Segoe UI, sans-serif" font-size="44" fill="#e8f0e9">${c.canadaLabel}</text>
  <text x="80" y="950" font-family="Avenir Next, Segoe UI, sans-serif" font-size="32" fill="#b9cdb9">${c.canadaCount}</text>
  <rect x="80" y="1040" width="96" height="4" fill="#f3efe4" fill-opacity="0.45"/>
  <text x="80" y="1160" font-family="Avenir Next, Segoe UI, sans-serif" font-size="44" fill="#f3efe4">${c.provinceLabel}</text>
  <text x="80" y="1240" font-family="Palatino, Iowan Old Style, Georgia, serif" font-size="96" fill="#f3efe4">${c.provincePercent}</text>
  <text x="80" y="1320" font-family="Avenir Next, Segoe UI, sans-serif" font-size="32" fill="#b9cdb9">${c.provinceCount}</text>
  <text x="80" y="1720" font-family="Avenir Next, Segoe UI, sans-serif" font-size="30" fill="#d5e5d8">${c.firstLine}</text>
</svg>`;
}
