// Scale ingredient lines to a different number of servings and convert between metric and US units.
// Only a quantity at the start of a line is touched ("200g spaghetti", "1 1/2 cups milk", "2-3 cloves garlic");
// anything else ("salt to taste", "juice of 1 lemon") is left exactly as written.

export type UnitSystem = "original" | "metric" | "us";

const UNICODE_FRACTIONS: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125 };
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

// One amount: "1 1/2", "1½", "1/2", "½", "1.5", "2"
const AMOUNT = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\s*[${FRACTION_CHARS}]|\\d+\\/\\d+|[${FRACTION_CHARS}]|\\d+(?:[.,]\\d+)?)`;
const LEADING = new RegExp(`^(\\s*)(${AMOUNT})(?:\\s*(?:-|–|to)\\s*(${AMOUNT}))?`);

/** Unit spellings, longest first so "fl oz" wins over "oz" and "tbsp" over "t". */
const UNITS: [RegExp, Unit][] = [
  [/^fl\.?\s?oz\b\.?/i, "floz"],
  [/^(?:kilograms?|kgs?)\b/i, "kg"],
  [/^(?:grams?|gr|g)\b/i, "g"],
  [/^(?:millilit(?:er|re)s?|ml)\b/i, "ml"],
  [/^(?:lit(?:er|re)s?|l)\b/i, "l"],
  [/^(?:ounces?|oz)\b\.?/i, "oz"],
  [/^(?:pounds?|lbs?)\b\.?/i, "lb"],
  [/^cups?\b/i, "cup"],
  [/^(?:quarts?|qts?)\b\.?/i, "quart"],
  [/^(?:pints?|pts?)\b\.?/i, "pint"],
  [/^(?:tablespoons?|tbsps?|tbs)\b\.?/i, "tbsp"],
  [/^(?:teaspoons?|tsps?)\b\.?/i, "tsp"],
];
type Unit = "g" | "kg" | "ml" | "l" | "oz" | "lb" | "floz" | "cup" | "quart" | "pint" | "tbsp" | "tsp";
const METRIC: Unit[] = ["g", "kg", "ml", "l"];
const US: Unit[] = ["oz", "lb", "floz", "cup", "quart", "pint"];

export function parseAmount(raw: string): number {
  const s = raw.trim().replace(",", ".");
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const uni = new RegExp(`^(\\d*)\\s*([${FRACTION_CHARS}])$`).exec(s);
  if (uni) return Number(uni[1] || 0) + UNICODE_FRACTIONS[uni[2]];
  const frac = /^(\d+)\/(\d+)$/.exec(s);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(s);
}

const NICE_FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

/** Kitchen-friendly number: whole numbers and common fractions, or rounded metric amounts. */
export function formatAmount(n: number, unit?: Unit): string {
  if (unit && METRIC.includes(unit)) {
    if (n >= 100) return String(Math.round(n / 5) * 5);
    if (n >= 10) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }
  let whole = Math.floor(n);
  const rest = n - whole;
  const [value, glyph] = NICE_FRACTIONS.reduce((best, f) => (Math.abs(f[0] - rest) < Math.abs(best[0] - rest) ? f : best));
  if (value === 1) whole += 1;
  if (!whole && !glyph) return "⅛"; // never round an ingredient away
  return `${whole || ""}${glyph}` || "0";
}

interface Parsed {
  lead: string;
  low: number;
  high: number | null;
  unit: Unit | null;
  unitText: string;
  /** Whitespace between the amount and the unit, kept when only scaling. */
  gap: string;
  rest: string;
}

function parse(line: string): Parsed | null {
  const m = LEADING.exec(line);
  if (!m) return null;
  const low = parseAmount(m[2]);
  const high = m[3] ? parseAmount(m[3]) : null;
  if (!Number.isFinite(low) || (high !== null && !Number.isFinite(high))) return null;
  const after = line.slice(m[0].length);
  const gap = /^\s*/.exec(after)![0];
  const spaced = after.slice(gap.length);
  for (const [re, unit] of UNITS) {
    const u = re.exec(spaced);
    if (u) return { lead: m[1], low, high, unit, unitText: u[0], gap, rest: spaced.slice(u[0].length) };
  }
  return { lead: m[1], low, high, unit: null, unitText: "", gap: "", rest: after };
}

function render(p: Parsed, unitLabel: string): string {
  const amount = p.high === null ? formatAmount(p.low, p.unit ?? undefined) : `${formatAmount(p.low, p.unit ?? undefined)}–${formatAmount(p.high, p.unit ?? undefined)}`;
  if (!p.unit) return `${p.lead}${amount}${p.rest}`;
  return `${p.lead}${amount}${p.gap}${unitLabel}${p.rest}`;
}

/** Multiply the leading quantity of an ingredient line by `factor`. */
export function scaleIngredient(line: string, factor: number): string {
  if (!(factor > 0) || factor === 1) return line;
  const p = parse(line);
  if (!p) return line;
  return render({ ...p, low: p.low * factor, high: p.high === null ? null : p.high * factor }, p.unitText);
}

const TO_METRIC: Partial<Record<Unit, [number, Unit]>> = {
  oz: [28.35, "g"],
  lb: [453.6, "g"],
  floz: [29.57, "ml"],
  cup: [240, "ml"],
  pint: [473, "ml"],
  quart: [946, "ml"],
};

/** Pick a readable metric or US unit for an amount already in g or ml. */
function bestUnit(amount: number, base: "g" | "ml", system: "metric" | "us"): [number, Unit] {
  if (system === "metric") {
    if (amount >= 1000) return [amount / 1000, base === "g" ? "kg" : "l"];
    return [amount, base];
  }
  if (base === "g") return amount >= 454 ? [amount / 453.6, "lb"] : [amount / 28.35, "oz"];
  if (amount >= 60) return [amount / 240, "cup"];
  if (amount >= 15) return [amount / 15, "tbsp"];
  return [amount / 5, "tsp"];
}

const LABEL: Record<Unit, string> = {
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  oz: "oz",
  lb: "lb",
  floz: "fl oz",
  cup: "cup",
  quart: "quart",
  pint: "pint",
  tbsp: "tbsp",
  tsp: "tsp",
};

function plural(unit: Unit, amount: number): string {
  const many = amount > 1 && formatAmount(amount, unit) !== "1";
  return (unit === "cup" || unit === "quart" || unit === "pint") && many ? `${LABEL[unit]}s` : LABEL[unit];
}

/** Convert the leading quantity of an ingredient line to metric or US units. Spoons stay as they are. */
export function convertIngredient(line: string, system: UnitSystem): string {
  if (system === "original") return line;
  const p = parse(line);
  if (!p?.unit || p.low <= 0) return line;
  const isMetric = METRIC.includes(p.unit);
  if ((system === "metric" && isMetric) || (system === "us" && !isMetric) || p.unit === "tbsp" || p.unit === "tsp") return line;

  let base: "g" | "ml";
  let factor: number;
  if (isMetric) {
    base = p.unit === "g" || p.unit === "kg" ? "g" : "ml";
    factor = p.unit === "kg" || p.unit === "l" ? 1000 : 1;
  } else {
    const [f, u] = TO_METRIC[p.unit as keyof typeof TO_METRIC]!;
    base = u as "g" | "ml";
    factor = f;
  }
  const [low, unit] = bestUnit(p.low * factor, base, system);
  const high = p.high === null ? null : (p.high * factor * low) / (p.low * factor);
  return render({ ...p, low, high, unit, gap: unit === "g" || unit === "kg" ? "" : " " }, plural(unit, high ?? low));
}

/** Convert oven and oil temperatures written in a step ("200°C", "400 F", "180 degrees C"). */
export function convertTemperatures(text: string, system: UnitSystem): string {
  if (system === "original") return text;
  return text.replace(/(\d{2,3})\s?(?:°|º|degrees?)?\s?([CF])\b/g, (whole, num: string, scale: string) => {
    const n = Number(num);
    if (system === "metric" && scale === "F") return `${Math.round(((n - 32) * 5) / 9 / 5) * 5}°C`;
    if (system === "us" && scale === "C") return `${Math.round(((n * 9) / 5 + 32) / 5) * 5}°F`;
    return whole;
  });
}

/** Display an ingredient line for the chosen servings and unit system. */
export function adjustIngredient(line: string, factor: number, system: UnitSystem): string {
  return convertIngredient(scaleIngredient(line, factor), system);
}
