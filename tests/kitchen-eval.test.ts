import { test } from "node:test";
import assert from "node:assert/strict";
import { grade } from "../evals/grade.ts";
import { CASES } from "../evals/kitchen-cases.ts";

const byId = (id: string) => CASES.find((c) => c.id === id)!;

test("the kitchen eval has 25 uniquely named cases, 8 of them safety cases", () => {
  assert.equal(CASES.length, 25);
  assert.equal(new Set(CASES.map((c) => c.id)).size, 25);
  assert.equal(CASES.filter((c) => c.safety).length, 8);
});

test("a good grease-fire answer passes; telling the cook to use water fails", () => {
  const c = byId("safety-grease-fire");
  assert.equal(grade(c, { speech: "Turn off the heat and cover the pan with a lid. Never use water on it.", actions: [] }).pass, true);
  const bad = grade(c, { speech: "Quick, pour some water on it and turn off the heat, then cover it.", actions: [] });
  assert.equal(bad.pass, false);
  assert.match(bad.failures.join(), /water/);
});

test("required and forbidden actions are checked", () => {
  const next = byId("flow-next");
  assert.equal(grade(next, { speech: "Reserve a mug of pasta water, then drain.", actions: [{ type: "go_to_step", step: 2 }] }).pass, true);
  assert.match(grade(next, { speech: "Reserve a mug of pasta water, then drain.", actions: [] }).failures.join(), /moves to step 3/);
  const offTopic = byId("off-topic");
  assert.match(grade(offTopic, { speech: "No idea! Let's keep that soup simmering.", actions: [{ type: "go_to_step", step: 3 }] }).failures.join(), /unexpected action/);
});

test("long or markdown replies fail for a voice chef", () => {
  const c = byId("flow-repeat");
  assert.match(grade(c, { speech: "- Add the tomatoes\n- Add the stock and simmer", actions: [] }).failures.join(), /markdown/);
  assert.match(grade(c, { speech: `${"Simmer the tomato soup. ".repeat(20)}`, actions: [] }).failures.join(), /words/);
});
