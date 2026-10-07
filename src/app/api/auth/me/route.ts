import { trackDailyOpen } from "@/lib/analytics";
import { currentUser } from "@/lib/auth";
import { handler, json } from "@/lib/http";

// The app calls this on every load, so it also records the day's first open for retention.
export const GET = handler(async () => {
  const user = await currentUser();
  if (user) trackDailyOpen(user.id);
  return json({ user });
});
