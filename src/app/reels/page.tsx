"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { BookmarkIcon, ClockIcon, CloseIcon, CommentIcon, HeartIcon, SendIcon } from "@/components/Icons";
import { totalMinutes, useToggles } from "@/components/RecipeCard";
import { api } from "@/lib/client";
import type { Reel } from "@/lib/types";

/** How long a reel must stay on screen before it counts as watched. */
const VIEW_MS = 1200;

export default function ReelsPage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "done" | "error">("loading");
  const [active, setActive] = useState(0);
  // Follow state per author, so following from one reel updates every reel by that cook.
  const [following, setFollowing] = useState<Record<number, boolean>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const shown = useRef<number[]>([]);
  const loading = useRef(false);

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await api<{ reels: Reel[] }>(`/api/reels?exclude=${shown.current.join(",")}`);
      shown.current.push(...r.reels.map((x) => x.id));
      setReels((prev) => [...prev, ...r.reels]);
      setFollowing((prev) => Object.fromEntries([...r.reels.map((x) => [x.author.id, x.following]), ...Object.entries(prev)]));
      setStatus(r.reels.length ? "ready" : "done");
    } catch {
      setStatus("error");
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  // Fetch the next page a few reels before the end.
  useEffect(() => {
    if (status === "ready" && active >= reels.length - 3) loadMore();
  }, [active, reels.length, status, loadMore]);

  // The reel filling most of the screen is the active one.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  const activeId = reels[active]?.id;
  useEffect(() => {
    if (!activeId) return;
    const t = setTimeout(() => api(`/api/reels/${activeId}/view`, { body: {} }).catch(() => {}), VIEW_MS);
    return () => clearTimeout(t);
  }, [activeId]);

  // Arrow keys and j/k flip through reels on a computer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = scroller.current;
      if (!root || (e.target as HTMLElement).closest("input, textarea")) return;
      const dir = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      root.scrollBy({ top: dir * root.clientHeight, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleFollow = async (reel: Reel) => {
    const id = reel.author.id;
    setFollowing((f) => ({ ...f, [id]: !f[id] }));
    const r = await api<{ following: boolean }>(`/api/users/${reel.author.username}/follow`, { body: {} }).catch(() => null);
    if (r) setFollowing((f) => ({ ...f, [id]: r.following }));
  };

  return (
    <>
      <div ref={scroller} className="no-scrollbar fixed inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-none bg-black text-white">
        {reels.map((reel, i) => (
          <ReelView
            key={reel.id}
            reel={reel}
            index={i}
            active={i === active}
            near={Math.abs(i - active) <= 2}
            following={following[reel.author.id] ?? reel.following}
            onToggleFollow={() => toggleFollow(reel)}
          />
        ))}
        {status !== "ready" && (
          <section className="flex h-dvh snap-start flex-col items-center justify-center px-10 text-center">
            {status === "loading" && <p className="text-white/70">Finding something delicious…</p>}
            {status === "error" && (
              <>
                <p className="font-serif text-3xl">Couldn&apos;t load reels</p>
                <button onClick={loadMore} className="btn mt-5 bg-white text-black">Try again</button>
              </>
            )}
            {status === "done" && (
              <>
                <p className="font-serif text-3xl">{reels.length ? "You're all caught up" : "No recipes to discover yet"}</p>
                <p className="mt-2 text-sm text-white/70">
                  {reels.length ? "Come back later for new recipes, or share one of your own." : "Be the first: share a recipe and it shows up here for everyone."}
                </p>
                <Link href="/recipes/new" className="btn mt-5 bg-white text-black">Share a recipe</Link>
              </>
            )}
          </section>
        )}
      </div>
      <header className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-10 bg-gradient-to-b from-black/50 to-transparent text-white">
        <div className="mx-auto flex h-14 max-w-xl items-center px-5">
          <h1 className="font-serif text-[1.65rem] leading-none tracking-tight">Reels</h1>
        </div>
      </header>
    </>
  );
}

function ReelView({
  reel,
  index,
  active,
  near,
  following,
  onToggleFollow,
}: {
  reel: Reel;
  index: number;
  active: boolean;
  near: boolean;
  following: boolean;
  onToggleFollow: () => void;
}) {
  const { liked, saved, likes, toggleLike, toggleSave } = useToggles(reel);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lastTap = useRef(0);
  const time = totalMinutes(reel);

  // Double-tap anywhere on the picture to like, Instagram style.
  const onTap = (e: React.PointerEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) toggleLike();
      const rect = e.currentTarget.getBoundingClientRect();
      const heart = { id: now, x: e.clientX - rect.left, y: e.clientY - rect.top };
      setHearts((h) => [...h, heart]);
      setTimeout(() => setHearts((h) => h.filter((x) => x.id !== heart.id)), 900);
      lastTap.current = 0;
    } else lastTap.current = now;
  };

  const share = async () => {
    const url = `${location.origin}/recipes/${reel.id}`;
    if (navigator.share) return navigator.share({ title: reel.title, url }).catch(() => {});
    await navigator.clipboard?.writeText(url).catch(() => {});
    setToast("Link copied");
    setTimeout(() => setToast(null), 1500);
  };

  return (
    <section data-index={index} className={`relative h-dvh snap-start snap-always overflow-hidden ${active ? "reel-active" : ""}`}>
      <div className="relative mx-auto h-full max-w-xl overflow-hidden">
        <div className="absolute inset-0 touch-manipulation" onPointerUp={onTap}>
          {reel.photoUrl ? (
            near && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reel.photoUrl} alt="" className="reel-photo h-full w-full object-cover" draggable={false} />
            )
          ) : (
            <div className="h-full w-full" style={{ background: cardGradient(reel.id) }} />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
          {hearts.map((h) => (
            <HeartIcon key={h.id} filled className="reel-heart pointer-events-none absolute text-white" width={96} height={96} style={{ left: h.x - 48, top: h.y - 48 }} />
          ))}
        </div>

        {/* Actions */}
        <div className="reel-bottom absolute right-2 bottom-0 flex flex-col items-center gap-4">
          <RailButton label="Like" onClick={toggleLike} count={likes}>
            <HeartIcon filled={liked} width={30} height={30} className={liked ? "text-[#ff4d6d]" : ""} />
          </RailButton>
          <RailButton label="Comments" href={`/recipes/${reel.id}#comments`} count={reel.commentCount}>
            <CommentIcon width={30} height={30} />
          </RailButton>
          <RailButton label={saved ? "Unsave" : "Save"} onClick={toggleSave}>
            <BookmarkIcon filled={saved} width={30} height={30} />
          </RailButton>
          <RailButton label="Share" onClick={share}>
            <SendIcon width={28} height={28} />
          </RailButton>
        </div>

        {/* Caption, with the ingredient list filling the space above it when there's no photo. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          {reel.photoUrl ? <div className="flex-1" /> : <IngredientList reel={reel} />}
          <div className="reel-bottom pr-20 pl-4">
            <div className="pointer-events-auto flex items-center gap-2.5">
              <Link href={`/u/${reel.author.username}`} className="flex min-w-0 items-center gap-2.5">
                <Avatar user={reel.author} size={34} />
                <span className="truncate text-sm font-semibold">{reel.author.displayName}</span>
              </Link>
              <button
                onClick={onToggleFollow}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${following ? "border-white/40 text-white/80" : "border-white"}`}
              >
                {following ? "Following" : "Follow"}
              </button>
            </div>
            <Link href={`/recipes/${reel.id}`} className="pointer-events-auto mt-3 block font-serif text-[1.75rem] leading-tight tracking-tight">
              {reel.title}
            </Link>
            {reel.description && (
              <button onClick={() => setExpanded(!expanded)} className={`pointer-events-auto mt-1 block text-left text-[15px] text-white/85 ${expanded ? "" : "line-clamp-2"}`}>
                {reel.description}
              </button>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/75">
              {time && <span className="flex items-center gap-1"><ClockIcon width={14} height={14} />{time}</span>}
              {reel.servings ? <span>Serves {reel.servings}</span> : null}
              {reel.cookedCount > 0 && <span>Cooked {reel.cookedCount}×</span>}
              {reel.tags.slice(0, 3).map((t) => (
                <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`} className="pointer-events-auto">#{t}</Link>
              ))}
            </div>
            <div className="pointer-events-auto mt-3.5 flex gap-2">
              <button onClick={() => setSheet(true)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
                Ingredients
              </button>
              <Link href={`/recipes/${reel.id}/cook`} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
                Cook this
              </Link>
            </div>
          </div>
        </div>

        {toast && <p className="absolute top-1/2 left-1/2 -translate-x-1/2 rounded-full bg-black/75 px-4 py-2 text-sm">{toast}</p>}
        {sheet && <IngredientSheet reel={reel} onClose={() => setSheet(false)} />}
      </div>
    </section>
  );
}

function RailButton({ label, count, onClick, href, children }: { label: string; count?: number; onClick?: () => void; href?: string; children: React.ReactNode }) {
  const inner = (
    <>
      <span className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">{children}</span>
      {count !== undefined && <span className="text-xs font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{count > 0 ? count : ""}</span>}
    </>
  );
  const cls = "flex min-w-12 flex-col items-center gap-0.5 p-1.5";
  return href ? (
    <Link href={href} aria-label={label} className={cls}>{inner}</Link>
  ) : (
    <button onClick={onClick} aria-label={label} className={cls}>{inner}</button>
  );
}

const cardGradient = (id: number) => {
  const hue = (id * 47) % 360;
  return `linear-gradient(160deg, hsl(${hue} 42% 30%), hsl(${(hue + 40) % 360} 48% 11%))`;
};

/** Stand-in for recipes without a photo: the ingredient list, fading out where it meets the caption. */
function IngredientList({ reel }: { reel: Reel }) {
  return (
    <div className="reel-fade min-h-0 flex-1 overflow-hidden px-8 pt-[calc(env(safe-area-inset-top)+5rem)] pb-4">
      <p className="text-[0.72rem] font-semibold tracking-[0.08em] text-white/60 uppercase">
        {reel.ingredients.length} ingredients · {reel.stepCount} steps
      </p>
      <ul className="mt-3 space-y-1 font-serif text-[1.4rem] leading-snug">
        {reel.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
      </ul>
    </div>
  );
}

function IngredientSheet({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div className="pb-safe max-h-[75%] overflow-y-auto rounded-t-3xl bg-surface text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center bg-surface px-5 pt-4 pb-2">
          <div className="flex-1">
            <p className="label !mb-0">Ingredients{reel.servings ? ` · serves ${reel.servings}` : ""}</p>
            <h2 className="font-serif text-2xl leading-tight">{reel.title}</h2>
          </div>
          <button onClick={onClose} className="-mr-2 p-2" aria-label="Close"><CloseIcon /></button>
        </div>
        <ul className="divide-y divide-line px-5">
          {reel.ingredients.map((ing, i) => <li key={i} className="py-2.5 text-[15px]">{ing}</li>)}
        </ul>
        <div className="flex gap-2 px-5 pt-4 pb-24">
          <Link href={`/recipes/${reel.id}`} className="btn btn-ghost flex-1">Full recipe</Link>
          <Link href={`/recipes/${reel.id}/cook`} className="btn btn-primary flex-1">Cook this</Link>
        </div>
      </div>
    </div>
  );
}
