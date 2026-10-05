"use client";

// Speech in/out. Inside the iOS app (Capacitor) we use native plugins because WKWebView
// has no Web Speech recognition; in browsers we use the Web Speech API.

import { Capacitor } from "@capacitor/core";

const isNative = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

type WebRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function webRecognitionCtor(): (new () => WebRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return isNative() || webRecognitionCtor() !== null;
}

let preferredVoice: SpeechSynthesisVoice | null = null;
function pickVoice(): SpeechSynthesisVoice | null {
  if (preferredVoice || typeof speechSynthesis === "undefined") return preferredVoice;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  preferredVoice =
    voices.find((v) => /samantha|ava|allison|google us english|premium|enhanced/i.test(v.name)) ?? voices.find((v) => v.default) ?? voices[0] ?? null;
  return preferredVoice;
}

/** Speak text and resolve when finished. */
export async function speak(text: string): Promise<void> {
  if (!text) return;
  if (isNative()) {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop().catch(() => {});
    await TextToSpeech.speak({ text, lang: "en-US", rate: 1.0, category: "playback" }).catch(() => {});
    return;
  }
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = 1.02;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
    // Safari occasionally never fires onend.
    setTimeout(resolve, 1500 + text.length * 90);
  });
}

export async function stopSpeaking(): Promise<void> {
  if (isNative()) {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop().catch(() => {});
  } else if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

/** Call from a user gesture so iOS Safari allows later speech. */
export function unlockSpeech(): void {
  if (!isNative() && typeof speechSynthesis !== "undefined") {
    speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    pickVoice();
  }
}

let activeWeb: WebRecognition | null = null;

/** Listen for a single utterance. Resolves with the transcript, or "" if nothing was heard. */
export async function listenOnce(): Promise<string> {
  if (isNative()) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== "granted") throw new Error("Microphone permission was denied.");
    const result = await SpeechRecognition.start({ language: "en-US", maxResults: 1, partialResults: false, popup: false });
    return result.matches?.[0]?.trim() ?? "";
  }
  const Ctor = webRecognitionCtor();
  if (!Ctor) throw new Error("Voice input isn't supported in this browser. You can type instead.");
  stopListening();
  return new Promise<string>((resolve, reject) => {
    const rec = new Ctor();
    activeWeb = rec;
    let heard = "";
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      heard = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") reject(new Error("Microphone permission was denied."));
    };
    rec.onend = () => {
      if (activeWeb === rec) activeWeb = null;
      resolve(heard);
    };
    rec.start();
  });
}

export async function stopListening(): Promise<void> {
  if (isNative()) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    await SpeechRecognition.stop().catch(() => {});
  } else if (activeWeb) {
    activeWeb.abort();
    activeWeb = null;
  }
}

/** Short kitchen-timer chime. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.22);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* audio unavailable */
  }
}
