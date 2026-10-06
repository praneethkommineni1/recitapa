# Recitapa

A social cooking app: share recipes, post tonight's dinner as a 24-hour story, keep a nightly dinner streak, and cook with a voice sous-chef that talks you through each step and helps when something goes wrong.

## Features

- **Recipes**: publish recipes with a cover photo, ingredients, steps and optional per-step timers. Like, comment, save, search by title or #tag.
- **Dinner stories**: log tonight's dinner (photo and/or caption, optionally linked to a recipe). It shows as a story to your followers for 24 hours and stays in your dinner diary.
- **Streaks**: every night you log dinner extends your streak. The home screen warns you when it's at risk, and profiles show your current and best streak plus a five-week calendar.
- **Voice sous-chef** (cook mode): it reads each step out loud, runs the timers, checks in if a step runs long, and listens hands-free. Tell it what went wrong ("I burned the garlic", "I'm out of cream", "it's too salty") and it suggests a fix. It logs the mishap and rewrites the remaining steps when the plan needs to change.
- **Social**: follow cooks, a Following/Discover feed, and profiles.
- **iOS**: installable as a home-screen web app, plus a native iOS shell (Capacitor) for the App Store.

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

Other scripts: `npm test` (unit tests), `npm run lint` (typecheck), `npm run build && npm start` (production).

## How the sous-chef works

`src/app/recipes/[id]/cook/page.tsx` keeps the live session: the current step, the steps (which the chef may revise), running timers, mishaps and the transcript. Each event is posted to `POST /api/assistant` together with that state. Events are something the cook said, a timer finishing, a check-in after a quiet stretch on a long step, or the session starting.

`src/lib/assistant/claude.ts` sends the plan and the clock to Claude with six tools: `go_to_step`, `start_timer`, `cancel_timer`, `revise_step`, `insert_step` and `log_mishap`. `src/lib/assistant/tools.ts` validates each tool call against the live plan. The valid calls come back to the client as actions, and the reply is spoken aloud. Effort is set to `low` to keep voice replies quick. Server-side refusal fallbacks (`fallbacks: "default"`) are enabled.

## iOS

### Option 1: Home-screen app (no App Store)

Deploy the web app over HTTPS and open it in Safari on the iPhone. Tap **Share → Add to Home Screen**. It runs full-screen with the app icon and respects the notch and home indicator. Voice input uses Safari's speech recognition.

### Option 2: Native iOS app (App Store / TestFlight)

The `ios/` folder is a Capacitor project. The app is a native shell that loads your deployed Recitapa server, because accounts, the feed and the AI need the backend. It uses native plugins for speech recognition and text-to-speech. Mic, speech, camera and photo-library permission strings are already in `Info.plist`.

Requirements: a Mac with Xcode (from the App Store; open it once to install the iOS components), Node 22+, and CocoaPods (`brew install cocoapods`). A free Apple ID is enough to run on your own iPhone. TestFlight and the App Store need a paid Apple Developer account.

#### Run it on the Simulator or your iPhone (development)

The native app loads the Next.js server running on your Mac.

```bash
npm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY
npm run seed                   # optional demo data

# Terminal 1: start the web server, reachable from your local network
npm run dev:lan

# Terminal 2: point the iOS shell at it, install pods and open Xcode
CAP_SERVER_URL=http://localhost:3000 npm run ios:sync           # Simulator
# or, for a real iPhone on the same Wi-Fi, use your Mac's Bonjour name
# (System Settings → General → Sharing → Local hostname):
CAP_SERVER_URL=http://your-mac-name.local:3000 npm run ios:sync # iPhone
npm run ios:open
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities**. Choose your **Team** (add your Apple ID under Xcode → Settings → Accounts if it isn't listed). If Xcode reports that `com.recitapa.app` is taken, change the bundle identifier to something unique, e.g. `com.yourname.recitapa`, and set the same value as `appId` in `capacitor.config.ts`.
2. Pick a Simulator or your plugged-in iPhone from the device menu at the top and press **Run** (⌘R).
3. On a real iPhone, the first run needs **Developer Mode** turned on (Settings → Privacy & Security). You also need to trust your developer certificate (Settings → General → VPN & Device Management).

If the app shows "Can't reach the kitchen right now", the phone can't reach your server. Check that `npm run dev:lan` is running, that both devices are on the same Wi-Fi, and that you synced with the right `CAP_SERVER_URL`.

#### Ship to TestFlight / the App Store

```bash
# 1. Deploy the web app somewhere with HTTPS and a persistent disk (for SQLite + photos)
# 2. Point the iOS shell at it and sync
CAP_SERVER_URL=https://your-recitapa-domain.com npm run ios:sync
# 3. Open in Xcode, then Product → Archive → Distribute App → App Store Connect
npm run ios:open
```

Bump the version and build number on the App target's **General** tab before each upload. Re-run `ios:sync` whenever you change the server URL or add plugins. Plain-HTTP loads are only allowed for local-network hosts (`NSAllowsLocalNetworking`), so a release build must point at an HTTPS server.

## Project layout

```
src/app/            pages (feed, recipe, cook mode, dinner, profile, explore, saved) and /api routes
src/components/     app shell + tab bar, recipe card, stories, streak card, photo picker
src/lib/            db schema, auth (scrypt + session cookie), queries, streak logic, voice, uploads
src/lib/assistant/  sous-chef prompt, tools, Claude loop, offline fallback
ios/                Capacitor iOS project
tests/              node:test unit tests (streaks, assistant tools, Claude loop against a mock API)
```

## Notes and next steps

- SQLite on local disk suits a single server. To run several instances, move to Postgres and object storage for photos.
- Nice follow-ups: push notifications ("your streak is at risk"), story replies and reactions, recipe forking, scaling servings, Sign in with Apple.
