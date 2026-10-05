import type { UserSummary } from "@/lib/types";

export function Avatar({ user, size = 40, ring }: { user: Pick<UserSummary, "displayName" | "avatarUrl">; size?: number; ring?: "unseen" | "seen" }) {
  const inner = user.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
  ) : (
    <span
      className="flex h-full w-full items-center justify-center rounded-full bg-accent-soft font-serif text-accent"
      style={{ fontSize: size * 0.42 }}
    >
      {user.displayName.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
  if (!ring) return <span className="inline-block shrink-0" style={{ width: size, height: size }}>{inner}</span>;
  return (
    <span
      className={`inline-block shrink-0 rounded-full p-[2.5px] ${ring === "unseen" ? "bg-accent" : "bg-line"}`}
      style={{ width: size + 8, height: size + 8 }}
    >
      <span className="block h-full w-full rounded-full bg-bg p-[2px]">{inner}</span>
    </span>
  );
}
