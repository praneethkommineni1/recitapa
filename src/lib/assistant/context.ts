import type { AssistantEvent, KitchenState } from "./types.ts";

const mmss = (s: number) => `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;

/** Render the live plan + clock as text for the model. Steps are numbered from 1. */
export function describeState(state: KitchenState): string {
  const plan = state.steps
    .map((s, i) => {
      const marker = i === state.currentStep ? " <- CURRENT" : i < state.currentStep ? " (done)" : "";
      return `${i + 1}. ${s.text}${s.minutes ? ` [timer: ${s.minutes} min]` : ""}${marker}`;
    })
    .join("\n");
  const timers = state.timers.length
    ? state.timers.map((t) => `"${t.label}" ${mmss(t.secondsLeft)} left`).join("; ")
    : "none";
  return [
    `Current plan:\n${plan}`,
    `Cooking for ${mmss(state.elapsedSeconds)}; on step ${state.currentStep + 1} of ${state.steps.length} for ${mmss(state.secondsOnStep)}.`,
    `Running timers: ${timers}.`,
    state.mishaps.length ? `Mishaps so far: ${state.mishaps.join("; ")}.` : "No mishaps so far.",
  ].join("\n");
}

export function describeEvent(event: AssistantEvent, state: KitchenState): string {
  switch (event.type) {
    case "start":
      return "The cook just opened cook mode. Greet them in one short sentence, mention anything to prep first if it matters, then read step 1 and start its timer if it has one.";
    case "utterance":
      return `The cook says: "${event.text}"`;
    case "timer_done":
      return `The timer "${event.label}" just went off. Tell the cook what to do now.`;
    case "check_in": {
      const step = state.steps[state.currentStep];
      return `No word from the cook for a while; they have been on step ${state.currentStep + 1} ("${step?.text ?? ""}") longer than expected. Check in briefly with something useful (a doneness cue or what to look for).`;
    }
  }
}
