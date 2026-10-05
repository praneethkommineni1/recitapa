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
