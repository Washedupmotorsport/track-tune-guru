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
      attachments: {
        Row: {
          caption: string | null
          car_id: string
          created_at: string
          file_name: string | null
          id: string
          lap_id: string | null
          maintenance_id: string | null
          mime_type: string | null
          note_id: string | null
          session_id: string | null
          setup_id: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          car_id: string
          created_at?: string
          file_name?: string | null
          id?: string
          lap_id?: string | null
          maintenance_id?: string | null
          mime_type?: string | null
          note_id?: string | null
          session_id?: string | null
          setup_id?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          car_id?: string
          created_at?: string
          file_name?: string | null
          id?: string
          lap_id?: string | null
          maintenance_id?: string | null
          mime_type?: string | null
          note_id?: string | null
          session_id?: string | null
          setup_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          car_id: string | null
          checklist: Json
          created_at: string
          ends_at: string | null
          event_type: string
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          status: string
          title: string
          track: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          car_id?: string | null
          checklist?: Json
          created_at?: string
          ends_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          status?: string
          title: string
          track?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          car_id?: string | null
          checklist?: Json
          created_at?: string
          ends_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          status?: string
          title?: string
          track?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      car_shares: {
        Row: {
          car_id: string
          created_at: string
          id: string
          owner_id: string
          role: Database["public"]["Enums"]["share_role"]
          shared_with_user_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          id?: string
          owner_id: string
          role?: Database["public"]["Enums"]["share_role"]
          shared_with_user_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          role?: Database["public"]["Enums"]["share_role"]
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_shares_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      cars: {
        Row: {
          created_at: string
          discipline: string
          id: string
          make: string | null
          model: string | null
          name: string
          notes: string | null
          photo_path: string | null
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          created_at?: string
          discipline?: string
          id?: string
          make?: string | null
          model?: string | null
          name: string
          notes?: string | null
          photo_path?: string | null
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          created_at?: string
          discipline?: string
          id?: string
          make?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          photo_path?: string | null
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      damage_reports: {
        Row: {
          car_id: string
          component: string
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          parts_used: string | null
          repair_cost: number | null
          resolved_at: string | null
          session_id: string | null
          severity: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          car_id: string
          component: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          parts_used?: string | null
          repair_cost?: number | null
          resolved_at?: string | null
          session_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          car_id?: string
          component?: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          parts_used?: string | null
          repair_cost?: number | null
          resolved_at?: string | null
          session_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_confidence: {
        Row: {
          air_temp_c: number | null
          best_lap_ms: number | null
          brakes: number | null
          car_id: string
          created_at: string
          front: number | null
          hot_fl: number | null
          hot_fr: number | null
          hot_rl: number | null
          hot_rr: number | null
          id: string
          notes: string | null
          overall: number
          rear: number | null
          recorded_at: string
          session_id: string | null
          setup_id: string | null
          track_temp_c: number | null
          traction: number | null
          updated_at: string
          user_id: string
          weather: string | null
        }
        Insert: {
          air_temp_c?: number | null
          best_lap_ms?: number | null
          brakes?: number | null
          car_id: string
          created_at?: string
          front?: number | null
          hot_fl?: number | null
          hot_fr?: number | null
          hot_rl?: number | null
          hot_rr?: number | null
          id?: string
          notes?: string | null
          overall: number
          rear?: number | null
          recorded_at?: string
          session_id?: string | null
          setup_id?: string | null
          track_temp_c?: number | null
          traction?: number | null
          updated_at?: string
          user_id: string
          weather?: string | null
        }
        Update: {
          air_temp_c?: number | null
          best_lap_ms?: number | null
          brakes?: number | null
          car_id?: string
          created_at?: string
          front?: number | null
          hot_fl?: number | null
          hot_fr?: number | null
          hot_rl?: number | null
          hot_rr?: number | null
          id?: string
          notes?: string | null
          overall?: number
          rear?: number | null
          recorded_at?: string
          session_id?: string | null
          setup_id?: string | null
          track_temp_c?: number | null
          traction?: number | null
          updated_at?: string
          user_id?: string
          weather?: string | null
        }
        Relationships: []
      }
      driver_feedback: {
        Row: {
          balance: string | null
          car_id: string
          category: string
          confidence: number | null
          corner: string | null
          created_at: string
          description: string
          id: string
          phase: string | null
          recommendation: string | null
          recorded_at: string
          session_id: string | null
          setup_id: string | null
          severity: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: string | null
          car_id: string
          category?: string
          confidence?: number | null
          corner?: string | null
          created_at?: string
          description: string
          id?: string
          phase?: string | null
          recommendation?: string | null
          recorded_at?: string
          session_id?: string | null
          setup_id?: string | null
          severity?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: string | null
          car_id?: string
          category?: string
          confidence?: number | null
          corner?: string | null
          created_at?: string
          description?: string
          id?: string
          phase?: string | null
          recommendation?: string | null
          recorded_at?: string
          session_id?: string | null
          setup_id?: string | null
          severity?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_notes: {
        Row: {
          body: string | null
          car_id: string | null
          category: string
          corner: string | null
          created_at: string
          id: string
          phase: string | null
          session_id: string | null
          setup_id: string | null
          severity: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          car_id?: string | null
          category?: string
          corner?: string | null
          created_at?: string
          id?: string
          phase?: string | null
          session_id?: string | null
          setup_id?: string | null
          severity?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          car_id?: string | null
          category?: string
          corner?: string | null
          created_at?: string
          id?: string
          phase?: string | null
          session_id?: string | null
          setup_id?: string | null
          severity?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_notes_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notes_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "setups"
            referencedColumns: ["id"]
          },
        ]
      }
      engineering_memory: {
        Row: {
          car_id: string
          category: string
          conditions: string | null
          confidence: number
          created_at: string
          detail: string | null
          id: string
          last_observed_at: string
          occurrences: number
          pinned: boolean
          session_id: string | null
          setup_id: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          car_id: string
          category?: string
          conditions?: string | null
          confidence?: number
          created_at?: string
          detail?: string | null
          id?: string
          last_observed_at?: string
          occurrences?: number
          pinned?: boolean
          session_id?: string | null
          setup_id?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          car_id?: string
          category?: string
          conditions?: string | null
          confidence?: number
          created_at?: string
          detail?: string | null
          id?: string
          last_observed_at?: string
          occurrences?: number
          pinned?: boolean
          session_id?: string | null
          setup_id?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          car_id: string | null
          category: string
          created_at: string
          currency: string
          description: string | null
          event_id: string | null
          id: string
          spent_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          car_id?: string | null
          category: string
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string | null
          id?: string
          spent_on?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          car_id?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          event_id?: string | null
          id?: string
          spent_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          car_id: string
          created_at: string
          description: string | null
          flag: string
          id: string
          lap_id: string | null
          lap_number: number | null
          occurred_at: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          description?: string | null
          flag?: string
          id?: string
          lap_id?: string | null
          lap_number?: number | null
          occurred_at?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          description?: string | null
          flag?: string
          id?: string
          lap_id?: string | null
          lap_number?: number | null
          occurred_at?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      laps: {
        Row: {
          car_id: string
          conditions: string | null
          created_at: string
          fuel_load: number | null
          id: string
          lap_number: number | null
          lap_time_ms: number
          notes: string | null
          recorded_at: string
          sector_1_ms: number | null
          sector_2_ms: number | null
          sector_3_ms: number | null
          session_id: string | null
          setup_id: string
          tire_set: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          car_id: string
          conditions?: string | null
          created_at?: string
          fuel_load?: number | null
          id?: string
          lap_number?: number | null
          lap_time_ms: number
          notes?: string | null
          recorded_at?: string
          sector_1_ms?: number | null
          sector_2_ms?: number | null
          sector_3_ms?: number | null
          session_id?: string | null
          setup_id: string
          tire_set?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          car_id?: string
          conditions?: string | null
          created_at?: string
          fuel_load?: number | null
          id?: string
          lap_number?: number | null
          lap_time_ms?: number
          notes?: string | null
          recorded_at?: string
          sector_1_ms?: number | null
          sector_2_ms?: number | null
          sector_3_ms?: number | null
          session_id?: string | null
          setup_id?: string
          tire_set?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laps_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laps_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "setups"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          car_id: string
          component: string
          created_at: string
          current_value: number
          description: string | null
          id: string
          last_service_date: string | null
          last_service_value: number | null
          notes: string | null
          priority: string
          service_interval: number | null
          unit: string
          updated_at: string
          user_id: string
          warn_threshold: number | null
        }
        Insert: {
          car_id: string
          component: string
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          last_service_date?: string | null
          last_service_value?: number | null
          notes?: string | null
          priority?: string
          service_interval?: number | null
          unit?: string
          updated_at?: string
          user_id: string
          warn_threshold?: number | null
        }
        Update: {
          car_id?: string
          component?: string
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          last_service_date?: string | null
          last_service_value?: number | null
          notes?: string | null
          priority?: string
          service_interval?: number | null
          unit?: string
          updated_at?: string
          user_id?: string
          warn_threshold?: number | null
        }
        Relationships: []
      }
      parts_inventory: {
        Row: {
          car_id: string | null
          category: string | null
          created_at: string
          id: string
          location: string | null
          min_quantity: number
          name: string
          notes: string | null
          part_number: string | null
          quantity: number
          supplier: string | null
          unit_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          car_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          min_quantity?: number
          name: string
          notes?: string | null
          part_number?: string | null
          quantity?: number
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          car_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          location?: string | null
          min_quantity?: number
          name?: string
          notes?: string | null
          part_number?: string | null
          quantity?: number
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_debriefs: {
        Row: {
          ai_summary: Json | null
          balance_issue: string | null
          car_id: string
          confidence_issue: string | null
          created_at: string
          id: string
          improved: string | null
          needs_work: string | null
          notes: string | null
          session_id: string | null
          setup_id: string | null
          suggested_changes: string | null
          tyre_issue: string | null
          updated_at: string
          user_id: string
          worsened: string | null
        }
        Insert: {
          ai_summary?: Json | null
          balance_issue?: string | null
          car_id: string
          confidence_issue?: string | null
          created_at?: string
          id?: string
          improved?: string | null
          needs_work?: string | null
          notes?: string | null
          session_id?: string | null
          setup_id?: string | null
          suggested_changes?: string | null
          tyre_issue?: string | null
          updated_at?: string
          user_id: string
          worsened?: string | null
        }
        Update: {
          ai_summary?: Json | null
          balance_issue?: string | null
          car_id?: string
          confidence_issue?: string | null
          created_at?: string
          id?: string
          improved?: string | null
          needs_work?: string | null
          notes?: string | null
          session_id?: string | null
          setup_id?: string | null
          suggested_changes?: string | null
          tyre_issue?: string | null
          updated_at?: string
          user_id?: string
          worsened?: string | null
        }
        Relationships: []
      }
      session_shares: {
        Row: {
          car_id: string
          created_at: string
          expires_at: string | null
          id: string
          session_id: string
          token: string
          user_id: string
        }
        Insert: {
          car_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          session_id: string
          token: string
          user_id: string
        }
        Update: {
          car_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          session_id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          air_temp_c: number | null
          car_id: string
          created_at: string
          driver: string | null
          event_id: string | null
          fuel_end_l: number | null
          fuel_start_l: number | null
          id: string
          name: string
          notes: string | null
          session_type: string
          setup_id: string | null
          started_at: string
          track: string | null
          track_temp_c: number | null
          updated_at: string
          user_id: string
          weather: string | null
        }
        Insert: {
          air_temp_c?: number | null
          car_id: string
          created_at?: string
          driver?: string | null
          event_id?: string | null
          fuel_end_l?: number | null
          fuel_start_l?: number | null
          id?: string
          name: string
          notes?: string | null
          session_type?: string
          setup_id?: string | null
          started_at?: string
          track?: string | null
          track_temp_c?: number | null
          updated_at?: string
          user_id: string
          weather?: string | null
        }
        Update: {
          air_temp_c?: number | null
          car_id?: string
          created_at?: string
          driver?: string | null
          event_id?: string | null
          fuel_end_l?: number | null
          fuel_start_l?: number | null
          id?: string
          name?: string
          notes?: string | null
          session_type?: string
          setup_id?: string | null
          started_at?: string
          track?: string | null
          track_temp_c?: number | null
          updated_at?: string
          user_id?: string
          weather?: string | null
        }
        Relationships: []
      }
      setup_changes: {
        Row: {
          area: string
          car_id: string
          changes: Json
          confidence_delta: number | null
          created_at: string
          driver_response: string | null
          expected_effect: string | null
          id: string
          lap_delta_ms: number | null
          measured_at: string | null
          outcome_notes: string | null
          outcome_status: string
          parent_setup_id: string | null
          reason: string | null
          session_id: string | null
          setup_id: string
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string
          car_id: string
          changes?: Json
          confidence_delta?: number | null
          created_at?: string
          driver_response?: string | null
          expected_effect?: string | null
          id?: string
          lap_delta_ms?: number | null
          measured_at?: string | null
          outcome_notes?: string | null
          outcome_status?: string
          parent_setup_id?: string | null
          reason?: string | null
          session_id?: string | null
          setup_id: string
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          car_id?: string
          changes?: Json
          confidence_delta?: number | null
          created_at?: string
          driver_response?: string | null
          expected_effect?: string | null
          id?: string
          lap_delta_ms?: number | null
          measured_at?: string | null
          outcome_notes?: string | null
          outcome_status?: string
          parent_setup_id?: string | null
          reason?: string | null
          session_id?: string | null
          setup_id?: string
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      setups: {
        Row: {
          car_id: string
          conditions: string | null
          created_at: string
          discipline: string
          id: string
          ideal_conditions: string | null
          is_baseline: boolean
          name: string
          notes: string | null
          preset_type: string
          setup_data: Json
          track: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          car_id: string
          conditions?: string | null
          created_at?: string
          discipline?: string
          id?: string
          ideal_conditions?: string | null
          is_baseline?: boolean
          name: string
          notes?: string | null
          preset_type?: string
          setup_data?: Json
          track?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          car_id?: string
          conditions?: string | null
          created_at?: string
          discipline?: string
          id?: string
          ideal_conditions?: string | null
          is_baseline?: boolean
          name?: string
          notes?: string | null
          preset_type?: string
          setup_data?: Json
          track?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setups_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
        ]
      }
      tire_logs: {
        Row: {
          ambient_c: number | null
          car_id: string
          cold_fl: number | null
          cold_fr: number | null
          cold_rl: number | null
          cold_rr: number | null
          compound: string | null
          created_at: string
          heat_cycles: number | null
          hot_fl: number | null
          hot_fr: number | null
          hot_rl: number | null
          hot_rr: number | null
          id: string
          notes: string | null
          recorded_at: string
          session_id: string | null
          setup_id: string | null
          tire_set: string
          track_c: number | null
          tread_fl: number | null
          tread_fr: number | null
          tread_rl: number | null
          tread_rr: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ambient_c?: number | null
          car_id: string
          cold_fl?: number | null
          cold_fr?: number | null
          cold_rl?: number | null
          cold_rr?: number | null
          compound?: string | null
          created_at?: string
          heat_cycles?: number | null
          hot_fl?: number | null
          hot_fr?: number | null
          hot_rl?: number | null
          hot_rr?: number | null
          id?: string
          notes?: string | null
          recorded_at?: string
          session_id?: string | null
          setup_id?: string | null
          tire_set: string
          track_c?: number | null
          tread_fl?: number | null
          tread_fr?: number | null
          tread_rl?: number | null
          tread_rr?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ambient_c?: number | null
          car_id?: string
          cold_fl?: number | null
          cold_fr?: number | null
          cold_rl?: number | null
          cold_rr?: number | null
          compound?: string | null
          created_at?: string
          heat_cycles?: number | null
          hot_fl?: number | null
          hot_fr?: number | null
          hot_rl?: number | null
          hot_rr?: number | null
          id?: string
          notes?: string | null
          recorded_at?: string
          session_id?: string | null
          setup_id?: string | null
          tire_set?: string
          track_c?: number | null
          tread_fl?: number | null
          tread_fr?: number | null
          tread_rl?: number | null
          tread_rr?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tire_stints: {
        Row: {
          car_id: string
          compound: string | null
          created_at: string
          distance_km: number | null
          id: string
          laps: number
          notes: string | null
          recorded_at: string
          session_id: string | null
          tire_set: string
          tread_fl: number | null
          tread_fr: number | null
          tread_rl: number | null
          tread_rr: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          car_id: string
          compound?: string | null
          created_at?: string
          distance_km?: number | null
          id?: string
          laps?: number
          notes?: string | null
          recorded_at?: string
          session_id?: string | null
          tire_set: string
          tread_fl?: number | null
          tread_fr?: number | null
          tread_rl?: number | null
          tread_rr?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          car_id?: string
          compound?: string | null
          created_at?: string
          distance_km?: number | null
          id?: string
          laps?: number
          notes?: string | null
          recorded_at?: string
          session_id?: string | null
          tire_set?: string
          tread_fl?: number | null
          tread_fr?: number | null
          tread_rl?: number | null
          tread_rr?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      has_car_access: {
        Args: {
          _car_id: string
          _min_role: Database["public"]["Enums"]["share_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_car_owner: {
        Args: { _car_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      share_role: "viewer" | "editor"
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
      share_role: ["viewer", "editor"],
    },
  },
} as const
