"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { RecipeCard } from "@/components/RecipeCard";
import { StoriesBar } from "@/components/Stories";
import { StreakCard } from "@/components/Streak";
import { api } from "@/lib/client";
import type { RecipeCard as Recipe } from "@/lib/types";

export default function Home() {
  const [scope, setScope] = useState<"following" | "all">("following");
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);

  useEffect(() => {
    setRecipes(null);
    api<{ recipes: Recipe[] }>(`/api/feed?scope=${scope}`).then((r) => setRecipes(r.recipes));
  }, [scope]);

  return (
    <>
      <PageHeader title={<span className="italic">Recitapa</span>} />
      <StoriesBar />
      <StreakCard />
      <div className="mt-6 flex gap-6 border-b border-line px-5">
        {(["following", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold ${scope === s ? "border-ink text-ink" : "border-transparent text-muted"}`}
          >
            {s === "following" ? "Following" : "Discover"}
          </button>
        ))}
      </div>
      <div className="space-y-5 px-4 pt-5">
        {recipes === null && <p className="px-1 text-sm text-muted">Loading…</p>}
        {recipes?.length === 0 && (
          <div className="rounded-3xl border border-line bg-surface p-6 text-center">
            <p className="font-serif text-2xl">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted">
              {scope === "following" ? "Follow some cooks or share your first recipe." : "Be the first to share a recipe."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/recipes/new" className="btn btn-primary">Share a recipe</Link>
              {scope === "following" && <button onClick={() => setScope("all")} className="btn btn-ghost">Discover</button>}
            </div>
          </div>
        )}
        {recipes?.map((r) => <RecipeCard key={r.id} recipe={r} />)}
      </div>
    </>
  );
}
