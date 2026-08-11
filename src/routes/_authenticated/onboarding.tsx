import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react";
import { completeOnboarding } from "@/lib/onboarding.functions";
import { PETS, type PetType, getPet } from "@/lib/pet-catalog";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to HabitPet — Adopt your pet" },
      { name: "description", content: "Set up your pet, share a bit about you, and get a personalized daily plan." },
    ],
  }),
  component: Onboarding,
});

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "es", label: "Español (Spanish)" },
  { code: "fr", label: "Français (French)" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "zh", label: "中文 (Mandarin)" },
  { code: "pt", label: "Português (Portuguese)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "ur", label: "اردو (Urdu)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "de", label: "Deutsch (German)" },
  { code: "ja", label: "日本語 (Japanese)" },
  { code: "ko", label: "한국어 (Korean)" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "tr", label: "Türkçe (Turkish)" },
  { code: "ru", label: "Русский (Russian)" },
];

const HEALTH_OPTIONS = [
  "Overweight", "Underweight", "Low energy / Weakness", "Back pain", "Anxiety / Stress",
  "Diabetes risk", "High blood pressure", "Poor sleep", "Bad posture", "None",
];

const FITNESS_GOALS: { value: "lose_weight"|"gain_muscle"|"stay_fit"|"more_energy"|"flexible"; label: string; emoji: string }[] = [
  { value: "lose_weight", label: "Lose weight", emoji: "🔥" },
  { value: "gain_muscle", label: "Gain muscle", emoji: "💪" },
  { value: "stay_fit", label: "Stay fit", emoji: "🌿" },
  { value: "more_energy", label: "More energy", emoji: "⚡" },
  { value: "flexible", label: "Be more flexible", emoji: "🧘" },
];

const ACTIVITY_LEVELS: { value: "sedentary"|"light"|"moderate"|"active"|"very_active"; label: string; hint: string }[] = [
  { value: "sedentary", label: "Sedentary", hint: "Little to no exercise" },
  { value: "light", label: "Light", hint: "1–3 days / week" },
  { value: "moderate", label: "Moderate", hint: "3–5 days / week" },
  { value: "active", label: "Active", hint: "6–7 days / week" },
  { value: "very_active", label: "Very active", hint: "Athlete / physical job" },
];

const SKILL_PRESETS = [
  "Video editing", "Coding", "UI/UX design", "Writing", "Public speaking",
  "Music production", "Photography", "Digital marketing", "Graphic design", "3D animation",
];

const HABIT_PRESETS = [
  "Exercise", "Read", "Drink water", "Study", "Meditation",
  "Walk 5km", "Sleep 8h", "Journal",
];

const TOTAL_STEPS = 8;

