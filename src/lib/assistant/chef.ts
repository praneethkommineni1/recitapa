import { claudeChef, DEFAULT_MODEL } from "./claude.ts";
import type { ChefProvider } from "./types.ts";

/**
 * The provider that runs the sous-chef, chosen with CHEF_MODEL (default claude-opus-5-5).
 * A bare model id or "claude:<model>" runs on Claude. To add another provider, implement
 * ChefProvider in its own file and register its prefix here.
 */
export function chefFor(spec: string = process.env.CHEF_MODEL || DEFAULT_MODEL): ChefProvider {
  const [prefix, ...rest] = spec.split(":");
  if (rest.length && prefix !== "claude") throw new Error(`Unknown chef provider "${prefix}" in CHEF_MODEL=${spec}`);
  return claudeChef(rest.length ? rest.join(":") : spec);
}
