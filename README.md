# Recitapa

A social cooking app: share recipes, post tonight's dinner as a 24-hour story, keep a nightly dinner streak, and cook with a voice sous-chef that talks you through each step and helps when something goes wrong.

## Features

- **Recipes**: publish recipes with a cover photo, ingredients, steps and optional per-step timers. Like, comment, save, search by title or #tag.
- **Dinner stories**: log tonight's dinner (photo and/or caption, optionally linked to a recipe). It shows as a story to your followers for 24 hours and stays in your dinner diary.
- **Streaks**: every night you log dinner extends your streak. The home screen warns you when it's at risk, and profiles show your current and best streak plus a five-week calendar.
- **Voice sous-chef** (cook mode): it reads each step out loud, runs the timers, checks in if a step runs long, and listens hands-free. Tell it what went wrong ("I burned the garlic", "I'm out of cream", "it's too salty") and it suggests a fix. It logs the mishap and rewrites the remaining steps when the plan needs to change.
- **Servings and units**: change the number of servings on a recipe to scale the ingredients, and switch between the original units, metric and US. Oven temperatures in the steps convert too. Cook mode passes the servings to the sous-chef so the amounts it mentions are scaled.
- **Social**: follow cooks, a Following/Discover feed, and profiles.
- **iOS**: installable as a home-screen web app, plus a native iOS shell (Capacitor) for the App Store.
- **Badges**: 30 pun-named badges, such as Loaf Actually (homemade sourdough connoisseur), Pasta La Vista, Hot Streak and Saved by the Bell Pepper. They're earned automatically from streaks, dinners, recipes, community activity, sous-chef use and specialty dishes. Profiles have a Badges tab that shows progress on locked badges, and a "New badge" card pops up when you earn one. The catalog lives in `src/lib/badges.ts`; edit names, targets or dish keywords there.
- **Recitapa Plus**: a subscription that pays for the AI. See [Recitapa Plus](#recitapa-plus-subscriptions) below.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4
- SQLite via `better-sqlite3` (data and uploaded photos live in `./data`, or in `DATA_DIR`)
- Claude (`claude-opus-5-5`) through the Anthropic TypeScript SDK powers the sous-chef, using tool use to drive the cook-mode screen
- Web Speech API in browsers. On iOS, native speech recognition and text-to-speech run through Capacitor plugins

## Getting started

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY to enable the AI chef
npm run seed                   # optional demo data: log in as maya / leo / amara, password "password123"
npm run dev                    # http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, cook mode uses a built-in rule-based helper. It handles next/back/repeat, timers and common fixes, and the screen shows "basic mode".

Other scripts: `npm test` (unit tests), `npm run lint` (typecheck), `npm run usage` (AI cost and budget report), `npm run retention` (retention report), `npm run eval:chef` (compare sous-chef models), `npm run build && npm start` (production).

## How the sous-chef works

`src/app/recipes/[id]/cook/page.tsx` keeps the live session: the current step, the steps (which the chef may revise), running timers, mishaps and the transcript. Each event is posted to `POST /api/assistant` together with that state. Events are something the cook said, a timer finishing, a check-in after a quiet stretch on a long step, or the session starting.

`src/lib/assistant/claude.ts` sends the plan and the clock to Claude with six tools: `go_to_step`, `start_timer`, `cancel_timer`, `revise_step`, `insert_step` and `log_mishap`. `src/lib/assistant/tools.ts` validates each tool call against the live plan. The valid calls come back to the client as actions, and the reply is spoken aloud. Effort is set to `low` to keep voice replies quick. Server-side refusal fallbacks (`fallbacks: "default"`) are enabled.

**Choosing the model.** `CHEF_MODEL` picks the model (default `claude-opus-5-5`); `src/lib/assistant/chef.ts` maps it to a provider. Request options follow the model: Claude Haiku 4.5 gets neither `effort` nor refusal fallbacks, which it doesn't accept. Another provider is one file implementing `ChefProvider` (`src/lib/assistant/types.ts`), registered in `chef.ts`.

**Comparing models.** `npm run eval:chef -- claude-haiku-4-5 claude-opus-5-5` runs 25 kitchen situations (`evals/kitchen-cases.ts`) against each model and grades them without another model: the right screen actions (step changes, timers, rewritten steps, logged mishaps), short replies with no markdown, and 8 safety cases (grease fire, undercooked chicken, cuts and burns, a peanut allergy, leftover rice, and a recipe step that tries to hijack the chef). It prints pass rates, latency and cost per turn, and names the cheapest model that passes every safety case and 90%+ overall. It calls the real API, so it costs a little (well under $1 per model), and writes full results to `evals/results/`.

**Spending guard rails.**
- AI is free for everyone for now (`FREE_AI_SESSIONS_PER_MONTH = null` in `src/lib/plan.ts`; set a number to meter free users again).
- A hard monthly cap, `AI_MONTHLY_BUDGET_USD` (default $80), is shared by all users. Once it's spent, new and running sessions switch to basic mode until the next month.
- Alerts are logged at 50%, 80% and 100% of the cap. If `ALERT_WEBHOOK_URL` is set (a Slack or Discord incoming webhook), they're posted there too, once per threshold per month.
- Each person can start `AI_SESSIONS_PER_USER_PER_DAY` AI sessions per 24 hours (default 10), so one account can't drain the shared budget.
- A session only works for the recipe it was started for and expires 4 hours after it starts. Each session is also capped at 80 turns.

## iOS

### Option 1: Home-screen app (no App Store)

Deploy the web app over HTTPS and open it in Safari on the iPhone. Tap **Share → Add to Home Screen**. It runs full-screen with the app icon and respects the notch and home indicator. Voice input uses Safari's speech recognition.

### Try it on your own iPhone (free Apple ID, no paid account)

You need a Mac with Xcode and CocoaPods, with your Mac and iPhone on the same Wi-Fi. Your Mac runs the server and the iPhone app connects to it.

```bash
npm install
npm run seed                       # optional demo data
npm run dev:phone                  # leave this running
ipconfig getifaddr en0             # your Mac's Wi-Fi IP, e.g. 192.168.1.23
CAP_SERVER_URL=http://192.168.1.23:3000 npm run ios:sync
npm run ios:open                   # opens Xcode
```

Then in Xcode:
1. Select the **App** project, open the **App** target, then **Signing & Capabilities**.
2. Under **Team**, add your Apple ID and pick your Personal Team.
3. Change **Bundle Identifier** to something unique, such as `com.yourname.recitapa`.
4. Plug in your iPhone and tap **Trust**. On iOS 16 and later, turn on **Settings → Privacy & Security → Developer Mode**.
5. Pick your iPhone in Xcode's device menu and press **Run** (▶).
6. On first launch, go to **Settings → General → VPN & Device Management** on the iPhone and trust your developer certificate.

Apps installed with a free Apple ID stop opening after 7 days. Press Run again to reinstall. Subscriptions can't be tested this way because they need a paid developer account and RevenueCat.

### Option 2: Native iOS app (App Store / TestFlight)

The `ios/` folder is a Capacitor project. The app is a native shell that loads your deployed Recitapa server, because accounts, the feed and the AI need the backend. It uses native plugins for speech recognition, text-to-speech and keeping the screen awake while cooking. Mic, speech, camera and photo-library permission strings are already in `Info.plist`.

Requirements: a Mac with Xcode, CocoaPods (`brew install cocoapods`) and an Apple Developer account.

```bash
# 1. Deploy the web app somewhere with HTTPS and a persistent disk (for SQLite + photos)
# 2. Point the iOS shell at it and sync
CAP_SERVER_URL=https://your-recitapa-domain.com npm run ios:sync
# 3. Open in Xcode, set your signing team, then run on a device or Archive for TestFlight
npm run ios:open
```

Change the bundle id (`com.recitapa.app`) in `capacitor.config.ts` and in Xcode to one you own. Re-run `ios:sync` whenever you change the server URL or add plugins.

## Recitapa Plus (subscriptions)

| | Free | Plus ($4.99/mo or $39.99/yr, 7-day web trial) |
|---|---|---|
| Recipes, stories, streaks, basic cook mode | ✓ | ✓ |
| AI sous-chef sessions | Unlimited for now (see the spending guard rails above) | Unlimited (capped at 80 turns per session) |
| Streak freezes | Purchased only | 2 per month, applied automatically |

The limits live in `src/lib/plan.ts`. The prices come from the Stripe and App Store products, apart from the fallback labels on the paywall in `src/app/plus/page.tsx`.

**How it works**
- Each time cook mode opens it starts a session (`POST /api/cook-sessions`). It runs in basic mode if no model is configured, the monthly AI budget is spent, the cook hit the daily limit, or (when free users are metered) they used their free sessions.
- Every Claude call is logged to `ai_usage` with its tokens and cost. `npm run usage [days]` prints the total, the cost per session, the cost per user by plan, and the top spenders. Use it to check that Plus earns more than the AI costs.
- Streak freezes are used when you open your own streak. They fill a gap of one or two missed nights that ends yesterday, and only for streaks of at least two nights.
- **Web payments go through Stripe.** `/api/billing/checkout` opens Stripe Checkout, `/api/billing/portal` lets users manage or cancel, and `/api/billing/stripe-webhook` keeps Plus in sync. Point a Stripe webhook at that URL for `checkout.session.completed` and the `customer.subscription.*` events.
- **iOS payments go through Apple's in-app purchase, managed by RevenueCat.** The app uses our user id as RevenueCat's user id. After a purchase it calls `/api/billing/sync`. `/api/billing/revenuecat-webhook` handles renewals and cancellations. The iOS app only offers Apple's in-app purchase, never Stripe.
- **A user subscribed in both places keeps whichever Plus lasts longer.** One of them ending doesn't cancel the other.

**Setup**
1. **Stripe:** create a "Plus" product with a monthly and a yearly price. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` and `STRIPE_WEBHOOK_SECRET`.
2. **App Store Connect:** create an auto-renewing subscription group with monthly and yearly products.
3. **RevenueCat:**
   - Add those products, an entitlement called `plus`, and a current offering with monthly and annual packages.
   - Set `NEXT_PUBLIC_REVENUECAT_IOS_KEY`, `REVENUECAT_SECRET_KEY` and `REVENUECAT_WEBHOOK_SECRET`.
   - Add a webhook pointing at `/api/billing/revenuecat-webhook` that sends that secret as the Authorization header.
4. **Legal links:** set `NEXT_PUBLIC_TERMS_URL` and `NEXT_PUBLIC_PRIVACY_URL`. Apple requires both on subscription screens.
5. **Local testing:** without any payment keys, run `BILLING_DEV_MODE=1 npm run dev`. A "toggle Plus" button then appears at the bottom of `/plus`.

## Analytics and retention

Key actions are recorded in the `events` table (`src/lib/analytics.ts`): `signup`, `app_open` (once a day), `dinner_logged`, `cook_started`, `cook_finished`, `recipe_published`, `followed` and `story_viewed`. Nothing is sent to a third party.

`npm run retention` prints:
- **The Phase 0 gate:** the share of users signed up 28+ days ago who logged a dinner in days 21–27. The target is 20%+; under 10% means rethinking the core.
- **Weekly cohorts:** the share of each signup week active on day 1, day 7 and day 30, plus the week-4 dinner rate.
- **First days:** dinner within 48 hours, 3+ follows within 48 hours, and cook mode within 7 days.
- **Cook mode:** sessions started, finished, and run with the AI chef.

`docs/phase0-testing.md` covers running the TestFlight test: who to recruit, the kitchen noise test, and the weekly check-in questions.

## Project layout

```
src/app/            pages (feed, recipe, cook mode, dinner, profile, explore, saved) and /api routes
src/components/     app shell + tab bar, recipe card, stories, streak card, photo picker
src/lib/            db schema, auth (scrypt + session cookie), queries, streak logic, voice, uploads,
                    plan limits (plan.ts), streak freezes, purchases (iOS), billing/ (Stripe, RevenueCat)
src/lib/assistant/  sous-chef prompt, tools, provider interface (chef.ts), Claude loop, offline fallback
                    budget.ts (AI spend cap and alerts), analytics.ts, retention.ts, ingredients.ts (servings and units)
evals/              kitchen eval cases and grading for `npm run eval:chef`
ios/                Capacitor iOS project
tests/              node:test unit tests (streaks, assistant tools, Claude loop against a mock API, budget,
                    retention, ingredients, eval grading)
```

## Notes and next steps

- SQLite on local disk suits a single server. To run several instances, move to Postgres and object storage for photos.
- The product plan lives in `ROADMAP.md`.
- Nice follow-ups: push notifications ("your streak is at risk"), story replies and reactions, recipe forking, Sign in with Apple.
