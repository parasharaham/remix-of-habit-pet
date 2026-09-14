export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge: string
          category: string
          code: string
          created_at: string
          description: string
          id: string
          metric: string
          threshold: number
          title: string
        }
        Insert: {
          badge?: string
          category?: string
          code: string
          created_at?: string
          description: string
          id?: string
          metric?: string
          threshold?: number
          title: string
        }
        Update: {
          badge?: string
          category?: string
          code?: string
          created_at?: string
          description?: string
          id?: string
          metric?: string
          threshold?: number
          title?: string
        }
        Relationships: []
      }
      activity_feed: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      activity_logs: {
        Row: {
          activity_date: string
          activity_type: string
          calories_burned: number | null
          created_at: string
          distance_km: number | null
          duration_min: number
          id: string
          notes: string | null
          steps: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_date?: string
          activity_type: string
          calories_burned?: number | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number
          id?: string
          notes?: string | null
          steps?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          calories_burned?: number | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number
          id?: string
          notes?: string | null
          steps?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_food_corrections: {
        Row: {
          corrected_name: string
          created_at: string
          id: string
          original_name: string
          user_id: string
        }
        Insert: {
          corrected_name: string
          created_at?: string
          id?: string
          original_name: string
          user_id: string
        }
        Update: {
          corrected_name?: string
          created_at?: string
          id?: string
          original_name?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      daily_goals: {
        Row: {
          ai_generated: boolean
          calories: number
          created_at: string
          fruit_servings: number
          goal_date: string
          healthy_meals: number
          id: string
          protein_g: number
          rationale: string | null
          sleep_hours: number
          steps: number
          updated_at: string
          user_id: string
          veg_servings: number
          water_ml: number
        }
        Insert: {
          ai_generated?: boolean
          calories?: number
          created_at?: string
          fruit_servings?: number
          goal_date?: string
          healthy_meals?: number
          id?: string
          protein_g?: number
          rationale?: string | null
          sleep_hours?: number
          steps?: number
          updated_at?: string
          user_id: string
          veg_servings?: number
          water_ml?: number
        }
        Update: {
          ai_generated?: boolean
          calories?: number
          created_at?: string
          fruit_servings?: number
          goal_date?: string
          healthy_meals?: number
          id?: string
          protein_g?: number
          rationale?: string | null
          sleep_hours?: number
          steps?: number
          updated_at?: string
          user_id?: string
          veg_servings?: number
          water_ml?: number
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          calories_in: number
          calories_out: number
          created_at: string
          habits_completed: number
          habits_total: number
          health_score: number
          id: string
          nutrition_score: number
          pet_status: string | null
          protein_g: number
          report_date: string
          suggestions: Json
          summary: string | null
          updated_at: string
          user_id: string
          water_ml: number
        }
        Insert: {
          calories_in?: number
          calories_out?: number
          created_at?: string
          habits_completed?: number
          habits_total?: number
          health_score?: number
          id?: string
          nutrition_score?: number
          pet_status?: string | null
          protein_g?: number
          report_date?: string
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id: string
          water_ml?: number
        }
        Update: {
          calories_in?: number
          calories_out?: number
          created_at?: string
          habits_completed?: number
          habits_total?: number
          health_score?: number
          id?: string
          nutrition_score?: number
          pet_status?: string | null
          protein_g?: number
          report_date?: string
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id?: string
          water_ml?: number
        }
        Relationships: []
      }
      habit_completions: {
        Row: {
          completion_date: string
          created_at: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completion_date?: string
          created_at?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completion_date?: string
          created_at?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_completions_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          category: string
          created_at: string
          current_streak: number
          description: string | null
          difficulty: string
          frequency: Database["public"]["Enums"]["habit_frequency"]
          id: string
          is_active: boolean
          is_paused: boolean
          last_completed_at: string | null
          longest_streak: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          current_streak?: number
          description?: string | null
          difficulty?: string
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          id?: string
          is_active?: boolean
          is_paused?: boolean
          last_completed_at?: string | null
          longest_streak?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          current_streak?: number
          description?: string | null
          difficulty?: string
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          id?: string
          is_active?: boolean
          is_paused?: boolean
          last_completed_at?: string | null
          longest_streak?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_logs: {
        Row: {
          ai_analyzed: boolean
          analysis_id: string | null
          benefits: Json
          carbs_g: number | null
          classification: string
          classification_reason: string | null
          confidence: number | null
          considerations: Json
          created_at: string
          fat_g: number | null
          fiber_g: number | null
          food_name: string | null
          health_score: number | null
          id: string
          ingredients: Json
          items: Json
          meal_date: string
          meal_type: string
          notes: string | null
          nutrition_extra: Json
          photo_url: string | null
          portion_grams: number | null
          protein_g: number | null
          recommendations: Json
          sodium_mg: number | null
          sub_scores: Json
          sugar_g: number | null
          total_calories: number | null
          updated_at: string
          user_adjusted: boolean
          user_id: string
          water_ml: number | null
        }
        Insert: {
          ai_analyzed?: boolean
          analysis_id?: string | null
          benefits?: Json
          carbs_g?: number | null
          classification?: string
          classification_reason?: string | null
          confidence?: number | null
          considerations?: Json
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          food_name?: string | null
          health_score?: number | null
          id?: string
          ingredients?: Json
          items?: Json
          meal_date?: string
          meal_type: string
          notes?: string | null
          nutrition_extra?: Json
          photo_url?: string | null
          portion_grams?: number | null
          protein_g?: number | null
          recommendations?: Json
          sodium_mg?: number | null
          sub_scores?: Json
          sugar_g?: number | null
          total_calories?: number | null
          updated_at?: string
          user_adjusted?: boolean
          user_id: string
          water_ml?: number | null
        }
        Update: {
          ai_analyzed?: boolean
          analysis_id?: string | null
          benefits?: Json
          carbs_g?: number | null
          classification?: string
          classification_reason?: string | null
          confidence?: number | null
          considerations?: Json
          created_at?: string
          fat_g?: number | null
          fiber_g?: number | null
          food_name?: string | null
          health_score?: number | null
          id?: string
          ingredients?: Json
          items?: Json
          meal_date?: string
          meal_type?: string
          notes?: string | null
          nutrition_extra?: Json
          photo_url?: string | null
          portion_grams?: number | null
          protein_g?: number | null
          recommendations?: Json
          sodium_mg?: number | null
          sub_scores?: Json
          sugar_g?: number | null
          total_calories?: number | null
          updated_at?: string
          user_adjusted?: boolean
          user_id?: string
          water_ml?: number | null
        }
        Relationships: []
      }
      motivations: {
        Row: {
          author: string | null
          id: string
          image_index: number
          quote: string
          shown_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          id?: string
          image_index?: number
          quote: string
          shown_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          id?: string
          image_index?: number
          quote?: string
          shown_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pets: {
        Row: {
          created_at: string
          current_level: number
          energy_points: number
          happiness_points: number
          health_points: number
          id: string
          last_decay_checked_at: string
          onboarded: boolean
          pet_name: string
          pet_stage: Database["public"]["Enums"]["pet_stage"]
          pet_type: string
          total_experience_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          energy_points?: number
          happiness_points?: number
          health_points?: number
          id?: string
          last_decay_checked_at?: string
          onboarded?: boolean
          pet_name?: string
          pet_stage?: Database["public"]["Enums"]["pet_stage"]
          pet_type?: string
          total_experience_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_level?: number
          energy_points?: number
          happiness_points?: number
          health_points?: number
          id?: string
          last_decay_checked_at?: string
          onboarded?: boolean
          pet_name?: string
          pet_stage?: Database["public"]["Enums"]["pet_stage"]
          pet_type?: string
          total_experience_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: string | null
          age: number | null
          allergies: string[] | null
          avatar_url: string | null
          coins: number
          created_at: string
          daily_calorie_target: number | null
          fitness_goal: string | null
          food_preferences: string[] | null
          full_name: string | null
          grade: string | null
          health_conditions: string[] | null
          height_cm: number | null
          id: string
          is_admin: boolean
          is_premium: boolean
          life_objective: string | null
          lifestyle: string | null
          mother_tongue: string | null
          passion: string | null
          preferred_language: string
          profession: string | null
          profile_completed: boolean
          sex: string | null
          sleep_hours: number | null
          target_skill: string | null
          total_coins_earned: number
          total_habits_completed: number
          total_xp_earned: number
          updated_at: string
          username: string | null
          weight_kg: number | null
        }
        Insert: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          coins?: number
          created_at?: string
          daily_calorie_target?: number | null
          fitness_goal?: string | null
          food_preferences?: string[] | null
          full_name?: string | null
          grade?: string | null
          health_conditions?: string[] | null
          height_cm?: number | null
          id: string
          is_admin?: boolean
          is_premium?: boolean
          life_objective?: string | null
          lifestyle?: string | null
          mother_tongue?: string | null
          passion?: string | null
          preferred_language?: string
          profession?: string | null
          profile_completed?: boolean
          sex?: string | null
          sleep_hours?: number | null
          target_skill?: string | null
          total_coins_earned?: number
          total_habits_completed?: number
          total_xp_earned?: number
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
        }
        Update: {
          activity_level?: string | null
          age?: number | null
          allergies?: string[] | null
          avatar_url?: string | null
          coins?: number
          created_at?: string
          daily_calorie_target?: number | null
          fitness_goal?: string | null
          food_preferences?: string[] | null
          full_name?: string | null
          grade?: string | null
          health_conditions?: string[] | null
          height_cm?: number | null
          id?: string
          is_admin?: boolean
          is_premium?: boolean
          life_objective?: string | null
          lifestyle?: string | null
          mother_tongue?: string | null
          passion?: string | null
          preferred_language?: string
          profession?: string | null
          profile_completed?: boolean
          sex?: string | null
          sleep_hours?: number | null
          target_skill?: string | null
          total_coins_earned?: number
          total_habits_completed?: number
          total_xp_earned?: number
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      routine_messages: {
        Row: {
          content: string
          created_at: string
          emotion: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          emotion?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          emotion?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      routines: {
        Row: {
          blocks: Json
          created_at: string
          encouragement: string | null
          id: string
          inputs: Json
          roadmap: Json
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          encouragement?: string | null
          id?: string
          inputs?: Json
          roadmap?: Json
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          encouragement?: string | null
          id?: string
          inputs?: Json
          roadmap?: Json
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_usage: {
        Row: {
          created_at: string
          id: string
          scan_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scan_count?: number
          updated_at?: string
          usage_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scan_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          category: string
          coin_cost: number
          created_at: string
          description: string
          id: string
          image: string
          is_premium: boolean
          name: string
          rarity: string
        }
        Insert: {
          category: string
          coin_cost: number
          created_at?: string
          description: string
          id?: string
          image?: string
          is_premium?: boolean
          name: string
          rarity?: string
        }
        Update: {
          category?: string
          coin_cost?: number
          created_at?: string
          description?: string
          id?: string
          image?: string
          is_premium?: boolean
          name?: string
          rarity?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          one_time: boolean
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          plan: string
          plan_code: string
          plan_state: string
          provider: string | null
          provider_price_id: string | null
          provider_purchase_token: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          one_time?: boolean
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          plan?: string
          plan_code?: string
          plan_state?: string
          provider?: string | null
          provider_price_id?: string | null
          provider_purchase_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          one_time?: boolean
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          plan?: string
          plan_code?: string
          plan_state?: string
          provider?: string | null
          provider_price_id?: string | null
          provider_purchase_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          acquired_at: string
          equipped: boolean
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          equipped?: boolean
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          equipped?: boolean
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_profiles: {
        Args: { _ids?: string[] }
        Returns: {
          avatar_url: string
          created_at: string
          id: string
          total_coins_earned: number
          total_habits_completed: number
          total_xp_earned: number
          username: string
        }[]
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      habit_frequency: "daily" | "weekly"
      pet_stage: "egg" | "baby" | "child" | "adult"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      habit_frequency: ["daily", "weekly"],
      pet_stage: ["egg", "baby", "child", "adult"],
    },
  },
} as const
