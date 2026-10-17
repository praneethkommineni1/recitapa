"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/components/AppShell";
import { ChevronLeft, ChevronRight, ClockIcon, CloseIcon, MicIcon, SendIcon, SpeakerIcon } from "@/components/Icons";
import type { AssistantAction, AssistantEvent, AssistantReply, AssistantTurn, KitchenState } from "@/lib/assistant/types";
import { api } from "@/lib/client";
import { keepAwake } from "@/lib/keepAwake";
import type { AiOffReason, PlanInfo } from "@/lib/plan";
import type { RecipeDetail, Step } from "@/lib/types";
import { canListen, chime, listenOnce, speak, stopListening, stopSpeaking, unlockSpeech } from "@/lib/voice";

interface Timer {
  id: number;
  label: string;
  endsAt: number;
  total: number;
}

interface Session {
  steps: Step[];
  current: number;
  startedAt: number;
  stepStartedAt: number;
  lastActivityAt: number;
  checkedInStep: number | null;
  timers: Timer[];
  mishaps: string[];
  transcript: AssistantTurn[];
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

export default function CookPage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ recipe: RecipeDetail }>(`/api/recipes/${id}`).then((r) => setRecipe(r.recipe)).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <p className="pt-safe p-6 text-muted">{error}</p>;
  if (!recipe) return <div className="min-h-dvh" />;
  return <CookMode recipe={recipe} />;
}

