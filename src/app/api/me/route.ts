import { getDb } from "@/lib/db";
import { handler, json, readJson, requireUser, str } from "@/lib/http";
import { photoField } from "@/lib/uploads";

/** Update the signed-in user's profile. */
export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const displayName = str(body.displayName ?? user.displayName, "Name", { max: 60 });
  const bio = str(body.bio ?? user.bio, "Bio", { max: 280, required: false });
  const avatarUrl = body.avatar === undefined ? user.avatarUrl : photoField(body.avatar);
  getDb()
    .prepare("UPDATE users SET display_name = ?, bio = ?, avatar_url = ? WHERE id = ?")
    .run(displayName, bio, avatarUrl, user.id);
  return json({ ok: true });
});
