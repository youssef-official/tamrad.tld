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
      branches: {
        Row: {
          accepting_orders: boolean
          address: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          manager_id: string | null
          name: string
          phone: string | null
          slug: string
          tenant_id: string
          theme: Json
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          manager_id?: string | null
          name: string
          phone?: string | null
          slug: string
          tenant_id: string
          theme?: Json
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          manager_id?: string | null
          name?: string
          phone?: string | null
          slug?: string
          tenant_id?: string
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          assigned_user_id: string | null
          branch_id: string | null
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          is_loyalty_reward: boolean
          min_order_iqd: number
          tenant_id: string
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          assigned_user_id?: string | null
          branch_id?: string | null
          code: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_loyalty_reward?: boolean
          min_order_iqd?: number
          tenant_id: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          assigned_user_id?: string | null
          branch_id?: string | null
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_loyalty_reward?: boolean
          min_order_iqd?: number
          tenant_id?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          created_at: string
          full_address: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          full_address: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          full_address?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          branch_id: string | null
          center_lat: number | null
          center_lng: number | null
          created_at: string
          fee_iqd: number
          id: string
          is_active: boolean
          name: string
          radius_km: number | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          fee_iqd?: number
          id?: string
          is_active?: boolean
          name: string
          radius_km?: number | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string
          fee_iqd?: number
          id?: string
          is_active?: boolean
          name?: string
          radius_km?: number | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      driver_credentials: {
        Row: {
          code: string
          created_at: string
          driver_name: string
          driver_phone: string | null
          id: string
          is_active: boolean
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          driver_name: string
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          driver_name?: string
          driver_phone?: string | null
          id?: string
          is_active?: boolean
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          lat: number
          lng: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          lat: number
          lng: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          lat?: number
          lng?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_settlements: {
        Row: {
          amount_iqd: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          driver_id: string
          driver_note: string | null
          id: string
          note: string | null
          order_id: string | null
          owner_note: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["settlement_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_iqd: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          driver_id: string
          driver_note?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          owner_note?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_iqd?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          driver_id?: string
          driver_note?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          owner_note?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["settlement_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_settlements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_settlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          id: string
          points: number
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          points?: number
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          points?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_redemptions: {
        Row: {
          coupon_id: string | null
          created_at: string
          id: string
          milestone_number: number
          order_id: string | null
          reward_type: string
          reward_value_iqd: number
          tenant_id: string
          user_id: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          id?: string
          milestone_number: number
          order_id?: string | null
          reward_type: string
          reward_value_iqd?: number
          tenant_id: string
          user_id: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          id?: string
          milestone_number?: number
          order_id?: string | null
          reward_type?: string
          reward_value_iqd?: number
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          branch_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_iqd: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_iqd: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_iqd?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifier_groups: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          max_select: number
          menu_item_id: string
          min_select: number
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          menu_item_id: string
          min_select?: number
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          max_select?: number
          menu_item_id?: string
          min_select?: number
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifier_groups_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_modifier_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_modifier_options: {
        Row: {
          created_at: string
          extra_price_iqd: number
          group_id: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extra_price_iqd?: number
          group_id: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extra_price_iqd?: number
          group_id?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_modifier_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "menu_modifier_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_modifier_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number
          body: string
          created_at: string
          data: Json
          error: string | null
          id: string
          order_id: string | null
          sent_at: string | null
          status: string
          tenant_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          order_id?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          data?: Json
          error?: string | null
          id?: string
          order_id?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_driver_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_driver_id: string | null
          id: string
          order_id: string
          reason: string | null
          tenant_id: string
          to_driver_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_driver_id?: string | null
          id?: string
          order_id: string
          reason?: string | null
          tenant_id: string
          to_driver_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_driver_id?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          tenant_id?: string
          to_driver_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_driver_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_driver_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_driver_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_driver_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          order_id: string
          sender_id: string
          sender_role: string
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          order_id: string
          sender_id: string
          sender_role: string
          tenant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          order_id?: string
          sender_id?: string
          sender_role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          coupon_code: string | null
          created_at: string
          customer_address: string | null
          customer_id: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee_iqd: number
          discount_iqd: number
          driver_id: string | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          payment_collected: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          rejection_reason: string | null
          status: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          total_iqd: number
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          branch_id?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee_iqd?: number
          discount_iqd?: number
          driver_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number: string
          payment_collected?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"]
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id: string
          total_iqd?: number
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          branch_id?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_address?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_fee_iqd?: number
          discount_iqd?: number
          driver_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          payment_collected?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"]
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tenant_id?: string
          total_iqd?: number
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_zone_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          language: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id: string
          language?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          language?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          driver_id: string | null
          driver_rating: number | null
          food_rating: number | null
          id: string
          order_id: string
          restaurant_rating: number | null
          tenant_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          driver_id?: string | null
          driver_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id: string
          restaurant_rating?: number | null
          tenant_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          driver_id?: string | null
          driver_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id?: string
          restaurant_rating?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string | null
          reporter_id: string
          reporter_role: string
          resolution_note: string | null
          status: string
          subject: string
          target: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id?: string | null
          reporter_id: string
          reporter_role: string
          resolution_note?: string | null
          status?: string
          subject: string
          target: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string | null
          reporter_id?: string
          reporter_role?: string
          resolution_note?: string | null
          status?: string
          subject?: string
          target?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accepting_orders: boolean
          address: string | null
          created_at: string
          custom_domain: string | null
          description: string | null
          features_enabled: Json
          id: string
          is_active: boolean
          logo_url: string | null
          loyalty_enabled: boolean
          loyalty_reward_item_id: string | null
          loyalty_reward_type: string
          loyalty_reward_value_iqd: number
          loyalty_target_orders: number
          monthly_fee_iqd: number
          name: string
          phone: string | null
          slug: string
          subscription_expires_at: string | null
          subscription_notes: string | null
          subscription_plan: string
          subscription_started_at: string
          subscription_status: string
          theme_config: Json
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          address?: string | null
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          features_enabled?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_reward_item_id?: string | null
          loyalty_reward_type?: string
          loyalty_reward_value_iqd?: number
          loyalty_target_orders?: number
          monthly_fee_iqd?: number
          name: string
          phone?: string | null
          slug: string
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          subscription_plan?: string
          subscription_started_at?: string
          subscription_status?: string
          theme_config?: Json
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          address?: string | null
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          features_enabled?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_reward_item_id?: string | null
          loyalty_reward_type?: string
          loyalty_reward_value_iqd?: number
          loyalty_target_orders?: number
          monthly_fee_iqd?: number
          name?: string
          phone?: string | null
          slug?: string
          subscription_expires_at?: string | null
          subscription_notes?: string | null
          subscription_plan?: string
          subscription_started_at?: string
          subscription_status?: string
          theme_config?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_loyalty_reward_item_id_fkey"
            columns: ["loyalty_reward_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_iqd: number
          created_at: string
          id: string
          note: string | null
          order_id: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["wallet_txn_type"]
          user_id: string
        }
        Insert: {
          amount_iqd: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          tenant_id: string
          type: Database["public"]["Enums"]["wallet_txn_type"]
          user_id: string
        }
        Update: {
          amount_iqd?: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string | null
          tenant_id?: string
          type?: Database["public"]["Enums"]["wallet_txn_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_history_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "driver_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      driver_orders_history_view: {
        Row: {
          branch_id: string | null
          created_at: string | null
          customer_address: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee_iqd: number | null
          driver_id: string | null
          id: string | null
          order_number: string | null
          payment_collected: boolean | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pii_masked: boolean | null
          status: Database["public"]["Enums"]["order_status"] | null
          tenant_id: string | null
          total_iqd: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: never
          customer_phone?: never
          delivered_at?: string | null
          delivery_fee_iqd?: number | null
          driver_id?: string | null
          id?: string | null
          order_number?: string | null
          payment_collected?: boolean | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pii_masked?: never
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          total_iqd?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: never
          customer_phone?: never
          delivered_at?: string | null
          delivery_fee_iqd?: number | null
          driver_id?: string | null
          id?: string | null
          order_number?: string | null
          payment_collected?: boolean | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pii_masked?: never
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          total_iqd?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_orders_view: {
        Row: {
          branch_id: string | null
          created_at: string | null
          customer_address: string | null
          customer_id: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_fee_iqd: number | null
          driver_id: string | null
          id: string | null
          items: Json | null
          notes: string | null
          order_number: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          status: Database["public"]["Enums"]["order_status"] | null
          tenant_id: string | null
          total_iqd: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: never
          customer_id?: never
          customer_phone?: never
          delivered_at?: string | null
          delivery_fee_iqd?: number | null
          driver_id?: string | null
          id?: string | null
          items?: Json | null
          notes?: string | null
          order_number?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          total_iqd?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: never
          customer_id?: never
          customer_phone?: never
          delivered_at?: string | null
          delivery_fee_iqd?: number | null
          driver_id?: string | null
          id?: string | null
          items?: Json | null
          notes?: string | null
          order_number?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tenant_id?: string | null
          total_iqd?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_driver_to_tenant: { Args: { _phone: string }; Returns: Json }
      driver_request_settlement: {
        Args: { _amount_iqd: number; _note: string; _tenant_id: string }
        Returns: Json
      }
      ensure_owner_restaurant: { Args: never; Returns: Json }
      get_loyalty_progress: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: {
          delivered_count: number
          enabled: boolean
          last_milestone: number
          progress_in_cycle: number
          remaining_to_next: number
          reward_item_id: string
          reward_type: string
          reward_value_iqd: number
          target_orders: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      owner_approve_settlement: {
        Args: { _approve: boolean; _note: string; _settlement_id: string }
        Returns: Json
      }
      owner_tenant_id: { Args: { _user_id: string }; Returns: string }
      remove_driver_from_tenant: { Args: { _user_id: string }; Returns: Json }
      reorder_from: { Args: { _order_id: string }; Returns: Json }
      transfer_order_driver: {
        Args: { _new_driver_id: string; _order_id: string; _reason: string }
        Returns: Json
      }
      user_tenant_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "super_admin" | "owner" | "driver" | "customer"
      discount_type: "percent" | "fixed"
      order_status:
        | "pending"
        | "accepted"
        | "preparing"
        | "on_the_way"
        | "delivered"
        | "cancelled"
        | "rejected"
      payment_method: "cash" | "credit" | "wallet"
      settlement_status:
        | "pending"
        | "paid"
        | "pending_approval"
        | "approved"
        | "rejected"
      wallet_txn_type: "credit" | "debit"
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
      app_role: ["super_admin", "owner", "driver", "customer"],
      discount_type: ["percent", "fixed"],
      order_status: [
        "pending",
        "accepted",
        "preparing",
        "on_the_way",
        "delivered",
        "cancelled",
        "rejected",
      ],
      payment_method: ["cash", "credit", "wallet"],
      settlement_status: [
        "pending",
        "paid",
        "pending_approval",
        "approved",
        "rejected",
      ],
      wallet_txn_type: ["credit", "debit"],
    },
  },
} as const
