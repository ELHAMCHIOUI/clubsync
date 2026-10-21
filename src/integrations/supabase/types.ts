// Fichier généré depuis le schéma SQL (supabase/migrations). Ne pas modifier à la main.
// Régénérer : npm run db:types (projet Supabase lié) ou supabase/tests/gen_types.py (Postgres local).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13" };
  public: {
    Tables: {
      attendance_logs: {
        Row: {
          id: number;
          organization_id: string;
          member_id: string;
          result: Database["public"]["Enums"]["checkin_result"];
          reason: string;
          method: Database["public"]["Enums"]["checkin_method"];
          scanned_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          organization_id: string;
          member_id: string;
          result: Database["public"]["Enums"]["checkin_result"];
          reason?: string;
          method: Database["public"]["Enums"]["checkin_method"];
          scanned_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          organization_id?: string;
          member_id?: string;
          result?: Database["public"]["Enums"]["checkin_result"];
          reason?: string;
          method?: Database["public"]["Enums"]["checkin_method"];
          scanned_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          organization_id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          organization_id: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          data?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          organization_id?: string;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          data?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cash_closings: {
        Row: {
          id: string;
          organization_id: string;
          day: string;
          expected_cents: number;
          counted_cents: number;
          difference_cents: number | null;
          note: string;
          closed_by: string | null;
          closed_at: string;
          validated_by: string | null;
          validated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          day: string;
          expected_cents: number;
          counted_cents: number;
          difference_cents?: never;
          note?: string;
          closed_by?: string | null;
          closed_at?: string;
          validated_by?: string | null;
          validated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          day?: string;
          expected_cents?: number;
          counted_cents?: number;
          difference_cents?: never;
          note?: string;
          closed_by?: string | null;
          closed_at?: string;
          validated_by?: string | null;
          validated_at?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          organization_id: string;
          category: string;
          label: string;
          amount_cents: number;
          method: Database["public"]["Enums"]["payment_method"];
          spent_on: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          category: string;
          label?: string;
          amount_cents: number;
          method?: Database["public"]["Enums"]["payment_method"];
          spent_on?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          category?: string;
          label?: string;
          amount_cents?: number;
          method?: Database["public"]["Enums"]["payment_method"];
          spent_on?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          subscription_id: string;
          number: number;
          issued_on: string;
          total_cents: number;
          vat_rate: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          subscription_id: string;
          number: number;
          issued_on?: string;
          total_cents: number;
          vat_rate?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          member_id?: string;
          subscription_id?: string;
          number?: number;
          issued_on?: string;
          total_cents?: number;
          vat_rate?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      loyalty_ledger: {
        Row: {
          id: number;
          organization_id: string;
          member_id: string;
          kind: Database["public"]["Enums"]["loyalty_kind"];
          points: number;
          note: string;
          subscription_id: string | null;
          attendance_id: number | null;
          redemption_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          organization_id: string;
          member_id: string;
          kind: Database["public"]["Enums"]["loyalty_kind"];
          points: number;
          note?: string;
          subscription_id?: string | null;
          attendance_id?: number | null;
          redemption_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          organization_id?: string;
          member_id?: string;
          kind?: Database["public"]["Enums"]["loyalty_kind"];
          points?: number;
          note?: string;
          subscription_id?: string | null;
          attendance_id?: number | null;
          redemption_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      loyalty_settings: {
        Row: {
          organization_id: string;
          enabled: boolean;
          points_per_visit: number;
          welcome_points: number;
          points_per_month: number;
          renewal_bonus: number;
          referral_points: number;
          expiry_months: number;
        };
        Insert: {
          organization_id: string;
          enabled?: boolean;
          points_per_visit?: number;
          welcome_points?: number;
          points_per_month?: number;
          renewal_bonus?: number;
          referral_points?: number;
          expiry_months?: number;
        };
        Update: {
          organization_id?: string;
          enabled?: boolean;
          points_per_visit?: number;
          welcome_points?: number;
          points_per_month?: number;
          renewal_bonus?: number;
          referral_points?: number;
          expiry_months?: number;
        };
        Relationships: [];
      };
      member_cards: {
        Row: {
          member_id: string;
          organization_id: string;
          qr_token: string;
          link_token: string;
          issued_at: string;
          regenerated_at: string | null;
        };
        Insert: {
          member_id: string;
          organization_id: string;
          qr_token?: string;
          link_token?: string;
          issued_at?: string;
          regenerated_at?: string | null;
        };
        Update: {
          member_id?: string;
          organization_id?: string;
          qr_token?: string;
          link_token?: string;
          issued_at?: string;
          regenerated_at?: string | null;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          phone: string;
          email: string;
          notes: string;
          whatsapp_opt_in: boolean;
          photo_path: string | null;
          referred_by: string | null;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          phone?: string;
          email?: string;
          notes?: string;
          whatsapp_opt_in?: boolean;
          photo_path?: string | null;
          referred_by?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          full_name?: string;
          phone?: string;
          email?: string;
          notes?: string;
          whatsapp_opt_in?: boolean;
          photo_path?: string | null;
          referred_by?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          organization_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["staff_role"];
          created_at: string;
        };
        Insert: {
          organization_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["staff_role"];
          created_at?: string;
        };
        Update: {
          organization_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["staff_role"];
          created_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          phone: string;
          address: string;
          city: string;
          ice: string;
          tax_id: string;
          vat_rate: number;
          invoice_prefix: string;
          invoice_seq: number;
          max_reception_discount_pct: number;
          anti_passback_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string;
          address?: string;
          city?: string;
          ice?: string;
          tax_id?: string;
          vat_rate?: number;
          invoice_prefix?: string;
          invoice_seq?: number;
          max_reception_discount_pct?: number;
          anti_passback_minutes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          address?: string;
          city?: string;
          ice?: string;
          tax_id?: string;
          vat_rate?: number;
          invoice_prefix?: string;
          invoice_seq?: number;
          max_reception_discount_pct?: number;
          anti_passback_minutes?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          subscription_id: string;
          member_id: string;
          amount_cents: number;
          method: Database["public"]["Enums"]["payment_method"];
          paid_at: string;
          reference: string;
          note: string;
          received_by: string | null;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          subscription_id: string;
          member_id: string;
          amount_cents: number;
          method: Database["public"]["Enums"]["payment_method"];
          paid_at?: string;
          reference?: string;
          note?: string;
          received_by?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          subscription_id?: string;
          member_id?: string;
          amount_cents?: number;
          method?: Database["public"]["Enums"]["payment_method"];
          paid_at?: string;
          reference?: string;
          note?: string;
          received_by?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          duration_months: number;
          price_cents: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          duration_months: number;
          price_cents: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          duration_months?: number;
          price_cents?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          email?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      redemptions: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          reward_id: string;
          reward_name: string;
          points_cost: number;
          note: string;
          given_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          reward_id: string;
          reward_name: string;
          points_cost: number;
          note?: string;
          given_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          member_id?: string;
          reward_id?: string;
          reward_name?: string;
          points_cost?: number;
          note?: string;
          given_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reminder_logs: {
        Row: {
          id: number;
          organization_id: string;
          member_id: string;
          subscription_id: string | null;
          kind: Database["public"]["Enums"]["reminder_kind"];
          sent_by: string | null;
          sent_at: string;
        };
        Insert: {
          id?: number;
          organization_id: string;
          member_id: string;
          subscription_id?: string | null;
          kind: Database["public"]["Enums"]["reminder_kind"];
          sent_by?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: number;
          organization_id?: string;
          member_id?: string;
          subscription_id?: string | null;
          kind?: Database["public"]["Enums"]["reminder_kind"];
          sent_by?: string | null;
          sent_at?: string;
        };
        Relationships: [];
      };
      reminder_templates: {
        Row: {
          id: string;
          organization_id: string;
          kind: Database["public"]["Enums"]["reminder_kind"];
          offset_days: number;
          template: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          organization_id: string;
          kind: Database["public"]["Enums"]["reminder_kind"];
          offset_days: number;
          template: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          organization_id?: string;
          kind?: Database["public"]["Enums"]["reminder_kind"];
          offset_days?: number;
          template?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      rewards: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string;
          reward_type: Database["public"]["Enums"]["reward_type"];
          points_cost: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string;
          reward_type?: Database["public"]["Enums"]["reward_type"];
          points_cost: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string;
          reward_type?: Database["public"]["Enums"]["reward_type"];
          points_cost?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: Database["public"]["Enums"]["staff_role"];
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: Database["public"]["Enums"]["staff_role"];
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["staff_role"];
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          member_id: string;
          plan_id: string;
          start_date: string;
          end_date: string;
          amount_due_cents: number;
          discount_cents: number;
          state: Database["public"]["Enums"]["subscription_state"];
          frozen_from: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          member_id: string;
          plan_id: string;
          start_date: string;
          end_date: string;
          amount_due_cents: number;
          discount_cents?: number;
          state?: Database["public"]["Enums"]["subscription_state"];
          frozen_from?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          member_id?: string;
          plan_id?: string;
          start_date?: string;
          end_date?: string;
          amount_due_cents?: number;
          discount_cents?: number;
          state?: Database["public"]["Enums"]["subscription_state"];
          frozen_from?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      attendance_overview: {
        Row: {
          id: number | null;
          organization_id: string | null;
          member_id: string | null;
          member_name: string | null;
          result: Database["public"]["Enums"]["checkin_result"] | null;
          reason: string | null;
          method: Database["public"]["Enums"]["checkin_method"] | null;
          created_at: string | null;
          created_local: string | null;
          created_on: string | null;
          scanned_by_name: string | null;
        };
        Relationships: [];
      };
      expenses_by_month: {
        Row: {
          organization_id: string | null;
          month: string | null;
          category: string | null;
          method: Database["public"]["Enums"]["payment_method"] | null;
          total_cents: number | null;
        };
        Relationships: [];
      };
      member_overview: {
        Row: {
          id: string | null;
          organization_id: string | null;
          full_name: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          whatsapp_opt_in: boolean | null;
          photo_path: string | null;
          referred_by: string | null;
          archived_at: string | null;
          created_at: string | null;
          created_on: string | null;
          subscription_id: string | null;
          plan_name: string | null;
          start_date: string | null;
          end_date: string | null;
          subscription_status: string | null;
          days_left: number | null;
          balance_cents: number | null;
          points: number | null;
          last_visit_at: string | null;
        };
        Relationships: [];
      };
      member_points: {
        Row: {
          member_id: string | null;
          organization_id: string | null;
          balance: number | null;
          last_activity: string | null;
        };
        Relationships: [];
      };
      payment_overview: {
        Row: {
          id: string | null;
          organization_id: string | null;
          subscription_id: string | null;
          member_id: string | null;
          member_name: string | null;
          plan_name: string | null;
          amount_cents: number | null;
          method: Database["public"]["Enums"]["payment_method"] | null;
          paid_at: string | null;
          paid_local: string | null;
          paid_on: string | null;
          reference: string | null;
          note: string | null;
          received_by: string | null;
          received_by_name: string | null;
          voided_at: string | null;
          void_reason: string | null;
        };
        Relationships: [];
      };
      revenue_by_month: {
        Row: {
          organization_id: string | null;
          month: string | null;
          method: Database["public"]["Enums"]["payment_method"] | null;
          total_cents: number | null;
          payment_count: number | null;
        };
        Relationships: [];
      };
      staff_overview: {
        Row: {
          organization_id: string | null;
          user_id: string | null;
          role: Database["public"]["Enums"]["staff_role"] | null;
          created_at: string | null;
          full_name: string | null;
          email: string | null;
        };
        Relationships: [];
      };
      subscription_overview: {
        Row: {
          id: string | null;
          organization_id: string | null;
          member_id: string | null;
          member_name: string | null;
          member_phone: string | null;
          member_whatsapp_opt_in: boolean | null;
          member_archived: boolean | null;
          plan_id: string | null;
          plan_name: string | null;
          plan_duration_months: number | null;
          start_date: string | null;
          end_date: string | null;
          state: Database["public"]["Enums"]["subscription_state"] | null;
          frozen_from: string | null;
          amount_due_cents: number | null;
          discount_cents: number | null;
          paid_cents: number | null;
          balance_cents: number | null;
          status: string | null;
          days_left: number | null;
          created_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      adjust_points: {
        Args: { p_member: string; p_points: number; p_note: string };
        Returns: undefined;
      };
      cash_expected: {
        Args: { p_org: string; p_day: string };
        Returns: number;
      };
      change_staff_role: {
        Args: { p_org: string; p_user: string; p_role: Database["public"]["Enums"]["staff_role"] };
        Returns: undefined;
      };
      check_in: {
        Args: { p_org: string; p_qr_token: string };
        Returns: Json;
      };
      close_cash: {
        Args: { p_org: string; p_day: string; p_counted_cents: number; p_note?: string };
        Returns: Json;
      };
      create_invoice: {
        Args: { p_sub: string };
        Returns: string;
      };
      create_organization: {
        Args: { p_name: string };
        Returns: string;
      };
      create_subscription: {
        Args: { p_member: string; p_plan: string; p_start: string; p_discount_cents?: number; p_first_payment_cents?: number; p_method?: Database["public"]["Enums"]["payment_method"]; p_reference?: string };
        Returns: string;
      };
      get_public_card: {
        Args: { p_link_token: string };
        Returns: Json;
      };
      invite_staff: {
        Args: { p_org: string; p_email: string; p_role: Database["public"]["Enums"]["staff_role"] };
        Returns: string;
      };
      is_org_admin: {
        Args: { p_org: string };
        Returns: boolean;
      };
      is_org_member: {
        Args: { p_org: string };
        Returns: boolean;
      };
      is_org_owner: {
        Args: { p_org: string };
        Returns: boolean;
      };
      local_today: {
        Args: never;
        Returns: string;
      };
      log_reminder: {
        Args: { p_sub: string; p_kind: Database["public"]["Enums"]["reminder_kind"] };
        Returns: undefined;
      };
      manual_check_in: {
        Args: { p_member: string; p_reason: string };
        Returns: Json;
      };
      org_role: {
        Args: { p_org: string };
        Returns: Database["public"]["Enums"]["staff_role"];
      };
      record_payment: {
        Args: { p_sub: string; p_amount_cents: number; p_method: Database["public"]["Enums"]["payment_method"]; p_reference?: string; p_note?: string };
        Returns: string;
      };
      redeem_reward: {
        Args: { p_member: string; p_reward: string; p_note?: string };
        Returns: string;
      };
      regenerate_card: {
        Args: { p_member: string };
        Returns: undefined;
      };
      remove_staff: {
        Args: { p_org: string; p_user: string };
        Returns: undefined;
      };
      require_role: {
        Args: { p_org: string; p_level: string };
        Returns: Database["public"]["Enums"]["staff_role"];
      };
      set_subscription_state: {
        Args: { p_sub: string; p_action: string };
        Returns: undefined;
      };
      update_subscription: {
        Args: { p_sub: string; p_start: string; p_end: string; p_amount_due_cents: number };
        Returns: undefined;
      };
      validate_cash_closing: {
        Args: { p_id: string };
        Returns: undefined;
      };
      void_payment: {
        Args: { p_payment: string; p_reason: string };
        Returns: undefined;
      };
    };
    Enums: {
      checkin_method: "qr" | "manual";
      checkin_result: "accepted" | "refused";
      loyalty_kind: "welcome" | "visit" | "subscription" | "renewal" | "referral" | "redemption" | "adjustment" | "expiration";
      payment_method: "cash" | "transfer" | "card" | "cheque";
      reminder_kind: "expiry" | "unpaid";
      reward_type: "guest_pass" | "discount" | "free_days" | "goodie" | "partner" | "other";
      staff_role: "owner" | "manager" | "receptionist";
      subscription_state: "active" | "frozen" | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

