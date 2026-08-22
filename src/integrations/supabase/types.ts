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
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          delivery_radius_km: number
          id: boolean
          notifications_enabled: boolean
          request_expiry_minutes: number
          support_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_radius_km?: number
          id?: boolean
          notifications_enabled?: boolean
          request_expiry_minutes?: number
          support_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_radius_km?: number
          id?: boolean
          notifications_enabled?: boolean
          request_expiry_minutes?: number
          support_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          admin_notes: string | null
          body: string
          created_at: string
          id: string
          order_id: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          body: string
          created_at?: string
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          body?: string
          created_at?: string
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          available_cash: number
          bank_details: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          date_of_birth: string | null
          emergency_contact: string | null
          gov_id_number: string | null
          gov_id_url: string | null
          home_address: string | null
          id: string
          insurance_url: string | null
          is_available: boolean
          is_busy: boolean
          is_online: boolean
          licence_url: string | null
          location_updated_at: string | null
          payout_upi: string | null
          profile_photo_url: string | null
          puc_url: string | null
          rating_avg: number
          rating_count: number
          rc_url: string | null
          selfie_url: string | null
          updated_at: string
          vehicle_number: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verification_notes: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          available_cash?: number
          bank_details?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          date_of_birth?: string | null
          emergency_contact?: string | null
          gov_id_number?: string | null
          gov_id_url?: string | null
          home_address?: string | null
          id: string
          insurance_url?: string | null
          is_available?: boolean
          is_busy?: boolean
          is_online?: boolean
          licence_url?: string | null
          location_updated_at?: string | null
          payout_upi?: string | null
          profile_photo_url?: string | null
          puc_url?: string | null
          rating_avg?: number
          rating_count?: number
          rc_url?: string | null
          selfie_url?: string | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          available_cash?: number
          bank_details?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          date_of_birth?: string | null
          emergency_contact?: string | null
          gov_id_number?: string | null
          gov_id_url?: string | null
          home_address?: string | null
          id?: string
          insurance_url?: string | null
          is_available?: boolean
          is_busy?: boolean
          is_online?: boolean
          licence_url?: string | null
          location_updated_at?: string | null
          payout_upi?: string | null
          profile_photo_url?: string | null
          puc_url?: string | null
          rating_avg?: number
          rating_count?: number
          rc_url?: string | null
          selfie_url?: string | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_address: string
          customer_lat: number | null
          customer_lng: number | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_charge: number
          delivery_otp: string | null
          driver_id: string | null
          expires_at: string | null
          id: string
          order_amount: number
          order_description: string
          otp_verified: boolean
          out_for_delivery_at: string | null
          payment_method: string
          payment_received_at: string | null
          picked_up_at: string | null
          pickup_lat: number
          pickup_lng: number
          pickup_notes: string | null
          radius_km: number
          reached_shop_at: string | null
          shop_id: string
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_address: string
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_charge: number
          delivery_otp?: string | null
          driver_id?: string | null
          expires_at?: string | null
          id?: string
          order_amount: number
          order_description: string
          otp_verified?: boolean
          out_for_delivery_at?: string | null
          payment_method?: string
          payment_received_at?: string | null
          picked_up_at?: string | null
          pickup_lat: number
          pickup_lng: number
          pickup_notes?: string | null
          radius_km?: number
          reached_shop_at?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_address?: string
          customer_lat?: number | null
          customer_lng?: number | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_charge?: number
          delivery_otp?: string | null
          driver_id?: string | null
          expires_at?: string | null
          id?: string
          order_amount?: number
          order_description?: string
          otp_verified?: boolean
          out_for_delivery_at?: string | null
          payment_method?: string
          payment_received_at?: string | null
          picked_up_at?: string | null
          pickup_lat?: number
          pickup_lng?: number
          pickup_notes?: string | null
          radius_km?: number
          reached_shop_at?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shopkeepers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          order_id: string
          ratee_id: string
          rater_id: string
          review: string | null
          stars: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          ratee_id: string
          rater_id: string
          review?: string | null
          stars: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          ratee_id?: string
          rater_id?: string
          review?: string | null
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shopkeepers: {
        Row: {
          address: string
          approval_status: Database["public"]["Enums"]["approval_status"]
          created_at: string
          gov_id_url: string | null
          gst_number: string | null
          id: string
          latitude: number
          licence_number: string | null
          longitude: number
          owner_name: string | null
          pan_number: string | null
          rating_avg: number
          rating_count: number
          shop_category: string
          shop_name: string
          shop_phone: string | null
          shop_photo_url: string | null
          trade_license_url: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          address: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          created_at?: string
          gov_id_url?: string | null
          gst_number?: string | null
          id: string
          latitude: number
          licence_number?: string | null
          longitude: number
          owner_name?: string | null
          pan_number?: string | null
          rating_avg?: number
          rating_count?: number
          shop_category: string
          shop_name: string
          shop_phone?: string | null
          shop_photo_url?: string | null
          trade_license_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          address?: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          created_at?: string
          gov_id_url?: string | null
          gst_number?: string | null
          id?: string
          latitude?: number
          licence_number?: string | null
          longitude?: number
          owner_name?: string | null
          pan_number?: string | null
          rating_avg?: number
          rating_count?: number
          shop_category?: string
          shop_name?: string
          shop_phone?: string | null
          shop_photo_url?: string | null
          trade_license_url?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      accept_order: {
        Args: { p_lat: number; p_lng: number; p_order_id: string }
        Returns: Json
      }
      advance_order: {
        Args: {
          p_order_id: string
          p_otp?: string
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: Json
      }
      expire_stale_orders: { Args: never; Returns: undefined }
      get_settings: {
        Args: never
        Returns: {
          created_at: string
          delivery_radius_km: number
          id: boolean
          notifications_enabled: boolean
          request_expiry_minutes: number
          support_number: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "app_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      is_active_driver: { Args: never; Returns: boolean }
      is_driver_of_order_shop: { Args: { _shop: string }; Returns: boolean }
      is_order_counterparty: { Args: { _other: string }; Returns: boolean }
      is_shop_of_order_driver: { Args: { _driver: string }; Returns: boolean }
      nearby_orders: {
        Args: { driver_lat: number; driver_lng: number }
        Returns: {
          created_at: string
          customer_address: string
          customer_name: string
          delivery_charge: number
          distance_km: number
          expires_at: string
          id: string
          order_amount: number
          order_description: string
          payment_method: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          pickup_notes: string
          shop_id: string
          shop_name: string
          shop_phone: string
          total_amount: number
        }[]
      }
      resend_order: { Args: { p_order_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "shopkeeper" | "driver" | "admin"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "suspended"
        | "blocked"
      complaint_status: "open" | "resolved" | "closed"
      order_status:
        | "pending"
        | "accepted"
        | "reached_shop"
        | "payment_received"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "searching"
        | "going_to_shop"
        | "arrived_at_shop"
        | "picked_up"
        | "going_to_customer"
        | "arrived_at_customer"
        | "expired"
        | "no_driver_found"
      vehicle_type: "walking" | "cycle" | "bike" | "car"
      verification_status:
        | "pending"
        | "verified"
        | "active"
        | "rejected"
        | "resubmit"
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
      app_role: ["shopkeeper", "driver", "admin"],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "suspended",
        "blocked",
      ],
      complaint_status: ["open", "resolved", "closed"],
      order_status: [
        "pending",
        "accepted",
        "reached_shop",
        "payment_received",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "searching",
        "going_to_shop",
        "arrived_at_shop",
        "picked_up",
        "going_to_customer",
        "arrived_at_customer",
        "expired",
        "no_driver_found",
      ],
      vehicle_type: ["walking", "cycle", "bike", "car"],
      verification_status: [
        "pending",
        "verified",
        "active",
        "rejected",
        "resubmit",
      ],
    },
  },
} as const
