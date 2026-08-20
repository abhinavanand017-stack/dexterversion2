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
      etf_aum_snapshots: {
        Row: {
          aum_cr: number | null
          id: number
          snapshot_date: string
          ticker: string
        }
        Insert: {
          aum_cr?: number | null
          id?: number
          snapshot_date?: string
          ticker: string
        }
        Update: {
          aum_cr?: number | null
          id?: number
          snapshot_date?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "etf_aum_snapshots_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "etfs"
            referencedColumns: ["ticker"]
          },
        ]
      }
      etfs: {
        Row: {
          amc: string | null
          aum_cr: number | null
          benchmark: string | null
          category: string
          created_at: string
          day_change_pct: number | null
          etf_name: string
          etf_ticker: string | null
          expense_ratio_pct: number | null
          forecast_unavailable: boolean
          inav: number | null
          inception_date: string | null
          ltp_nav: number | null
          price_updated_at: string | null
          ret_1m_pct: number | null
          ret_1yr_pct: number | null
          ret_3m_pct: number | null
          ret_3yr_pct: number | null
          ret_5yr_pct: number | null
          ticker: string
          tracking_error_pct: number | null
          updated_at: string
          volume: number | null
          w52_high: number | null
          w52_low: number | null
        }
        Insert: {
          amc?: string | null
          aum_cr?: number | null
          benchmark?: string | null
          category: string
          created_at?: string
          day_change_pct?: number | null
          etf_name: string
          etf_ticker?: string | null
          expense_ratio_pct?: number | null
          forecast_unavailable?: boolean
          inav?: number | null
          inception_date?: string | null
          ltp_nav?: number | null
          price_updated_at?: string | null
          ret_1m_pct?: number | null
          ret_1yr_pct?: number | null
          ret_3m_pct?: number | null
          ret_3yr_pct?: number | null
          ret_5yr_pct?: number | null
          ticker: string
          tracking_error_pct?: number | null
          updated_at?: string
          volume?: number | null
          w52_high?: number | null
          w52_low?: number | null
        }
        Update: {
          amc?: string | null
          aum_cr?: number | null
          benchmark?: string | null
          category?: string
          created_at?: string
          day_change_pct?: number | null
          etf_name?: string
          etf_ticker?: string | null
          expense_ratio_pct?: number | null
          forecast_unavailable?: boolean
          inav?: number | null
          inception_date?: string | null
          ltp_nav?: number | null
          price_updated_at?: string | null
          ret_1m_pct?: number | null
          ret_1yr_pct?: number | null
          ret_3m_pct?: number | null
          ret_3yr_pct?: number | null
          ret_5yr_pct?: number | null
          ticker?: string
          tracking_error_pct?: number | null
          updated_at?: string
          volume?: number | null
          w52_high?: number | null
          w52_low?: number | null
        }
        Relationships: []
      }
      live_quotes: {
        Row: {
          day_change: number | null
          day_change_pct: number | null
          ltp: number | null
          symbol: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          day_change?: number | null
          day_change_pct?: number | null
          ltp?: number | null
          symbol: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          day_change?: number | null
          day_change_pct?: number | null
          ltp?: number | null
          symbol?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
