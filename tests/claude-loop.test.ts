import { after, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Exercises the Claude provider against a local mock of the Messages API. The SDK client is created
// once per process, so every test shares one mock server and swaps in its own responder.
type Req = { headers: http.IncomingHttpHeaders; body: Record<string, unknown> };
type Responder = (body: Record<string, unknown>, n: number) => { status?: number; json: unknown };

let requests: Req[] = [];
let responder: Responder = () => ({ json: {} });
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    requests.push({ headers: req.headers, body });
    const { status = 200, json } = responder(body, requests.length);
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(json));
  });
});
await new Promise<void>((r) => server.listen(0, r));
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
after(() => {
  server.close();
  server.closeAllConnections();
});

function respond(fn: Responder) {
  requests = [];
  responder = fn;
}

const message = (body: Record<string, unknown>, content: unknown[], stop_reason = "end_turn", model = body.model) => ({
  json: {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 100 },
    content,
  },
});

const { claudeTurn } = await import("../src/lib/assistant/claude.ts");
const { chefFor } = await import("../src/lib/assistant/chef.ts");
const { costMicroUsd } = await import("../src/lib/assistant/pricing.ts");
const { ChefUnavailableError } = await import("../src/lib/assistant/types.ts");

test("claudeTurn runs tools, returns actions and speech", async () => {
  respond((body, n) =>
    n === 1
      ? message(
          body,
          [
            { type: "tool_use", id: "tu_1", name: "log_mishap", input: { summary: "Over-salted the sauce" } },
            { type: "tool_use", id: "tu_2", name: "revise_step", input: { step: 3, text: "Finish the sauce, no extra salt.", minutes: null } },
            { type: "tool_use", id: "tu_3", name: "go_to_step", input: { step: 99 } },
          ],
          "tool_use",
        )
      : message(body, [{ type: "text", text: "Add a splash of cream to balance it. I've dropped the salt from the last step." }]),
  );

  const reply = await claudeTurn({
    recipe: { title: "Pasta", servings: 2, ingredients: ["pasta", "salt"] },
    state: {
      steps: [
        { text: "Boil", minutes: 8 },
        { text: "Make sauce", minutes: null },
        { text: "Season sauce with salt", minutes: null },
      ],
      currentStep: 1,
      elapsedSeconds: 300,
      secondsOnStep: 30,
      timers: [],
      mishaps: [],
    },
    history: [{ role: "chef", text: "dropped: history must start with the cook" }, { role: "cook", text: "hi" }, { role: "chef", text: "Hello" }],
    event: { type: "utterance", text: "I put way too much salt in" },
  });

  assert.equal(reply.mode, "ai");
  assert.match(reply.speech, /splash of cream/);
  assert.deepEqual(reply.actions, [
    { type: "log_mishap", summary: "Over-salted the sauce" },
    { type: "revise_step", step: 2, text: "Finish the sauce, no extra salt.", minutes: null },
  ]);

  assert.equal(requests.length, 2);
  const [first, second] = requests;
  assert.equal(first.body.model, "claude-opus-5-5");
  assert.equal(first.body.fallbacks, "default");
  assert.deepEqual(first.body.output_config, { effort: "low" });
  assert.match(String(first.headers["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  const msgs = first.body.messages as { role: string }[];
  assert.equal(msgs[0].role, "user");
  // Second request carries the tool results, with the invalid step flagged as an error.
  const results = (second.body.messages as { content: unknown }[]).at(-1)!.content as { tool_use_id: string; is_error?: boolean }[];
  assert.equal(results.length, 3);
  assert.equal(results.find((r) => r.tool_use_id === "tu_3")?.is_error, true);
});

const kitchen = {
  recipe: { title: "Soup", servings: 4, ingredients: ["1 litre stock"], note: "The cook scaled this recipe from 2 to 4 servings." },
  state: { steps: [{ text: "Simmer", minutes: 10 }], currentStep: 0, elapsedSeconds: 0, secondsOnStep: 0, timers: [], mishaps: [] },
  history: [],
  event: { type: "utterance" as const, text: "What now?" },
};

test("CHEF_MODEL picks the model; Haiku requests leave out effort and refusal fallbacks", async () => {
  respond((body) => message(body, [{ type: "text", text: "Keep stirring." }], "end_turn", `${body.model}-20251001`));
  const chef = chefFor("claude:claude-haiku-4-5");
  assert.equal(chef.model, "claude-haiku-4-5");
  const reply = await chef.turn(kitchen);
  assert.equal(reply.speech, "Keep stirring.");
  // Priced as Haiku even though the API reports a dated id: 1000 × $1 + 100 × $5 per million tokens.
  assert.equal(costMicroUsd(reply.usage[0]), 1500);
  const { body, headers } = requests[0];
  assert.equal(body.model, "claude-haiku-4-5");
  assert.equal(body.fallbacks, undefined);
  assert.equal(body.output_config, undefined);
  assert.doesNotMatch(String(headers["anthropic-beta"] ?? ""), /server-side-fallback/);
  // The scaling note reaches the model with the recipe.
  assert.match(JSON.stringify(body.system), /scaled this recipe from 2 to 4/);
});

test("an API error becomes ChefUnavailableError so cook mode falls back to basic mode", async () => {
  respond(() => ({ status: 400, json: { type: "error", error: { type: "invalid_request_error", message: "bad request" } } }));
  await assert.rejects(chefFor("claude-opus-5-5").turn(kitchen), (err) => err instanceof ChefUnavailableError && /400/.test(err.message));
  assert.equal(requests.length, 1);
});

test("chefFor rejects unknown providers", () => {
  assert.throws(() => chefFor("gemini:flash"), /Unknown chef provider/);
});
