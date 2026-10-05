"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, useUser } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FlameIcon } from "@/components/Icons";
import { PhotoPicker } from "@/components/PhotoPicker";
import { RecipeCard } from "@/components/RecipeCard";
import { api, localToday } from "@/lib/client";
import type { Dinner, RecipeCard as Recipe, StreakInfo } from "@/lib/types";

interface Profile {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  isMe: boolean;
  following: boolean;
  stats: { recipes: number; dinners: number; followers: number; following: number };
  streak: StreakInfo;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { refresh } = useUser();
  const [data, setData] = useState<{ profile: Profile; recipes: Recipe[]; dinners: Dinner[] } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"recipes" | "diary">("recipes");
  const [editing, setEditing] = useState(false);

  const load = useCallback(
    () => api<typeof data & object>(`/api/users/${username}?today=${localToday()}`).then(setData).catch((e) => setError(e.message)),
    [username],
  );
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <><PageHeader title="Profile" back /><p className="px-5 text-muted">{error}</p></>;
  if (!data) return <PageHeader title="" />;
  const { profile, recipes, dinners } = data;

  async function toggleFollow() {
    await api(`/api/users/${profile.username}/follow`, { body: {} });
    load();
  }

  async function logout() {
    await api("/api/auth/logout", { body: {} });
    window.location.href = "/login";
  }

  return (
    <>
      <PageHeader
        title={`@${profile.username}`}
        right={profile.isMe ? <button onClick={logout} className="text-sm text-muted">Log out</button> : undefined}
      />
      <section className="px-5">
        <div className="flex items-center gap-5">
          <Avatar user={profile} size={84} />
          <div className="grid flex-1 grid-cols-3 text-center">
            {[
              ["Recipes", profile.stats.recipes],
              ["Followers", profile.stats.followers],
              ["Following", profile.stats.following],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="font-serif text-2xl">{v}</p>
                <p className="text-xs text-muted">{k}</p>
              </div>
            ))}
          </div>
        </div>
        <h1 className="mt-4 font-serif text-3xl tracking-tight">{profile.displayName}</h1>
        {profile.bio && <p className="mt-1 text-[15px]">{profile.bio}</p>}

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <FlameIcon className="text-accent" />
          <p className="flex-1 text-sm">
            <span className="font-semibold">{profile.streak.current}-night streak</span>
            <span className="text-muted"> · best {profile.streak.longest} · {profile.stats.dinners} dinners logged</span>
          </p>
        </div>

        <div className="mt-4">
          {profile.isMe ? (
            <button onClick={() => setEditing(true)} className="btn btn-ghost w-full">Edit profile</button>
          ) : (
            <button onClick={toggleFollow} className={`btn w-full ${profile.following ? "btn-ghost" : "btn-primary"}`}>
              {profile.following ? "Following" : "Follow"}
            </button>
          )}
        </div>
      </section>

      <div className="mt-6 flex gap-6 border-b border-line px-5">
        {(["recipes", "diary"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold ${tab === t ? "border-ink" : "border-transparent text-muted"}`}>
            {t === "recipes" ? "Recipes" : "Dinner diary"}
          </button>
        ))}
      </div>

      {tab === "recipes" ? (
        <div className="space-y-5 px-4 pt-5">
          {recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}
          {!recipes.length && <p className="px-1 text-sm text-muted">No recipes yet.</p>}
        </div>
      ) : (
        <Diary dinners={dinners} />
      )}

      {editing && (
        <EditProfile
          profile={profile}
          onClose={(changed) => {
            setEditing(false);
            if (changed) {
              load();
              refresh();
            }
          }}
        />
      )}
    </>
  );
}

function Diary({ dinners }: { dinners: Dinner[] }) {
  // Last 5 weeks as a calendar strip, then a photo grid.
  const days = new Set(dinners.map((d) => d.localDate));
  const today = new Date();
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (34 - i));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, day: d.getDate(), cooked: days.has(iso) };
  });
  return (
    <div className="px-5 pt-5">
      <p className="label">Last five weeks</p>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c) => (
          <div key={c.iso} title={c.iso} className={`flex aspect-square items-center justify-center rounded-lg text-xs ${c.cooked ? "bg-accent text-accent-ink font-semibold" : "bg-surface text-muted border border-line"}`}>
            {c.day}
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-1.5">
        {dinners.map((d) => {
          const inner = d.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.photoUrl} alt={d.caption} className="aspect-square w-full rounded-lg object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-accent-soft p-2 text-center font-serif text-sm text-accent">{d.caption}</div>
          );
          return d.recipe ? <Link key={d.id} href={`/recipes/${d.recipe.id}`}>{inner}</Link> : <div key={d.id}>{inner}</div>;
        })}
      </div>
      {!dinners.length && <p className="text-sm text-muted">No dinners logged yet.</p>}
    </div>
  );
}

function EditProfile({ profile, onClose }: { profile: Profile; onClose: (changed: boolean) => void }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState<string | null>(profile.avatarUrl);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/me", { method: "PATCH", body: { displayName, bio, avatar } });
      onClose(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => onClose(false)}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="pb-safe mx-auto w-full max-w-xl space-y-4 rounded-t-3xl bg-bg p-5">
        <h2 className="font-serif text-2xl">Edit profile</h2>
        <div className="w-32"><PhotoPicker value={avatar} onChange={setAvatar} label="Photo" aspect="aspect-square" /></div>
        <div><label className="label">Name</label><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required /></div>
        <div><label className="label">Bio</label><textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2"><button type="button" onClick={() => onClose(false)} className="btn btn-ghost flex-1">Cancel</button><button className="btn btn-primary flex-1">Save</button></div>
      </form>
    </div>
  );
}
