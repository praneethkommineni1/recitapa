"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";
import { api } from "@/lib/client";
import { BookmarkIcon, HomeIcon, PlusIcon, SearchIcon, UserIcon } from "./Icons";

const UserContext = createContext<{ user: SessionUser | null; refresh: () => void }>({ user: null, refresh: () => {} });
export const useUser = () => useContext(UserContext);

const PUBLIC = ["/login", "/signup"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const immersive = /^\/recipes\/\d+\/cook/.test(pathname);

  useEffect(() => {
    api<{ user: SessionUser | null }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, [version]);

  useEffect(() => {
    if (user === null && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, isPublic, pathname, router]);

  if (isPublic) return <>{children}</>;
  if (!user) return <div className="min-h-dvh" />;

  return (
    <UserContext.Provider value={{ user, refresh: () => setVersion((v) => v + 1) }}>
      <div className={`mx-auto min-h-dvh max-w-xl ${immersive ? "" : "pb-24"}`}>{children}</div>
      {!immersive && <TabBar username={user.username} pathname={pathname} />}
    </UserContext.Provider>
  );
}

function TabBar({ username, pathname }: { username: string; pathname: string }) {
  const tabs = [
    { href: "/", label: "Home", Icon: HomeIcon, active: pathname === "/" },
    { href: "/explore", label: "Explore", Icon: SearchIcon, active: pathname.startsWith("/explore") },
    { href: "/new", label: "Create", Icon: PlusIcon, active: pathname === "/new", primary: true },
    { href: "/saved", label: "Saved", Icon: BookmarkIcon, active: pathname.startsWith("/saved") },
    { href: `/u/${username}`, label: "You", Icon: UserIcon, active: pathname.startsWith("/u/") },
  ];
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl items-center justify-around px-2 pt-2 pb-2">
        {tabs.map(({ href, label, Icon, active, primary }) => (
          <li key={href}>
            <Link
              href={href}
              aria-label={label}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium ${active ? "text-ink" : "text-muted"}`}
            >
              {primary ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-bg">
                  <Icon width={20} height={20} />
                </span>
              ) : (
                <Icon width={24} height={24} strokeWidth={active ? 2.2 : 1.8} />
              )}
              {!primary && label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageHeader({ title, right, back }: { title: ReactNode; right?: ReactNode; back?: boolean }) {
  const router = useRouter();
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-5">
        {back && (
          <button onClick={() => router.back()} className="-ml-2 p-2 text-ink" aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 5-7 7 7 7" /></svg>
          </button>
        )}
        <h1 className="flex-1 truncate font-serif text-[1.65rem] leading-none tracking-tight">{title}</h1>
        {right}
      </div>
    </header>
  );
}
