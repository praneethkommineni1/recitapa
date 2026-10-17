import { track } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { hashPassword, startSession } from "@/lib/auth";
import { handler, HttpError, json, readJson, str } from "@/lib/http";

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const username = str(body.username, "Username", { max: 24 }).toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username))
    throw new HttpError(400, "Username must be 3-24 letters, numbers or underscores.");
  const displayName = str(body.displayName, "Name", { max: 60 });
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters.");

  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username))
    throw new HttpError(409, "That username is taken.");
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)")
    .run(username, displayName, hashPassword(password));
  track(Number(lastInsertRowid), "signup");
  await startSession(Number(lastInsertRowid));
  return json({ ok: true }, 201);
});
