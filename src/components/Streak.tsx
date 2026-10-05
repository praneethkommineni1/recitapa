"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, localToday } from "@/lib/client";
import type { StreakInfo } from "@/lib/types";
import { FlameIcon } from "./Icons";

export function StreakCard() {
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  useEffect(() => {
    api<{ streak: StreakInfo }>(`/api/streak?today=${localToday()}`).then((r) => setStreak(r.streak));
  }, []);
  if (!streak) return <div className="mx-5 h-[88px]" />;

  const { current, longest, cookedToday, atRisk } = streak;
  const message = cookedToday
    ? "Dinner's logged. See you tomorrow night."
    : atRisk
      ? "Cook tonight to keep your streak alive."
      : "Make dinner tonight to start a streak.";

  return (
    <section className="mx-5 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
      <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${current ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"}`}>
        <FlameIcon width={20} height={20} />
        <span className="font-serif text-xl leading-none">{current}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-xl leading-tight">
          {current ? `${current}-night dinner streak` : "No streak yet"}
        </p>
        <p className="text-sm text-muted">
          {message}
          {longest > current && ` Best: ${longest}.`}
        </p>
      </div>
      {!cookedToday && (
        <Link href="/dinner/new" className="btn btn-primary shrink-0 !px-4 !py-2 text-sm">Log</Link>
      )}
    </section>
  );
}
