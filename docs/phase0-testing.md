# Phase 0 test: does a friend group keep cooking?

Four weeks, one friend group, one number at the end: the share of testers who still log dinner in their fourth week (`npm run retention`). 20% or more means move on to Phase 1. Under about 10% means rethink the core before building more.

## Before inviting anyone

1. **Pick the model.** Run `npm run eval:chef -- claude-haiku-4-5 claude-opus-5-5` (needs `ANTHROPIC_API_KEY`; costs well under $1 per model). Set `CHEF_MODEL` to the cheapest model that passes every safety case and 90%+ overall. If none pass, keep `claude-opus-5-5`.
2. **Set the guard rails** on the server: `AI_MONTHLY_BUDGET_USD=80` (or whatever's left after hosting), and `ALERT_WEBHOOK_URL` to a Slack or Discord webhook so 50%, 80% and 100% alerts reach your phone.
3. **Run the kitchen noise test** (below) on at least one iPhone.
4. **Ship a TestFlight build:** deploy the server over HTTPS, then `CAP_SERVER_URL=https://… npm run ios:sync`, `npm run ios:open`, archive, upload. Invite friends as external testers with a public TestFlight link; the first build needs a short Beta App Review. (Internal testing skips review but only works for people added to your App Store Connect team.)

## Who to recruit

- 20–50 young adults (about 18–28) who **already know each other**: one dorm floor, club, team or friend group. Strangers won't show whether friends keep each other cooking.
- People who want to cook more, not people who already cook every night.
- Ask each person to follow at least three others on day one.

## Kitchen noise test

Voice is useless if the mic can't hear over a kitchen. With the phone propped up about an arm's length away, say each phrase three times under each condition and count how many the chef understood.

| Condition | Phrases |
|---|---|
| Quiet kitchen | "What's next?", "Set a five minute timer", "I burned the garlic", "Repeat that" |
| Extractor fan on high | same |
| Something sizzling in a pan | same |
| Music playing at a normal volume | same |
| Tap running | same |

Fewer than 10 of 12 in any row is a problem to fix before the test, for example by suggesting the cook taps the mic button rather than relying on hands-free, or by moving the phone closer.

## During the four weeks

- **Check the numbers weekly:** `npm run retention` (cohorts, first-days funnel, cook mode) and `npm run usage` (AI spend against the cap, cost per session per model).
- **Talk to 5–10 testers each week,** for 10 minutes each. Ask the same questions every time so the answers compare:
  1. Which nights did you cook this week, and what made you do it?
  2. Which nights did you skip, and why?
  3. Did anything in the app make you want to cook, or feel like a chore?
  4. Did you use the voice sous-chef? What happened?
  5. What did you tell a friend about the app, if anything?
- Write down exact quotes. They matter more than ratings.

## At the end of week four

| Week-4 dinner rate | Decision |
|---|---|
| 20% or more | Start Phase 1 (launch safety) |
| 10–20% | Keep testing for two more weeks and fix the biggest reason people gave for skipping |
| Under 10% | Stop building features; rethink why friends would cook together, using the interview notes |
