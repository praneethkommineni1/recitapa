import { getDb } from "@/lib/db";
import { startSession, verifyPassword } from "@/lib/auth";
import { handler, HttpError, json, readJson, str } from "@/lib/http";

export const POST = handler(async (req: Request) => {
  const body = await readJson(req);
  const username = str(body.username, "Username", { max: 24 });
  const password = typeof body.password === "string" ? body.password : "";
  const user = getDb().prepare("SELECT id, password_hash FROM users WHERE username = ?").get(username) as
    | { id: number; password_hash: string }
    | undefined;
  if (!user || !verifyPassword(password, user.password_hash))
    throw new HttpError(401, "Wrong username or password.");
  await startSession(user.id);
  return json({ ok: true });
});
