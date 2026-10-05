import type { AssistantAction, AssistantEvent, AssistantReply, KitchenState } from "./types.ts";

// A small rule-based helper used when no Claude API key is configured, so cook mode still works.

const MISHAPS: { match: RegExp; tip: string }[] = [
  { match: /fire|flame/, tip: "Safety first: turn off the heat and cover the pan with a lid or baking sheet. Never use water on a grease fire." },
  { match: /burn|burnt|scorch|black/, tip: "Don't stir the burnt bits in. Move everything that isn't stuck into a clean pan and carry on there. If it tastes smoky, a squeeze of acid or a pinch of sugar helps." },
  { match: /salt/, tip: "To rescue too much salt, add more of the unsalted base: liquid, starch, or vegetables, plus a splash of acid. I'll skip any more salt until you taste at the end." },
  { match: /spic|too hot|chili|chilli/, tip: "To tame the heat, add dairy, a little sugar or honey, acid, or bulk it out with more of the other ingredients." },
  { match: /curdl|split|broke/, tip: "Take it off the heat. Whisk in a spoonful of cold liquid, or blend it briefly to bring it back together." },
  { match: /thin|watery|runny/, tip: "Let it simmer uncovered to reduce, or stir in a little cornstarch mixed with cold water." },
  { match: /thick|dry/, tip: "Loosen it with a splash of warm stock, water or pasta water, a little at a time." },
  { match: /undercook|raw|not done|pink/, tip: "Give it more time over moderate heat and check again in a few minutes. For poultry, make sure it reaches 74°C or 165°F inside." },
  { match: /overcook|mushy|tough/, tip: "No problem. Slice it thinner and serve with extra sauce, or turn it into a soup or fried rice tomorrow." },
  { match: /stick|stuck/, tip: "Lower the heat and add a little fat. Let it release on its own before turning it." },
  { match: /out of|don't have|dont have|missing|no more/, tip: "Tell me what you're missing and use the closest thing you have. Most recipes forgive a swap." },
  { match: /drop|spill/, tip: "Clean up safely first. Then see what's left; we can scale the rest down or skip that bit." },
];

const mmss = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m ? `${m} minute${m === 1 ? "" : "s"}${sec ? ` ${sec} seconds` : ""}` : `${sec} seconds`;
};

function readStep(state: KitchenState, index: number, actions: AssistantAction[]): string {
  const step = state.steps[index];
  if (!step) return "That's the last step. Enjoy your dinner, and don't forget to share it!";
  if (step.minutes) actions.push({ type: "start_timer", label: `Step ${index + 1}`, seconds: step.minutes * 60 });
  const text = /[.!?]$/.test(step.text) ? step.text : `${step.text}.`;
  return `Step ${index + 1}. ${text}${step.minutes ? ` I started a timer for ${step.minutes} minutes.` : ""}`;
}

export function offlineTurn(state: KitchenState, event: AssistantEvent): AssistantReply {
  const actions: AssistantAction[] = [];
  const reply = (speech: string): AssistantReply => ({ speech, actions, mode: "offline" });
  const go = (index: number) => {
    if (index < state.steps.length) actions.push({ type: "go_to_step", step: index });
    return readStep(state, index, actions);
  };

  switch (event.type) {
    case "start":
      return reply(`Let's cook. ${go(0)}`);
    case "timer_done":
      return reply(`${event.label} timer is done. Say "next" when you're ready to move on.`);
    case "check_in":
      return reply(`Still on step ${state.currentStep + 1}? Take your time. Say "next" when it's done, or tell me if something's off.`);
    case "utterance": {
      const t = event.text.toLowerCase();
      const mishap = MISHAPS.find((m) => m.match.test(t));
      if (mishap) {
        actions.push({ type: "log_mishap", summary: event.text.slice(0, 200) });
        return reply(mishap.tip);
      }
      if (/\b(next|done|finished|ready)\b/.test(t)) return reply(go(state.currentStep + 1));
      if (/\b(back|previous)\b/.test(t)) return reply(go(Math.max(0, state.currentStep - 1)));
      if (/\b(timer|how long|time left)\b/.test(t)) {
        if (!state.timers.length) return reply("No timers are running.");
        return reply(state.timers.map((x) => `${x.label} has ${mmss(x.secondsLeft)} left.`).join(" "));
      }
      if (/\b(repeat|again|what)\b/.test(t)) return reply(readStep(state, state.currentStep, []));
      return reply(`I'm in offline mode, so I can do "next", "back", "repeat", timers, and common fixes like burnt, too salty or too thin.`);
    }
  }
}
