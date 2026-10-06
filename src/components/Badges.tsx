"use client";

import type { Badge } from "@/lib/badges";
import type { UserBadge } from "@/lib/badgeAwards";

export function BadgeMedal({ badge, earned = true, size = 64 }: { badge: Pick<Badge, "emoji" | "name">; earned?: boolean; size?: number }) {
  return (
    <span
      role="img"
      aria-label={badge.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 ${
        earned ? "border-accent bg-accent-soft" : "border-dashed border-line bg-surface opacity-60 grayscale"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      {badge.emoji}
    </span>
  );
}

export function BadgeGrid({ badges }: { badges: UserBadge[] }) {
  const earnedCount = badges.filter((b) => b.earned).length;
  const categories = [...new Set(badges.map((b) => b.category))];
  return (
    <div className="px-5 pt-5">
      <p className="font-serif text-2xl">
        {earnedCount} of {badges.length} badges
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent" style={{ width: `${(earnedCount / badges.length) * 100}%` }} />
      </div>
      {categories.map((category) => (
        <section key={category} className="mt-7">
          <p className="label">{category}</p>
          <ul className="grid grid-cols-2 gap-3">
            {badges
              .filter((b) => b.category === category)
              .sort((a, b) => Number(b.earned) - Number(a.earned))
              .map((b) => (
                <li key={b.id} className={`flex flex-col items-center rounded-2xl border p-4 text-center ${b.earned ? "border-line bg-surface" : "border-line"}`}>
                  <BadgeMedal badge={b} earned={b.earned} size={56} />
                  <p className={`mt-2 font-serif text-lg leading-tight ${b.earned ? "" : "text-muted"}`}>{b.name}</p>
                  <p className="mt-1 text-xs leading-snug text-muted">{b.description}</p>
                  {b.earned ? (
                    <p className="mt-2 text-[11px] font-semibold tracking-wide text-accent uppercase">
                      Earned{b.earnedAt ? ` ${new Date(b.earnedAt.replace(" ", "T") + "Z").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
                    </p>
                  ) : (
                    b.target > 1 && (
                      <div className="mt-2 w-full">
                        <div className="h-1 overflow-hidden rounded-full bg-line">
                          <div className="h-full bg-ink/60" style={{ width: `${(b.value / b.target) * 100}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted tabular-nums">
                          {b.value} / {b.target}
                        </p>
                      </div>
                    )
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Full-screen card celebrating newly earned badges, one at a time. */
export function BadgeCelebration({ badges, onDone }: { badges: Badge[]; onDone: () => void }) {
  const [badge, ...rest] = badges;
  if (!badge) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6" onClick={onDone}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-bg p-8 text-center shadow-2xl">
        <p className="label">New badge</p>
        <div className="mt-3 flex justify-center">
          <BadgeMedal badge={badge} size={112} />
        </div>
        <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight">{badge.name}</h2>
        <p className="mt-2 text-muted">{badge.description}</p>
        <button onClick={onDone} className="btn btn-primary mt-7 w-full">
          {rest.length ? `Nice! (${rest.length} more)` : "Nice!"}
        </button>
      </div>
    </div>
  );
}
