import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";

// Exercises the Claude tool loop against a local mock of the Messages API.
test("claudeTurn runs tools, returns actions and speech", async () => {
  const requests: { headers: http.IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      requests.push({ headers: req.headers, body });
      const first = requests.length === 1;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          id: `msg_${requests.length}`,
          type: "message",
          role: "assistant",
          model: body.model,
          stop_reason: first ? "tool_use" : "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
          content: first
            ? [
                { type: "tool_use", id: "tu_1", name: "log_mishap", input: { summary: "Over-salted the sauce" } },
                { type: "tool_use", id: "tu_2", name: "revise_step", input: { step: 3, text: "Finish the sauce, no extra salt.", minutes: null } },
                { type: "tool_use", id: "tu_3", name: "go_to_step", input: { step: 99 } },
              ]
            : [{ type: "text", text: "Add a splash of cream to balance it. I've dropped the salt from the last step." }],
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  let reply: Awaited<ReturnType<typeof import("../src/lib/assistant/claude.ts").claudeTurn>>;
  try {
    const { claudeTurn } = await import("../src/lib/assistant/claude.ts");
    reply = await claudeTurn({
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
  } finally {
    server.close();
    server.closeAllConnections();
  }

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
  assert.match(String(first.headers["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  const msgs = first.body.messages as { role: string }[];
  assert.equal(msgs[0].role, "user");
  // Second request carries the tool results, with the invalid step flagged as an error.
  const results = (second.body.messages as { content: unknown }[]).at(-1)!.content as { tool_use_id: string; is_error?: boolean }[];
  assert.equal(results.length, 3);
  assert.equal(results.find((r) => r.tool_use_id === "tu_3")?.is_error, true);
});
