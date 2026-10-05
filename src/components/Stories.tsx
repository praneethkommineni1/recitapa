"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import type { StoryGroup } from "@/lib/types";
import { Avatar } from "./Avatar";
import { useUser } from "./AppShell";
import { CloseIcon, PlusIcon } from "./Icons";

const STORY_MS = 5000;

export function StoriesBar() {
  const { user } = useUser();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(() => api<{ groups: StoryGroup[] }>("/api/stories").then((r) => setGroups(r.groups)), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!user || !groups) return <div className="h-[98px]" />;
  const mine = groups.find((g) => g.user.id === user.id);
  const others = groups.filter((g) => g.user.id !== user.id);

  return (
    <>
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-5 py-3">
        <div className="flex w-[66px] shrink-0 flex-col items-center gap-1.5">
          {mine ? (
            <button onClick={() => setOpen(groups.indexOf(mine))} aria-label="Your story">
              <Avatar user={user} size={58} ring="seen" />
            </button>
          ) : (
            <Link href="/dinner/new" className="relative" aria-label="Share tonight's dinner">
              <Avatar user={user} size={58} ring="seen" />
              <span className="absolute right-0 bottom-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg bg-accent text-accent-ink">
                <PlusIcon width={14} height={14} strokeWidth={2.6} />
              </span>
            </Link>
          )}
          <span className="w-full truncate text-center text-[11px] text-muted">{mine ? "Your dinner" : "Add dinner"}</span>
        </div>
        {others.map((g) => (
          <button key={g.user.id} onClick={() => setOpen(groups.indexOf(g))} className="flex w-[66px] shrink-0 flex-col items-center gap-1.5">
            <Avatar user={g.user} size={58} ring={g.allSeen ? "seen" : "unseen"} />
            <span className="w-full truncate text-center text-[11px]">{g.user.displayName.split(" ")[0]}</span>
          </button>
        ))}
        {!others.length && (
          <p className="self-center pr-4 text-xs text-muted">Follow friends to see what they&apos;re having for dinner.</p>
        )}
      </div>
      {open !== null && (
        <StoryViewer
          groups={groups}
          start={open}
          onClose={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </>
  );
}

function StoryViewer({ groups, start, onClose }: { groups: StoryGroup[]; start: number; onClose: () => void }) {
  const [g, setG] = useState(start);
  const [i, setI] = useState(0);
  const group = groups[g];
  const story = group?.stories[i];

  const next = useCallback(() => {
    if (i + 1 < group.stories.length) setI(i + 1);
    else if (g + 1 < groups.length) {
      setG(g + 1);
      setI(0);
    } else onClose();
  }, [g, i, group, groups.length, onClose]);
  const prev = () => {
    if (i > 0) setI(i - 1);
    else if (g > 0) {
      setG(g - 1);
      setI(groups[g - 1].stories.length - 1);
    }
  };

  useEffect(() => {
    if (!story) return;
    api(`/api/stories/${story.id}/view`, { body: {} }).catch(() => {});
    const t = setTimeout(next, STORY_MS);
    return () => clearTimeout(t);
  }, [story, next]);

  if (!story) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="pt-safe absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6">
        <div className="mt-2 flex gap-1">
          {group.stories.map((s, idx) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                key={`${s.id}-${idx === i}`}
                className="h-full bg-white"
                style={idx < i ? { width: "100%" } : idx === i ? { animation: `story-progress ${STORY_MS}ms linear forwards` } : { width: 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Avatar user={group.user} size={32} />
          <span className="text-sm font-semibold">{group.user.displayName}</span>
          <span className="text-sm text-white/70">{timeAgo(story.createdAt)}</span>
          <button onClick={onClose} className="ml-auto p-2" aria-label="Close"><CloseIcon /></button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        {story.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.photoUrl} alt="" className="max-h-full w-full object-contain" />
        ) : (
          <p className="px-10 text-center font-serif text-4xl leading-tight">{story.caption}</p>
        )}
        <button className="absolute inset-y-0 left-0 w-1/3" onClick={prev} aria-label="Previous" />
        <button className="absolute inset-y-0 right-0 w-2/3" onClick={next} aria-label="Next" />
      </div>

      <div className="pb-safe absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pt-10 pb-6">
        {story.photoUrl && story.caption && <p className="font-serif text-2xl leading-snug">{story.caption}</p>}
        {story.recipe && (
          <Link href={`/recipes/${story.recipe.id}`} className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
            Recipe: {story.recipe.title}
          </Link>
        )}
      </div>
    </div>
  );
}
