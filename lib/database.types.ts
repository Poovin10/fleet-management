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
            referencedRelation: "trips"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "diesel_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "trucks"
            referencedColumns: ["id"]
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
      fleet_tyres: {
        Row: {
          brand_model: string | null
          condition_status: string | null
          last_mount_odo: number | null
          nsd_measurement: number | null
          placement_position: string | null
          recorded_date: string | null
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
          last_mount_odo?: number | null
          nsd_measurement?: number | null
          placement_position?: string | null
          recorded_date?: string | null
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
          last_mount_odo?: number | null
          nsd_measurement?: number | null
          placement_position?: string | null
          recorded_date?: string | null
          serial_number?: string | null
          total_km_run?: number | null
          tyre_id?: number
          tyre_status?: string | null
          tyre_type?: string | null
          vehicle_id?: number | null
        }
        Relationships: []
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
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
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
            referencedRelation: "trucks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
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
      get_monthly_pl_summary: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
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
