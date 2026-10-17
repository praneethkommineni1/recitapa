import type { Step } from "../types.ts";

/** What the cook-mode client knows about the session, sent with every assistant turn. */
export interface KitchenState {
  steps: Step[];
  /** 0-based index of the step the cook is on. */
  currentStep: number;
  elapsedSeconds: number;
  secondsOnStep: number;
  timers: { label: string; secondsLeft: number }[];
  mishaps: string[];
}

export type AssistantEvent =
  | { type: "start" }
  | { type: "utterance"; text: string }
  | { type: "timer_done"; label: string }
  | { type: "check_in" };

export type AssistantAction =
  | { type: "go_to_step"; step: number }
  | { type: "start_timer"; label: string; seconds: number }
  | { type: "cancel_timer"; label: string }
  | { type: "revise_step"; step: number; text: string; minutes: number | null }
  | { type: "insert_step"; after: number; text: string; minutes: number | null }
  | { type: "log_mishap"; summary: string };

export interface AssistantTurn {
  role: "cook" | "chef";
  text: string;
}

export interface AssistantReply {
  speech: string;
  actions: AssistantAction[];
  mode: "ai" | "offline";
}

/** Token usage of one model call, priced in pricing.ts. */
export interface CallUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ChefInput {
  recipe: {
    title: string;
    servings: number | null;
    ingredients: string[];
    /** Extra context about the recipe, e.g. that the cook scaled it. */
    note?: string;
  };
  state: KitchenState;
  history: AssistantTurn[];
  event: AssistantEvent;
}

export type ChefReply = AssistantReply & { usage: CallUsage[] };

/** A model provider that can run the sous-chef. Pick one with CHEF_MODEL (see chef.ts). */
export interface ChefProvider {
  name: string;
  model: string;
  configured(): boolean;
  turn(input: ChefInput): Promise<ChefReply>;
}

/** Thrown by a provider when the model can't be reached; cook mode falls back to basic mode. */
export class ChefUnavailableError extends Error {}
