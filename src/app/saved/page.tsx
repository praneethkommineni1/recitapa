"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { RecipeCard } from "@/components/RecipeCard";
import { api } from "@/lib/client";
import type { RecipeCard as Recipe } from "@/lib/types";

export default function Saved() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  useEffect(() => {
    api<{ recipes: Recipe[] }>("/api/saved").then((r) => setRecipes(r.recipes));
  }, []);
  return (
    <>
      <PageHeader title="Saved" />
      <div className="space-y-5 px-4 pt-2">
        {recipes?.length === 0 && <p className="px-1 text-sm text-muted">Tap the bookmark on any recipe to keep it here.</p>}
        {recipes?.map((r) => <RecipeCard key={r.id} recipe={r} />)}
      </div>
    </>
  );
}
