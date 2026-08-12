import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeToProModal } from "@/components/UpgradeToProModal";
import { trackSubEvent } from "@/lib/sub-analytics";
import { localDateString } from "@/lib/entitlements";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Camera,
  Image as ImageIcon,
  RotateCw,
  X,
  Zap,
  ZapOff,
  Sparkles,
  Check,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  Pencil,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  analyzeMeal,
  logMeal,
  uploadMealPhoto,
  logAiCorrection,
  CLASSIFICATION_LABEL,
  type MealAnalysisDTO,
} from "@/lib/food.functions";

const CLASSIFICATION_STYLE: Record<string, { chip: string; dot: string; blurb: string }> = {
  healthy_balanced: {
    chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    blurb: "Counts toward your balanced meals today.",
  },
  moderate: {
    chip: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    blurb: "Logged and tracked — a mixed choice, nothing wrong with it.",
  },
  occasional_choice: {
    chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    blurb: "Logged and tracked. Best kept as an occasional choice.",
  },
};

function FoodAssessment({ analysis }: { analysis: MealAnalysisDTO }) {
  const cls = analysis.classification;
  const style = CLASSIFICATION_STYLE[cls] ?? CLASSIFICATION_STYLE["moderate"]!;
  const isBalanced = cls === "healthy_balanced";

  return (
    <div className="rounded-[2rem] bg-card p-6 shadow-pet">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Food Assessment
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${style.chip}`}>
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          {CLASSIFICATION_LABEL[cls]}
        </span>
        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          Logged: Yes
        </span>
        <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          Healthy meal: {isBalanced ? "Yes" : "No"}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {analysis.classification_reason || style.blurb}
      </p>

      {(analysis.benefits.length > 0 || analysis.considerations.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {analysis.benefits.length > 0 && (
            <div className="rounded-2xl bg-emerald-500/8 p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Advantages
              </div>
              <ul className="space-y-1.5 text-sm">
                {analysis.benefits.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-600">+</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {analysis.considerations.length > 0 && (
            <div className="rounded-2xl bg-amber-500/8 p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Considerations
              </div>
              <ul className="space-y-1.5 text-sm">
                {analysis.considerations.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {analysis.ingredients.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Ingredients detected
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.ingredients.map((ing, i) => (
              <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {ing}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Every meal you log is a win — your pet is rewarded for tracking, never for what you chose to eat.
      </p>
    </div>
  );
}

import { prepareImage, MAX_UPLOAD_BYTES } from "@/lib/image";

export const Route = createFileRoute("/_authenticated/food-scanner")({
  head: () => ({
    meta: [
      { title: "AI Food Scanner — HabitPet" },
      {
        name: "description",
        content:
          "Scan any meal, drink, or packaged food. Instant AI nutrition, health score, and personalized recommendations.",
      },
    ],
  }),
  component: FoodScannerPage,
});

type Stage =
  | "permission"
  | "camera"
  | "captured"
  | "meal-type"
  | "analyzing"
  | "not-food"
  | "result";

type CamState = "idle" | "requesting" | "starting" | "ready" | "error";

function cameraErrorMessage(e: any): string {
  const name = e?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access was blocked. Allow camera access in your browser settings, or upload a photo instead.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera was found on this device. You can upload a meal photo instead.";
  if (name === "NotReadableError")
    return "Your camera is already in use by another app. Close it and try again, or upload a photo.";
  if (typeof window !== "undefined" && !window.isSecureContext)
    return "Camera access needs a secure (https) connection. Upload a photo instead.";
  return e?.message || "Camera couldn't start. Try allowing camera access or upload a meal photo instead.";
}

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast", emoji: "🥐" },
  { id: "lunch", label: "Lunch", emoji: "🥗" },
  { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "snack", label: "Snack", emoji: "🍎" },
  { id: "pre_workout", label: "Pre-Workout", emoji: "💪" },
  { id: "post_workout", label: "Post-Workout", emoji: "🏋️" },
  { id: "late_night", label: "Late Night", emoji: "🌙" },
] as const;
type MealTypeId = (typeof MEAL_TYPES)[number]["id"];

const LOADING_LINES = [
  "Detecting food…",
  "Identifying ingredients…",
  "Estimating portions…",
  "Calculating macros…",
  "Reading micronutrients…",
  "Personalizing insights…",
];

function FoodScannerPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("camera");
  const [camState, setCamState] = useState<CamState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torch, setTorch] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealTypeId>("lunch");
  const [analysis, setAnalysis] = useState<MealAnalysisDTO | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(0);

  const fnAnalyze = useServerFn(analyzeMeal);
  const sub = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const fnUpload = useServerFn(uploadMealPhoto);
  const fnLog = useServerFn(logMeal);
  const fnCorrect = useServerFn(logAiCorrection);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setTorch(false);
  }, []);

  const startStream = useCallback(
    async (mode: "environment" | "user") => {
      // Stop anything running so we never hold two streams at once.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setPermissionError(null);
      setCamState("requesting");
      setStage("camera"); // mount the <video> element before the stream arrives

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setPermissionError("This browser doesn't support camera access. Upload a photo instead.");
        setCamState("error");
        setStage("permission");
        return;
      }

      try {
        let media: MediaStream;
        try {
          media = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
        } catch (inner: any) {
          // The requested facing mode may not exist (most desktops) — fall back.
          if (inner?.name === "NotAllowedError" || inner?.name === "SecurityError") throw inner;
          media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        streamRef.current = media;
        setCamState("starting");
        setStream(media);
      } catch (e: any) {
        setPermissionError(cameraErrorMessage(e));
        setCamState("error");
        setStage("permission");
      }
    },
    [],
  );

  // Attach the stream once BOTH the stream and the <video> element exist.
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video || stage !== "camera") return;
    let cancelled = false;

    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;

    const onReady = async () => {
      if (cancelled) return;
      try {
        await video.play();
      } catch {
        /* autoplay can reject on some browsers; readiness below still applies */
      }
      if (!cancelled && video.videoWidth > 0) setCamState("ready");
    };

    if (video.readyState >= 1) void onReady();
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("canplay", onReady);

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
    };
  }, [stream, stage]);

  // Auto-start the camera as soon as the scanner opens — no manual refresh.
  useEffect(() => {
    void startStream("environment");
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage !== "analyzing") return;
    const t = setInterval(() => setLoadingIdx((i) => (i + 1) % LOADING_LINES.length), 1200);
    return () => clearInterval(t);
  }, [stage]);

  async function toggleTorch(next: boolean) {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      // @ts-expect-error torch not in standard TS lib
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorch(next);
    } catch {
      toast.error("Flash not supported on this device");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || camState !== "ready" || video.readyState < 2 || !video.videoWidth) return;
    try {
      const url = await prepareImage(video);
      setPhoto(url);
      stopStream();
      setStage("captured");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't capture that frame");
    }
  }

  async function onGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error("Image must be under 15 MB");
      return;
    }
    try {
      const url = await prepareImage(f);
      setPhoto(url);
      stopStream();
      setStage("captured");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that image");
    }
  }

  function retake() {
    setPhoto(null);
    setAnalysis(null);
    setRejectReason(null);
    startStream(facing);
  }

  function openGallery() {
    galleryRef.current?.click();
  }

  const runAnalysis = useMutation({
    mutationFn: async () => {
      if (!photo) throw new Error("Missing photo");
      if (!sub.can("food_scan").allowed) {
        trackSubEvent("feature_limit_reached", { feature: "food_scan" });
        throw new Error("__scan_limit__");
      }
      return fnAnalyze({
        data: { image_data_url: photo, text: null, local_date: localDateString() },
      });
    },
    onMutate: () => setStage("analyzing"),
    onSuccess: (r) => {
      sub.refresh();
      if (!r.is_food) {
        setRejectReason(r.reject_reason || "This image doesn't appear to contain edible food.");
        setAnalysis(null);
        setStage("not-food");
        return;
      }
      setAnalysis(r);
      setStage("result");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setStage("captured");
      if (msg === "__scan_limit__" || /free scans/i.test(msg)) {
        sub.refresh();
        setShowUpgrade(true);
        return;
      }
      toast.error(msg);
    },
  });

  const saveMeal = useMutation({
    mutationFn: async (edited: MealAnalysisDTO) => {
      if (!photo) throw new Error("Missing photo");
      const up = await fnUpload({ data: { data_url: photo } });
      return fnLog({
        data: {
          meal_type: mealType,
          items: edited.items,
          notes: edited.verdict || null,
          photo_url: up.path,
          food_name: edited.food_name ?? edited.items[0]?.name ?? null,
          total_calories: edited.total_calories,
          protein_g: edited.protein_g,
          carbs_g: edited.carbs_g,
          fat_g: edited.fat_g,
          fiber_g: edited.fiber_g,
          sugar_g: edited.extra?.sugar_g ?? 0,
          sodium_mg: edited.extra?.sodium_mg ?? 0,
          water_ml: edited.extra?.water_ml ?? 0,
          ai_analyzed: true,
          health_score: Math.round(edited.health_score),
          confidence: Math.round(edited.confidence),
          nutrition_extra: {
            ...(edited.extra as any),
            nutrition_score: Math.round(edited.nutrition_score ?? 0),
            meal_category: edited.meal_category ?? null,
            serving_size: edited.serving_size ?? null,
            weight_g: Math.round(edited.weight_g ?? 0),
          } as any,
          sub_scores: edited.sub_scores as any,
          recommendations: edited.recommendations,

        },
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["meals"] });
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      qc.invalidateQueries({ queryKey: ["pet-status"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["daily-goals"] });
      qc.invalidateQueries({ queryKey: ["daily-report"] });
      qc.invalidateQueries({ queryKey: ["nutrition-trends"] });

      const msg =
        r.pet_reaction === "happy"
          ? `Great choice! +${r.xp_gained} XP · +${r.coins_gained} coins · Pet is happier 🐣`
          : r.pet_reaction === "tired"
            ? `Logged. +${r.xp_gained} XP. Your pet looks a little tired — try a healthier option next time.`
            : `Logged. +${r.xp_gained} XP · +${r.coins_gained} coins.`;
      toast.success(msg);
      navigate({ to: "/nutrition" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <AppShell title="AI Food Scanner">
      <div className="mx-auto max-w-2xl">
        {stage === "permission" && (
          <PermissionCard
            error={permissionError}
            onGrant={() => startStream(facing)}
            onGallery={openGallery}
          />
        )}

        {(stage === "camera" || stage === "captured") && (
          <CameraStage
            stage={stage}
            camState={camState}
            videoRef={videoRef}
            photo={photo}
            torch={torch}
            onClose={() => {
              stopStream();
              navigate({ to: "/food" });
            }}
            onToggleTorch={toggleTorch}
            onGallery={openGallery}
            onCapture={capture}
            onFlip={() => {
              const next = facing === "environment" ? "user" : "environment";
              setFacing(next);
              startStream(next);
            }}
            onRetake={retake}
            onUse={() => setStage("meal-type")}
          />
        )}

        {stage === "meal-type" && (
          <MealTypePicker
            photo={photo}
            mealType={mealType}
            onBack={() => setStage("captured")}
            onSelect={setMealType}
            onAnalyze={() => {
              if (!runAnalysis.isPending) runAnalysis.mutate();
            }}
          />
        )}

        {stage === "analyzing" && <AnalyzingView photo={photo} line={LOADING_LINES[loadingIdx]} />}

        {stage === "not-food" && (
          <NotFoodView
            reason={rejectReason}
            onRetake={retake}
            onOpenCamera={() => startStream(facing)}
            onUpload={openGallery}
          />
        )}

        {stage === "result" && analysis && photo && (
          <ResultView
            photo={photo}
            initial={analysis}
            mealType={mealType}
            onMealTypeChange={setMealType}
            onSave={(edited) => {
              if (!saveMeal.isPending) saveMeal.mutate(edited);
            }}
            saving={saveMeal.isPending}
            onRetake={retake}
            onCorrection={(original, corrected) =>
              fnCorrect({ data: { original_name: original, corrected_name: corrected } }).catch(() => {})
            }
          />
        )}

        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={onGallery}
          className="hidden"
        />
      </div>
          <UpgradeToProModal
        open={showUpgrade}
        source="food_scan_limit"
        onClose={() => setShowUpgrade(false)}
        detail="You're out of today's food scans — you've used all 3 free scans. Upgrade to Pro for unlimited food scanning."
      />
</AppShell>
  );
}

/* ---------- Permission ---------- */
function PermissionCard({
  error,
  onGrant,
  onGallery,
}: {
  error: string | null;
  onGrant: () => void;
  onGallery: () => void;
}) {
  return (
    <div className="rounded-[2rem] bg-card p-8 text-center shadow-pet">
      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
        <Camera size={36} />
      </div>
      <h2 className="mb-2 text-2xl font-bold">Scan any meal, drink, or snack</h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        {error
          ? "Camera access is needed to scan your meal. You can also upload a photo instead."
          : "Point at your food — the AI recognizes multiple items, packaged foods, and drinks, then gives calories, macros, micros, and a personalized health score."}
      </p>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <button
          onClick={onGrant}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg"
        >
          <Camera size={16} /> {error ? "Allow Camera" : "Open Camera"}
        </button>
        <button
          onClick={onGallery}
          className="inline-flex items-center gap-2 rounded-full border-2 border-input bg-background px-6 py-3 font-semibold hover:bg-muted"
        >
          <ImageIcon size={16} /> Upload Photo Instead
        </button>
      </div>
      {error && <p className="mt-4 text-xs text-muted-foreground">{error}</p>}
      <Link
        to="/meal-history"
        className="mt-6 inline-block text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
      >
        View meal history →
      </Link>
    </div>
  );
}

/* ---------- Camera ---------- */
function CameraStage({
  stage,
  camState,
  videoRef,
  photo,
  torch,
  onClose,
  onToggleTorch,
  onGallery,
  onCapture,
  onFlip,
  onRetake,
  onUse,
}: {
  stage: "camera" | "captured";
  camState: CamState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  photo: string | null;
  torch: boolean;
  onClose: () => void;
  onToggleTorch: (next: boolean) => void;
  onGallery: () => void;
  onCapture: () => void;
  onFlip: () => void;
  onRetake: () => void;
  onUse: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-black shadow-pet">
      <div className="relative aspect-[3/4] w-full">
        {stage === "camera" ? (
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        ) : photo ? (
          <img src={photo} alt="Captured meal" className="h-full w-full object-cover" />
        ) : null}

        {stage === "camera" && camState === "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-3/4 w-4/5 rounded-3xl border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>
        )}

        {stage === "camera" && camState !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm font-semibold">
              {camState === "requesting" ? "Waiting for camera permission…" : "Starting camera…"}
            </p>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          {stage === "camera" && (
            <button
              onClick={() => onToggleTorch(!torch)}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
              aria-label="Flash"
            >
              {torch ? <Zap size={18} /> : <ZapOff size={18} />}
            </button>
          )}
        </div>

        {stage === "camera" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-around p-6">
            <button
              onClick={onGallery}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur"
              aria-label="Gallery"
            >
              <ImageIcon size={20} />
            </button>
            <button
              onClick={onCapture}
              disabled={camState !== "ready"}
              className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-2xl transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
              aria-label="Capture"
            >
              <div className="h-16 w-16 rounded-full border-4 border-black/80" />
            </button>
            <button
              onClick={onFlip}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur"
              aria-label="Switch camera"
            >
              <RotateCw size={20} />
            </button>
          </div>
        )}

        {stage === "captured" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-6">
            <button
              onClick={onRetake}
              className="inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-3 text-sm font-semibold text-black backdrop-blur"
            >
              <RefreshCw size={16} /> Retake
            </button>
            <button
              onClick={onUse}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
            >
              <Check size={16} /> Use Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Meal Type Picker ---------- */
function MealTypePicker({
  photo,
  mealType,
  onBack,
  onSelect,
  onAnalyze,
}: {
  photo: string | null;
  mealType: MealTypeId;
  onBack: () => void;
  onSelect: (t: MealTypeId) => void;
  onAnalyze: () => void;
}) {
  return (
    <div className="rounded-[2rem] bg-card p-6 shadow-pet">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back
      </button>
      {photo && (
        <img
          src={photo}
          alt="Meal"
          className="mb-4 aspect-video w-full rounded-2xl object-cover"
        />
      )}
      <h2 className="mb-1 text-xl font-bold">Which meal is this?</h2>
      <p className="mb-5 text-sm text-muted-foreground">Choose one — you can change it later.</p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MEAL_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-sm font-semibold transition ${
              mealType === t.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted hover:bg-muted/70"
            }`}
          >
            <span className="text-3xl">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onAnalyze}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg"
      >
        <Sparkles size={18} /> Analyze with AI
      </button>
    </div>
  );
}

