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
      event_registrations: {
        Row: {
          created_at: string
          email: string | null
          event_id: string
          full_name: string
          hold_expires_at: string | null
          id: string
          ip_hash: string | null
          locale: string
          phone_e164: string
          rekaz_payment_link: string | null
          rekaz_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_id: string
          full_name: string
          hold_expires_at?: string | null
          id?: string
          ip_hash?: string | null
          locale?: string
          phone_e164: string
          rekaz_payment_link?: string | null
          rekaz_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event_id?: string
          full_name?: string
          hold_expires_at?: string | null
          id?: string
          ip_hash?: string | null
          locale?: string
          phone_e164?: string
          rekaz_payment_link?: string | null
          rekaz_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          created_at: string
          date_precision: string
          description_ar: string | null
          description_en: string | null
          edition: string | null
          ends_at: string
          host_ar: string | null
          host_en: string | null
          id: string
          location_ar: string | null
          location_en: string | null
          poster_path: string | null
          rekaz_price_immutable_id: string | null
          series: string | null
          slug: string
          starts_at: string
          status: string
          summary_ar: string | null
          summary_en: string | null
          ticket_amount: number | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          date_precision?: string
          description_ar?: string | null
          description_en?: string | null
          edition?: string | null
          ends_at: string
          host_ar?: string | null
          host_en?: string | null
          id?: string
          location_ar?: string | null
          location_en?: string | null
          poster_path?: string | null
          rekaz_price_immutable_id?: string | null
          series?: string | null
          slug: string
          starts_at: string
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          ticket_amount?: number | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          date_precision?: string
          description_ar?: string | null
          description_en?: string | null
          edition?: string | null
          ends_at?: string
          host_ar?: string | null
          host_en?: string | null
          id?: string
          location_ar?: string | null
          location_en?: string | null
          poster_path?: string | null
          rekaz_price_immutable_id?: string | null
          series?: string | null
          slug?: string
          starts_at?: string
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          ticket_amount?: number | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          request_fingerprint: string
          response_body: Json | null
          response_status: number | null
          scope: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          request_fingerprint: string
          response_body?: Json | null
          response_status?: number | null
          scope: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          request_fingerprint?: string
          response_body?: Json | null
          response_status?: number | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          count: number
          window_start: string
        }
        Insert: {
          bucket: string
          count: number
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      startup_applications: {
        Row: {
          code: string | null
          code_expires_at: string | null
          consent_at: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_email_error: string | null
          decision_email_sent_at: string | null
          decision_note: string | null
          email: string
          founder_name: string
          id: string
          ip_hash: string | null
          locale: string
          phone_e164: string
          pitch: string
          redeemed_at: string | null
          redeemed_by: string | null
          reference: string
          space: string
          stage: string
          startup_name: string
          status: string
          team_size: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          code_expires_at?: string | null
          consent_at?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_email_error?: string | null
          decision_email_sent_at?: string | null
          decision_note?: string | null
          email: string
          founder_name: string
          id?: string
          ip_hash?: string | null
          locale?: string
          phone_e164: string
          pitch: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          reference: string
          space: string
          stage: string
          startup_name: string
          status?: string
          team_size: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          code_expires_at?: string | null
          consent_at?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_email_error?: string | null
          decision_email_sent_at?: string | null
          decision_note?: string | null
          email?: string
          founder_name?: string
          id?: string
          ip_hash?: string | null
          locale?: string
          phone_e164?: string
          pitch?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          reference?: string
          space?: string
          stage?: string
          startup_name?: string
          status?: string
          team_size?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_domain_rejection: { Args: never; Returns: Json }
      enforce_admin_email_domain: { Args: { event: Json }; Returns: Json }
      event_claim_seat: {
        Args: {
          p_email: string
          p_event_id: string
          p_full_name: string
          p_hold_seconds: number
          p_ip_hash: string
          p_locale: string
          p_phone_e164: string
        }
        Returns: {
          outcome: string
          registration_id: string
          registration_status: string
          seats_left: number
        }[]
      }
      event_expire_holds: { Args: { p_event_id: string }; Returns: number }
      event_seats_taken: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          taken: number
        }[]
      }
      health_ping: { Args: never; Returns: string }
      idempotency_begin: {
        Args: {
          p_fingerprint: string
          p_key: string
          p_retain_hours?: number
          p_scope: string
          p_stale_after_seconds?: number
        }
        Returns: {
          outcome: string
          response_body: Json
          response_status: number
        }[]
      }
      rate_limit_hit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
