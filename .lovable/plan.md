This is a very large scope (roughly a second full app on top of HabitPet). To ship something that actually works instead of a half-wired demo, I'll break it into phases and confirm a few decisions before building.

## Decisions I need from you

1. **3D pets** — True 3D (react-three-fiber + GLB models) adds ~500KB per pet, requires 3D artist assets, and takes 1-2 days per pet just to rig. **My recommendation:** keep the current high-quality illustrated pets and add subtle idle/bounce animations + a "3D-style" shaded look via CSS transforms. Real 3D can be a later upgrade. OK?
2. **Fitness tracking** — Browsers can't background-track walking distance. Real step tracking needs either (a) a native mobile app, (b) Google Fit / Apple Health OAuth connector, or (c) manual "I walked X km today" entry. **My recommendation:** manual entry + optional Google Fit connector later. OK?
3. **Calorie AI from photos** — I'll use Lovable AI (Gemini vision) to analyze meal photos and estimate calories/protein/carbs/fat. Estimates only, not medical grade — I'll show a disclaimer.
4. **Skill lessons & motivational quotes in mother tongue** — generated on-demand by Lovable AI (Gemini) in the user's chosen language. First lesson generates on skill selection, then daily.
5. **Medical info (diseases/weaknesses)** — I'll store it but add a clear disclaimer: HabitPet is not medical advice. OK?

## Build phases (one PR each, in order)

### Phase 1 — Expanded onboarding + profile
- New onboarding steps after pet selection:
  1. Name, age, profession, class/grade (optional)
  2. Mother tongue (dropdown: English, Hindi, Spanish, French, Arabic, Mandarin, Portuguese, Bengali, Urdu, Tamil, +more)
  3. Health conditions (multi-select: overweight, underweight, weakness/low-energy, diabetes-risk, back-pain, anxiety, none, +custom)
  4. Fitness goal (lose weight / gain muscle / stay fit / more energy)
  5. Skill to learn (video editing, coding, design, writing, public speaking, music, +custom)
- Migration: add columns to `profiles` (full_name, age, profession, grade, mother_tongue, health_conditions[], fitness_goal, target_skill, height_cm, weight_kg)

### Phase 2 — AI-generated daily habits
- On onboarding complete, call Lovable AI (Gemini 3 Flash) with profile → returns 5–10 tailored habits (JSON, validated with Zod). Insert into `habits`.
- "Regenerate my plan" button on /habits page.

### Phase 3 — Food tracking + calorie AI (Cal AI-style)
- New route `/food` with:
  - "Log meal" — pick meal (breakfast/lunch/dinner/snack), either type text OR upload/take photo
  - Camera button uses `<input type="file" accept="image/*" capture="environment">`
  - Photo goes to a `createServerFn` that calls Gemini vision → structured JSON: `{items:[{name, grams, calories, protein_g, carbs_g, fat_g}], total_calories, ...}`
  - Save to new `meal_logs` table
- New route `/nutrition` (daily dashboard):
  - Today's calories in/out, protein/carbs/fat rings, weekly trend chart
  - Compare vs. target (calculated from age/weight/goal — Mifflin-St Jeor formula)
- New tables: `meal_logs`, `activity_logs` (for manual walk/run/workout entry with kcal burned)

### Phase 4 — Diet plan
- Daily AI-generated meal suggestions based on profile + goal + mother tongue for meal names.
- Stored in `diet_suggestions` table, cached per day.

### Phase 5 — Fitness tracking
- Manual entry: "I walked X km" / "I did X minutes of Y"
- Progress ring toward daily goal (e.g., 5 km walk)
- Streaks for meeting the goal.

### Phase 6 — Pet health score linkage
- Nightly (on next-day open): compute a **wellness score 0–100** from:
  - Habit completion rate (40%)
  - Calorie balance vs. target (25%)
  - Fitness goal met (25%)
  - Sleep/hydration habits done (10%)
- Score maps to pet health/happiness deltas. Score ≥70 → pet happy & healthy; <40 → pet sick animation + gentle nudge.

### Phase 7 — Skill lessons + mother-tongue motivation
- New route `/learn`:
  - Today's lesson for chosen skill: what/why/how/first steps (AI-generated, cached per day, in English + user's mother tongue side-by-side).
  - "Next lesson" progresses a curriculum stored in `skill_lessons`.
- Dashboard widget: 3 motivational lines in mother tongue tailored to age + skill, refreshed daily.

### Phase 8 — Pet polish (the "3D feel")
- Add drop-shadow, subtle float/bounce/blink animations, tilt-on-hover, particle sparkles on level-up. Keeps current art but feels alive.
- (Real 3D pets deferred until you provide/approve GLB models.)

## Technical notes (for reference)

- All AI calls via **Lovable AI Gateway** (`google/gemini-3-flash-preview` for text, same model for vision — it's multimodal). Server-only, keys stay in `process.env.LOVABLE_API_KEY`.
- Food photos: uploaded as base64 data URLs directly to the server fn (no storage bucket needed for MVP; can add Supabase Storage later for history).
- All new tables get RLS scoped to `auth.uid()` + GRANTs to `authenticated` + `service_role`.
- Structured AI output uses AI SDK `Output.object` with small Zod schemas (no `.min/.max` in schema — enforced in prompt + clamped after).
- Nothing here changes existing pages/design — only adds routes and expands onboarding.

## What I'll do next

Reply with **"go"** and I'll start with **Phase 1 (expanded onboarding + profile schema)**. Or tell me which decisions above to change and I'll adjust before starting.