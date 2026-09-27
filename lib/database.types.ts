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
      adblue_logs: {
        Row: {
          adblue_date: string
          adblue_log_id: number
          adblue_rate_per_litre: number
          adblue_vendor: string | null
          created_at: string
          filling_odometer_km: number
          is_tank_full: boolean
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_adblue_cost: number
          trip_id: number | null
          vehicle_id: number
          vendor_id: number | null
        }
        Insert: {
          adblue_date?: string
          adblue_log_id?: number
          adblue_rate_per_litre: number
          adblue_vendor?: string | null
          created_at?: string
          filling_odometer_km: number
          is_tank_full?: boolean
          litres_filled: number
          lr_number?: string | null
          remarks?: string | null
          total_adblue_cost: number
          trip_id?: number | null
          vehicle_id: number
          vendor_id?: number | null
        }
        Update: {
          adblue_date?: string
          adblue_log_id?: number
          adblue_rate_per_litre?: number
          adblue_vendor?: string | null
          created_at?: string
          filling_odometer_km?: number
          is_tank_full?: boolean
          litres_filled?: number
          lr_number?: string | null
          remarks?: string | null
          total_adblue_cost?: number
          trip_id?: number | null
          vehicle_id?: number
          vendor_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "adblue_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_km_anomalies"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "adblue_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "adblue_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "adblue_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "adblue_logs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      app_users: {
        Row: {
          created_at: string | null
          password: string
          role: string
          user_id: number
          username: string
        }
        Insert: {
          created_at?: string | null
          password: string
          role?: string
          user_id?: number
          username: string
        }
        Update: {
          created_at?: string | null
          password?: string
          role?: string
          user_id?: number
          username?: string
        }
        Relationships: []
      }
      archive_trucks_deprecated: {
        Row: {
          carrying_capacity_tons: number
          created_at: string | null
          current_status: string | null
          fc_expiry_date: string | null
          id: number
          insurance_expiry_date: string | null
          is_active: boolean | null
          np_expiry_date: string | null
          puc_expiry_date: string | null
          qtax_expiry_date: string | null
          state_permit_expiry_date: string | null
          status_remarks: string | null
          status_updated_at: string | null
          tank_cert_expiry_date: string | null
          truck_type: string
          vehicle_number: string
        }
        Insert: {
          carrying_capacity_tons?: number
          created_at?: string | null
          current_status?: string | null
          fc_expiry_date?: string | null
          id?: number
          insurance_expiry_date?: string | null
          is_active?: boolean | null
          np_expiry_date?: string | null
          puc_expiry_date?: string | null
          qtax_expiry_date?: string | null
          state_permit_expiry_date?: string | null
          status_remarks?: string | null
          status_updated_at?: string | null
          tank_cert_expiry_date?: string | null
          truck_type: string
          vehicle_number: string
        }
        Update: {
          carrying_capacity_tons?: number
          created_at?: string | null
          current_status?: string | null
          fc_expiry_date?: string | null
          id?: number
          insurance_expiry_date?: string | null
          is_active?: boolean | null
          np_expiry_date?: string | null
          puc_expiry_date?: string | null
          qtax_expiry_date?: string | null
          state_permit_expiry_date?: string | null
          status_remarks?: string | null
          status_updated_at?: string | null
          tank_cert_expiry_date?: string | null
          truck_type?: string
          vehicle_number?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          branch_code: string
          branch_id: number
          branch_name: string
          created_at: string | null
          is_active: boolean | null
          location: string | null
        }
        Insert: {
          branch_code: string
          branch_id?: number
          branch_name: string
          created_at?: string | null
          is_active?: boolean | null
          location?: string | null
        }
        Update: {
          branch_code?: string
          branch_id?: number
          branch_name?: string
          created_at?: string | null
          is_active?: boolean | null
          location?: string | null
        }
        Relationships: []
      }
      daily_ai_audits: {
        Row: {
          anomalies: Json | null
          audit_date: string
          audit_id: string
          created_at: string | null
          efficiency_leaks: Json | null
          retention_suggestions: Json | null
        }
        Insert: {
          anomalies?: Json | null
          audit_date?: string
          audit_id?: string
          created_at?: string | null
          efficiency_leaks?: Json | null
          retention_suggestions?: Json | null
        }
        Update: {
          anomalies?: Json | null
          audit_date?: string
          audit_id?: string
          created_at?: string | null
          efficiency_leaks?: Json | null
          retention_suggestions?: Json | null
        }
        Relationships: []
      }
      destinations_freight_master: {
        Row: {
          capacity_tons: string
          cargo_category: string | null
          cargo_type: string
          created_at: string | null
          destination_id: number
          destination_name: string
          freight_rate_per_ton: number
          is_active: boolean | null
          max_km_tolerance_pct: number
          min_km_tolerance_pct: number
          origin: string
          standard_km: number | null
        }
        Insert: {
          capacity_tons?: string
          cargo_category?: string | null
          cargo_type: string
          created_at?: string | null
          destination_id?: number
          destination_name: string
          freight_rate_per_ton: number
          is_active?: boolean | null
          max_km_tolerance_pct?: number
          min_km_tolerance_pct?: number
          origin: string
          standard_km?: number | null
        }
        Update: {
          capacity_tons?: string
          cargo_category?: string | null
          cargo_type?: string
          created_at?: string | null
          destination_id?: number
          destination_name?: string
          freight_rate_per_ton?: number
          is_active?: boolean | null
          max_km_tolerance_pct?: number
          min_km_tolerance_pct?: number
          origin?: string
          standard_km?: number | null
        }
        Relationships: []
      }
      diesel_fuel_logs: {
        Row: {
          created_at: string | null
          diesel_category: string
          diesel_rate_per_litre: number
          filling_odometer_km: number | null
          fuel_date: string
          fuel_log_id: number
          fuel_station_vendor: string | null
          is_tank_full: boolean | null
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_fuel_cost: number
          trip_id: number | null
          vehicle_id: number | null
        }
        Insert: {
          created_at?: string | null
          diesel_category?: string
          diesel_rate_per_litre: number
          filling_odometer_km?: number | null
          fuel_date?: string
          fuel_log_id?: number
          fuel_station_vendor?: string | null
          is_tank_full?: boolean | null
          litres_filled?: number
          lr_number?: string | null
          remarks?: string | null
          total_fuel_cost: number
          trip_id?: number | null
          vehicle_id?: number | null
        }
        Update: {
          created_at?: string | null
          diesel_category?: string
          diesel_rate_per_litre?: number
          filling_odometer_km?: number | null
          fuel_date?: string
          fuel_log_id?: number
          fuel_station_vendor?: string | null
          is_tank_full?: boolean | null
          litres_filled?: number
          lr_number?: string | null
          remarks?: string | null
          total_fuel_cost?: number
          trip_id?: number | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_fuel_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_km_anomalies"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "diesel_fuel_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "diesel_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "diesel_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      driver_advances: {
        Row: {
          advance_date: string
          advance_id: number
          amount: number
          created_at: string | null
          driver_id: number | null
          payment_mode: string | null
          remarks: string | null
          trip_id: number | null
        }
        Insert: {
          advance_date?: string
          advance_id?: never
          amount?: number
          created_at?: string | null
          driver_id?: number | null
          payment_mode?: string | null
          remarks?: string | null
          trip_id?: number | null
        }
        Update: {
          advance_date?: string
          advance_id?: never
          amount?: number
          created_at?: string | null
          driver_id?: number | null
          payment_mode?: string | null
          remarks?: string | null
          trip_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_advances_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "driver_advances_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_km_anomalies"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "driver_advances_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      driver_bata_master: {
        Row: {
          bata_rule_id: number
          capacity_tons: string | null
          cargo_type: string | null
          created_at: string | null
          destination_name: string
          origin: string | null
          standard_bata_inr: number
          vehicle_id: number | null
        }
        Insert: {
          bata_rule_id?: number
          capacity_tons?: string | null
          cargo_type?: string | null
          created_at?: string | null
          destination_name: string
          origin?: string | null
          standard_bata_inr?: number
          vehicle_id?: number | null
        }
        Update: {
          bata_rule_id?: number
          capacity_tons?: string | null
          cargo_type?: string | null
          created_at?: string | null
          destination_name?: string
          origin?: string | null
          standard_bata_inr?: number
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_bata_master_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_bata_master_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      driver_direct_advances: {
        Row: {
          advance_date: string
          advance_id: number
          advance_type: string | null
          amount_inr: number
          created_at: string | null
          driver_id: number
          is_settled: boolean | null
          payment_mode: string | null
          reference_remarks: string | null
          settled_at: string | null
        }
        Insert: {
          advance_date?: string
          advance_id?: number
          advance_type?: string | null
          amount_inr: number
          created_at?: string | null
          driver_id: number
          is_settled?: boolean | null
          payment_mode?: string | null
          reference_remarks?: string | null
          settled_at?: string | null
        }
        Update: {
          advance_date?: string
          advance_id?: number
          advance_type?: string | null
          amount_inr?: number
          created_at?: string | null
          driver_id?: number
          is_settled?: boolean | null
          payment_mode?: string | null
          reference_remarks?: string | null
          settled_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_direct_advances_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      driver_pending_entries: {
        Row: {
          amount_inr: number
          created_at: string | null
          driver_code: string | null
          entry_id: number
          entry_type: string
          litres: number | null
          odometer_km: number | null
          receipt_remarks: string | null
          rejection_reason: string | null
          status: string | null
          submitted_at: string | null
          vehicle_id: number | null
        }
        Insert: {
          amount_inr: number
          created_at?: string | null
          driver_code?: string | null
          entry_id?: number
          entry_type: string
          litres?: number | null
          odometer_km?: number | null
          receipt_remarks?: string | null
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          vehicle_id?: number | null
        }
        Update: {
          amount_inr?: number
          created_at?: string | null
          driver_code?: string | null
          entry_id?: number
          entry_type?: string
          litres?: number | null
          odometer_km?: number | null
          receipt_remarks?: string | null
          rejection_reason?: string | null
          status?: string | null
          submitted_at?: string | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_pending_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "driver_pending_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      driver_sessions: {
        Row: {
          created_at: string
          driver_id: number
          expires_at: string
          last_seen_at: string
          revoked_at: string | null
          session_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          driver_id: number
          expires_at: string
          last_seen_at?: string
          revoked_at?: string | null
          session_id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          driver_id?: number
          expires_at?: string
          last_seen_at?: string
          revoked_at?: string | null
          session_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_sessions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
        ]
      }
      drivers: {
        Row: {
          branch_id: number | null
          created_at: string | null
          driver_code: string
          driver_id: number
          full_name: string
          is_active: boolean | null
          license_expiry_date: string | null
          license_number: string
          phone_number: string
          pin: string | null
          pin_hash: string | null
        }
        Insert: {
          branch_id?: number | null
          created_at?: string | null
          driver_code: string
          driver_id?: number
          full_name: string
          is_active?: boolean | null
          license_expiry_date?: string | null
          license_number: string
          phone_number: string
          pin?: string | null
          pin_hash?: string | null
        }
        Update: {
          branch_id?: number | null
          created_at?: string | null
          driver_code?: string
          driver_id?: number
          full_name?: string
          is_active?: boolean | null
          license_expiry_date?: string | null
          license_number?: string
          phone_number?: string
          pin?: string | null
          pin_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string | null
          expense_date: string
          expense_id: number
          vehicle_id: number | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          expense_id?: never
          vehicle_id?: number | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          expense_id?: never
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      fleet_tyre_cost_entries: {
        Row: {
          amount: number
          cost_entry_id: number
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_type: string
          event_id: number | null
          invoice_number: string | null
          tyre_id: number | null
          vehicle_id: number | null
          vendor_id: number | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          cost_entry_id?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_type: string
          event_id?: number | null
          invoice_number?: string | null
          tyre_id?: number | null
          vehicle_id?: number | null
          vendor_id?: number | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          cost_entry_id?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_type?: string
          event_id?: number | null
          invoice_number?: string | null
          tyre_id?: number | null
          vehicle_id?: number | null
          vendor_id?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_tyre_cost_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "fleet_tyre_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fleet_tyre_cost_entries_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "fleet_tyres"
            referencedColumns: ["tyre_id"]
          },
          {
            foreignKeyName: "fleet_tyre_cost_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fleet_tyre_cost_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fleet_tyre_cost_entries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      fleet_tyre_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_at: string
          event_date: string
          event_id: number
          event_type: string
          invoice_number: string | null
          nsd_measurement: number | null
          odometer_km: number | null
          placement_position: string | null
          reason: string | null
          remarks: string | null
          tyre_condition_after: string | null
          tyre_condition_before: string | null
          tyre_id: number
          tyre_status_after: string | null
          tyre_status_before: string | null
          vehicle_id: number | null
          vendor_id: number | null
          vendor_name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_at?: string
          event_date?: string
          event_id?: number
          event_type: string
          invoice_number?: string | null
          nsd_measurement?: number | null
          odometer_km?: number | null
          placement_position?: string | null
          reason?: string | null
          remarks?: string | null
          tyre_condition_after?: string | null
          tyre_condition_before?: string | null
          tyre_id: number
          tyre_status_after?: string | null
          tyre_status_before?: string | null
          vehicle_id?: number | null
          vendor_id?: number | null
          vendor_name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_at?: string
          event_date?: string
          event_id?: number
          event_type?: string
          invoice_number?: string | null
          nsd_measurement?: number | null
          odometer_km?: number | null
          placement_position?: string | null
          reason?: string | null
          remarks?: string | null
          tyre_condition_after?: string | null
          tyre_condition_before?: string | null
          tyre_id?: number
          tyre_status_after?: string | null
          tyre_status_before?: string | null
          vehicle_id?: number | null
          vendor_id?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_tyre_events_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "fleet_tyres"
            referencedColumns: ["tyre_id"]
          },
          {
            foreignKeyName: "fleet_tyre_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fleet_tyre_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fleet_tyre_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      fleet_tyre_purchase_bill_items: {
        Row: {
          brand_model: string | null
          created_at: string
          item_id: number
          nsd_measurement: number | null
          purchase_bill_id: number
          serial_number: string
          tyre_id: number | null
          tyre_type: string | null
          unit_amount: number
        }
        Insert: {
          brand_model?: string | null
          created_at?: string
          item_id?: number
          nsd_measurement?: number | null
          purchase_bill_id: number
          serial_number: string
          tyre_id?: number | null
          tyre_type?: string | null
          unit_amount?: number
        }
        Update: {
          brand_model?: string | null
          created_at?: string
          item_id?: number
          nsd_measurement?: number | null
          purchase_bill_id?: number
          serial_number?: string
          tyre_id?: number | null
          tyre_type?: string | null
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "fleet_tyre_purchase_bill_items_purchase_bill_id_fkey"
            columns: ["purchase_bill_id"]
            isOneToOne: false
            referencedRelation: "fleet_tyre_purchase_bills"
            referencedColumns: ["purchase_bill_id"]
          },
          {
            foreignKeyName: "fleet_tyre_purchase_bill_items_tyre_id_fkey"
            columns: ["tyre_id"]
            isOneToOne: false
            referencedRelation: "fleet_tyres"
            referencedColumns: ["tyre_id"]
          },
        ]
      }
      fleet_tyre_purchase_bills: {
        Row: {
          bill_date: string
          created_at: string
          created_by: string | null
          invoice_date: string | null
          invoice_number: string | null
          payable_id: number | null
          payment_status: string
          purchase_bill_id: number
          remarks: string | null
          subtotal_amount: number
          tax_amount: number
          total_bill_amount: number
          tyre_count: number
          vendor_id: number | null
          vendor_name: string
        }
        Insert: {
          bill_date?: string
          created_at?: string
          created_by?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          payable_id?: number | null
          payment_status?: string
          purchase_bill_id?: number
          remarks?: string | null
          subtotal_amount?: number
          tax_amount?: number
          total_bill_amount?: number
          tyre_count?: number
          vendor_id?: number | null
          vendor_name: string
        }
        Update: {
          bill_date?: string
          created_at?: string
          created_by?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          payable_id?: number | null
          payment_status?: string
          purchase_bill_id?: number
          remarks?: string | null
          subtotal_amount?: number
          tax_amount?: number
          total_bill_amount?: number
          tyre_count?: number
          vendor_id?: number | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_tyre_purchase_bills_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "vendor_payables"
            referencedColumns: ["payable_id"]
          },
          {
            foreignKeyName: "fleet_tyre_purchase_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      fleet_tyres: {
        Row: {
          brand_model: string | null
          condition_status: string | null
          current_retread_count: number
          last_mount_odo: number | null
          last_retread_date: string | null
          last_retread_vendor: string | null
          nsd_measurement: number | null
          placement_position: string | null
          purchase_bill_amount: number | null
          purchase_date: string | null
          purchase_invoice_number: string | null
          purchase_vendor: string | null
          recorded_date: string | null
          retread_rejected: boolean
          serial_number: string | null
          total_km_run: number | null
          tyre_id: number
          tyre_status: string | null
          tyre_type: string | null
          vehicle_id: number | null
        }
        Insert: {
          brand_model?: string | null
          condition_status?: string | null
          current_retread_count?: number
          last_mount_odo?: number | null
          last_retread_date?: string | null
          last_retread_vendor?: string | null
          nsd_measurement?: number | null
          placement_position?: string | null
          purchase_bill_amount?: number | null
          purchase_date?: string | null
          purchase_invoice_number?: string | null
          purchase_vendor?: string | null
          recorded_date?: string | null
          retread_rejected?: boolean
          serial_number?: string | null
          total_km_run?: number | null
          tyre_id?: number
          tyre_status?: string | null
          tyre_type?: string | null
          vehicle_id?: number | null
        }
        Update: {
          brand_model?: string | null
          condition_status?: string | null
          current_retread_count?: number
          last_mount_odo?: number | null
          last_retread_date?: string | null
          last_retread_vendor?: string | null
          nsd_measurement?: number | null
          placement_position?: string | null
          purchase_bill_amount?: number | null
          purchase_date?: string | null
          purchase_invoice_number?: string | null
          purchase_vendor?: string | null
          recorded_date?: string | null
          retread_rejected?: boolean
          serial_number?: string | null
          total_km_run?: number | null
          tyre_id?: number
          tyre_status?: string | null
          tyre_type?: string | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_tyres_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fleet_tyres_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          is_active: boolean
          item_code: string
          item_id: number
          item_name: string
          minimum_stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          is_active?: boolean
          item_code: string
          item_id?: number
          item_name: string
          minimum_stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          is_active?: boolean
          item_code?: string
          item_id?: number
          item_name?: string
          minimum_stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_purchase_bills: {
        Row: {
          bill_date: string
          created_at: string
          created_by: string | null
          invoice_date: string | null
          invoice_number: string | null
          payable_id: number | null
          payment_status: string
          purchase_bill_id: number
          remarks: string | null
          subtotal_amount: number
          tax_amount: number
          total_bill_amount: number
          vendor_id: number
        }
        Insert: {
          bill_date?: string
          created_at?: string
          created_by?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          payable_id?: number | null
          payment_status?: string
          purchase_bill_id?: number
          remarks?: string | null
          subtotal_amount?: number
          tax_amount?: number
          total_bill_amount?: number
          vendor_id: number
        }
        Update: {
          bill_date?: string
          created_at?: string
          created_by?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          payable_id?: number | null
          payment_status?: string
          purchase_bill_id?: number
          remarks?: string | null
          subtotal_amount?: number
          tax_amount?: number
          total_bill_amount?: number
          vendor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_bills_payable_fk"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "vendor_payables"
            referencedColumns: ["payable_id"]
          },
          {
            foreignKeyName: "inventory_purchase_bills_vendor_fk"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      inventory_purchase_items: {
        Row: {
          created_at: string
          item_id: number
          line_amount: number | null
          purchase_bill_id: number
          purchase_item_id: number
          quantity: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          item_id: number
          line_amount?: number | null
          purchase_bill_id: number
          purchase_item_id?: number
          quantity: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          item_id?: number
          line_amount?: number | null
          purchase_bill_id?: number
          purchase_item_id?: number
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_items_bill_fk"
            columns: ["purchase_bill_id"]
            isOneToOne: false
            referencedRelation: "inventory_purchase_bills"
            referencedColumns: ["purchase_bill_id"]
          },
          {
            foreignKeyName: "inventory_purchase_items_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_purchase_items_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_balance"
            referencedColumns: ["item_id"]
          },
        ]
      }
      inventory_stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          item_id: number
          movement_id: number
          movement_type: string
          quantity: number
          reason: string | null
          reference_id: number | null
          reference_type: string | null
          vehicle_id: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          item_id: number
          movement_id?: number
          movement_type: string
          quantity: number
          reason?: string | null
          reference_id?: number | null
          reference_type?: string | null
          vehicle_id?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          item_id?: number
          movement_id?: number
          movement_type?: string
          quantity?: number
          reason?: string | null
          reference_id?: number | null
          reference_type?: string | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_movements_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock_balance"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "inventory_stock_movements_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      pending_scans: {
        Row: {
          cargo_type: string | null
          created_at: string | null
          destination: string | null
          document_type: string
          image_url: string | null
          lr_number: string | null
          raw_json_result: Json | null
          scan_id: string
          source: string | null
          status: string | null
          tonnage_extracted: number | null
          truck_number: string | null
        }
        Insert: {
          cargo_type?: string | null
          created_at?: string | null
          destination?: string | null
          document_type: string
          image_url?: string | null
          lr_number?: string | null
          raw_json_result?: Json | null
          scan_id?: string
          source?: string | null
          status?: string | null
          tonnage_extracted?: number | null
          truck_number?: string | null
        }
        Update: {
          cargo_type?: string | null
          created_at?: string | null
          destination?: string | null
          document_type?: string
          image_url?: string | null
          lr_number?: string | null
          raw_json_result?: Json | null
          scan_id?: string
          source?: string | null
          status?: string | null
          tonnage_extracted?: number | null
          truck_number?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          setting_key: string
          setting_value: string
          updated_at: string | null
        }
        Insert: {
          setting_key: string
          setting_value: string
          updated_at?: string | null
        }
        Update: {
          setting_key?: string
          setting_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        Insert: {
          branch_id?: number | null
          breakdown_remarks?: string | null
          cash_advance_issued?: number | null
          created_at?: string | null
          destination: string
          destination_lat?: number | null
          destination_lng?: number | null
          diesel_filling_km?: number | null
          distance_basis?: string
          driver_bata?: number | null
          end_km?: number | null
          enroute_repairs_maintenance?: number | null
          freight_revenue: number
          fuel_expense?: number | null
          fuel_litres?: number | null
          halt_bata?: number | null
          is_tank_full?: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense?: number | null
          misc_trip_expense?: number | null
          origin: string
          origin_lat?: number | null
          origin_lng?: number | null
          pod_number?: string | null
          pod_received_date?: string | null
          pod_settlement_remarks?: string | null
          pod_status?: string | null
          primary_driver_id: number
          reached_at?: string | null
          received_weight_mt?: number | null
          returning_at?: string | null
          settled_at?: string | null
          settlement_remarks?: string | null
          settlement_status?: string | null
          shortage_bearer?: string | null
          shortage_mt?: number | null
          shortage_penalty_deduction?: number | null
          shortage_weight_mt?: number | null
          start_km?: number | null
          toll_fastag_expense?: number | null
          tonnage_loaded: number
          total_km_run?: number | null
          trip_closed_at?: string | null
          trip_end_date: string
          trip_id?: number
          trip_number: string
          trip_start_date: string
          trip_status?: string | null
          unloaded_at?: string | null
          unloaded_weight_mt?: number | null
          vehicle_id?: number | null
        }
        Update: {
          branch_id?: number | null
          breakdown_remarks?: string | null
          cash_advance_issued?: number | null
          created_at?: string | null
          destination?: string
          destination_lat?: number | null
          destination_lng?: number | null
          diesel_filling_km?: number | null
          distance_basis?: string
          driver_bata?: number | null
          end_km?: number | null
          enroute_repairs_maintenance?: number | null
          freight_revenue?: number
          fuel_expense?: number | null
          fuel_litres?: number | null
          halt_bata?: number | null
          is_tank_full?: boolean | null
          loaded_weight_mt?: number
          loading_unloading_expense?: number | null
          misc_trip_expense?: number | null
          origin?: string
          origin_lat?: number | null
          origin_lng?: number | null
          pod_number?: string | null
          pod_received_date?: string | null
          pod_settlement_remarks?: string | null
          pod_status?: string | null
          primary_driver_id?: number
          reached_at?: string | null
          received_weight_mt?: number | null
          returning_at?: string | null
          settled_at?: string | null
          settlement_remarks?: string | null
          settlement_status?: string | null
          shortage_bearer?: string | null
          shortage_mt?: number | null
          shortage_penalty_deduction?: number | null
          shortage_weight_mt?: number | null
          start_km?: number | null
          toll_fastag_expense?: number | null
          tonnage_loaded?: number
          total_km_run?: number | null
          trip_closed_at?: string | null
          trip_end_date?: string
          trip_id?: number
          trip_number?: string
          trip_start_date?: string
          trip_status?: string | null
          unloaded_at?: string | null
          unloaded_weight_mt?: number | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "trips_primary_driver_id_fkey"
            columns: ["primary_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["driver_id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      tyre_tracking: {
        Row: {
          created_at: string | null
          current_nsd_mm: number | null
          installation_date: string | null
          installation_odo: number | null
          status: string | null
          tyre_id: number
          tyre_serial_number: string
          vehicle_id: number | null
          wheel_position: string | null
        }
        Insert: {
          created_at?: string | null
          current_nsd_mm?: number | null
          installation_date?: string | null
          installation_odo?: number | null
          status?: string | null
          tyre_id?: number
          tyre_serial_number: string
          vehicle_id?: number | null
          wheel_position?: string | null
        }
        Update: {
          created_at?: string | null
          current_nsd_mm?: number | null
          installation_date?: string | null
          installation_odo?: number | null
          status?: string | null
          tyre_id?: number
          tyre_serial_number?: string
          vehicle_id?: number | null
          wheel_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tyre_tracking_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "tyre_tracking_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      vehicle_odometer_logs: {
        Row: {
          created_at: string
          entered_at: string
          entered_by: string | null
          odometer_km: number
          odometer_log_id: number
          reading_at: string
          reading_type: string
          reference_id: number | null
          remarks: string | null
          vehicle_id: number
        }
        Insert: {
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          odometer_km: number
          odometer_log_id?: number
          reading_at?: string
          reading_type: string
          reference_id?: number | null
          remarks?: string | null
          vehicle_id: number
        }
        Update: {
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          odometer_km?: number
          odometer_log_id?: number
          reading_at?: string
          reading_type?: string
          reference_id?: number | null
          remarks?: string | null
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_odometer_logs_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "vehicle_odometer_logs_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      vehicles: {
        Row: {
          carrying_capacity_tons: number
          created_at: string | null
          current_status: string | null
          fc_expiry_date: string | null
          gross_vehicle_weight_tons: number | null
          insurance_expiry_date: string | null
          is_active: boolean | null
          np_expiry_date: string | null
          odometer_working: boolean | null
          puc_expiry_date: string | null
          qtax_expiry_date: string | null
          state_permit_expiry_date: string | null
          status_remarks: string | null
          status_updated_at: string | null
          tank_cert_expiry_date: string | null
          truck_type: string
          vehicle_id: number
          vehicle_number: string
        }
        Insert: {
          carrying_capacity_tons?: number
          created_at?: string | null
          current_status?: string | null
          fc_expiry_date?: string | null
          gross_vehicle_weight_tons?: number | null
          insurance_expiry_date?: string | null
          is_active?: boolean | null
          np_expiry_date?: string | null
          odometer_working?: boolean | null
          puc_expiry_date?: string | null
          qtax_expiry_date?: string | null
          state_permit_expiry_date?: string | null
          status_remarks?: string | null
          status_updated_at?: string | null
          tank_cert_expiry_date?: string | null
          truck_type: string
          vehicle_id?: number
          vehicle_number: string
        }
        Update: {
          carrying_capacity_tons?: number
          created_at?: string | null
          current_status?: string | null
          fc_expiry_date?: string | null
          gross_vehicle_weight_tons?: number | null
          insurance_expiry_date?: string | null
          is_active?: boolean | null
          np_expiry_date?: string | null
          odometer_working?: boolean | null
          puc_expiry_date?: string | null
          qtax_expiry_date?: string | null
          state_permit_expiry_date?: string | null
          status_remarks?: string | null
          status_updated_at?: string | null
          tank_cert_expiry_date?: string | null
          truck_type?: string
          vehicle_id?: number
          vehicle_number?: string
        }
        Relationships: []
      }
      vendor_payables: {
        Row: {
          bill_amount: number
          bill_date: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          invoice_number: string | null
          outstanding_amount: number | null
          paid_amount: number
          payable_id: number
          source_reference_id: number | null
          source_type: string
          status: string
          vendor_id: number
        }
        Insert: {
          bill_amount: number
          bill_date?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          invoice_number?: string | null
          outstanding_amount?: number | null
          paid_amount?: number
          payable_id?: number
          source_reference_id?: number | null
          source_type?: string
          status?: string
          vendor_id: number
        }
        Update: {
          bill_amount?: number
          bill_date?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          invoice_number?: string | null
          outstanding_amount?: number | null
          paid_amount?: number
          payable_id?: number
          source_reference_id?: number | null
          source_type?: string
          status?: string
          vendor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payables_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          payable_id: number
          payment_date: string
          payment_id: number
          payment_mode: string
          reference_number: string | null
          remarks: string | null
          vendor_id: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          payable_id: number
          payment_date?: string
          payment_id?: number
          payment_mode?: string
          reference_number?: string | null
          remarks?: string | null
          vendor_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          payable_id?: number
          payment_date?: string
          payment_id?: number
          payment_mode?: string
          reference_number?: string | null
          remarks?: string | null
          vendor_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_payable_id_fkey"
            columns: ["payable_id"]
            isOneToOne: false
            referencedRelation: "vendor_payables"
            referencedColumns: ["payable_id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          is_active: boolean
          phone_number: string | null
          tax_number: string | null
          vendor_id: number
          vendor_name: string
          vendor_subcategory: string | null
          vendor_type: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          is_active?: boolean
          phone_number?: string | null
          tax_number?: string | null
          vendor_id?: number
          vendor_name: string
          vendor_subcategory?: string | null
          vendor_type?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          is_active?: boolean
          phone_number?: string | null
          tax_number?: string | null
          vendor_id?: number
          vendor_name?: string
          vendor_subcategory?: string | null
          vendor_type?: string
        }
        Relationships: []
      }
      workshop_repairs: {
        Row: {
          breakdown_date: string
          created_at: string | null
          is_preventative: boolean | null
          mechanic_notes: string | null
          odometer_reading: number | null
          repair_category: string
          repair_id: number
          total_cost_inr: number | null
          vehicle_id: number | null
        }
        Insert: {
          breakdown_date: string
          created_at?: string | null
          is_preventative?: boolean | null
          mechanic_notes?: string | null
          odometer_reading?: number | null
          repair_category: string
          repair_id?: number
          total_cost_inr?: number | null
          vehicle_id?: number | null
        }
        Update: {
          breakdown_date?: string
          created_at?: string | null
          is_preventative?: boolean | null
          mechanic_notes?: string | null
          odometer_reading?: number | null
          repair_category?: string
          repair_id?: number
          total_cost_inr?: number | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workshop_repairs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "workshop_repairs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      workshop_spares_bills: {
        Row: {
          bill_date: string | null
          bill_id: number
          invoice_number: string | null
          spare_parts_details: string | null
          total_bill_amount: number | null
          vehicle_id: number | null
          vendor_name: string | null
        }
        Insert: {
          bill_date?: string | null
          bill_id?: number
          invoice_number?: string | null
          spare_parts_details?: string | null
          total_bill_amount?: number | null
          vehicle_id?: number | null
          vendor_name?: string | null
        }
        Update: {
          bill_date?: string | null
          bill_id?: number
          invoice_number?: string | null
          spare_parts_details?: string | null
          total_bill_amount?: number | null
          vehicle_id?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workshop_spares_bills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "workshop_spares_bills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_corporate_fleet_retention"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
    }
    Views: {
      inventory_stock_balance: {
        Row: {
          category: string | null
          current_stock: number | null
          is_active: boolean | null
          item_code: string | null
          item_id: number | null
          item_name: string | null
          minimum_stock: number | null
          unit: string | null
        }
        Relationships: []
      }
      trip_km_anomalies: {
        Row: {
          actual_km: number | null
          destination: string | null
          end_km: number | null
          km_status: string | null
          loaded_weight_mt: number | null
          max_km: number | null
          max_km_tolerance_pct: number | null
          min_km: number | null
          min_km_tolerance_pct: number | null
          origin: string | null
          route_id: number | null
          standard_km: number | null
          start_km: number | null
          trip_id: number | null
          trip_number: string | null
          variance_pct: number | null
        }
        Relationships: []
      }
      view_corporate_fleet_retention: {
        Row: {
          carrying_capacity_tons: number | null
          gross_freight_revenue_inr: number | null
          net_retained_margin_inr: number | null
          total_adhoc_operating_costs_inr: number | null
          total_delivered_mt: number | null
          total_direct_trip_costs_inr: number | null
          total_driver_bata_inr: number | null
          total_fuel_expense_inr: number | null
          total_fuel_litres: number | null
          total_km_run: number | null
          total_loaded_mt: number | null
          total_operating_days: number | null
          total_shortage_mt: number | null
          total_shortage_penalty_inr: number | null
          total_toll_expense_inr: number | null
          total_trips_completed: number | null
          total_trips_logged: number | null
          truck_type: string | null
          vehicle_id: number | null
          vehicle_number: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_driver_entry: { Args: { p_entry_id: number }; Returns: Json }
      approve_driver_fuel_atomic: {
        Args: {
          p_entered_by?: string
          p_entry_id: number
          p_final_cost: number
        }
        Returns: {
          created_at: string | null
          diesel_category: string
          diesel_rate_per_litre: number
          filling_odometer_km: number | null
          fuel_date: string
          fuel_log_id: number
          fuel_station_vendor: string | null
          is_tank_full: boolean | null
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_fuel_cost: number
          trip_id: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "diesel_fuel_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      authenticate_driver: {
        Args: { p_driver_code: string; p_pin: string }
        Returns: {
          branch_id: number
          driver_code: string
          driver_id: number
          full_name: string
          phone_number: string
        }[]
      }
      authenticate_driver_session: {
        Args: { p_driver_code: string; p_pin: string }
        Returns: {
          branch_id: number
          driver_code: string
          driver_id: number
          full_name: string
          phone_number: string
          session_expires_at: string
          session_token: string
        }[]
      }
      cancel_driver_pending_entry_atomic: {
        Args: { p_entry_id: number; p_session_token: string }
        Returns: {
          amount_inr: number
          created_at: string | null
          driver_code: string | null
          entry_id: number
          entry_type: string
          litres: number | null
          odometer_km: number | null
          receipt_remarks: string | null
          rejection_reason: string | null
          status: string | null
          submitted_at: string | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "driver_pending_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_route_km: {
        Args: { p_actual_km: number; p_destination_id: number }
        Returns: {
          actual_km: number
          max_km: number
          min_km: number
          standard_km: number
          status: string
        }[]
      }
      close_driver_trip_atomic: {
        Args: {
          p_end_km: number
          p_entered_by?: string
          p_reading_at?: string
          p_trip_id: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_driver_trip_session_atomic: {
        Args: {
          p_end_km: number
          p_reading_at?: string
          p_session_token: string
          p_trip_id: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_pod_atomic: {
        Args: {
          p_add_diesel: number
          p_claims: number
          p_closing_date: string
          p_diesel_rate_per_litre: number
          p_filling_odometer_km: number
          p_halt_bata: number
          p_is_tank_full: boolean
          p_pod_number: string
          p_scan_id?: string
          p_shortage_mt: number
          p_trip_id: number
          p_unloaded_weight_mt: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_tyre_retread_atomic: {
        Args: {
          p_created_by?: string
          p_disposition?: string
          p_invoice_number?: string
          p_mount_odo?: number
          p_placement_position?: string
          p_reason?: string
          p_result: string
          p_result_date?: string
          p_retread_amount?: number
          p_returned_nsd_measurement?: number
          p_tyre_id: number
          p_vehicle_id?: number
          p_vendor_id: number
        }
        Returns: Json
      }
      create_dispatch_trip_atomic: {
        Args: {
          p_cash_advance_issued: number
          p_destination: string
          p_driver_bata: number
          p_entered_by?: string
          p_freight_revenue: number
          p_fuel_expense: number
          p_fuel_litres: number
          p_is_tank_full: boolean
          p_origin: string
          p_primary_driver_id: number
          p_reading_at?: string
          p_start_km: number
          p_tonnage_loaded: number
          p_trip_number: string
          p_trip_start_date: string
          p_vehicle_id: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_inventory_item: {
        Args: {
          p_category?: string
          p_item_code: string
          p_item_name: string
          p_minimum_stock?: number
          p_unit?: string
        }
        Returns: {
          category: string
          created_at: string
          is_active: boolean
          item_code: string
          item_id: number
          item_name: string
          minimum_stock: number
          unit: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inventory_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_inventory_purchase_atomic: {
        Args: {
          p_bill_date: string
          p_created_by?: string
          p_invoice_date?: string
          p_invoice_number?: string
          p_items?: Json
          p_payment_status?: string
          p_remarks?: string
          p_subtotal_amount?: number
          p_tax_amount?: number
          p_total_bill_amount?: number
          p_vendor_id: number
        }
        Returns: Json
      }
      create_master_bata: {
        Args: {
          p_capacity_tons?: string
          p_cargo_type?: string
          p_destination_name: string
          p_origin?: string
          p_standard_bata_inr?: number
          p_vehicle_id?: number
        }
        Returns: {
          bata_rule_id: number
          capacity_tons: string | null
          cargo_type: string | null
          created_at: string | null
          destination_name: string
          origin: string | null
          standard_bata_inr: number
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "driver_bata_master"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_master_driver: {
        Args: {
          p_branch_id?: number
          p_full_name: string
          p_license_expiry_date?: string
          p_license_number: string
          p_phone_number: string
          p_pin?: string
        }
        Returns: {
          branch_id: number | null
          created_at: string | null
          driver_code: string
          driver_id: number
          full_name: string
          is_active: boolean | null
          license_expiry_date: string | null
          license_number: string
          phone_number: string
          pin: string | null
          pin_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "drivers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_master_freight: {
        Args: {
          p_capacity_tons: string
          p_cargo_category?: string
          p_cargo_type: string
          p_destination_name: string
          p_freight_rate_per_ton: number
          p_max_km_tolerance_pct?: number
          p_min_km_tolerance_pct?: number
          p_origin: string
          p_standard_km?: number
        }
        Returns: {
          capacity_tons: string
          cargo_category: string | null
          cargo_type: string
          created_at: string | null
          destination_id: number
          destination_name: string
          freight_rate_per_ton: number
          is_active: boolean | null
          max_km_tolerance_pct: number
          min_km_tolerance_pct: number
          origin: string
          standard_km: number | null
        }
        SetofOptions: {
          from: "*"
          to: "destinations_freight_master"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_master_vehicle: {
        Args: {
          p_carrying_capacity_tons?: number
          p_fc_expiry_date?: string
          p_gross_vehicle_weight_tons?: number
          p_insurance_expiry_date?: string
          p_np_expiry_date?: string
          p_puc_expiry_date?: string
          p_qtax_expiry_date?: string
          p_state_permit_expiry_date?: string
          p_tank_cert_expiry_date?: string
          p_truck_type: string
          p_vehicle_number: string
        }
        Returns: {
          carrying_capacity_tons: number
          created_at: string | null
          current_status: string | null
          fc_expiry_date: string | null
          gross_vehicle_weight_tons: number | null
          insurance_expiry_date: string | null
          is_active: boolean | null
          np_expiry_date: string | null
          odometer_working: boolean | null
          puc_expiry_date: string | null
          qtax_expiry_date: string | null
          state_permit_expiry_date: string | null
          status_remarks: string | null
          status_updated_at: string | null
          tank_cert_expiry_date: string | null
          truck_type: string
          vehicle_id: number
          vehicle_number: string
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_tyre_purchase_atomic: {
        Args: {
          p_bill_date: string
          p_created_by?: string
          p_invoice_date?: string
          p_invoice_number?: string
          p_items?: Json
          p_remarks?: string
          p_subtotal_amount?: number
          p_tax_amount?: number
          p_total_bill_amount?: number
          p_vendor_id: number
        }
        Returns: Json
      }
      create_vendor_atomic: {
        Args: {
          p_address?: string
          p_email?: string
          p_phone_number?: string
          p_tax_number?: string
          p_vendor_name: string
          p_vendor_subcategory?: string
          p_vendor_type: string
        }
        Returns: {
          address: string | null
          created_at: string
          email: string | null
          is_active: boolean
          phone_number: string | null
          tax_number: string | null
          vendor_id: number
          vendor_name: string
          vendor_subcategory: string | null
          vendor_type: string
        }
        SetofOptions: {
          from: "*"
          to: "vendors"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_workshop_bill_atomic: {
        Args: {
          p_bill_date?: string
          p_invoice_number?: string
          p_spare_parts_details?: string
          p_total_bill_amount?: number
          p_vehicle_id?: number
          p_vendor_name?: string
        }
        Returns: {
          bill_date: string | null
          bill_id: number
          invoice_number: string | null
          spare_parts_details: string | null
          total_bill_amount: number | null
          vehicle_id: number | null
          vendor_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "workshop_spares_bills"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_adblue_atomic: {
        Args: { p_adblue_log_id: number }
        Returns: undefined
      }
      delete_driver_advance_atomic: {
        Args: { p_advance_id: number }
        Returns: {
          advance_date: string
          advance_id: number
          advance_type: string | null
          amount_inr: number
          created_at: string | null
          driver_id: number
          is_settled: boolean | null
          payment_mode: string | null
          reference_remarks: string | null
          settled_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "driver_direct_advances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_fuel_atomic: {
        Args: { p_fuel_log_id: number }
        Returns: undefined
      }
      dispose_tyre_atomic: {
        Args: {
          p_buyer_vendor_id?: number
          p_created_by?: string
          p_disposition: string
          p_event_date?: string
          p_invoice_number?: string
          p_odometer_km?: number
          p_reason?: string
          p_recovery_amount?: number
          p_tyre_id: number
        }
        Returns: Json
      }
      find_route_km_standard:
        | {
            Args: {
              p_destination: string
              p_loaded_weight_mt: number
              p_origin: string
            }
            Returns: {
              destination_id: number
              max_km: number
              max_km_tolerance_pct: number
              min_km: number
              min_km_tolerance_pct: number
              standard_km: number
            }[]
          }
        | {
            Args: {
              p_cargo_type: string
              p_destination: string
              p_loaded_weight_mt: number
              p_origin: string
            }
            Returns: {
              destination_id: number
              max_km: number
              max_km_tolerance_pct: number
              min_km: number
              min_km_tolerance_pct: number
              standard_km: number
            }[]
          }
      get_driver_monthly_reports: {
        Args: { p_month_start: string; p_session_token: string }
        Returns: Json
      }
      get_driver_portal_data: {
        Args: { p_session_token: string }
        Returns: Json
      }
      get_monthly_pl_summary: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_vehicle_current_odometer: {
        Args: { p_vehicle_id: number }
        Returns: number
      }
      is_current_user_superadmin: { Args: never; Returns: boolean }
      issue_inventory_stock: {
        Args: {
          p_created_by?: string
          p_item_id: number
          p_quantity: number
          p_reason?: string
          p_vehicle_id?: number
        }
        Returns: {
          created_at: string
          created_by: string | null
          item_id: number
          movement_id: number
          movement_type: string
          quantity: number
          reason: string | null
          reference_id: number | null
          reference_type: string | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "inventory_stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      modify_trip_atomic: {
        Args: { p_payload: Json; p_trip_id: number }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mount_tyre_atomic: {
        Args: {
          p_created_by?: string
          p_event_date?: string
          p_mount_odo: number
          p_placement_position: string
          p_reason?: string
          p_tyre_id: number
          p_vehicle_id: number
        }
        Returns: {
          brand_model: string | null
          condition_status: string | null
          current_retread_count: number
          last_mount_odo: number | null
          last_retread_date: string | null
          last_retread_vendor: string | null
          nsd_measurement: number | null
          placement_position: string | null
          purchase_bill_amount: number | null
          purchase_date: string | null
          purchase_invoice_number: string | null
          purchase_vendor: string | null
          recorded_date: string | null
          retread_rejected: boolean
          serial_number: string | null
          total_km_run: number | null
          tyre_id: number
          tyre_status: string | null
          tyre_type: string | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "fleet_tyres"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_adblue_credit_atomic: {
        Args: {
          p_adblue_date: string
          p_adblue_rate_per_litre: number
          p_created_by?: string
          p_due_date?: string
          p_filling_odometer_km: number
          p_invoice_number?: string
          p_is_tank_full?: boolean
          p_litres_filled: number
          p_lr_number?: string
          p_reading_at?: string
          p_remarks?: string
          p_trip_id?: number
          p_vehicle_id: number
          p_vendor_id: number
        }
        Returns: {
          adblue_date: string
          adblue_log_id: number
          adblue_rate_per_litre: number
          adblue_vendor: string | null
          created_at: string
          filling_odometer_km: number
          is_tank_full: boolean
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_adblue_cost: number
          trip_id: number | null
          vehicle_id: number
          vendor_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "adblue_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_adblue_filling_atomic: {
        Args: {
          p_adblue_date: string
          p_adblue_rate_per_litre: number
          p_entered_by?: string
          p_filling_odometer_km: number
          p_is_tank_full?: boolean
          p_litres_filled: number
          p_lr_number?: string
          p_reading_at?: string
          p_remarks?: string
          p_trip_id?: number
          p_vehicle_id: number
          p_vendor_id?: number
        }
        Returns: {
          adblue_date: string
          adblue_log_id: number
          adblue_rate_per_litre: number
          adblue_vendor: string | null
          created_at: string
          filling_odometer_km: number
          is_tank_full: boolean
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_adblue_cost: number
          trip_id: number | null
          vehicle_id: number
          vendor_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "adblue_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_driver_breakdown_atomic: {
        Args: {
          p_breakdown_remarks: string
          p_entered_by: string
          p_odometer_km: number
          p_reading_at: string
          p_trip_id: number
          p_vehicle_id: number
        }
        Returns: undefined
      }
      record_driver_breakdown_session_atomic: {
        Args: {
          p_breakdown_remarks: string
          p_odometer_km: number
          p_reading_at: string
          p_session_token: string
          p_trip_id: number
          p_vehicle_id: number
        }
        Returns: undefined
      }
      record_fuel_atomic: {
        Args: {
          p_diesel_category: string
          p_diesel_rate_per_litre: number
          p_entered_by?: string
          p_filling_odometer_km?: number
          p_fuel_date: string
          p_fuel_station_vendor?: string
          p_is_tank_full?: boolean
          p_litres_filled: number
          p_lr_number?: string
          p_reading_at?: string
          p_remarks?: string
          p_total_fuel_cost: number
          p_trip_id?: number
          p_vehicle_id: number
        }
        Returns: {
          created_at: string | null
          diesel_category: string
          diesel_rate_per_litre: number
          filling_odometer_km: number | null
          fuel_date: string
          fuel_log_id: number
          fuel_station_vendor: string | null
          is_tank_full: boolean | null
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_fuel_cost: number
          trip_id: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "diesel_fuel_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_vehicle_odometer: {
        Args: {
          p_entered_by?: string
          p_odometer_km: number
          p_reading_at?: string
          p_reading_type: string
          p_reference_id?: number
          p_remarks?: string
          p_vehicle_id: number
        }
        Returns: {
          created_at: string
          entered_at: string
          entered_by: string | null
          odometer_km: number
          odometer_log_id: number
          reading_at: string
          reading_type: string
          reference_id: number | null
          remarks: string | null
          vehicle_id: number
        }
        SetofOptions: {
          from: "*"
          to: "vehicle_odometer_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_vendor_payment_atomic: {
        Args: {
          p_created_by?: string
          p_payable_id: number
          p_payment_amount: number
          p_payment_date: string
          p_payment_mode: string
          p_reference_number?: string
          p_remarks?: string
        }
        Returns: {
          amount: number
          created_at: string
          created_by: string | null
          payable_id: number
          payment_date: string
          payment_id: number
          payment_mode: string
          reference_number: string | null
          remarks: string | null
          vendor_id: number
        }
        SetofOptions: {
          from: "*"
          to: "vendor_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_tyre_atomic: {
        Args: {
          p_brand_model?: string
          p_condition_status?: string
          p_mount_odo?: number
          p_nsd_measurement?: number
          p_placement_position?: string
          p_serial_number: string
          p_vehicle_id?: number
        }
        Returns: {
          brand_model: string | null
          condition_status: string | null
          current_retread_count: number
          last_mount_odo: number | null
          last_retread_date: string | null
          last_retread_vendor: string | null
          nsd_measurement: number | null
          placement_position: string | null
          purchase_bill_amount: number | null
          purchase_date: string | null
          purchase_invoice_number: string | null
          purchase_vendor: string | null
          recorded_date: string | null
          retread_rejected: boolean
          serial_number: string | null
          total_km_run: number | null
          tyre_id: number
          tyre_status: string | null
          tyre_type: string | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "fleet_tyres"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_driver_pending_entry_atomic: {
        Args: { p_entry_id: number; p_rejection_reason?: string }
        Returns: {
          amount_inr: number
          created_at: string | null
          driver_code: string | null
          entry_id: number
          entry_type: string
          litres: number | null
          odometer_km: number | null
          receipt_remarks: string | null
          rejection_reason: string | null
          status: string | null
          submitted_at: string | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "driver_pending_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_driver_session: {
        Args: { p_session_token: string }
        Returns: number
      }
      save_driver_advance_atomic: {
        Args: {
          p_advance_date?: string
          p_advance_id?: number
          p_advance_type?: string
          p_amount_inr?: number
          p_driver_id?: number
          p_payment_mode?: string
          p_reference_remarks?: string
        }
        Returns: {
          advance_date: string
          advance_id: number
          advance_type: string | null
          amount_inr: number
          created_at: string | null
          driver_id: number
          is_settled: boolean | null
          payment_mode: string | null
          reference_remarks: string | null
          settled_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "driver_direct_advances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_tyre_for_retread_atomic: {
        Args: {
          p_created_by?: string
          p_event_date?: string
          p_invoice_number?: string
          p_nsd_measurement?: number
          p_odometer_km: number
          p_reason?: string
          p_tyre_id: number
          p_vendor_id: number
        }
        Returns: Json
      }
      set_master_driver_pin: {
        Args: { p_driver_id: number; p_pin: string }
        Returns: {
          branch_id: number | null
          created_at: string | null
          driver_code: string
          driver_id: number
          full_name: string
          is_active: boolean | null
          license_expiry_date: string | null
          license_number: string
          phone_number: string
          pin: string | null
          pin_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "drivers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      settle_and_close_trip: {
        Args: {
          p_allowable_shortage_mt: number
          p_pod_date: string
          p_pod_number: string
          p_received_weight: number
          p_remarks: string
          p_shortage_bearer: string
          p_shortage_rate_per_mt: number
          p_trip_id: number
        }
        Returns: Json
      }
      settle_driver_period_atomic: {
        Args: { p_driver_id: number; p_from_date: string; p_to_date: string }
        Returns: Json
      }
      start_driver_draft_trip_atomic: {
        Args: {
          p_entered_by?: string
          p_primary_driver_id: number
          p_reading_at?: string
          p_start_km: number
          p_trip_number: string
          p_trip_start_date: string
          p_vehicle_id: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_driver_draft_trip_session_atomic: {
        Args: {
          p_reading_at?: string
          p_session_token: string
          p_start_km: number
          p_trip_number: string
          p_trip_start_date: string
          p_vehicle_id: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_driver_existing_trip_session_atomic: {
        Args: {
          p_reading_at?: string
          p_session_token: string
          p_start_km?: number
          p_trip_id: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_existing_trip_atomic: {
        Args: {
          p_entered_by?: string
          p_reading_at?: string
          p_start_km?: number
          p_trip_id: number
        }
        Returns: {
          branch_id: number | null
          breakdown_remarks: string | null
          cash_advance_issued: number | null
          created_at: string | null
          destination: string
          destination_lat: number | null
          destination_lng: number | null
          diesel_filling_km: number | null
          distance_basis: string
          driver_bata: number | null
          end_km: number | null
          enroute_repairs_maintenance: number | null
          freight_revenue: number
          fuel_expense: number | null
          fuel_litres: number | null
          halt_bata: number | null
          is_tank_full: boolean | null
          loaded_weight_mt: number
          loading_unloading_expense: number | null
          misc_trip_expense: number | null
          origin: string
          origin_lat: number | null
          origin_lng: number | null
          pod_number: string | null
          pod_received_date: string | null
          pod_settlement_remarks: string | null
          pod_status: string | null
          primary_driver_id: number
          reached_at: string | null
          received_weight_mt: number | null
          returning_at: string | null
          settled_at: string | null
          settlement_remarks: string | null
          settlement_status: string | null
          shortage_bearer: string | null
          shortage_mt: number | null
          shortage_penalty_deduction: number | null
          shortage_weight_mt: number | null
          start_km: number | null
          toll_fastag_expense: number | null
          tonnage_loaded: number
          total_km_run: number | null
          trip_closed_at: string | null
          trip_end_date: string
          trip_id: number
          trip_number: string
          trip_start_date: string
          trip_status: string | null
          unloaded_at: string | null
          unloaded_weight_mt: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_driver_fuel_pending_atomic: {
        Args: {
          p_litres: number
          p_odometer_km: number
          p_receipt_remarks?: string
          p_session_token: string
          p_vehicle_id: number
        }
        Returns: {
          amount_inr: number
          created_at: string | null
          driver_code: string | null
          entry_id: number
          entry_type: string
          litres: number | null
          odometer_km: number | null
          receipt_remarks: string | null
          rejection_reason: string | null
          status: string | null
          submitted_at: string | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "driver_pending_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unmount_tyre_to_store_atomic: {
        Args: {
          p_created_by?: string
          p_event_date?: string
          p_nsd_measurement?: number
          p_reason?: string
          p_tyre_id: number
          p_unmount_odo: number
        }
        Returns: {
          brand_model: string | null
          condition_status: string | null
          current_retread_count: number
          last_mount_odo: number | null
          last_retread_date: string | null
          last_retread_vendor: string | null
          nsd_measurement: number | null
          placement_position: string | null
          purchase_bill_amount: number | null
          purchase_date: string | null
          purchase_invoice_number: string | null
          purchase_vendor: string | null
          recorded_date: string | null
          retread_rejected: boolean
          serial_number: string | null
          total_km_run: number | null
          tyre_id: number
          tyre_status: string | null
          tyre_type: string | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "fleet_tyres"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_adblue_atomic: {
        Args: {
          p_adblue_date: string
          p_adblue_log_id: number
          p_adblue_rate_per_litre: number
          p_is_tank_full?: boolean
          p_litres_filled: number
          p_lr_number?: string
          p_remarks?: string
          p_vendor_id?: number
        }
        Returns: {
          adblue_date: string
          adblue_log_id: number
          adblue_rate_per_litre: number
          adblue_vendor: string | null
          created_at: string
          filling_odometer_km: number
          is_tank_full: boolean
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_adblue_cost: number
          trip_id: number | null
          vehicle_id: number
          vendor_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "adblue_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_fuel_atomic: {
        Args: {
          p_diesel_category: string
          p_diesel_rate_per_litre: number
          p_fuel_date: string
          p_fuel_log_id: number
          p_fuel_station_vendor?: string
          p_is_tank_full?: boolean
          p_litres_filled: number
          p_lr_number?: string
          p_remarks?: string
          p_total_fuel_cost: number
        }
        Returns: {
          created_at: string | null
          diesel_category: string
          diesel_rate_per_litre: number
          filling_odometer_km: number | null
          fuel_date: string
          fuel_log_id: number
          fuel_station_vendor: string | null
          is_tank_full: boolean | null
          litres_filled: number
          lr_number: string | null
          remarks: string | null
          total_fuel_cost: number
          trip_id: number | null
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "diesel_fuel_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_master_bata: {
        Args: {
          p_bata_rule_id: number
          p_capacity_tons: string
          p_cargo_type: string
          p_destination_name: string
          p_origin: string
          p_standard_bata_inr: number
          p_vehicle_id: number
        }
        Returns: {
          bata_rule_id: number
          capacity_tons: string | null
          cargo_type: string | null
          created_at: string | null
          destination_name: string
          origin: string | null
          standard_bata_inr: number
          vehicle_id: number | null
        }
        SetofOptions: {
          from: "*"
          to: "driver_bata_master"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_master_driver: {
        Args: {
          p_branch_id: number
          p_driver_id: number
          p_full_name: string
          p_is_active: boolean
          p_license_expiry_date: string
          p_license_number: string
          p_phone_number: string
        }
        Returns: {
          branch_id: number | null
          created_at: string | null
          driver_code: string
          driver_id: number
          full_name: string
          is_active: boolean | null
          license_expiry_date: string | null
          license_number: string
          phone_number: string
          pin: string | null
          pin_hash: string | null
        }
        SetofOptions: {
          from: "*"
          to: "drivers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_master_freight: {
        Args: {
          p_capacity_tons: string
          p_cargo_category: string
          p_cargo_type: string
          p_destination_id: number
          p_destination_name: string
          p_freight_rate_per_ton: number
          p_is_active: boolean
          p_max_km_tolerance_pct: number
          p_min_km_tolerance_pct: number
          p_origin: string
          p_standard_km: number
        }
        Returns: {
          capacity_tons: string
          cargo_category: string | null
          cargo_type: string
          created_at: string | null
          destination_id: number
          destination_name: string
          freight_rate_per_ton: number
          is_active: boolean | null
          max_km_tolerance_pct: number
          min_km_tolerance_pct: number
          origin: string
          standard_km: number | null
        }
        SetofOptions: {
          from: "*"
          to: "destinations_freight_master"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_master_vehicle: {
        Args: {
          p_carrying_capacity_tons: number
          p_fc_expiry_date: string
          p_gross_vehicle_weight_tons: number
          p_insurance_expiry_date: string
          p_is_active: boolean
          p_np_expiry_date: string
          p_odometer_working: boolean
          p_puc_expiry_date: string
          p_qtax_expiry_date: string
          p_state_permit_expiry_date: string
          p_tank_cert_expiry_date: string
          p_truck_type: string
          p_vehicle_id: number
          p_vehicle_number: string
        }
        Returns: {
          carrying_capacity_tons: number
          created_at: string | null
          current_status: string | null
          fc_expiry_date: string | null
          gross_vehicle_weight_tons: number | null
          insurance_expiry_date: string | null
          is_active: boolean | null
          np_expiry_date: string | null
          odometer_working: boolean | null
          puc_expiry_date: string | null
          qtax_expiry_date: string | null
          state_permit_expiry_date: string | null
          status_remarks: string | null
          status_updated_at: string | null
          tank_cert_expiry_date: string | null
          truck_type: string
          vehicle_id: number
          vehicle_number: string
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_trip_status_atomic: {
        Args: {
          p_payload: Json
          p_trip_id: number
          p_vehicle_id: number
          p_vehicle_remarks: string
          p_vehicle_status: string
        }
        Returns: undefined
      }
      update_vehicle_status_atomic: {
        Args: {
          p_status: string
          p_status_remarks?: string
          p_vehicle_id: number
        }
        Returns: {
          carrying_capacity_tons: number
          created_at: string | null
          current_status: string | null
          fc_expiry_date: string | null
          gross_vehicle_weight_tons: number | null
          insurance_expiry_date: string | null
          is_active: boolean | null
          np_expiry_date: string | null
          odometer_working: boolean | null
          puc_expiry_date: string | null
          qtax_expiry_date: string | null
          state_permit_expiry_date: string | null
          status_remarks: string | null
          status_updated_at: string | null
          tank_cert_expiry_date: string | null
          truck_type: string
          vehicle_id: number
          vehicle_number: string
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_vendor_atomic: {
        Args: {
          p_address?: string
          p_email?: string
          p_is_active?: boolean
          p_phone_number?: string
          p_tax_number?: string
          p_vendor_id: number
          p_vendor_name: string
          p_vendor_subcategory?: string
          p_vendor_type: string
        }
        Returns: {
          address: string | null
          created_at: string
          email: string | null
          is_active: boolean
          phone_number: string | null
          tax_number: string | null
          vendor_id: number
          vendor_name: string
          vendor_subcategory: string | null
          vendor_type: string
        }
        SetofOptions: {
          from: "*"
          to: "vendors"
          isOneToOne: true
          isSetofReturn: false
        }
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
    Enums: {},
  },
} as const
