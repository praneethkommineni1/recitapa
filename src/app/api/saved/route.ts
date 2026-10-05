import { handler, json, requireUser } from "@/lib/http";
import { savedRecipes } from "@/lib/queries";

export const GET = handler(async () => {
  const user = await requireUser();
  return json({ recipes: savedRecipes(user.id) });
});
