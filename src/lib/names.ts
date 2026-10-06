/** Exact match key for an official name: case, accents kept, space collapsed. */
export function normalizeName(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isProvince(value: string): value is import("./types").Province {
  return value === "NS" || value === "PEI" || value === "NB" || value === "NL";
}
