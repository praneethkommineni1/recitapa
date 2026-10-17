import { getDb } from "./db.ts";

// Product analytics, stored in the events table and read by `npm run retention`.
export type EventName =
  | "signup"
  | "app_open" // at most once per user per UTC day
  | "dinner_logged"
  | "cook_started"
  | "cook_finished"
  | "recipe_published"
  | "followed"
  | "story_viewed"; // first view of a friend's dinner story

/** Record an event. Analytics must never break a request, so failures are only logged. */
export function track(userId: number, name: EventName, props: Record<string, string | number | boolean | null> = {}): void {
  try {
    getDb().prepare("INSERT INTO events (user_id, name, props) VALUES (?, ?, ?)").run(userId, name, JSON.stringify(props));
  } catch (err) {
    console.error(`track(${name}) failed: ${(err as Error).message}`);
  }
}

/** Record that the user opened the app today, once per UTC day. */
export function trackDailyOpen(userId: number): void {
  try {
    const seen = getDb()
      .prepare("SELECT 1 FROM events WHERE user_id = ? AND name = 'app_open' AND created_at >= date('now')")
      .get(userId);
    if (!seen) track(userId, "app_open");
  } catch (err) {
    console.error(`trackDailyOpen failed: ${(err as Error).message}`);
  }
}
