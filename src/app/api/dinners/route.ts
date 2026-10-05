import { getDb } from "@/lib/db";
import { handler, HttpError, json, optInt, readJson, requireUser, str } from "@/lib/http";
import { dayNumber, isIsoDate } from "@/lib/streak";
import { streakFor } from "@/lib/queries";
import { photoField } from "@/lib/uploads";

/** Log tonight's dinner. It extends the streak and shows up as a 24h story. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const localDate = body.localDate;
  if (!isIsoDate(localDate)) throw new HttpError(400, "localDate must be YYYY-MM-DD.");
  // The client sends its local date; reject anything implausibly far from the server's clock.
  const serverDay = Math.floor(Date.now() / 86_400_000);
  if (Math.abs(dayNumber(localDate) - serverDay) > 1) throw new HttpError(400, "Dinners can only be logged for today.");

  const caption = str(body.caption, "Caption", { max: 500, required: false });
  const photoUrl = photoField(body.photo);
  if (!photoUrl && !caption) throw new HttpError(400, "Add a photo or a caption.");
  const recipeId = optInt(body.recipeId, "Recipe", Number.MAX_SAFE_INTEGER);
  const db = getDb();
  if (recipeId && !db.prepare("SELECT 1 FROM recipes WHERE id = ?").get(recipeId))
    throw new HttpError(404, "Recipe not found.");

  const { lastInsertRowid } = db
    .prepare("INSERT INTO dinners (user_id, recipe_id, photo_url, caption, local_date) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, recipeId, photoUrl, caption, localDate);
  return json({ id: Number(lastInsertRowid), streak: streakFor(user.id, localDate) }, 201);
});
