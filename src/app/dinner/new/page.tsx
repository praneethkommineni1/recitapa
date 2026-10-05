"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { FlameIcon } from "@/components/Icons";
import { PhotoPicker } from "@/components/PhotoPicker";
import { api, localToday } from "@/lib/client";
import type { RecipeDetail, StreakInfo } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <NewDinner />
    </Suspense>
  );
}

function NewDinner() {
  const router = useRouter();
  const params = useSearchParams();
  const recipeId = params.get("recipe");
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState(params.get("caption") ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<StreakInfo | null>(null);

  useEffect(() => {
    if (recipeId) api<{ recipe: RecipeDetail }>(`/api/recipes/${recipeId}`).then((r) => setRecipe(r.recipe)).catch(() => {});
  }, [recipeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ streak: StreakInfo }>("/api/dinners", {
        body: { photo, caption, recipeId: recipe?.id ?? null, localDate: localToday() },
      });
      setDone(r.streak);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="pt-safe flex min-h-[80dvh] flex-col items-center justify-center px-8 text-center">
        <span className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-accent text-accent-ink">
          <FlameIcon width={30} height={30} />
          <span className="font-serif text-3xl leading-none">{done.current}</span>
        </span>
        <h1 className="mt-6 font-serif text-4xl tracking-tight">
          {done.current === 1 ? "Streak started." : `${done.current} nights in a row.`}
        </h1>
        <p className="mt-2 text-muted">Your dinner is up as a story for the next 24 hours.</p>
        <button onClick={() => router.replace("/")} className="btn btn-primary mt-8">Back to the feed</button>
      </main>
    );
  }

  return (
    <>
      <PageHeader title="Tonight's dinner" back />
      <form onSubmit={submit} className="space-y-5 px-5 pb-10">
        <PhotoPicker value={photo} onChange={setPhoto} label="Snap your plate" aspect="aspect-[4/5]" />
        {recipe && (
          <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm">
            Cooked from <span className="font-semibold">{recipe.title}</span> by {recipe.author.displayName}
          </p>
        )}
        <div>
          <label className="label" htmlFor="caption">Caption</label>
          <textarea id="caption" className="input min-h-20" placeholder="What's on the table tonight?" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || (!photo && !caption.trim())}>
          {busy ? "Posting…" : "Share to story"}
        </button>
        <p className="text-center text-xs text-muted">Logging dinner keeps your streak alive. Stories disappear after 24 hours; your dinner diary keeps them.</p>
      </form>
    </>
  );
}
