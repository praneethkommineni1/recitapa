import { handler, json, requireUser } from "@/lib/http";
import { explorePage } from "@/lib/queries";

/** Recommendations and categories for Explore before the viewer searches. */
export const GET = handler(async () => {
  const user = await requireUser();
  return json(explorePage(user.id));
});
