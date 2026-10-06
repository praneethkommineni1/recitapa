"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { ReelsIcon } from "@/components/Icons";
import { RecipeCard } from "@/components/RecipeCard";
import { api } from "@/lib/client";
import type { RecipeCard as Recipe, UserSummary } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}

function Explore() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<{ users: UserSummary[]; recipes: Recipe[] } | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) return setResults(null);
    const t = setTimeout(() => api<{ users: UserSummary[]; recipes: Recipe[] }>(`/api/search?q=${encodeURIComponent(term)}`).then(setResults), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <PageHeader title="Explore" />
      <div className="px-5">
        <input className="input" type="search" placeholder="Search cooks, recipes, #tags" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" />
      </div>
      {!results && (
        <>
          <p className="px-5 pt-6 text-sm text-muted">Find friends to follow, or search for something to cook tonight.</p>
          <Link href="/reels" className="mx-5 mt-5 flex items-center gap-4 rounded-3xl bg-ink p-5 text-bg">
            <ReelsIcon width={32} height={32} />
            <div>
              <p className="font-serif text-2xl leading-tight">Not sure what to cook?</p>
              <p className="text-sm opacity-75">Swipe through recipes picked for you</p>
            </div>
          </Link>
        </>
      )}
      {results && (
        <>
          {results.users.length > 0 && (
            <ul className="mt-4 divide-y divide-line px-5">
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
          <div className="space-y-5 px-4 pt-5">
            {results.recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
          </div>
          {!results.users.length && !results.recipes.length && <p className="px-5 pt-6 text-sm text-muted">No matches.</p>}
        </>
      )}
    </>
  );
}