/* ---------- Analyzing ---------- */
function AnalyzingView({ photo, line }: { photo: string | null; line: string }) {
  return (
    <div className="rounded-[2rem] bg-card p-10 text-center shadow-pet">
      {photo && (
        <div className="relative mx-auto mb-6 h-48 w-48 overflow-hidden rounded-3xl">
          <img src={photo} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 h-1 animate-[scanline_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>
      )}
      <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
        <Sparkles size={16} className="animate-pulse" /> AI Vision
      </div>
      <div className="text-lg font-bold transition-all">{line}</div>
      <p className="mt-2 text-sm text-muted-foreground">Please wait a moment…</p>
      <style>{`@keyframes scanline{0%{top:0}50%{top:100%}100%{top:0}}`}</style>
    </div>
  );
}

/* ---------- Not Food ---------- */
function NotFoodView({
  reason,
  onRetake,
  onOpenCamera,
  onUpload,
}: {
  reason: string | null;
  onRetake: () => void;
  onOpenCamera: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="rounded-[2rem] bg-card p-8 text-center shadow-pet">
      <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle size={36} />
      </div>
      <h2 className="mb-2 text-2xl font-bold">❌ Not a Food Item Detected</h2>
      <p className="mx-auto mb-6 max-w-md text-sm text-muted-foreground">
        {reason ||
          "This image doesn't appear to contain edible food. Please upload or capture a clear photo of a meal or food item."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          onClick={onRetake}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg"
        >
          <RefreshCw size={16} /> Take Another Photo
        </button>
        <button
          onClick={onOpenCamera}
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-input bg-background px-6 py-3 text-sm font-semibold hover:bg-muted"
        >
          <Camera size={16} /> Open Camera Again
        </button>
        <button
          onClick={onUpload}
          className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-input bg-background px-6 py-3 text-sm font-semibold hover:bg-muted"
        >
          <ImageIcon size={16} /> Upload Different Image
        </button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        The system never estimates nutrition for non-food images.
      </p>
    </div>
  );
}

/* ---------- Result ---------- */
function ResultView({
  photo,
  initial,
  mealType,
  onMealTypeChange,
  onSave,
  saving,
  onRetake,
  onCorrection,
}: {
  photo: string;
  initial: MealAnalysisDTO;
  mealType: MealTypeId;
  onMealTypeChange: (t: MealTypeId) => void;
  onSave: (edited: MealAnalysisDTO) => void;
  saving: boolean;
  onRetake: () => void;
  onCorrection: (original: string, corrected: string) => void;
}) {
  const [edited, setEdited] = useState<MealAnalysisDTO>(initial);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initial.food_name ?? initial.items[0]?.name ?? "");

  function recalcTotals(items: MealAnalysisDTO["items"]) {
    return items.reduce(
      (acc, it) => ({
        total_calories: acc.total_calories + (it.calories || 0),
        protein_g: acc.protein_g + (it.protein_g || 0),
        carbs_g: acc.carbs_g + (it.carbs_g || 0),
        fat_g: acc.fat_g + (it.fat_g || 0),
        fiber_g: acc.fiber_g + (it.fiber_g || 0),
      }),
      { total_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    );
  }

  function updateItem(idx: number, patch: Partial<MealAnalysisDTO["items"][number]>) {
    const items = edited.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setEdited({ ...edited, items, ...recalcTotals(items) });
  }
  function removeItem(idx: number) {
    const items = edited.items.filter((_, i) => i !== idx);
    setEdited({ ...edited, items, ...recalcTotals(items) });
  }
  function addItem() {
    const items = [
      ...edited.items,
      { name: "New item", grams: 100, calories: 100, protein_g: 5, carbs_g: 15, fat_g: 3, fiber_g: 1 },
    ];
    setEdited({ ...edited, items, ...recalcTotals(items) });
  }
  function scalePortion(idx: number, factor: number) {
    const it = edited.items[idx];
    updateItem(idx, {
      grams: it.grams ? Math.round(it.grams * factor) : null,
      calories: Math.round(it.calories * factor),
      protein_g: +(it.protein_g * factor).toFixed(1),
      carbs_g: +(it.carbs_g * factor).toFixed(1),
      fat_g: +(it.fat_g * factor).toFixed(1),
      fiber_g: +(it.fiber_g * factor).toFixed(1),
    });
  }

  const score = Math.round(edited.health_score);
  const confidence = Math.round(edited.confidence);
  const label =
    score >= 85
      ? "Excellent"
      : score >= 70
        ? "Very Good"
        : score >= 50
          ? "Average"
          : score >= 30
            ? "Poor"
            : "Very Poor";
  const scoreColor =
    score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-red-600";
  const ring =
    score >= 70 ? "stroke-emerald-500" : score >= 40 ? "stroke-amber-500" : "stroke-red-500";

  const subScoreEntries: [string, number][] = [
    ["Protein", edited.sub_scores.protein],
    ["Fiber", edited.sub_scores.fiber],
    ["Vitamins", edited.sub_scores.vitamin],
    ["Healthy Fat", edited.sub_scores.healthy_fat],
    ["Whole Food", edited.sub_scores.processed],
    ["Low Sugar", edited.sub_scores.sugar],
    ["Low Salt", edited.sub_scores.salt],
  ];

  const macros = [
    { label: "Protein", value: edited.protein_g, unit: "g", color: "bg-primary" },
    { label: "Carbs", value: edited.carbs_g, unit: "g", color: "bg-amber-500" },
    { label: "Fat", value: edited.fat_g, unit: "g", color: "bg-pink-500" },
    { label: "Fiber", value: edited.fiber_g, unit: "g", color: "bg-emerald-500" },
  ];

  const primary = edited.food_name ?? edited.items[0]?.name ?? "Your meal";

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="overflow-hidden rounded-[2rem] bg-card shadow-pet">
        <img src={photo} alt="Meal" className="aspect-video w-full object-cover" />
        <div className="p-6">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {MEAL_TYPES.find((m) => m.id === mealType)?.emoji}{" "}
              {MEAL_TYPES.find((m) => m.id === mealType)?.label}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                confidence >= 80
                  ? "bg-emerald-500/10 text-emerald-700"
                  : confidence >= 60
                    ? "bg-amber-500/10 text-amber-700"
                    : "bg-red-500/10 text-red-700"
              }`}
            >
              AI Confidence {confidence}%
            </span>
          </div>

          {editingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const original = edited.food_name ?? edited.items[0]?.name ?? "";
                const trimmed = nameDraft.trim();
                if (trimmed && trimmed !== original) onCorrection(original, trimmed);
                setEdited({ ...edited, food_name: trimmed || primary });
                setEditingName(false);
              }}
              className="mb-3 flex gap-2"
            >
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 rounded-lg border-2 border-input bg-background px-3 py-2 text-lg font-bold outline-none focus:border-ring"
              />
              <button className="rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                Save
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setNameDraft(primary);
                setEditingName(true);
              }}
              className="mb-3 inline-flex items-center gap-2 text-left text-2xl font-bold hover:text-primary"
            >
              {primary}
              <Pencil size={14} className="text-muted-foreground" />
            </button>
          )}

          {confidence < 60 && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                Low confidence — please tap the name above to correct it, or edit portions below.
              </span>
            </div>
          )}

          {(edited.serving_size || edited.weight_g || edited.meal_category) && (
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold">
              {edited.meal_category && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  {edited.meal_category}
                </span>
              )}
              {edited.serving_size && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  Serving: {edited.serving_size}
                </span>
              )}
              {edited.weight_g > 0 && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                  ~{Math.round(edited.weight_g)} g
                </span>
              )}
            </div>
          )}

          <div className="mb-4 flex items-center gap-5">
            <ScoreRing score={score} ringClass={ring} textClass={scoreColor} />
            <div>
              <div className={`text-lg font-bold ${scoreColor}`}>{label}</div>
              {edited.nutrition_score > 0 && (
                <div className="text-xs font-semibold text-muted-foreground">
                  Nutrition score {Math.round(edited.nutrition_score)}/100
                </div>
              )}
              {edited.verdict && (
                <p className="mt-1 text-sm text-muted-foreground">{edited.verdict}</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--gradient-meadow)] p-4 text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estimated Calories
            </div>
            <div className="text-4xl font-bold">{Math.round(edited.total_calories)}</div>
            <div className="text-sm text-muted-foreground">kcal</div>
          </div>

        </div>
      </div>

      {/* Food Assessment */}
      <FoodAssessment analysis={edited} />



      {/* Meal type quick switch */}
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Meal type
        </div>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => onMealTypeChange(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                mealType === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70"
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {macros.map((m) => (
          <div key={m.label} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {m.label}
            </div>
            <div className="mt-1 text-2xl font-bold">
              {Math.round(m.value)}
              <span className="text-sm text-muted-foreground">{m.unit}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${m.color}`}
                style={{ width: `${Math.min(100, m.value * 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sub-scores */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quality Breakdown
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {subScoreEntries.map(([k, v]) => (
            <SubScore key={k} label={k} value={Math.round(v ?? 0)} />
          ))}
        </div>
      </div>

      {/* Extended nutrition */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Full Nutrition
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <NutRow label="Sugar" value={edited.extra.sugar_g} unit="g" />
          <NutRow label="Sodium" value={edited.extra.sodium_mg} unit="mg" />
          <NutRow label="Potassium" value={edited.extra.potassium_mg} unit="mg" />
          <NutRow label="Calcium" value={edited.extra.calcium_mg} unit="mg" />
          <NutRow label="Iron" value={edited.extra.iron_mg} unit="mg" />
          <NutRow label="Magnesium" value={edited.extra.magnesium_mg} unit="mg" />
          <NutRow label="Zinc" value={edited.extra.zinc_mg} unit="mg" />
          <NutRow label="Cholesterol" value={edited.extra.cholesterol_mg} unit="mg" />
          <NutRow label="Saturated Fat" value={edited.extra.saturated_fat_g} unit="g" />
          <NutRow label="Unsaturated Fat" value={edited.extra.unsaturated_fat_g} unit="g" />
          <NutRow label="Omega-3" value={edited.extra.omega3_g} unit="g" />
          <NutRow label="Omega-6" value={edited.extra.omega6_g} unit="g" />
          <NutRow label="Water" value={edited.extra.water_ml} unit="ml" />
          <NutRow label="Water %" value={edited.extra.water_pct} unit="%" />

          <NutRow label="Vit A" value={edited.extra.vit_a_iu} unit="IU" />
          <NutRow label="Vit B" value={edited.extra.vit_b_mg} unit="mg" />
          <NutRow label="Vit C" value={edited.extra.vit_c_mg} unit="mg" />
          <NutRow label="Vit D" value={edited.extra.vit_d_iu} unit="IU" />
          <NutRow label="Vit E" value={edited.extra.vit_e_mg} unit="mg" />
          <NutRow label="Vit K" value={edited.extra.vit_k_mcg} unit="mcg" />
          <NutRow label="Glycemic Index" value={edited.extra.glycemic_index} unit="" />
          <NutRow label="Glycemic Load" value={edited.extra.glycemic_load} unit="" />
        </div>
      </div>

      {/* Ingredients (editable) */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ingredients ({edited.items.length})
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold hover:bg-muted/70"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        <ul className="space-y-3">
          {edited.items.map((it, i) => (
            <li key={i} className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <input
                  value={it.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold outline-none hover:bg-background focus:bg-background"
                />
                <span className="text-sm font-bold">{Math.round(it.calories)} kcal</span>
                <button
                  onClick={() => removeItem(i)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Portion:{" "}
                  <input
                    type="number"
                    min={0}
                    value={it.grams ?? 0}
                    onChange={(e) => {
                      const g = Number(e.target.value) || 0;
                      const factor = it.grams ? g / it.grams : 1;
                      if (it.grams && g > 0) scalePortion(i, factor);
                      else updateItem(i, { grams: g });
                    }}
                    className="w-16 rounded bg-background px-1.5 py-0.5 text-foreground"
                  />
                  g
                </span>
                <button
                  onClick={() => scalePortion(i, 0.5)}
                  className="rounded-full bg-background px-2 py-0.5 hover:bg-muted"
                >
                  ½×
                </button>
                <button
                  onClick={() => scalePortion(i, 2)}
                  className="rounded-full bg-background px-2 py-0.5 hover:bg-muted"
                >
                  2×
                </button>
                <span>P {Math.round(it.protein_g)}g</span>
                <span>C {Math.round(it.carbs_g)}g</span>
                <span>F {Math.round(it.fat_g)}g</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendations */}
      {edited.recommendations?.length > 0 && (
        <div className="rounded-2xl bg-[var(--gradient-meadow)] p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
            <Sparkles size={14} /> Personalized Recommendations
          </div>
          <ul className="space-y-2 text-sm">
            {edited.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          All nutrition values are AI-generated estimates and may not exactly match laboratory
          measurements. Edit foods or portions above for greater accuracy.
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onRetake}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-input bg-background px-6 py-3 font-semibold hover:bg-muted"
        >
          <RefreshCw size={16} /> Rescan
        </button>
        <button
          onClick={() => onSave(edited)}
          disabled={saving}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg disabled:opacity-60"
        >
          <Check size={16} /> {saving ? "Saving…" : "Save Meal"}
        </button>
      </div>
    </div>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function NutRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">
        {value != null ? Number(value).toFixed(unit === "g" ? 1 : 0) : "—"}
        {unit && <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}

function ScoreRing({
  score,
  ringClass,
  textClass,
}: {
  score: number;
  ringClass: string;
  textClass: string;
}) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} strokeWidth="7" className="fill-none stroke-muted" />
        <circle
          cx="40"
          cy="40"
          r={r}
          strokeWidth="7"
          strokeLinecap="round"
          className={`fill-none ${ringClass} transition-all duration-700`}
          style={{ strokeDasharray: c, strokeDashoffset: offset }}
        />
      </svg>
      <div className={`absolute inset-0 grid place-items-center text-lg font-bold ${textClass}`}>
        {score}
      </div>
    </div>
  );
}
