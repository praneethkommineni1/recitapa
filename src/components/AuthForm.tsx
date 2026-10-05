"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();
  const [form, setForm] = useState({ username: "", displayName: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, { body: form });
      const next = params.get("next");
      // Full navigation so the app shell reloads the session.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <p className="label">Recitapa</p>
      <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">
        {mode === "login" ? <>Welcome back to the <em>table</em>.</> : <>Cook, share, <em>repeat</em>.</>}
      </h1>
      <p className="mt-3 text-muted">
        {mode === "login" ? "Log in to see what everyone's cooking tonight." : "Share recipes, post tonight's dinner and keep your streak going."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" className="input" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={form.username} onChange={set("username")} required />
        </div>
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="displayName">Your name</label>
            <input id="displayName" className="input" autoComplete="name" value={form.displayName} onChange={set("displayName")} required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} required minLength={mode === "signup" ? 8 : undefined} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link href={mode === "login" ? "/signup" : "/login"} className="font-semibold text-ink underline">
          {mode === "login" ? "Create an account" : "Log in"}
        </Link>
      </p>
    </main>
  );
}
