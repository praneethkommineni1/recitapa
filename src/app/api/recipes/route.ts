import { getDb } from "@/lib/db";
import { handler, HttpError, json, optInt, readJson, requireUser, str } from "@/lib/http";
import type { Step } from "@/lib/types";
import { photoField } from "@/lib/uploads";

function parseSteps(value: unknown): Step[] {
  if (!Array.isArray(value)) throw new HttpError(400, "Steps are required.");
  const steps = value
    .map((s, i) => {
      const step = (s ?? {}) as Record<string, unknown>;
      return { text: str(step.text, `Step ${i + 1}`, { max: 1000, required: false }), minutes: optInt(step.minutes, `Step ${i + 1} timer`, 1440) };
    })
    .filter((s) => s.text);
  if (!steps.length) throw new HttpError(400, "Add at least one step.");
  if (steps.length > 60) throw new HttpError(400, "Too many steps.");
  return steps;
}

function parseList(value: unknown, field: string, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const items = value.map((v) => str(v, field, { max: 200, required: false })).filter(Boolean);
  if (items.length > max) throw new HttpError(400, `Too many ${field.toLowerCase()}s.`);
  return items;
}

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const title = str(body.title, "Title", { max: 120 });
  const description = str(body.description, "Description", { max: 2000, required: false });
  const ingredients = parseList(body.ingredients, "Ingredient", 80);
  if (!ingredients.length) throw new HttpError(400, "Add at least one ingredient.");
  const steps = parseSteps(body.steps);
  const tags = parseList(body.tags, "Tag", 10).map((t) => t.toLowerCase().replace(/^#/, ""));

  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO recipes (user_id, title, description, photo_url, servings, prep_minutes, cook_minutes, ingredients, steps, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      title,
      description,
      photoField(body.photo),
      optInt(body.servings, "Servings", 100),
      optInt(body.prepMinutes, "Prep time", 1440),
      optInt(body.cookMinutes, "Cook time", 2880),
      JSON.stringify(ingredients),
      JSON.stringify(steps),
      JSON.stringify(tags),
    );
  return json({ id: Number(lastInsertRowid) }, 201);
});
