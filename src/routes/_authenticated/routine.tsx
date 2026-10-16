import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion } from "motion/react";
import {
  Sparkles, Send, Moon, Droplets, Dumbbell, Utensils, Briefcase,
  Heart, Target, Coffee, BookOpen, Loader2, Wand2, Map, Mic, MicOff,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getRoutine, generateRoutine, getRoutineMessages, sendRoutineMessage,
  type RoutineBlock, type RoutineInputs,
} from "@/lib/routine.functions";

export const Route = createFileRoute("/_authenticated/routine")({
  head: () => ({
    meta: [
      { title: "My Routine — HabitPet" },
      { name: "description", content: "Build an AI daily routine around your work, your passion and your life objective — with 8h sleep, 3L water and daily movement." },
      { property: "og:title", content: "My Routine — HabitPet" },
      { property: "og:description", content: "An AI coach that understands how you feel and designs a day that moves you toward your real goal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoutinePage,
});

const CATEGORY_META: Record<RoutineBlock["category"], { icon: typeof Moon; tint: string }> = {
  sleep: { icon: Moon, tint: "bg-indigo-500/12 text-indigo-500" },
  water: { icon: Droplets, tint: "bg-sky-500/12 text-sky-500" },
  exercise: { icon: Dumbbell, tint: "bg-emerald-500/12 text-emerald-500" },
  meal: { icon: Utensils, tint: "bg-orange-500/12 text-orange-500" },
  work: { icon: Briefcase, tint: "bg-slate-500/12 text-slate-500" },
  passion: { icon: Heart, tint: "bg-pink-500/12 text-pink-500" },
  objective: { icon: Target, tint: "bg-primary/15 text-primary" },
  rest: { icon: Coffee, tint: "bg-amber-500/12 text-amber-600" },
  learning: { icon: BookOpen, tint: "bg-violet-500/12 text-violet-500" },
};

const EMPTY: RoutineInputs = {
  profession: "", work_hours: "", wake_time: "", sleep_time: "",
  current_routine: "", life_objective: "", passion: "", feeling: "", blockers: "",
};

function RoutinePage() {
  const qc = useQueryClient();
  const fetchRoutine = useServerFn(getRoutine);
  const fnGenerate = useServerFn(generateRoutine);

  const routine = useQuery({ queryKey: ["routine"], queryFn: () => fetchRoutine() });
  const [form, setForm] = useState<RoutineInputs>(EMPTY);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (routine.data?.inputs) setForm({ ...EMPTY, ...routine.data.inputs });
  }, [routine.data?.inputs]);

  const generate = useMutation({
    mutationFn: () => fnGenerate({ data: form }),
    onSuccess: (data) => {
      qc.setQueryData(["routine"], data);
      setEditing(false);
      toast.success("Your new day is ready");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't build the routine"),
  });

  const has = (routine.data?.blocks.length ?? 0) > 0;
  const showForm = editing || (!has && !routine.isLoading);
  const set = (k: keyof RoutineInputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AppShell title="My Routine">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {showForm ? (
            <section className="rounded-[2rem] bg-card p-6 shadow-pet">
              <header className="mb-5 space-y-1">
                <h2 className="text-2xl font-extrabold">Tell the coach about your day</h2>
                <p className="text-sm text-muted-foreground">
                  Be honest — how you feel matters as much as your schedule. Every plan protects 8 hours of sleep,
                  3 litres of water and time to move.
                </p>
              </header>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your work / study" value={form.profession} onChange={set("profession")} placeholder="e.g. 9–5 sales job" />
                <Field label="Work hours" value={form.work_hours} onChange={set("work_hours")} placeholder="e.g. 9:30 to 18:30, Mon–Fri" />
                <Field label="You usually wake at" value={form.wake_time} onChange={set("wake_time")} placeholder="e.g. 07:30" />
                <Field label="You usually sleep at" value={form.sleep_time} onChange={set("sleep_time")} placeholder="e.g. 01:00" />
                <Area label="Your day right now" value={form.current_routine} onChange={set("current_routine")} placeholder="Walk me through a normal day…" />
                <Area label="What you want to change in your life" value={form.life_objective} onChange={set("life_objective")} placeholder="e.g. build an online business so I can leave my 9–5" />
                <Area label="Your passion" value={form.passion} onChange={set("passion")} placeholder="The thing you lose track of time doing" />
                <Area label="How you feel lately" value={form.feeling} onChange={set("feeling")} placeholder="Tired, stuck, hopeful…" />
                <Area label="What gets in the way" value={form.blockers} onChange={set("blockers")} placeholder="e.g. no energy after work, phone at night" />
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-primary)] px-6 py-3 font-bold text-primary-foreground shadow-glow disabled:opacity-60"
                >
                  {generate.isPending ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                  {generate.isPending ? "Designing your day…" : "Build my routine"}
                </button>
                {has && (
                  <button onClick={() => setEditing(false)} className="rounded-full border-2 border-border px-5 py-3 font-bold">
                    Cancel
                  </button>
                )}
              </div>
            </section>
          ) : (
            <>
              {routine.data?.encouragement && (
                <section className="rounded-[2rem] bg-[image:var(--gradient-sky)] p-6 shadow-pet">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
                    <Sparkles size={16} /> For you
                  </div>
                  <p className="text-lg font-semibold leading-relaxed">{routine.data.encouragement}</p>
                </section>
              )}

              <section className="rounded-[2rem] bg-card p-6 shadow-pet">
                <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-extrabold">Your day</h2>
                    {routine.data?.summary && <p className="text-sm text-muted-foreground">{routine.data.summary}</p>}
                  </div>
                  <button onClick={() => setEditing(true)} className="rounded-full border-2 border-border px-4 py-2 text-sm font-bold hover:bg-muted">
                    Rebuild
                  </button>
                </header>
                <ol className="space-y-2">
                  {(routine.data?.blocks ?? []).map((b, i) => {
                    const meta = CATEGORY_META[b.category] ?? CATEGORY_META.rest;
                    const Icon = meta.icon;
                    return (
                      <motion.li
                        key={`${b.start}-${i}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex gap-3 rounded-2xl border border-border p-3"
                      >
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.tint}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-extrabold tabular-nums">{b.start}–{b.end}</span>
                            <span className="font-bold">{b.title}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{b.why}</p>
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              </section>

              {(routine.data?.roadmap.length ?? 0) > 0 && (
                <section className="rounded-[2rem] bg-card p-6 shadow-pet">
                  <h2 className="mb-4 flex items-center gap-2 text-2xl font-extrabold">
                    <Map size={20} /> Roadmap to your objective
                  </h2>
                  <div className="space-y-3">
                    {routine.data!.roadmap.map((s, i) => (
                      <div key={i} className="rounded-2xl border border-border p-4">
                        <div className="text-xs font-bold uppercase tracking-wide text-primary">{s.timeframe}</div>
                        <div className="mt-0.5 font-bold">{s.goal}</div>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {s.actions.map((a, j) => (
                            <li key={j}>• {a}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <RoutineChat />
      </div>
    </AppShell>
  );
}

function Field(props: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string }) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-semibold">{props.label}</span>
      <input
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        className="w-full rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring"
      />
    </label>
  );
}

function Area(props: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string }) {
  return (
    <label className="space-y-1.5 sm:col-span-2">
      <span className="text-sm font-semibold">{props.label}</span>
      <textarea
        rows={3}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        className="w-full resize-y rounded-2xl border-2 border-input bg-background px-4 py-2.5 outline-none focus:border-ring"
      />
    </label>
  );
}

function RoutineChat() {
  const qc = useQueryClient();
  const fetchMessages = useServerFn(getRoutineMessages);
  const fnSend = useServerFn(sendRoutineMessage);
  const [input, setInput] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = useQuery({ queryKey: ["routine-messages"], queryFn: () => fetchMessages() });

  const send = useMutation({
    mutationFn: (message: string) => fnSend({ data: { message } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routine-messages"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "The coach couldn't reply"),
    onSettled: () => inputRef.current?.focus(),
  });

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.data, send.isPending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || send.isPending) return;
    setInput("");
    send.mutate(text);
  }

  return (
    <aside className="flex h-[70vh] flex-col rounded-[2rem] bg-card p-5 shadow-pet lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
      <header className="mb-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Sparkles size={18} className="text-primary" /> Talk it out
        </h2>
        <p className="text-xs text-muted-foreground">Say how your day really went. The coach listens first.</p>
      </header>

      <div ref={boxRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {(messages.data ?? []).length === 0 && !send.isPending && (
          <div className="rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Try: “I feel drained after work and I never touch my side project.”
          </div>
        )}
        {(messages.data ?? []).map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                : "max-w-[92%] whitespace-pre-wrap text-sm leading-relaxed"
            }
          >
            {m.content}
          </div>
        ))}
        {send.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Thinking about what you said…
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <VoiceButton onText={(t) => setInput((prev) => (prev ? prev + " " : "") + t)} />
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder="How are you feeling today?"
          className="min-h-[52px] flex-1 resize-none rounded-2xl border-2 border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-ring"
        />
        <button
          type="submit"
          disabled={!input.trim() || send.isPending}
          aria-label="Send"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </aside>
  );
}

/** Speak instead of typing — uses the browser's built-in speech recognition. */
function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => () => recRef.current?.stop?.(), []);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<any>)
        .map((r: any) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onText(text);
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed") toast.error("Please allow microphone access to talk.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop listening" : "Talk to your coach"}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition ${
        listening ? "animate-pulse border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:border-primary"
      }`}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
