import { handler, json, requireUser } from "@/lib/http";
import { storyGroups } from "@/lib/queries";

export const GET = handler(async () => {
  const user = await requireUser();
  return json({ groups: storyGroups(user.id) });
});
