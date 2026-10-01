# HabitPet roadmap

## In progress
- [ ] 5-plan subscription system (FREE, WEEKLY_PRO, SPECIAL_38_DAY, MONTHLY_PRO, YEARLY_PRO)
  - [x] DB columns: plan_code, plan_state, one_time, provider fields
  - [x] Central plan catalogue (src/lib/plans.ts) + billing config (src/lib/billing.server.ts)
  - [x] Guard / server functions / useSubscription / Paddle webhook plan mapping
  - [x] Pricing page wired to catalogue + checkout hand-off
  - [ ] Upgrade sheet, Settings, success screen, analytics events, i18n keys
  - [ ] Onboarding gate for new signups (questionnaire must not be skippable)
  - [ ] Restore Purchases + Google Play server verification (blocked: no provider configured)

## Requested
- [x] Replace visible template branding with HabitPet name and pet logo
- [x] Signup questionnaire (pet, name, body details, objective + passion)
- [x] Routine page with emotion-aware AI coach, 8h sleep / 3L water / exercise, roadmap
- [x] One-per-user motivation popup on app open (never repeats a line)
- [x] Firebase audit + migration plan
- [ ] Firebase migration (habitpet-co)
  - [x] SDK + web config wired, lazy client
  - [x] Step 1: Firestore data model, Firestore + Storage security rules
  - [x] Step 2 prep: Firebase sign-in provider (email, Google, reset) — not yet switched on
  - [x] Service-account key saved + Worker-safe server access (token, Firestore REST, custom tokens)
  - [ ] Step 3: move data feature by feature
  - [ ] Step 4: cut over, verify, retire old backend
