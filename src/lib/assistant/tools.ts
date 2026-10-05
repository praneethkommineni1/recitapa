import type Anthropic from "@anthropic-ai/sdk";
import type { AssistantAction, KitchenState } from "./types.ts";

type Tool = Anthropic.Beta.BetaTool;

const intProp = (description: string) => ({ type: "integer", description });
const strProp = (description: string) => ({ type: "string", description });

export const TOOLS: Tool[] = [
  {
    name: "go_to_step",
    description: "Move the cook-mode screen to a step (1-based). Use when the cook finishes a step, asks to go back, or should skip ahead.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { step: intProp("Step number, starting at 1.") },
      required: ["step"],
      additionalProperties: false,
    },
  },
  {
    name: "start_timer",
    description: "Start a countdown on the cook's screen. It alerts when done and you will be told. Use short labels like 'pasta' or 'rest steak'.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { label: strProp("Short label."), seconds: intProp("Duration in seconds (10-14400).") },
      required: ["label", "seconds"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_timer",
    description: "Cancel a running timer by its label.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { label: strProp("Label of the timer to cancel.") },
      required: ["label"],
      additionalProperties: false,
    },
  },
  {
    name: "revise_step",
    description: "Rewrite an upcoming step to account for a mishap, substitution or change of plan (e.g. reduce salt later after over-salting, extend a time). The cook sees the new text.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        step: intProp("Step number to rewrite, starting at 1."),
        text: strProp("Full replacement instruction."),
        minutes: { type: ["integer", "null"], description: "Timer minutes for the step, or null for none." },
      },
      required: ["step", "text", "minutes"],
      additionalProperties: false,
    },
  },
  {
    name: "insert_step",
    description: "Insert a new recovery or extra step into the plan after the given step number (0 = at the very start).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        after: intProp("Insert after this step number (0 for first)."),
        text: strProp("Instruction for the new step."),
        minutes: { type: ["integer", "null"], description: "Timer minutes for the step, or null for none." },
      },
      required: ["after", "text", "minutes"],
      additionalProperties: false,
    },
  },
  {
    name: "log_mishap",
    description: "Record a mishap (burnt, over-salted, missing ingredient...) so later advice accounts for it.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { summary: strProp("One-line description of what went wrong and the fix chosen.") },
      required: ["summary"],
      additionalProperties: false,
    },
  },
];

/**
 * Validate a tool call against the live plan and convert it to a client action.
 * Applies the action to `state` so later calls in the same turn see the effect.
 * Returns an error string when the input is unusable.
 */
export function toAction(name: string, input: unknown, state: KitchenState): AssistantAction | string {
  const a = (input ?? {}) as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : NaN);
  const text = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const minutes = (v: unknown) => (v === null || v === undefined ? null : Math.min(Math.max(int(v), 1), 1440) || null);
  const n = state.steps.length;

  switch (name) {
    case "go_to_step": {
      const step = int(a.step);
      if (!(step >= 1 && step <= n)) return `step must be between 1 and ${n}`;
      state.currentStep = step - 1;
      state.secondsOnStep = 0;
      return { type: "go_to_step", step: step - 1 };
    }
    case "start_timer": {
      const label = text(a.label, 40);
      const seconds = int(a.seconds);
      if (!label || !(seconds >= 10 && seconds <= 14_400)) return "label required and seconds must be 10-14400";
      state.timers = [...state.timers.filter((t) => t.label !== label), { label, secondsLeft: seconds }];
      return { type: "start_timer", label, seconds };
    }
    case "cancel_timer": {
      const label = text(a.label, 40);
      if (!state.timers.some((t) => t.label === label)) return `no running timer called "${label}"`;
      state.timers = state.timers.filter((t) => t.label !== label);
      return { type: "cancel_timer", label };
    }
    case "revise_step": {
      const step = int(a.step);
      const t = text(a.text);
      if (!(step >= 1 && step <= n) || !t) return `step must be between 1 and ${n} and text is required`;
      state.steps[step - 1] = { text: t, minutes: minutes(a.minutes) };
      return { type: "revise_step", step: step - 1, text: t, minutes: minutes(a.minutes) };
    }
    case "insert_step": {
      const after = int(a.after);
      const t = text(a.text);
      if (!(after >= 0 && after <= n) || !t || n >= 80) return `after must be between 0 and ${n} and text is required`;
      state.steps.splice(after, 0, { text: t, minutes: minutes(a.minutes) });
      if (after <= state.currentStep) state.currentStep += 1;
      return { type: "insert_step", after, text: t, minutes: minutes(a.minutes) };
    }
    case "log_mishap": {
      const summary = text(a.summary, 200);
      if (!summary) return "summary required";
      state.mishaps.push(summary);
      return { type: "log_mishap", summary };
    }
    default:
      return `unknown tool ${name}`;
  }
}
