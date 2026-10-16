# HabitPet roadmap

## In progress — "fix all bugs, user friendly, text-only data" (Oct 2026)
- [ ] Sweep every signed-in page for errors (console, failed requests, broken images)
- [ ] Meal photos are never stored — scanner analyses the photo, saves text only
- [ ] Old stored meal photos no longer shown; pages show a food icon instead
- [ ] Friendly error messages everywhere (no raw technical errors shown to users)
- [ ] Sign-in / sign-up: clear password hint, friendly errors, show/hide password, forgot password
- [ ] Routine page: replace the long form with a conversational AI coach (daily life → wants → budget → earning roadmap, mic input)
- [ ] Verify AI Coach chat + Routine chat reply end to end
- [ ] Verify pet images, motivation images, egg logo load on every page

## Subscription
- [x] 3 plans only: Free, Monthly Pro ($7.99), Yearly Pro ($64.99)
- [ ] Real payment provider (blocked: no payment account connected; upgrade is currently instant/free)
- [ ] Restore Purchases + Google Play server verification (blocked: no provider configured)

## Requested
- [x] Replace visible template branding with HabitPet name and pet logo
- [x] Signup questionnaire (pet, name, body details, objective + passion)
- [x] Routine page with emotion-aware AI coach, 8h sleep / 3L water / exercise, roadmap
- [x] One-per-user motivation popup on app open (never repeats a line)
- [x] Shop removed, Google sign-in removed, English only
- [ ] 300 motivational images (limited: large image sets bloat the app; pool of images rotates with unique lines)
- [ ] Firebase migration (habitpet-co)
  - [x] SDK + web config wired, lazy client
  - [x] Step 1: Firestore data model, Firestore + Storage security rules
  - [x] Step 2 prep: Firebase sign-in provider (email, reset) — not yet switched on
  - [x] Service-account key saved + Worker-safe server access
  - [ ] Step 3: move data feature by feature
  - [ ] Step 4: cut over, verify, retire old backend
