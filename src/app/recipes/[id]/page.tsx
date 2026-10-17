"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, useUser } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { BookmarkIcon, HeartIcon, MicIcon, SendIcon } from "@/components/Icons";
import { totalMinutes, useToggles } from "@/components/RecipeCard";
import { api, timeAgo } from "@/lib/client";
import { adjustIngredient, convertTemperatures, type UnitSystem } from "@/lib/ingredients";
import type { RecipeDetail } from "@/lib/types";

export default function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () => api<{ recipe: RecipeDetail }>(`/api/recipes/${id}`).then((r) => setRecipe(r.recipe)).catch((e) => setError(e.message)),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <><PageHeader title="Recipe" back /><p className="px-5 text-muted">{error}</p></>;
  if (!recipe) return <PageHeader title="" back />;
  return <RecipeView recipe={recipe} reload={load} />;
}

function RecipeView({ recipe, reload }: { recipe: RecipeDetail; reload: () => void }) {
  const { user } = useUser();
  const router = useRouter();
  const { liked, saved, likes, toggleLike, toggleSave } = useToggles(recipe);
  const [comment, setComment] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [servings, setServings] = useState(recipe.servings);
  const [units, setUnits] = useUnits();
  const factor = servings && recipe.servings ? servings / recipe.servings : 1;
  const time = totalMinutes(recipe);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    await api(`/api/recipes/${recipe.id}/comments`, { body: { body: comment } });
    setComment("");
    reload();
  }

  async function remove() {
    if (!confirm("Delete this recipe?")) return;
    await api(`/api/recipes/${recipe.id}`, { method: "DELETE" });
    router.replace(`/u/${recipe.author.username}`);
  }

  return (
    <>
      <PageHeader
        title=""
        back
        right={
          <div className="flex items-center gap-1">
            <button onClick={toggleLike} className={`flex items-center gap-1 p-2 text-sm ${liked ? "text-accent" : ""}`} aria-label="Like"><HeartIcon filled={liked} />{likes > 0 && likes}</button>
            <button onClick={toggleSave} className={`p-2 ${saved ? "text-accent" : ""}`} aria-label="Save"><BookmarkIcon filled={saved} /></button>
          </div>
        }
      />
      {recipe.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recipe.photoUrl} alt="" className="aspect-[4/3] w-full object-cover sm:rounded-3xl" />
      )}
      <div className="px-5 pt-6 pb-32">
        <h1 className="font-serif text-4xl leading-[1.08] tracking-tight">{recipe.title}</h1>
        <Link href={`/u/${recipe.author.username}`} className="mt-4 flex items-center gap-3">
          <Avatar user={recipe.author} size={32} />
          <span className="text-sm"><span className="font-semibold">{recipe.author.displayName}</span> <span className="text-muted">· {timeAgo(recipe.createdAt)}</span></span>
        </Link>
        {recipe.description && <p className="mt-5 text-[17px] leading-relaxed">{recipe.description}</p>}

        <dl className="mt-6 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface py-3 text-center">
          <div>
            <dt className="label !mb-0.5">Serves</dt>
            {servings ? (
              <dd className="flex items-center justify-center gap-2 font-serif text-xl">
                <button onClick={() => setServings(Math.max(1, servings - 1))} disabled={servings <= 1} className="h-7 w-7 rounded-full border border-line font-sans text-base leading-none disabled:opacity-40" aria-label="Fewer servings">−</button>
                <span aria-live="polite">{servings}</span>
                <button onClick={() => setServings(Math.min(50, servings + 1))} disabled={servings >= 50} className="h-7 w-7 rounded-full border border-line font-sans text-base leading-none disabled:opacity-40" aria-label="More servings">+</button>
              </dd>
            ) : (
              <dd className="font-serif text-xl">—</dd>
            )}
          </div>
          <div><dt className="label !mb-0.5">Time</dt><dd className="font-serif text-xl">{time ?? "—"}</dd></div>
          <div><dt className="label !mb-0.5">Cooked</dt><dd className="font-serif text-xl">{recipe.cookedCount}×</dd></div>
        </dl>

        <div className="mt-9 flex items-end justify-between gap-3">
          <h2 className="font-serif text-2xl">Ingredients</h2>
          <div className="flex rounded-full border border-line p-0.5 text-xs font-medium" role="group" aria-label="Units">
            {(["original", "metric", "us"] as const).map((u) => (
              <button key={u} onClick={() => setUnits(u)} aria-pressed={units === u} className={`rounded-full px-2.5 py-1 ${units === u ? "bg-ink text-bg" : "text-muted"}`}>
                {u === "original" ? "Original" : u === "metric" ? "Metric" : "US"}
              </button>
            ))}
          </div>
        </div>
        {factor !== 1 && <p className="mt-2 text-sm text-muted">Amounts scaled from {recipe.servings} to {servings} servings.</p>}
        <ul className="mt-3 divide-y divide-line">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={checked.has(i)}
                  onChange={() => {
                    const next = new Set(checked);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    setChecked(next);
                  }}
                />
                <span className={checked.has(i) ? "text-muted line-through" : ""}>{adjustIngredient(ing, factor, units)}</span>
              </label>
            </li>
          ))}
        </ul>

        <h2 className="mt-9 font-serif text-2xl">Method</h2>
        <ol className="mt-3 space-y-5">
          {recipe.steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-serif text-2xl leading-none text-accent">{i + 1}</span>
              <div>
                <p className="leading-relaxed">{convertTemperatures(s.text, units)}</p>
                {s.minutes && <p className="mt-1 text-xs font-semibold tracking-wide text-muted uppercase">{s.minutes} min timer</p>}
              </div>
            </li>
          ))}
        </ol>

        {recipe.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {recipe.tags.map((t) => <Link key={t} href={`/explore?q=${encodeURIComponent(t)}`} className="rounded-full border border-line px-3 py-1 text-sm">#{t}</Link>)}
          </div>
        )}

        <section id="comments" className="mt-10">
          <h2 className="font-serif text-2xl">Comments</h2>
          <div className="mt-3 space-y-4">
            {recipe.comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar user={c.author} size={30} />
                <p className="text-[15px]"><Link href={`/u/${c.author.username}`} className="font-semibold">{c.author.displayName}</Link> {c.body} <span className="text-xs text-muted">{timeAgo(c.createdAt)}</span></p>
              </div>
            ))}
            {!recipe.comments.length && <p className="text-sm text-muted">No comments yet. Made it? Tell them how it went.</p>}
          </div>
          <form onSubmit={postComment} className="mt-4 flex gap-2">
            <input className="input" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
            <button className="btn btn-primary !px-4" aria-label="Post comment"><SendIcon width={18} /></button>
          </form>
        </section>

        {user?.id === recipe.author.id && (
          <button onClick={remove} className="mt-10 text-sm text-danger underline">Delete recipe</button>
        )}
      </div>

      <div className="fixed inset-x-0 z-20 mx-auto max-w-xl px-4 pb-3" style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2 rounded-full border border-line bg-surface/95 p-1.5 shadow-lg backdrop-blur">
          <Link href={`/recipes/${recipe.id}/cook${factor !== 1 ? `?servings=${servings}` : ""}`} className="btn btn-accent flex-1 whitespace-nowrap"><MicIcon width={18} /> Start cooking</Link>
          <Link href={`/dinner/new?recipe=${recipe.id}`} className="btn btn-ghost !border-0 whitespace-nowrap">I made this</Link>
        </div>
      </div>
    </>
  );
}

const UNITS_KEY = "recitapa.units";

/** The reader's preferred units, remembered on this device. */
function useUnits(): [UnitSystem, (u: UnitSystem) => void] {
  const [units, setUnits] = useState<UnitSystem>("original");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(UNITS_KEY);
      if (saved === "metric" || saved === "us") setUnits(saved);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  return [
    units,
    (u) => {
      setUnits(u);
      try {
        localStorage.setItem(UNITS_KEY, u);
      } catch {
        /* ignore */
      }
    },
  ];
}