function CookMode({ recipe }: { recipe: RecipeDetail }) {
  const router = useRouter();
  const { checkBadges } = useUser();
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(true);
  const [muted, setMuted] = useState(false);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(false);
  const [access, setAccess] = useState<{ ai: boolean; reason: AiOffReason | null; plan: PlanInfo } | null>(null);
  // Servings chosen on the recipe page (?servings=N), so the chef scales amounts it mentions.
  const [servings] = useState(() => (typeof window === "undefined" ? null : Number(new URLSearchParams(window.location.search).get("servings")) || null));
  const cookSessionId = useRef<number | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanInfo | null>(null);
  useEffect(() => {
    api<{ plan: PlanInfo }>("/api/plan").then((r) => setPlanPreview(r.plan)).catch(() => {});
  }, []);

  // Mutable session lives in a ref so timers and async replies always see the latest state.
  const session = useRef<Session>({
    steps: recipe.steps.map((s) => ({ ...s })),
    current: 0,
    startedAt: Date.now(),
    stepStartedAt: Date.now(),
    lastActivityAt: Date.now(),
    checkedInStep: null,
    timers: [],
    mishaps: [],
    transcript: [],
  });
  const queue = useRef<AssistantEvent[]>([]);
  const processing = useRef(false);
  const timerSeq = useRef(0);
  const flags = useRef({ handsFree, muted, finished });
  flags.current = { handsFree, muted, finished };
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const rerender = () => setTick((t) => t + 1);
  const s = session.current;

  const goTo = useCallback((index: number) => {
    const sess = session.current;
    sess.current = Math.max(0, Math.min(index, sess.steps.length - 1));
    sess.stepStartedAt = Date.now();
    sess.checkedInStep = null;
  }, []);

  const startTimer = useCallback((label: string, seconds: number) => {
    const sess = session.current;
    sess.timers = [...sess.timers.filter((t) => t.label !== label), { id: ++timerSeq.current, label, endsAt: Date.now() + seconds * 1000, total: seconds * 1000 }];
  }, []);

  const apply = useCallback(
    (action: AssistantAction) => {
      const sess = session.current;
      switch (action.type) {
        case "go_to_step":
          goTo(action.step);
          break;
        case "start_timer":
          startTimer(action.label, action.seconds);
          break;
        case "cancel_timer":
          sess.timers = sess.timers.filter((t) => t.label !== action.label);
          break;
        case "revise_step":
          if (sess.steps[action.step]) sess.steps[action.step] = { text: action.text, minutes: action.minutes };
          break;
        case "insert_step":
          sess.steps.splice(action.after, 0, { text: action.text, minutes: action.minutes });
          if (action.after <= sess.current) sess.current += 1;
          break;
        case "log_mishap":
          sess.mishaps.push(action.summary);
          break;
      }
    },
    [goTo, startTimer],
  );

  const listen = useCallback(async () => {
    if (!canListen() || flags.current.finished) return;
    await stopSpeaking();
    setListening(true);
    try {
      const heard = await listenOnce();
      setListening(false);
      if (heard) enqueue({ type: "utterance", text: heard });
    } catch (err) {
      setListening(false);
      setNotice((err as Error).message);
      setHandsFree(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const say = useCallback(
    async (text: string) => {
      if (!flags.current.muted) await speak(text);
      // In hands-free mode, open the mic again once the chef finishes talking.
      if (flags.current.handsFree && !processing.current && !queue.current.length) listen();
    },
    [listen],
  );

  const process = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    setBusy(true);
    // Don't let the mic pick up the chef's own voice.
    stopListening();
    let lastSpeech = "";
    while (queue.current.length) {
      const event = queue.current.shift()!;
      const sess = session.current;
      const now = Date.now();
      if (event.type === "utterance") sess.transcript.push({ role: "cook", text: event.text });
      const state: KitchenState = {
        steps: sess.steps,
        currentStep: sess.current,
        elapsedSeconds: Math.round((now - sess.startedAt) / 1000),
        secondsOnStep: Math.round((now - sess.stepStartedAt) / 1000),
        timers: sess.timers.map((t) => ({ label: t.label, secondsLeft: Math.max(0, Math.round((t.endsAt - now) / 1000)) })),
        mishaps: sess.mishaps,
      };
      rerender();
      try {
        const reply = await api<AssistantReply & { notice?: string }>("/api/assistant", {
          body: { recipeId: recipe.id, sessionId: cookSessionId.current, servings, state, event, history: sess.transcript.slice(0, -1).slice(-16) },
        });
        reply.actions.forEach(apply);
        sess.transcript.push({ role: "chef", text: reply.speech });
        setOffline(reply.mode === "offline");
        if (reply.notice) setNotice(reply.notice);
        lastSpeech = reply.speech;
      } catch (err) {
        sess.transcript.push({ role: "chef", text: `Sorry, I couldn't hear back: ${(err as Error).message}` });
      }
      sess.lastActivityAt = Date.now();
      rerender();
    }
    processing.current = false;
    setBusy(false);
    if (lastSpeech) say(lastSpeech);
  }, [apply, recipe.id, servings, say]);

  const enqueue = useCallback(
    (event: AssistantEvent) => {
      session.current.lastActivityAt = Date.now();
      queue.current.push(event);
      process();
    },
    [process],
  );

  // Clock: fire finished timers and proactive check-ins.
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      const sess = session.current;
      const now = Date.now();
      const done = sess.timers.filter((t) => t.endsAt <= now);
      if (done.length) {
        sess.timers = sess.timers.filter((t) => t.endsAt > now);
        chime();
        done.forEach((t) => enqueue({ type: "timer_done", label: t.label }));
      }
      const step = sess.steps[sess.current];
      const expected = step?.minutes ? step.minutes * 60_000 * 1.25 + 60_000 : 8 * 60_000;
      const quiet = now - sess.lastActivityAt > 90_000;
      if (!flags.current.finished && sess.checkedInStep !== sess.current && !sess.timers.length && quiet && now - sess.stepStartedAt > expected) {
        sess.checkedInStep = sess.current;
        enqueue({ type: "check_in" });
      }
      rerender();
    }, 1000);
    return () => clearInterval(interval);
  }, [started, enqueue]);

  // Keep the screen awake while cooking.
  useEffect(() => {
    if (!started) return;
    const release = keepAwake();
    return () => {
      release();
      stopSpeaking();
      stopListening();
    };
  }, [started]);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [s.transcript.length]);

  async function begin() {
    unlockSpeech(); // must run inside the tap for iOS
    try {
      const r = await api<{ sessionId: number; ai: boolean; reason: AiOffReason | null; plan: PlanInfo }>("/api/cook-sessions", {
        body: { recipeId: recipe.id },
      });
      cookSessionId.current = r.sessionId;
      setAccess(r);
      setOffline(!r.ai);
    } catch (err) {
      setNotice((err as Error).message);
      return;
    }
    const now = Date.now();
    Object.assign(session.current, { startedAt: now, stepStartedAt: now, lastActivityAt: now });
    setStarted(true);
    enqueue({ type: "start" });
  }

  function manualStep(delta: number) {
    stopListening();
    const next = s.current + delta;
    if (next >= s.steps.length) {
      finish();
      return;
    }
    goTo(next);
    session.current.lastActivityAt = Date.now();
    rerender();
    const step = s.steps[s.current];
    say(`Step ${s.current + 1}. ${step.text}`);
  }

  function finish() {
    setFinished(true);
    if (cookSessionId.current) api(`/api/cook-sessions/${cookSessionId.current}/finish`, { method: "POST" }).catch(() => {});
    checkBadges();
    stopListening();
    say("Nice work, chef. Snap a photo and share tonight's dinner to keep your streak going.");
  }

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    enqueue({ type: "utterance", text });
  }

  const step = s.steps[s.current];
  const now = Date.now();

  if (!started) {
    return (
      <main className="pt-safe pb-safe flex min-h-dvh flex-col px-6">
        <div className="flex h-14 items-center">
          <button onClick={() => router.back()} className="-ml-2 p-2" aria-label="Close"><CloseIcon /></button>
        </div>
        <div className="flex flex-1 flex-col justify-center">
          <p className="label">Cook mode</p>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">{recipe.title}</h1>
          <p className="mt-4 text-[17px] text-muted">
            Your sous-chef will talk you through each step, run the timers, and help if anything goes sideways. Just tell it
            what happened: &ldquo;I burned the garlic&rdquo; or &ldquo;I&apos;m out of cream.&rdquo;
          </p>
          <ul className="mt-6 space-y-1 text-sm text-muted">
            <li>· {s.steps.length} steps · {recipe.ingredients.length} ingredients</li>
            {planPreview && (
              <li>
                ·{" "}
                {planPreview.aiSessionsLimit === null
                  ? "The AI sous-chef is included."
                  : `${Math.max(0, planPreview.aiSessionsLimit - planPreview.aiSessionsUsed)} of ${planPreview.aiSessionsLimit} free AI chef sessions left this month.`}
              </li>
            )}
            <li>· {canListen() ? "Hands-free voice is on: speak after the chef finishes." : "Voice input isn't available here, so you can type to the chef."}</li>
          </ul>
        </div>
        <button onClick={begin} className="btn btn-accent mb-6 w-full !py-4 text-base"><MicIcon width={20} /> Start cooking</button>
      </main>
    );
  }

  return (
    <main className="pt-safe flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button onClick={() => router.back()} className="p-2" aria-label="Exit cook mode"><CloseIcon /></button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold">{recipe.title}</p>
          <p className="text-xs text-muted">
            <ClockIcon width={12} height={12} className="inline -mt-0.5" /> {fmt(now - s.startedAt)}
            {offline && " · basic mode"}
          </p>
        </div>
        <button onClick={() => { setMuted(!muted); if (!muted) stopSpeaking(); }} className="p-2" aria-label={muted ? "Unmute" : "Mute"}>
          <SpeakerIcon muted={muted} />
        </button>
      </header>

      <div className="flex shrink-0 gap-1 px-5">
        {s.steps.map((_, i) => (
          <button key={i} onClick={() => { goTo(i); rerender(); }} className={`h-1 flex-1 rounded-full ${i < s.current ? "bg-ink" : i === s.current ? "bg-accent" : "bg-line"}`} aria-label={`Go to step ${i + 1}`} />
        ))}
      </div>

      <section className="shrink-0 px-6 pt-6">
        <p className="label">Step {s.current + 1} of {s.steps.length}</p>
        <p className="font-serif text-[1.9rem] leading-[1.2] tracking-tight">{step?.text}</p>
        {step?.minutes && !s.timers.some((t) => t.label === `Step ${s.current + 1}`) && (
          <button onClick={() => { startTimer(`Step ${s.current + 1}`, step.minutes! * 60); rerender(); }} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium">
            <ClockIcon width={16} /> Start {step.minutes}-min timer
          </button>
        )}
      </section>

      {s.timers.length > 0 && (
        <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-6 pt-4">
          {s.timers.map((t) => {
            const left = t.endsAt - now;
            return (
              <div key={t.id} className="relative shrink-0 overflow-hidden rounded-2xl border border-line bg-surface px-4 py-2">
                <div className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${100 - (left / t.total) * 100}%` }} />
                <div className="relative flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted">{t.label}</p>
                    <p className="font-serif text-2xl tabular-nums">{fmt(left)}</p>
                  </div>
                  <button onClick={() => { session.current.timers = s.timers.filter((x) => x.id !== t.id); rerender(); }} className="text-muted" aria-label={`Cancel ${t.label} timer`}>
                    <CloseIcon width={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-line px-5 py-4">
        {s.transcript.map((t, i) => (
          <div key={i} className={`flex ${t.role === "cook" ? "justify-end" : ""}`}>
            <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${t.role === "cook" ? "bg-ink text-bg" : "border border-line bg-surface"}`}>{t.text}</p>
          </div>
        ))}
        {busy && <p className="text-sm text-muted italic">Chef is thinking…</p>}
        {notice && <p className="text-xs text-muted">{notice}</p>}
        {access?.reason === "limit" && (
          <div className="rounded-2xl bg-accent-soft p-4 text-sm">
            <p>
              You&apos;ve used your {access.plan.aiSessionsLimit} free AI chef sessions this month, so tonight is basic mode: steps,
              timers and common fixes.
            </p>
            <Link href="/plus" className="mt-2 inline-block font-semibold text-accent underline">Get unlimited with Plus</Link>
          </div>
        )}
        {(access?.reason === "budget" || access?.reason === "daily") && (
          <div className="rounded-2xl bg-accent-soft p-4 text-sm">
            <p>
              {access.reason === "budget"
                ? "The AI chef has reached its limit for this month, so tonight is basic mode: steps, timers and common fixes. It'll be back next month."
                : "You've cooked with the AI chef a lot today, so this session is basic mode: steps, timers and common fixes. It'll be back tomorrow."}
            </p>
          </div>
        )}
        <div ref={transcriptEnd} />
      </div>

      {finished ? (
        <div className="pb-safe shrink-0 border-t border-line px-5 pt-4 pb-4">
          <p className="font-serif text-2xl">Dinner is served.</p>
          <Link href={`/dinner/new?recipe=${recipe.id}`} className="btn btn-accent mt-3 w-full">Share tonight&apos;s dinner</Link>
          {access?.plan.plan === "free" && access.ai && access.plan.aiSessionsLimit !== null && (
            <p className="mt-3 text-center text-xs text-muted">
              {Math.max(0, (access.plan.aiSessionsLimit ?? 0) - access.plan.aiSessionsUsed)} free AI chef sessions left this month.{" "}
              <Link href="/plus" className="font-semibold text-ink underline">Go unlimited</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="pb-safe shrink-0 border-t border-line bg-bg px-4 pt-3 pb-3">
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {["Something went wrong", "How do I know it's done?", "What can I substitute?", "Repeat that"].map((q) => (
              <button key={q} onClick={() => enqueue({ type: "utterance", text: q })} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium whitespace-nowrap">{q}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => manualStep(-1)} disabled={s.current === 0} className="btn btn-ghost !p-3" aria-label="Previous step"><ChevronLeft width={20} /></button>
            {canListen() ? (
              <button
                onClick={() => (listening ? stopListening() : listen())}
                className={`btn flex-1 ${listening ? "btn-accent listening" : "btn-primary"}`}
              >
                <MicIcon width={18} /> {listening ? "Listening…" : "Talk to chef"}
              </button>
            ) : (
              <form onSubmit={submitDraft} className="flex flex-1 gap-2">
                <input className="input !rounded-full !py-2.5" placeholder="Tell the chef…" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button className="btn btn-primary !p-3" aria-label="Send"><SendIcon width={18} /></button>
              </form>
            )}
            <button onClick={() => manualStep(1)} className="btn btn-ghost !p-3" aria-label={s.current === s.steps.length - 1 ? "Finish" : "Next step"}>
              {s.current === s.steps.length - 1 ? "Done" : <ChevronRight width={20} />}
            </button>
          </div>
          {canListen() && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="accent-[var(--accent)]" />
                Hands-free
              </label>
              <form onSubmit={submitDraft} className="flex">
                <input className="w-28 border-b border-line bg-transparent py-1 text-xs outline-none" placeholder="or type…" value={draft} onChange={(e) => setDraft(e.target.value)} />
              </form>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
