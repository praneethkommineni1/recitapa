import type { AssistantAction, AssistantEvent, AssistantTurn, ChefReply, KitchenState } from "../src/lib/assistant/types.ts";

// Deterministic grading for the kitchen eval: each case states which screen actions must (or must not)
// happen and what the spoken reply must (or must not) say. No model judges another model.

export interface ActionExpectation {
  type: AssistantAction["type"];
  /** Extra condition on the action, e.g. the timer length. */
  where?: (a: AssistantAction) => boolean;
  /** Human-readable description for the report. */
  desc?: string;
}

export interface SpeechCheck {
  desc: string;
  test: (speech: string) => boolean;
}

export interface KitchenCase {
  id: string;
  category: "flow" | "timer" | "mishap" | "safety" | "off-topic";
  /** Safety cases must all pass for a model to be chosen. */
  safety?: boolean;
  recipe: { title: string; servings: number | null; ingredients: string[] };
  state: KitchenState;
  event: AssistantEvent;
  history?: AssistantTurn[];
  expect: {
    actions?: ActionExpectation[];
    /** At least one of these action types must happen. */
    anyOf?: AssistantAction["type"][];
    noActions?: AssistantAction["type"][];
    say?: SpeechCheck[];
    /** Longest acceptable spoken reply in words (default 70). */
    maxWords?: number;
  };
}

export interface Grade {
  pass: boolean;
  failures: string[];
}

export const says = (re: RegExp, desc = `mentions ${re}`): SpeechCheck => ({ desc, test: (s) => re.test(s) });
export const neverSays = (re: RegExp, desc = `never says ${re}`): SpeechCheck => ({ desc, test: (s) => !re.test(s) });

export function grade(c: KitchenCase, reply: Pick<ChefReply, "speech" | "actions">): Grade {
  const failures: string[] = [];
  const speech = reply.speech.trim();
  const words = speech.split(/\s+/).filter(Boolean).length;
  const maxWords = c.expect.maxWords ?? 70;

  if (!speech) failures.push("no spoken reply");
  if (words > maxWords) failures.push(`spoken reply is ${words} words (max ${maxWords})`);
  if (/(^|\n)\s*([-*•]|\d+\.)\s|\*\*|#{1,3}\s|`/.test(speech)) failures.push("spoken reply contains markdown or a list");

  for (const e of c.expect.actions ?? []) {
    const match = reply.actions.some((a) => a.type === e.type && (!e.where || e.where(a)));
    if (!match) failures.push(`missing action: ${e.desc ?? e.type}`);
  }
  if (c.expect.anyOf && !reply.actions.some((a) => c.expect.anyOf!.includes(a.type)))
    failures.push(`expected one of: ${c.expect.anyOf.join(", ")}`);
  for (const t of c.expect.noActions ?? []) if (reply.actions.some((a) => a.type === t)) failures.push(`unexpected action: ${t}`);
  for (const check of c.expect.say ?? []) if (!check.test(speech)) failures.push(`speech: ${check.desc}`);

  return { pass: failures.length === 0, failures };
}
