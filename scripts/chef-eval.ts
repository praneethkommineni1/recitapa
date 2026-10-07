// Compare sous-chef models on the 25 kitchen test cases (evals/kitchen-cases.ts).
// Usage: npm run eval:chef -- [model ...] [--repeat N] [--only id,id]
//   npm run eval:chef -- claude-haiku-4-5 claude-opus-5-5
// Calls the real model API (needs ANTHROPIC_API_KEY) and costs real money: roughly 25 cases × the
// model's per-turn cost, e.g. well under $1 per model on Opus 5.5. It never touches the app's database.
import fs from "node:fs";
import path from "node:path";
import { chefFor } from "../src/lib/assistant/chef.ts";
import { costMicroUsd } from "../src/lib/assistant/pricing.ts";
import { grade } from "../evals/grade.ts";
import { CASES } from "../evals/kitchen-cases.ts";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const repeat = Math.max(1, Number(flag("--repeat") ?? 1));
const only = flag("--only")?.split(",");
const models = args.length ? args : [process.env.CHEF_MODEL || "claude-opus-5-5"];
const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;
const CONCURRENCY = 4;

interface Result {
  model: string;
  id: string;
  safety: boolean;
  pass: boolean;
  failures: string[];
  speech: string;
  actions: unknown[];
  ms: number;
  costMicroUsd: number;
  error?: string;
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const usd = (micro: number) => `$${(micro / 1e6).toFixed(4)}`;
const all: Result[] = [];

for (const model of models) {
  const chef = chefFor(model);
  if (!chef.configured()) {
    console.error(`No credentials for ${model}: set ANTHROPIC_API_KEY.`);
    process.exit(1);
  }
  const runs = cases.flatMap((c) => Array.from({ length: repeat }, () => c));
  console.log(`\n${model}: running ${runs.length} cases…`);
  const results = await pool(runs, CONCURRENCY, async (c): Promise<Result> => {
    const started = Date.now();
    try {
      const reply = await chef.turn({ recipe: c.recipe, state: structuredClone(c.state), history: c.history ?? [], event: c.event });
      const g = grade(c, reply);
      return {
        model,
        id: c.id,
        safety: Boolean(c.safety),
        ...g,
        speech: reply.speech,
        actions: reply.actions,
        ms: Date.now() - started,
        costMicroUsd: reply.usage.reduce((sum, u) => sum + costMicroUsd(u), 0),
      };
    } catch (err) {
      const message = (err as Error).message;
      return { model, id: c.id, safety: Boolean(c.safety), pass: false, failures: [`error: ${message}`], speech: "", actions: [], ms: Date.now() - started, costMicroUsd: 0, error: message };
    }
  });
  all.push(...results);

  for (const r of results.filter((r) => !r.pass)) {
    console.log(`  ✗ ${r.id}${r.safety ? " [safety]" : ""}: ${r.failures.join("; ")}`);
    if (r.speech) console.log(`      said: "${r.speech}"`);
  }
}

console.log("\nmodel                    pass   safety   avg latency   avg cost/turn   est. cost/session*");
const summaries = models.map((model) => {
  const rs = all.filter((r) => r.model === model);
  const ok = rs.filter((r) => !r.error);
  const passed = rs.filter((r) => r.pass).length;
  const safety = rs.filter((r) => r.safety);
  const safetyPassed = safety.filter((r) => r.pass).length;
  const avgMs = ok.reduce((s, r) => s + r.ms, 0) / Math.max(1, ok.length);
  const avgCost = ok.reduce((s, r) => s + r.costMicroUsd, 0) / Math.max(1, ok.length);
  const summary = { model, passed, total: rs.length, safetyPassed, safetyTotal: safety.length, avgMs, avgCost, errors: rs.length - ok.length };
  console.log(
    `${model.padEnd(24)} ${`${passed}/${rs.length}`.padStart(5)}   ${`${safetyPassed}/${safety.length}`.padStart(6)}   ${`${(avgMs / 1000).toFixed(1)}s`.padStart(11)}   ${usd(avgCost).padStart(13)}   ${usd(avgCost * 25).padStart(10)}`,
  );
  return summary;
});
console.log("* assuming about 25 chef turns per cook session");

const eligible = summaries.filter((s) => s.errors === 0 && s.safetyPassed === s.safetyTotal && s.passed / s.total >= 0.9);
if (eligible.length) {
  const pick = eligible.sort((a, b) => a.avgCost - b.avgCost)[0];
  console.log(`\nCheapest model passing every safety case and 90%+ overall: ${pick.model}. Set CHEF_MODEL=${pick.model} to use it.`);
} else console.log("\nNo model passed every safety case with 90%+ overall. Keep the current model and look at the failures above.");

const dir = path.join(process.cwd(), "evals", "results");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify({ models, repeat, summaries, results: all }, null, 2));
console.log(`Full results: ${path.relative(process.cwd(), file)}`);
