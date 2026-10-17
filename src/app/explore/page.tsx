"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { CloseIcon, ReelsIcon } from "@/components/Icons";
import { coverGradient, RecipeTile } from "@/components/RecipeTile";
import { api } from "@/lib/client";
import type { ExplorePage } from "@/lib/queries";
import type { RecipeCard as Recipe, UserSummary } from "@/lib/types";

const QUICK_MINUTES = 30;

export default function Page() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}

function Explore() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [tag, setTag] = useState(params.get("tag") ?? "");
  const [quick, setQuick] = useState(params.get("max") === String(QUICK_MINUTES));
  const [page, setPage] = useState<ExplorePage | null>(null);
  const [results, setResults] = useState<{ users: UserSummary[]; recipes: Recipe[] } | null>(null);
  const filtering = Boolean(q.trim() || tag || quick);

  useEffect(() => {
    api<ExplorePage>("/api/explore").then(setPage).catch(() => {});
  }, []);

  // Keep the URL in step with the filters so back/forward and shared links work.
  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (tag) next.set("tag", tag);
    if (quick) next.set("max", String(QUICK_MINUTES));
    const qs = next.toString();
    router.replace(qs ? `/explore?${qs}` : "/explore", { scroll: false });
  }, [q, tag, quick, router]);

  useEffect(() => {
    if (!filtering) return setResults(null);
    const search = new URLSearchParams();
    if (q.trim()) search.set("q", q.trim());
    if (tag) search.set("tag", tag);
    if (quick) search.set("max", String(QUICK_MINUTES));
    const t = setTimeout(() => api<{ users: UserSummary[]; recipes: Recipe[] }>(`/api/search?${search}`).then(setResults), q.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, tag, quick, filtering]);

  const pickTag = (t: string) => {
    setTag(tag === t ? "" : t);
    window.scrollTo({ top: 0 });
  };
  const clear = () => {
    setQ("");
    setTag("");
    setQuick(false);
  };

  return (
    <>
      <PageHeader title="Explore" />
      <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 bg-bg/95 pb-3 backdrop-blur">
        <div className="relative px-5">
          <input className="input !pr-10" type="search" placeholder="Search recipes, cooks or #tags" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" />
          {filtering && (
            <button onClick={clear} className="absolute top-1/2 right-7 -translate-y-1/2 p-1 text-muted" aria-label="Clear search and filters">
              <CloseIcon width={18} height={18} />
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-5">
          <Chip active={quick} onClick={() => setQuick(!quick)}>Under {QUICK_MINUTES} min</Chip>
          {(page?.tags ?? []).map((t) => (
            <Chip key={t.tag} active={tag === t.tag} onClick={() => pickTag(t.tag)}>#{t.tag}</Chip>
          ))}
          {tag && !page?.tags.some((t) => t.tag === tag) && <Chip active onClick={() => setTag("")}>#{tag}</Chip>}
        </div>
      </div>

      {filtering ? <Results results={results} onClear={clear} /> : <Browse page={page} onTag={pickTag} onQuick={() => setQuick(true)} />}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap ${active ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink"}`}
    >
      {children}
    </button>
  );
}

function Browse({ page, onTag, onQuick }: { page: ExplorePage | null; onTag: (tag: string) => void; onQuick: () => void }) {
  if (!page) return <BrowseSkeleton />;
  const empty = !page.forYou.length && !page.quick.length && !page.popular.length && !page.fresh.length;
  return (
    <div className="space-y-9 pt-3 pb-6">
      {empty && (
        <div className="mx-5 rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="font-serif text-2xl">Nothing to explore yet</p>
          <p className="mt-1 text-sm text-muted">Be the first to share a recipe and it shows up here for everyone.</p>
          <Link href="/recipes/new" className="btn btn-primary mt-4">Share a recipe</Link>
        </div>
      )}
      <Row title="Picked for you" recipes={page.forYou} />
      <Link href="/reels" className="mx-5 flex items-center gap-4 rounded-3xl bg-ink p-5 text-bg">
        <ReelsIcon width={32} height={32} />
        <div>
          <p className="font-serif text-2xl leading-tight">Not sure what to cook?</p>
          <p className="text-sm opacity-75">Swipe through recipes one at a time</p>
        </div>
      </Link>
      <Row title={`Dinner in ${QUICK_MINUTES} minutes`} recipes={page.quick} action={{ label: "See all", onClick: onQuick }} />
      <Row title="Most cooked" recipes={page.popular} />
      {page.tags.length > 0 && (
        <section>
          <h2 className="px-5 font-serif text-2xl">Browse by tag</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 px-5">
            {page.tags.slice(0, 8).map((t, i) => (
              <button key={t.tag} onClick={() => onTag(t.tag)} className="relative h-24 overflow-hidden rounded-2xl text-left text-white">
                {t.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.photoUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0" style={{ background: coverGradient(i * 7 + 3) }} />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
                <span className="absolute bottom-2.5 left-3">
                  <span className="block font-serif text-xl leading-none">#{t.tag}</span>
                  <span className="text-xs opacity-80">{t.count} {t.count === 1 ? "recipe" : "recipes"}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <Row title="New on Recitapa" recipes={page.fresh} />
      {page.cooks.length > 0 && <CooksToFollow cooks={page.cooks} />}
    </div>
  );
}

function Row({ title, recipes, action }: { title: string; recipes: Recipe[]; action?: { label: string; onClick: () => void } }) {
  if (!recipes.length) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between px-5">
        <h2 className="font-serif text-2xl">{title}</h2>
        {action && <button onClick={action.onClick} className="text-sm font-semibold text-accent">{action.label}</button>}
      </div>
      <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5">
        {recipes.map((r) => <RecipeTile key={r.id} recipe={r} className="w-[42%] max-w-48 shrink-0 snap-start" />)}
      </div>
    </section>
  );
}

function CooksToFollow({ cooks }: { cooks: (UserSummary & { recipeCount: number })[] }) {
  const [following, setFollowing] = useState<Record<number, boolean>>({});
  const toggle = async (c: UserSummary) => {
    setFollowing((f) => ({ ...f, [c.id]: !f[c.id] }));
    const r = await api<{ following: boolean }>(`/api/users/${c.username}/follow`, { body: {} }).catch(() => null);
    if (r) setFollowing((f) => ({ ...f, [c.id]: r.following }));
  };
  return (
    <section>
      <h2 className="px-5 font-serif text-2xl">Cooks to follow</h2>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5">
        {cooks.map((c) => (
          <div key={c.id} className="flex w-36 shrink-0 flex-col items-center rounded-3xl border border-line bg-surface p-4 text-center">
            <Link href={`/u/${c.username}`} className="flex flex-col items-center">
              <Avatar user={c} size={56} />
              <span className="mt-2 line-clamp-1 text-sm font-semibold">{c.displayName}</span>
              <span className="text-xs text-muted">{c.recipeCount} {c.recipeCount === 1 ? "recipe" : "recipes"}</span>
            </Link>
            <button onClick={() => toggle(c)} className={`btn mt-3 w-full !py-1.5 !text-sm ${following[c.id] ? "btn-ghost" : "btn-primary"}`}>
              {following[c.id] ? "Following" : "Follow"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Results({ results, onClear }: { results: { users: UserSummary[]; recipes: Recipe[] } | null; onClear: () => void }) {
  if (!results) return <p className="px-5 pt-4 text-sm text-muted">Searching…</p>;
  return (
    <div className="pb-6">
      {results.users.length > 0 && (
        <ul className="divide-y divide-line px-5">
          {results.users.map((u) => (
            <li key={u.id}>
              <Link href={`/u/${u.username}`} className="flex items-center gap-3 py-3">
                <Avatar user={u} size={44} />
                <div><p className="font-semibold">{u.displayName}</p><p className="text-sm text-muted">@{u.username}</p></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {results.recipes.length > 0 && (
        <>
          <p className="px-5 pt-3 text-xs font-semibold tracking-wider text-muted uppercase">
            {results.recipes.length} {results.recipes.length === 1 ? "recipe" : "recipes"}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-5 pt-3">
            {results.recipes.map((r) => <RecipeTile key={r.id} recipe={r} />)}
          </div>
        </>
      )}
      {!results.users.length && !results.recipes.length && (
        <div className="px-5 pt-6 text-center">
          <p className="font-serif text-2xl">No matches</p>
          <p className="mt-1 text-sm text-muted">Try a different word, or browse instead.</p>
          <button onClick={onClear} className="btn btn-ghost mt-4">Back to Explore</button>
        </div>
      )}
    </div>
  );
}

function BrowseSkeleton() {
  return (
    <div className="space-y-9 pt-3" aria-hidden>
      {[0, 1].map((s) => (
        <div key={s}>
          <div className="mx-5 h-6 w-40 animate-pulse rounded bg-line" />
          <div className="mt-3 flex gap-3 overflow-hidden px-5">
            {[0, 1, 2].map((i) => <div key={i} className="aspect-[4/5] w-[42%] max-w-48 shrink-0 animate-pulse rounded-2xl bg-line" />)}
          </div>
        </div>
      ))}
    </div>
  );
}
