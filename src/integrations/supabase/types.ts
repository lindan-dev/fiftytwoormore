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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string
          created_at: string
          emoji: string | null
          id: string
          location_country: string | null
          location_label: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          user_id: string
        }
        Insert: {
          activity_date?: string
          created_at?: string
          emoji?: string | null
          id?: string
          location_country?: string | null
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          user_id: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          emoji?: string | null
          id?: string
          location_country?: string | null
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      benchmark_cohorts: {
        Row: {
          cohort_key: string
          computed_at: string | null
          couple_count: number | null
          id: string
          median_consistency_score: number | null
          median_monthly_count: number | null
          median_rolling_4_weeks: number | null
          median_streak_length: number | null
          p25_monthly_count: number | null
          p75_monthly_count: number | null
          period: string
          period_type: string
        }
        Insert: {
          cohort_key: string
          computed_at?: string | null
          couple_count?: number | null
          id?: string
          median_consistency_score?: number | null
          median_monthly_count?: number | null
          median_rolling_4_weeks?: number | null
          median_streak_length?: number | null
          p25_monthly_count?: number | null
          p75_monthly_count?: number | null
          period: string
          period_type: string
        }
        Update: {
          cohort_key?: string
          computed_at?: string | null
          couple_count?: number | null
          id?: string
          median_consistency_score?: number | null
          median_monthly_count?: number | null
          median_rolling_4_weeks?: number | null
          median_streak_length?: number | null
          p25_monthly_count?: number | null
          p75_monthly_count?: number | null
          period?: string
          period_type?: string
        }
        Relationships: []
      }
      couple_invitations: {
        Row: {
          created_at: string
          id: string
          receiver_email: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_email: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_email?: string
          sender_id?: string
          status?: string
        }
        Relationships: []
      }
      couples: {
        Row: {
          anniversary: string | null
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          anniversary?: string | null
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          anniversary?: string | null
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      email_digest_log: {
        Row: {
          created_at: string | null
          id: string
          message_id: string | null
          resend_message_id: string | null
          sent_at: string | null
          subject: string | null
          type: string
          user_id: string
          variant_key: string | null
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          subject?: string | null
          type: string
          user_id: string
          variant_key?: string | null
          week_number: number
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          subject?: string | null
          type?: string
          user_id?: string
          variant_key?: string | null
          week_number?: number
          year?: number
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          event: string
          event_at: string
          id: string
          message_id: string
          metadata: Json | null
          type: string
          user_id: string
          variant_key: string | null
        }
        Insert: {
          created_at?: string
          event: string
          event_at?: string
          id?: string
          message_id: string
          metadata?: Json | null
          type: string
          user_id: string
          variant_key?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          event_at?: string
          id?: string
          message_id?: string
          metadata?: Json | null
          type?: string
          user_id?: string
          variant_key?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          benchmark_opt_in: boolean | null
          beta_partner_name: string | null
          beta_signup_date: string | null
          birthday: string | null
          created_at: string
          email_digest_enabled: boolean | null
          id: string
          is_beta_user: boolean | null
          last_log_at: string | null
          name: string | null
          signup_at: string | null
          streak_weeks: number | null
          timezone: string | null
          updated_at: string
          user_id: string
          year_total: number | null
        }
        Insert: {
          benchmark_opt_in?: boolean | null
          beta_partner_name?: string | null
          beta_signup_date?: string | null
          birthday?: string | null
          created_at?: string
          email_digest_enabled?: boolean | null
          id?: string
          is_beta_user?: boolean | null
          last_log_at?: string | null
          name?: string | null
          signup_at?: string | null
          streak_weeks?: number | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          year_total?: number | null
        }
        Update: {
          benchmark_opt_in?: boolean | null
          beta_partner_name?: string | null
          beta_signup_date?: string | null
          birthday?: string | null
          created_at?: string
          email_digest_enabled?: boolean | null
          id?: string
          is_beta_user?: boolean | null
          last_log_at?: string | null
          name?: string | null
          signup_at?: string | null
          streak_weeks?: number | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          year_total?: number | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      superuser_last_check: {
        Row: {
          last_check_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          last_check_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          last_check_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_name: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_name: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_name?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_partner_id: { Args: { user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_beta_user_or_partner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "superuser" | "user" | "beta_user" | "test_user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["superuser", "user", "beta_user", "test_user"],
    },
  },
} as const