function Onboarding() {
  const navigate = useNavigate();
  const fnComplete = useServerFn(completeOnboarding);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // Pet
  const [petType, setPetType] = useState<PetType | null>(null);
  const [petName, setPetName] = useState("");

  // Personal
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male"|"female"|"other"|"prefer_not"|"">("");
  const [profession, setProfession] = useState("");
  const [grade, setGrade] = useState("");

  // Language
  const [motherTongue, setMotherTongue] = useState("en");

  // Health
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<"sedentary"|"light"|"moderate"|"active"|"very_active"|"">("");
  const [fitnessGoal, setFitnessGoal] = useState<"lose_weight"|"gain_muscle"|"stay_fit"|"more_energy"|"flexible"|"">("");

  // Skill
  const [targetSkill, setTargetSkill] = useState("");
  const [customSkill, setCustomSkill] = useState("");

  // Habits
  const [habits, setHabits] = useState<string[]>([]);
  const [customHabit, setCustomHabit] = useState("");

  function toggleFromList(list: string[], setter: (v: string[]) => void, v: string) {
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  async function finish() {
    if (!petType || !petName.trim() || !fullName.trim() || !age || !fitnessGoal || !targetSkill.trim() || habits.length === 0) return;
    setBusy(true);
    try {
      await fnComplete({ data: {
        pet_type: petType,
        pet_name: petName.trim(),
        habits,
        full_name: fullName.trim(),
        age: parseInt(age, 10),
        sex: sex || null,
        profession: profession.trim() || null,
        grade: grade.trim() || null,
        mother_tongue: motherTongue,
        health_conditions: healthConditions,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        activity_level: activityLevel || null,
        fitness_goal: fitnessGoal,
        target_skill: targetSkill.trim(),
      } });
      toast.success(`${petName.trim()} is hatching!`);
      navigate({ to: "/app", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't finish setup");
      setBusy(false);
    }
  }

  const canAdvance =
    (step === 1 && !!petType) ||
    (step === 2 && petName.trim().length > 0) ||
    (step === 3 && fullName.trim().length > 0 && age.length > 0 && parseInt(age, 10) >= 5) ||
    (step === 4 && motherTongue.length > 0) ||
    (step === 5 && fitnessGoal.length > 0) ||
    (step === 6 && targetSkill.trim().length > 0) ||
    (step === 7 && habits.length > 0);

  return (
    <main className="min-h-screen px-4 py-8 md:py-14">
      <div className="mx-auto max-w-2xl">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full transition ${i < step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="rounded-[2rem] bg-card p-6 shadow-pet md:p-10">
          {step === 1 && (
            <div className="space-y-6">
              <header className="space-y-1">
                <p className="text-sm font-semibold text-primary">Step 1 of {TOTAL_STEPS}</p>
                <h1 className="text-3xl font-bold">Pick your starter pet</h1>
                <p className="text-muted-foreground">Each one grows the same way — pick the vibe you love.</p>
              </header>
              <div className="grid gap-3 sm:grid-cols-2">
                {PETS.map((p) => {
                  const active = petType === p.type;
                  return (
                    <button key={p.type} onClick={() => setPetType(p.type)}
                      className={`group flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}>
                      <img src={p.image} alt={p.label} width={80} height={80} loading="lazy" className="h-16 w-16 object-contain transition group-hover:scale-110" />
                      <span className="flex-1">
                        <span className="block font-bold">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">{p.vibe}</span>
                      </span>
                      {active && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={16} strokeWidth={3} /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <header className="space-y-1">
                <p className="text-sm font-semibold text-primary">Step 2 of {TOTAL_STEPS}</p>
                <h1 className="text-3xl font-bold">Name your pet</h1>
                <p className="text-muted-foreground">You can rename anytime.</p>
              </header>
              <div className="flex flex-col items-center gap-4 py-4">
                {petType && <img src={getPet(petType).image} alt={getPet(petType).label} width={160} height={160} className="h-32 w-32 object-contain" />}
                <input autoFocus value={petName} onChange={(e) => setPetName(e.target.value)} maxLength={40} placeholder="e.g. Pixel"
                  className="w-full max-w-xs rounded-full border-2 border-input bg-background px-5 py-3 text-center text-lg font-semibold outline-none focus:border-ring" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <header className="space-y-1">
                <p className="text-sm font-semibold text-primary">Step 3 of {TOTAL_STEPS}</p>
                <h1 className="text-3xl font-bold">Tell us about you</h1>
                <p className="text-muted-foreground">We'll tailor your daily plan.</p>
              </header>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Your name</span>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} placeholder="Full name"
                    className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Age</span>
                  <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={3} placeholder="e.g. 22"
                    className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Sex <span className="text-xs text-muted-foreground">(optional)</span></span>
                  <select value={sex} onChange={(e) => setSex(e.target.value as "male"|"female"|"other"|"prefer_not"|"")}
                    className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring">
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Profession <span className="text-xs text-muted-foreground">(optional)</span></span>
                  <input value={profession} onChange={(e) => setProfession(e.target.value)} maxLength={80} placeholder="Student, Designer, …"
                    className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold">Class / Grade <span className="text-xs text-muted-foreground">(optional — students only)</span></span>
                  <input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={40} placeholder="e.g. Class 10, Year 2 CS"
                    className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <header className="space-y-1">
                <p className="text-sm font-semibold text-primary">Step 4 of {TOTAL_STEPS}</p>
                <h1 className="text-3xl font-bold">Your mother tongue</h1>
                <p className="text-muted-foreground">We'll send you tips and motivation in this language.</p>
              </header>
              <div className="grid gap-2 sm:grid-cols-2">
                {LANGUAGES.map((l) => {
                  const active = motherTongue === l.code;
                  return (
                    <button key={l.code} onClick={() => setMotherTongue(l.code)}
                      className={`rounded-2xl border-2 px-4 py-3 text-left font-semibold transition ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}>
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <header className="space-y-1">
                <p className="text-sm font-semibold text-primary">Step 5 of {TOTAL_STEPS}</p>
                <h1 className="text-3xl font-bold">Your health</h1>
                <p className="text-muted-foreground">Not medical advice — just to personalize.</p>
              </header>

              <div>
                <div className="mb-2 text-sm font-semibold">Anything to keep in mind?</div>
                <div className="flex flex-wrap gap-2">
                  {HEALTH_OPTIONS.map((h) => {
                    const active = healthConditions.includes(h);
                    return (
                      <button key={h} onClick={() => toggleFromList(healthConditions, setHealthConditions, h)}
                        className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50"}`}>
                        {active ? "✓ " : "+ "}{h}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Height (cm) <span className="text-xs text-muted-foreground">optional</span></span>
                  <input value={heightCm} onChange={(e) => setHeightCm(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="e.g. 170"
                    className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold">Weight (kg) <span className="text-xs text-muted-foreground">optional</span></span>
                  <input value={weightKg} onChange={(e) => setWeightKg(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="e.g. 65"
                    className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                </label>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold">Activity level</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ACTIVITY_LEVELS.map((a) => {
                    const active = activityLevel === a.value;
                    return (
                      <button key={a.value} onClick={() => setActivityLevel(a.value)}
                        className={`rounded-2xl border-2 px-4 py-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}>
                        <div className="font-bold">{a.label}</div>
                        <div className="text-xs text-muted-foreground">{a.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold">Your fitness goal *</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FITNESS_GOALS.map((g) => {
                    const active = fitnessGoal === g.value;
                    return (
                      <button key={g.value} onClick={() => setFitnessGoal(g.value)}
                        className={`rounded-2xl border-2 px-4 py-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}>
                        <span className="mr-2 text-lg">{g.emoji}</span>
                        <span className="font-bold">{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <header className="space-y-1">
                <p className="text-sm font-semibold text-primary">Step 6 of {TOTAL_STEPS}</p>
                <h1 className="text-3xl font-bold">A skill to learn</h1>
                <p className="text-muted-foreground">We'll send you a lesson every day.</p>
              </header>

              <div className="flex flex-wrap gap-2">
                {SKILL_PRESETS.map((s) => {
                  const active = targetSkill === s;
                  return (
                    <button key={s} onClick={() => setTargetSkill(s)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50"}`}>
                      {active ? "✓ " : ""}{s}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if (customSkill.trim()) { setTargetSkill(customSkill.trim()); setCustomSkill(""); } }}
                className="flex gap-2">
                <input value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} placeholder="Or type your own"
                  className="flex-1 rounded-full border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                <button type="submit" disabled={!customSkill.trim()} className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
                  <Plus size={16} /> Use
                </button>
              </form>

              {targetSkill && (
                <div className="rounded-2xl bg-muted/50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You'll learn</div>
                  <div className="mt-1 text-lg font-bold">{targetSkill}</div>
                </div>
              )}
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6">
              <header className="space-y-1">
                <p className="text-sm font-semibold text-primary">Step 7 of {TOTAL_STEPS}</p>
                <h1 className="text-3xl font-bold">What habits feed your pet?</h1>
                <p className="text-muted-foreground">Pick a few — we'll suggest more based on your profile.</p>
              </header>
              <div className="flex flex-wrap gap-2">
                {HABIT_PRESETS.map((h) => {
                  const active = habits.includes(h);
                  return (
                    <button key={h} onClick={() => toggleFromList(habits, setHabits, h)}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/50"}`}>
                      {active ? "✓ " : "+ "}{h}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); const v = customHabit.trim(); if (v && !habits.includes(v)) setHabits([...habits, v]); setCustomHabit(""); }} className="flex gap-2">
                <input value={customHabit} onChange={(e) => setCustomHabit(e.target.value)} placeholder="Add your own habit" maxLength={100}
                  className="flex-1 rounded-full border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring" />
                <button type="submit" disabled={!customHabit.trim()} className="inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
                  <Plus size={16} /> Add
                </button>
              </form>

              {habits.length > 0 && (
                <div className="rounded-2xl bg-muted/50 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your starter habits ({habits.length})</div>
                  <ul className="flex flex-wrap gap-2">
                    {habits.map((h) => (
                      <li key={h} className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm font-medium">
                        {h}
                        <button onClick={() => toggleFromList(habits, setHabits, h)} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${h}`}>
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6 text-center">
              <p className="text-sm font-semibold text-primary">Step 8 of {TOTAL_STEPS}</p>
              <h1 className="text-3xl font-bold">You're all set!</h1>
              <div className="flex justify-center py-4">{petType && <img src={getPet(petType).image} alt={getPet(petType).label} width={180} height={180} className="h-40 w-40 object-contain" />}</div>
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{petName}</span> is ready to grow with you.
                We'll tailor habits, meals, and lessons to your goals.
              </p>
              <button onClick={finish} disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-50">
                {busy ? "Hatching…" : "Start my journey"} <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Nav */}
          {step < TOTAL_STEPS && (
            <div className="mt-8 flex items-center justify-between">
              <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition hover:-translate-y-0.5 disabled:opacity-50">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
