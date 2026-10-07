# Recitapa Roadmap

## The bet

**Recitapa is a social app that helps young adults cook at home more often and get better at it.**
Friends keep you cooking regularly. The voice sous-chef helps you improve. The social side is the core of the app, and the AI makes each dinner worth posting.

## Constraints

- **Team:** one person (the founder). Every phase has to be small enough for one developer to ship.
- **Budget:** $100/month, all costs included.
- **AI:** free for everyone while we learn. Paid plans can wait until retention is proven.
- **Growth:** free channels only: friends, campuses, cooking clubs and creators who join for perks. No paid ads or paid creators yet.

### Monthly budget

| Item | Cost |
|---|---|
| Apple Developer Program ($99/yr) | ~$8 |
| Hosting (one small server, SQLite + photos on disk) | ~$5–12 |
| Domain + email for password resets | ~$2 |
| **AI (Claude), hard-capped** | **~$80** |

An AI cook session is estimated at **$0.25–0.50**, so the budget covers about **150–300 sessions a month**. Measure the real number with `npm run usage` in Phase 0 and adjust the cap.

## How we measure success

Week-4 retention is the number that decides what happens next.

| Phase | Target |
|---|---|
| 0 | **20%+ of testers still log dinner each week in week 4**; average AI session cost known |
| 1 | App Store approval on the first or second submission |
| 2 | A new user follows ≥3 friends and logs a dinner within 48 hours |
| 3 | Users in a cooking circle keep a better week-4 retention than users who aren't |
| 4 | Each user brings in ≥0.3 new active users (viral coefficient) |

---

## Phase 0: Prove it (about 3–4 weeks)

The goal is to find out whether friends keep each other cooking, before building anything big.

- [ ] **Cheaper AI model.** Put the sous-chef behind a provider interface, write 20–30 kitchen test cases (tool accuracy, safety, short spoken replies), and compare Claude Haiku 4.5, Gemini Flash and Groq. Pick the cheapest model that passes every safety case; use a stronger model only for mishaps if needed. Avoid free tiers that train on user data.
- [ ] **Global AI budget cap.** A monthly spend limit (e.g. $80, from `ai_usage`); once it's reached, all sessions fall back to basic mode with a friendly notice. Turn on alerts at 50% and 80%.
- [ ] **Make AI free:** remove the 3-sessions-a-month free limit and keep the per-session turn cap.
- [ ] **Fix AI session abuse:** tie each session to its recipe, expire it after about 4 hours, and create it in one transaction.
- [ ] **Simple analytics:** an events table (signup, dinner logged, cook started/finished, follow, story viewed) and a script that prints day-1/7/30 retention for each signup week.
- [ ] **Kitchen basics:** keep the screen awake in cook mode, test voice with real kitchen noise, and add serving scaling and metric/imperial units.
- [ ] **TestFlight with 20–50 young adults** who already know each other (one friend group, dorm or club, not strangers).
- [ ] **Talk to testers each week.** What made you cook? What made you skip? What did you tell a friend about the app?

**Decision point:** if week-4 retention is under ~10%, change the core of the app before building more features.

## Phase 1: Launch safety (about 3–4 weeks)

These have to be done before the public App Store launch.

- [ ] **Report and block** on recipes, comments, stories and profiles, plus an admin review queue (App Store guideline 1.2).
- [ ] **In-app account deletion** that removes the user's data and photos (App Store guideline 5.1.1(v)).
- [ ] **Email + password reset**, plus a login rate limit, and move `scrypt` off the main thread.
- [ ] **Re-encode photos on the server** to strip GPS and other hidden photo data.
- [ ] **AI food safety:** allergy and diet fields in user profiles that the sous-chef respects, a written test list of unsafe questions ("the chicken is still pink"), and a disclaimer.
- [ ] **Privacy policy + terms**, including what voice data goes to the AI and how long it's kept.
- [ ] **Age gate: 13+**, and fill in the App Store privacy section accurately.

