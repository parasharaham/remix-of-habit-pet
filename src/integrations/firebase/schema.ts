/**
 * Firestore data model for HabitPet.
 *
 * Mirrors the existing relational model one-for-one so features can be moved
 * across a feature at a time. Collections named "byUid" hold exactly one
 * document per user, with the Firebase Auth uid as the document id. All other
 * collections hold many documents per user and carry a `user_id` field that
 * the security rules check.
 *
 * Dates that were SQL `date` columns stay ISO day strings ("2026-09-16").
 * Timestamps are stored as Firestore Timestamps and read as ISO strings.
 */

export const COLLECTIONS = {
  // one document per user (doc id === uid)
  profiles: "profiles",
  pets: "pets",
  routines: "routines",
  subscriptions: "subscriptions",

  // many documents per user (doc carries user_id)
  habits: "habits",
  habitCompletions: "habit_completions",
  mealLogs: "meal_logs",
  activityLogs: "activity_logs",
  dailyGoals: "daily_goals",
  dailyReports: "daily_reports",
  scanUsage: "scan_usage",
  routineMessages: "routine_messages",
  motivations: "motivations",
  coinTransactions: "coin_transactions",
  userInventory: "user_inventory",
  userAchievements: "user_achievements",
  aiFoodCorrections: "ai_food_corrections",

  // shared
  shopItems: "shop_items",
  achievements: "achievements",
  activityFeed: "activity_feed",
  contactSubmissions: "contact_submissions",
} as const;

export const SINGLE_DOC_COLLECTIONS = [
  COLLECTIONS.profiles,
  COLLECTIONS.pets,
  COLLECTIONS.routines,
  COLLECTIONS.subscriptions,
] as const;

export const STORAGE_PATHS = {
  /** meal-photos/{uid}/{fileName} */
  mealPhoto: (uid: string, fileName: string) => `meal-photos/${uid}/${fileName}`,
} as const;

export type ISODate = string; // "YYYY-MM-DD"
export type ISODateTime = string;

