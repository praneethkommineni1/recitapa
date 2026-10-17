// Retention maths for `npm run retention`, kept pure so it can be tested.
// Times are days since the user signed up (fractional), computed in SQL.

export interface UserActivity {
  userId: number;
  /** ISO date (YYYY-MM-DD) of signup, used to group users into weekly cohorts. */
  signupDate: string;
  /** Whole days between signup and now. */
  ageDays: number;
  /** Days after signup of each active event (any event except signup). */
  activeDays: number[];
  /** Days after signup of each logged dinner. */
  dinnerDays: number[];
  /** Days after signup of each follow. */
  followDays: number[];
  /** Days after signup of each cook-mode start. */
  cookDays: number[];
}

export interface CohortRow {
  /** Monday of the signup week. */
  week: string;
  users: number;
  /** Share active on day 1, day 7 and day 30 after signup; null while the cohort is too young. */
  d1: number | null;
  d7: number | null;
  d30: number | null;
  /** Share who logged at least one dinner in days 21-27: the Phase 0 gate metric. */
  week4Dinner: number | null;
}

export interface Funnel {
  signups: number;
  dinnerIn48h: number;
  follow3In48h: number;
  cookedIn7d: number;
}

export interface GateResult {
  /** Users old enough to measure (signed up at least 28 days ago). */
  eligible: number;
  /** Of those, how many logged a dinner in days 21-27. */
  stillCooking: number;
  share: number | null;
}

/** Monday of the week containing an ISO date. */
export function weekOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const activeOn = (days: number[], day: number) => days.some((t) => t >= day && t < day + 1);
const anyBetween = (days: number[], from: number, to: number) => days.some((t) => t >= from && t < to);

/** Share of `users` matching `hit`, only counting users at least `minAge` days old. */
function share(users: UserActivity[], minAge: number, hit: (u: UserActivity) => boolean): number | null {
  const old = users.filter((u) => u.ageDays >= minAge);
  return old.length ? old.filter(hit).length / old.length : null;
}

export function cohorts(users: UserActivity[]): CohortRow[] {
  const byWeek = new Map<string, UserActivity[]>();
  for (const u of users) {
    const w = weekOf(u.signupDate);
    byWeek.set(w, [...(byWeek.get(w) ?? []), u]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([week, us]) => ({
      week,
      users: us.length,
      d1: share(us, 2, (u) => activeOn(u.activeDays, 1)),
      d7: share(us, 8, (u) => activeOn(u.activeDays, 7)),
      d30: share(us, 31, (u) => activeOn(u.activeDays, 30)),
      week4Dinner: share(us, 28, (u) => anyBetween(u.dinnerDays, 21, 28)),
    }));
}

/** Phase 0 gate G1: share of users (28+ days old) who still logged a dinner in their fourth week. */
export function gate(users: UserActivity[]): GateResult {
  const eligible = users.filter((u) => u.ageDays >= 28);
  const stillCooking = eligible.filter((u) => anyBetween(u.dinnerDays, 21, 28)).length;
  return { eligible: eligible.length, stillCooking, share: eligible.length ? stillCooking / eligible.length : null };
}

/** First-days funnel for users old enough to have had the chance (7+ days). */
export function funnel(users: UserActivity[]): Funnel {
  const old = users.filter((u) => u.ageDays >= 7);
  return {
    signups: old.length,
    dinnerIn48h: old.filter((u) => anyBetween(u.dinnerDays, 0, 2)).length,
    follow3In48h: old.filter((u) => u.followDays.filter((t) => t < 2).length >= 3).length,
    cookedIn7d: old.filter((u) => anyBetween(u.cookDays, 0, 7)).length,
  };
}
