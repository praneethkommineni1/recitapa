import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
export { hashPassword, verifyPassword } from "./password";

const COOKIE = "recitapa_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function startSession(userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(sha256(token), userId, expires.toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  store.delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as
    | { id: number; username: string; display_name: string; avatar_url: string | null; bio: string; expires_at: string }
    | undefined;
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return { id: row.id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, bio: row.bio };
}
