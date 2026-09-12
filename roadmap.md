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
- [ ] Firebase audit + migration plan (read-only, no code changes) — explain Supabase/Lovable Cloud usage,
      auth/db/storage/server functions/profiles, Lovable AI preservation, feature data dependencies,
      files requiring changes, and a safe staged migration plan. Config provided for project habitpet-co.
