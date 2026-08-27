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
    PostgrestVersion: "14.17"
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
      stock_prices_eod: {
        Row: {
          as_of: string
          close: number | null
          date: string
          delivery_pct: number | null
          high: number | null
          low: number | null
          open: number | null
          source_tier: number
          ticker: string
          volume: number | null
          w52_high: number | null
          w52_low: number | null
        }
        Insert: {
          as_of?: string
          close?: number | null
          date: string
          delivery_pct?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          source_tier?: number
          ticker: string
          volume?: number | null
          w52_high?: number | null
          w52_low?: number | null
        }
        Update: {
          as_of?: string
          close?: number | null
          date?: string
          delivery_pct?: number | null
          high?: number | null
          low?: number | null
          open?: number | null
          source_tier?: number
          ticker?: string
          volume?: number | null
          w52_high?: number | null
          w52_low?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_prices_eod_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "stock_screener_rows"
            referencedColumns: ["ticker"]
          },
          {
            foreignKeyName: "stock_prices_eod_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "stock_universe"
            referencedColumns: ["ticker"]
          },
        ]
      }
      stock_technicals: {
        Row: {
          as_of: string
          beta: number | null
          date: string
          dma200: number | null
          dma50: number | null
          pct_from_52w_high: number | null
          pct_from_52w_low: number | null
          ret_1m_pct: number | null
          ret_1y_pct: number | null
          ret_3m_pct: number | null
          rsi14: number | null
          source_tier: number
          ticker: string
          volume_vs_20d_avg: number | null
        }
        Insert: {
          as_of?: string
          beta?: number | null
          date: string
          dma200?: number | null
          dma50?: number | null
          pct_from_52w_high?: number | null
          pct_from_52w_low?: number | null
          ret_1m_pct?: number | null
          ret_1y_pct?: number | null
          ret_3m_pct?: number | null
          rsi14?: number | null
          source_tier?: number
          ticker: string
          volume_vs_20d_avg?: number | null
        }
        Update: {
          as_of?: string
          beta?: number | null
          date?: string
          dma200?: number | null
          dma50?: number | null
          pct_from_52w_high?: number | null
          pct_from_52w_low?: number | null
          ret_1m_pct?: number | null
          ret_1y_pct?: number | null
          ret_3m_pct?: number | null
          rsi14?: number | null
          source_tier?: number
          ticker?: string
          volume_vs_20d_avg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_technicals_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "stock_screener_rows"
            referencedColumns: ["ticker"]
          },
          {
            foreignKeyName: "stock_technicals_ticker_fkey"
            columns: ["ticker"]
            isOneToOne: false
            referencedRelation: "stock_universe"
            referencedColumns: ["ticker"]
          },
        ]
      }
      stock_universe: {
        Row: {
          as_of: string
          company_name: string
          exchange: string
          free_float_pct: number | null
          inclusion_date: string
          index_membership: string[]
          isin: string | null
          market_cap_cr: number | null
          nse_industry: string | null
          sector: string | null
          source_tier: number
          sub_sector: string | null
          ticker: string
          universe_rank: number | null
        }
        Insert: {
          as_of?: string
          company_name: string
          exchange?: string
          free_float_pct?: number | null
          inclusion_date?: string
          index_membership?: string[]
          isin?: string | null
          market_cap_cr?: number | null
          nse_industry?: string | null
          sector?: string | null
          source_tier?: number
          sub_sector?: string | null
          ticker: string
          universe_rank?: number | null
        }
        Update: {
          as_of?: string
          company_name?: string
          exchange?: string
          free_float_pct?: number | null
          inclusion_date?: string
          index_membership?: string[]
          isin?: string | null
          market_cap_cr?: number | null
          nse_industry?: string | null
          sector?: string | null
          source_tier?: number
          sub_sector?: string | null
          ticker?: string
          universe_rank?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      stock_screener_rows: {
        Row: {
          beta: number | null
          close: number | null
          company_name: string | null
          delivery_pct: number | null
          dma200: number | null
          dma50: number | null
          exchange: string | null
          free_float_pct: number | null
          high: number | null
          index_membership: string[] | null
          isin: string | null
          low: number | null
          market_cap_cr: number | null
          open: number | null
          pct_from_52w_high: number | null
          pct_from_52w_low: number | null
          price_as_of: string | null
          price_date: string | null
          ret_1m_pct: number | null
          ret_1y_pct: number | null
          ret_3m_pct: number | null
          rsi14: number | null
          sector: string | null
          sub_sector: string | null
          technicals_as_of: string | null
          ticker: string | null
          universe_as_of: string | null
          universe_rank: number | null
          volume: number | null
          volume_vs_20d_avg: number | null
          w52_high: number | null
          w52_low: number | null
        }
        Relationships: []
      }
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