export interface ProfileDoc {
  username: string | null;
  avatar_url: string | null;
  coins: number;
  total_coins_earned: number;
  total_xp_earned: number;
  total_habits_completed: number;
  is_premium: boolean;
  is_admin: boolean;
  full_name: string | null;
  age: number | null;
  sex: string | null;
  profession: string | null;
  grade: string | null;
  mother_tongue: string | null;
  preferred_language: string;
  health_conditions: string[];
  allergies: string[];
  food_preferences: string[];
  lifestyle: string | null;
  sleep_hours: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: string | null;
  fitness_goal: string | null;
  target_skill: string | null;
  life_objective: string | null;
  passion: string | null;
  daily_calorie_target: number | null;
  profile_completed: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type PetStage = "egg" | "baby" | "child" | "adult";

export interface PetDoc {
  pet_name: string;
  pet_type: string;
  pet_stage: PetStage;
  health_points: number;
  happiness_points: number;
  energy_points: number;
  total_experience_points: number;
  current_level: number;
  onboarded: boolean;
  last_decay_checked_at: ISODateTime;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type HabitFrequency = "daily" | "weekly";

export interface HabitDoc {
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  difficulty: string;
  frequency: HabitFrequency;
  current_streak: number;
  longest_streak: number;
  last_completed_at: ISODateTime | null;
  is_active: boolean;
  is_paused: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface HabitCompletionDoc {
  user_id: string;
  habit_id: string;
  completion_date: ISODate;
  created_at: ISODateTime;
}

export interface MealLogDoc {
  user_id: string;
  meal_type: string;
  meal_date: ISODate;
  items: unknown[];
  notes: string | null;
  photo_url: string | null;
  food_name: string | null;
  total_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  water_ml: number | null;
  nutrition_extra: Record<string, unknown>;
  sub_scores: Record<string, unknown>;
  health_score: number | null;
  confidence: number | null;
  recommendations: unknown[];
  classification: string;
  classification_reason: string | null;
  benefits: unknown[];
  considerations: unknown[];
  ingredients: unknown[];
  portion_grams: number | null;
  user_adjusted: boolean;
  ai_analyzed: boolean;
  analysis_id: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ActivityLogDoc {
  user_id: string;
  activity_date: ISODate;
  activity_type: string;
  duration_min: number;
  distance_km: number | null;
  calories_burned: number | null;
  steps: number | null;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface DailyGoalDoc {
  user_id: string;
  goal_date: ISODate;
  calories: number;
  protein_g: number;
  water_ml: number;
  steps: number;
  sleep_hours: number;
  veg_servings: number;
  fruit_servings: number;
  healthy_meals: number;
  rationale: string | null;
  ai_generated: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface DailyReportDoc {
  user_id: string;
  report_date: ISODate;
  calories_in: number;
  calories_out: number;
  protein_g: number;
  water_ml: number;
  habits_completed: number;
  habits_total: number;
  nutrition_score: number;
  health_score: number;
  pet_status: string | null;
  summary: string | null;
  suggestions: unknown[];
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ScanUsageDoc {
  user_id: string;
  usage_date: ISODate;
  scan_count: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface RoutineDoc {
  inputs: Record<string, unknown>;
  blocks: unknown[];
  roadmap: unknown[];
  summary: string | null;
  encouragement: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface RoutineMessageDoc {
  user_id: string;
  role: "user" | "assistant";
  content: string;
  emotion: string | null;
  created_at: ISODateTime;
}

export interface MotivationDoc {
  user_id: string;
  quote: string;
  author: string | null;
  image_index: number;
  shown_at: ISODateTime;
}

export type PlanCode =
  | "FREE"
  | "WEEKLY_PRO"
  | "SPECIAL_38_DAY"
  | "MONTHLY_PRO"
  | "YEARLY_PRO";

export type PlanState = "ACTIVE" | "CANCELLED" | "EXPIRED" | "PENDING" | "PAST_DUE";

export interface SubscriptionDoc {
  user_id: string;
  plan_code: PlanCode;
  plan_state: PlanState;
  one_time: boolean;
  provider: string | null;
  provider_price_id: string | null;
  provider_purchase_token: string | null;
  current_period_start: ISODateTime | null;
  current_period_end: ISODateTime | null;
  cancel_at_period_end: boolean;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface CoinTransactionDoc {
  user_id: string;
  amount: number;
  reason: string;
  created_at: ISODateTime;
}

export interface ShopItemDoc {
  name: string;
  description: string;
  category: string;
  image: string;
  coin_cost: number;
  rarity: string;
  is_premium: boolean;
  created_at: ISODateTime;
}

export interface UserInventoryDoc {
  user_id: string;
  item_id: string;
  equipped: boolean;
  acquired_at: ISODateTime;
}

export interface AchievementDoc {
  code: string;
  title: string;
  description: string;
  badge: string;
  category: string;
  threshold: number;
  metric: string;
  created_at: ISODateTime;
}

export interface UserAchievementDoc {
  user_id: string;
  achievement_id: string;
  unlocked_at: ISODateTime;
}

export interface ActivityFeedDoc {
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: ISODateTime;
}

export interface AiFoodCorrectionDoc {
  user_id: string;
  original_name: string;
  corrected_name: string;
  created_at: ISODateTime;
}

export interface ContactSubmissionDoc {
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: ISODateTime;
}

/**
 * Composite indexes Firestore needs for the queries the app runs.
 * Create these in the Firebase console when the matching feature is moved.
 */
export const REQUIRED_INDEXES = [
  { collection: "habits", fields: ["user_id", "is_active", "created_at"] },
  { collection: "habit_completions", fields: ["user_id", "completion_date"] },
  { collection: "meal_logs", fields: ["user_id", "meal_date"] },
  { collection: "activity_logs", fields: ["user_id", "activity_date"] },
  { collection: "daily_goals", fields: ["user_id", "goal_date"] },
  { collection: "daily_reports", fields: ["user_id", "report_date"] },
  { collection: "scan_usage", fields: ["user_id", "usage_date"] },
  { collection: "routine_messages", fields: ["user_id", "created_at"] },
  { collection: "motivations", fields: ["user_id", "shown_at"] },
  { collection: "coin_transactions", fields: ["user_id", "created_at"] },
  { collection: "user_inventory", fields: ["user_id", "acquired_at"] },
  { collection: "user_achievements", fields: ["user_id", "unlocked_at"] },
  { collection: "activity_feed", fields: ["created_at"] },
] as const;
