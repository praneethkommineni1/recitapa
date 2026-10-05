"use client";

import Link from "next/link";
import { useState } from "react";
import { api, timeAgo } from "@/lib/client";
import type { RecipeCard as Recipe } from "@/lib/types";
import { Avatar } from "./Avatar";
import { BookmarkIcon, ClockIcon, CommentIcon, HeartIcon } from "./Icons";

export function useToggles(recipe: Pick<Recipe, "id" | "liked" | "saved" | "likeCount">) {
  const [liked, setLiked] = useState(recipe.liked);
  const [saved, setSaved] = useState(recipe.saved);
  const [likes, setLikes] = useState(recipe.likeCount);
  const toggleLike = async () => {
    setLiked(!liked);
    setLikes(likes + (liked ? -1 : 1));
    const r = await api<{ active: boolean }>(`/api/recipes/${recipe.id}/like`, { body: {} });
    setLiked(r.active);
  };
  const toggleSave = async () => {
    setSaved(!saved);
    const r = await api<{ active: boolean }>(`/api/recipes/${recipe.id}/save`, { body: {} });
    setSaved(r.active);
  };
  return { liked, saved, likes, toggleLike, toggleSave };
}

export function totalMinutes(r: Pick<Recipe, "prepMinutes" | "cookMinutes">) {
  const total = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  if (!total) return null;
  return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60 ? `${total % 60}m` : ""}`.trim() : `${total} min`;
}

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { liked, saved, likes, toggleLike, toggleSave } = useToggles(recipe);
  const time = totalMinutes(recipe);
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-surface">
      <Link href={`/u/${recipe.author.username}`} className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Avatar user={recipe.author} size={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{recipe.author.displayName}</p>
          <p className="text-xs text-muted">@{recipe.author.username} · {timeAgo(recipe.createdAt)}</p>
        </div>
      </Link>
      <Link href={`/recipes/${recipe.id}`} className="block">
        {recipe.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.photoUrl} alt="" className="aspect-[4/3] w-full object-cover" />
        )}
        <div className={`px-4 ${recipe.photoUrl ? "pt-4" : "pt-1"}`}>
          <h2 className={`font-serif leading-snug tracking-tight ${recipe.photoUrl ? "text-2xl" : "text-3xl"}`}>{recipe.title}</h2>
          {recipe.description && <p className="mt-1 line-clamp-2 text-[15px] text-muted">{recipe.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted">
            {time && <span className="flex items-center gap-1"><ClockIcon width={14} height={14} />{time}</span>}
            {recipe.cookedCount > 0 && <span>Cooked {recipe.cookedCount}×</span>}
            {recipe.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-1 px-2 py-2">
        <button onClick={toggleLike} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm ${liked ? "text-accent" : "text-ink"}`} aria-label="Like">
          <HeartIcon filled={liked} width={22} height={22} /> {likes > 0 && likes}
        </button>
        <Link href={`/recipes/${recipe.id}#comments`} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm" aria-label="Comments">
          <CommentIcon width={22} height={22} /> {recipe.commentCount > 0 && recipe.commentCount}
        </Link>
        <button onClick={toggleSave} className={`ml-auto rounded-full px-3 py-2 ${saved ? "text-accent" : "text-ink"}`} aria-label="Save">
          <BookmarkIcon filled={saved} width={22} height={22} />
        </button>
      </div>
    </article>
  );
}
