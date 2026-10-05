import { handler, json, requireUser } from "@/lib/http";
import { feed } from "@/lib/queries";

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "following";
  return json({ recipes: feed(user.id, scope) });
});
