import { takeUnseenBadges } from "@/lib/badgeAwards";
import { handler, json, requireUser } from "@/lib/http";

/** Newly earned badges to celebrate. The app shell checks this after navigation and key actions. */
export const POST = handler(async () => {
  const user = await requireUser();
  return json({ badges: takeUnseenBadges(user.id) });
});
