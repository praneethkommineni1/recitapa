import { handler, json, requireUser } from "@/lib/http";
import { reels } from "@/lib/queries";

/** Next page of the Reels feed. `exclude` lists the recipe ids already shown in this session. */
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const exclude = (new URL(req.url).searchParams.get("exclude") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(-500);
  return json({ reels: reels(user.id, exclude) });
});