## Phase 2: Friends from day one (about 4 weeks)

Social is the core of the app, so a new user must never land in an empty app.

- [ ] **Invite links and profile links** (`recitapa.app/@maya`) that open the app and auto-follow the inviter.
- [ ] **Contact import (opt-in)** to find friends who are already on the app.
- [ ] **Onboarding:** pick your skill level and diet, follow at least 3 people (suggested friends first, then active cooks), and get a first-recipe suggestion.
- [ ] **Starter recipe library:** about 100 original, cheap, beginner-friendly weeknight recipes (AI-assisted drafts, then edited and tested).
- [ ] **Reactions on dinner stories** (one-tap emojis, a quick "I want to make this").

## Phase 3: Cooking circles (about 4–6 weeks), the core of the app

Small friend groups who keep each other cooking. This is what Instagram can't easily copy.

- [ ] **Circles:** private groups of 3–10 friends with their own feed of dinners.
- [ ] **Shared circle streak:** the circle's streak grows when everyone (or most) cooks during the week. Weekly goals, e.g. 4 of 7 nights, instead of every night.
- [ ] **Weekly challenges:** a theme per week ("from-scratch pasta", "under $5", "a dish from home"), with circle members' attempts side by side.
- [ ] **Weekly voting:** circle members vote on challenge dinners. No self-votes, votes hidden until close, and only people who cooked can vote. Several awards instead of one winner (Best overall, Most improved, Most creative, Best on a budget, Best disaster) so beginners can win too. Winners get a crown on their profile for a week, a badge and a shareable card.
- [ ] **Cook-together nights:** pick a recipe and a time; everyone cooks it with the sous-chef and posts the result.
- [ ] **Skill progress:** track techniques learned (knife skills, sauces, baking) from recipes cooked. Badges already exist; tie them to these skills.
- [ ] **Push notifications:** "your circle is 1 dinner from the weekly goal", "Maya just posted dinner", "challenge ends tonight".

## Phase 4: Free growth (ongoing)

- [ ] **Shareable cards:** good-looking images of a dinner, circle streak or challenge result for Instagram/TikTok stories, with an invite link.
- [ ] **Campus playbook:** recruit volunteer ambassadors through cooking clubs, dorms and student groups; give them free perks, a "founding cook" badge and their own challenges.
- [ ] **Creators join for perks, not cash:** a featured page, "Cook with ___" challenges, and stats like "312 people cooked your recipe."
- [ ] **Referral tracking:** `referred_by` on new users, so you can see which campus or creator brings people who stay.

## Phase 5: The data advantage (once there's enough cooking)

Needs real volume. Start it when the app logs several hundred AI sessions a month.

- [ ] **Cook notes on steps** from logged mishaps ("12 cooks burned the garlic here, so try medium-low heat"). Only show a note once it's based on enough cooks (at least ~10).
- [ ] **Tested swaps** from step revisions ("Out of cream? 60 cooks used Greek yogurt").
- [ ] **Real step timings** vs. what the recipe says.
- [ ] **The sous-chef reads cook notes aloud** right before the step where people often make mistakes.

## Later: once retention is proven and there's money to spend

- Paid plan (Plus): pricing, which features are paid, and Apple's 15% small-business cut.
- Revenue share for creators.
- Postgres and photo storage in the cloud (S3/R2) instead of the single server's disk. Start this as soon as growth signs appear, not after the server struggles.
- Meal plans and grocery lists.
- Error monitoring and continuous integration (automatic tests on each push).

## Not doing now (and why)

| Idea | Why not yet |
|---|---|
| Paid creators or ads | No budget, and retention isn't proven yet |
| Big scraped recipe database | Copyright risk, and it doesn't protect us from copycats; a starter library is enough |
| A paywall on AI | Free AI generates the data and word of mouth we need first |
| Daily-only streaks | Too hard for young adults who eat out; weekly circle goals replace them |
| Postgres migration | One server handles thousands of users; migrate when growth shows up |
