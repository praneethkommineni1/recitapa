import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineTurn } from "../src/lib/assistant/offline.ts";
import { toAction } from "../src/lib/assistant/tools.ts";
import type { KitchenState } from "../src/lib/assistant/types.ts";

const state = (): KitchenState => ({
  steps: [
    { text: "Boil water", minutes: 10 },
    { text: "Cook pasta", minutes: 9 },
    { text: "Make sauce", minutes: null },
  ],
  currentStep: 1,
  elapsedSeconds: 600,
  secondsOnStep: 60,
  timers: [{ label: "pasta", secondsLeft: 300 }],
  mishaps: [],
});

test("offline start reads step 1 and starts its timer", () => {
  const r = offlineTurn(state(), { type: "start" });
  assert.match(r.speech, /Step 1\. Boil water/);
  assert.deepEqual(r.actions, [
    { type: "go_to_step", step: 0 },
    { type: "start_timer", label: "Step 1", seconds: 600 },
  ]);
});

test("offline next advances", () => {
  const r = offlineTurn(state(), { type: "utterance", text: "ok I'm done" });
  assert.deepEqual(r.actions[0], { type: "go_to_step", step: 2 });
});

test("offline handles mishaps and logs them", () => {
  const r = offlineTurn(state(), { type: "utterance", text: "I added way too much salt" });
  assert.match(r.speech, /salt/);
  assert.equal(r.actions[0].type, "log_mishap");
});

test("offline reports timers", () => {
  const r = offlineTurn(state(), { type: "utterance", text: "how long is left on the timer?" });
  assert.match(r.speech, /pasta has 5 minutes left/);
});

test("toAction validates step bounds", () => {
  assert.equal(typeof toAction("go_to_step", { step: 9 }, state()), "string");
  assert.deepEqual(toAction("go_to_step", { step: 3 }, state()), { type: "go_to_step", step: 2 });
});

test("insert_step before the current step shifts the current index", () => {
  const s = state();
  const a = toAction("insert_step", { after: 0, text: "Rinse the pan", minutes: null }, s);
  assert.deepEqual(a, { type: "insert_step", after: 0, text: "Rinse the pan", minutes: null });
  assert.equal(s.currentStep, 2);
  assert.equal(s.steps[0].text, "Rinse the pan");
});

test("revise_step rewrites the plan", () => {
  const s = state();
  toAction("revise_step", { step: 3, text: "Make sauce without salt", minutes: 5 }, s);
  assert.deepEqual(s.steps[2], { text: "Make sauce without salt", minutes: 5 });
});
