import { Resvg } from "@resvg/resvg-js";

/**
 * Render a share-card SVG string to PNG bytes.
 *
 * Facebook's og:image scraper and Instagram cannot display SVG, so the card
 * and story routes serve PNG. Text uses the SVG's font-family stacks; resvg
 * resolves them through fontconfig, so the Docker image installs
 * fonts-dejavu-core for a guaranteed fallback.
 */
export function svgToPng(svg: string): Uint8Array {
  const resvg = new Resvg(svg);
  return resvg.render().asPng();
}
