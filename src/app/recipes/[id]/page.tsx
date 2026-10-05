"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, useUser } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { BookmarkIcon, HeartIcon, MicIcon, SendIcon } from "@/components/Icons";
import { totalMinutes, useToggles } from "@/components/RecipeCard";
import { api, timeAgo } from "@/lib/client";
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
          <div><dt className="label !mb-0.5">Serves</dt><dd className="font-serif text-xl">{recipe.servings ?? "—"}</dd></div>
          <div><dt className="label !mb-0.5">Time</dt><dd className="font-serif text-xl">{time ?? "—"}</dd></div>
          <div><dt className="label !mb-0.5">Cooked</dt><dd className="font-serif text-xl">{recipe.cookedCount}×</dd></div>
        </dl>

        <h2 className="mt-9 font-serif text-2xl">Ingredients</h2>
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
                <span className={checked.has(i) ? "text-muted line-through" : ""}>{ing}</span>
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
                <p className="leading-relaxed">{s.text}</p>
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
          <Link href={`/recipes/${recipe.id}/cook`} className="btn btn-accent flex-1 whitespace-nowrap"><MicIcon width={18} /> Start cooking</Link>
          <Link href={`/dinner/new?recipe=${recipe.id}`} className="btn btn-ghost !border-0 whitespace-nowrap">I made this</Link>
        </div>
      </div>
    </>
  );
}
