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
      access_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          email: string
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          requested_by: string | null
          role: string
          scope_id: string | null
          scope_type: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          requested_by?: string | null
          role: string
          scope_id?: string | null
          scope_type?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          requested_by?: string | null
          role?: string
          scope_id?: string | null
          scope_type?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          org_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          org_id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          org_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          club_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          org_id: string
          pinned: boolean
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          club_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string
          pinned?: boolean
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string
          pinned?: boolean
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approver_guardian_id: string | null
          approver_user_id: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          decline_reason: string | null
          expires_at: string | null
          id: string
          method: string | null
          org_id: string
          player_id: string | null
          recorded_by: string | null
          requested_at: string | null
          status: string
          subject_id: string
          subject_type: string
          token_hash: string | null
        }
        Insert: {
          approver_guardian_id?: string | null
          approver_user_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decline_reason?: string | null
          expires_at?: string | null
          id?: string
          method?: string | null
          org_id: string
          player_id?: string | null
          recorded_by?: string | null
          requested_at?: string | null
          status?: string
          subject_id: string
          subject_type: string
          token_hash?: string | null
        }
        Update: {
          approver_guardian_id?: string | null
          approver_user_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decline_reason?: string | null
          expires_at?: string | null
          id?: string
          method?: string | null
          org_id?: string
          player_id?: string | null
          recorded_by?: string | null
          requested_at?: string | null
          status?: string
          subject_id?: string
          subject_type?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_approver_guardian_id_fkey"
            columns: ["approver_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          player_id: string
          status: string
          training_session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          player_id: string
          status?: string
          training_session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          player_id?: string
          status?: string
          training_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_training_session_id_fkey"
            columns: ["training_session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          entity_id: string | null
          entity_type: string | null
          id: number
          org_id: string | null
          scope_id: string | null
          scope_type: string | null
          ts: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          org_id?: string | null
          scope_id?: string | null
          scope_type?: string | null
          ts?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          org_id?: string | null
          scope_id?: string | null
          scope_type?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          app_state: Json | null
          categories: number | null
          created_at: string | null
          id: number
          matches: number | null
          saved_at: string | null
          saved_by: string | null
          teams: number | null
          tournament_name: string | null
        }
        Insert: {
          app_state?: Json | null
          categories?: number | null
          created_at?: string | null
          id?: never
          matches?: number | null
          saved_at?: string | null
          saved_by?: string | null
          teams?: number | null
          tournament_name?: string | null
        }
        Update: {
          app_state?: Json | null
          categories?: number | null
          created_at?: string | null
          id?: never
          matches?: number | null
          saved_at?: string | null
          saved_by?: string | null
          teams?: number | null
          tournament_name?: string | null
        }
        Relationships: []
      }
      club_staff: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_staff_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_staff_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_staff_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_staff_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          about: string | null
          branding: Json
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          name: string
          org_id: string
          publicly_listed: boolean
          settings: Json
          slug: string
          sport_id: string | null
          updated_at: string
        }
        Insert: {
          about?: string | null
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name: string
          org_id: string
          publicly_listed?: boolean
          settings?: Json
          slug: string
          sport_id?: string | null
          updated_at?: string
        }
        Update: {
          about?: string | null
          branding?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          name?: string
          org_id?: string
          publicly_listed?: boolean
          settings?: Json
          slug?: string
          sport_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      development_goal_drills: {
        Row: {
          drill_id: string
          goal_id: string
          org_id: string
        }
        Insert: {
          drill_id: string
          goal_id: string
          org_id?: string
        }
        Update: {
          drill_id?: string
          goal_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_goal_drills_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goal_drills_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "development_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goal_drills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      development_goals: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          current_level: number | null
          description: string | null
          id: string
          org_id: string
          player_id: string
          skill_id: string | null
          start_date: string | null
          starting_level: number | null
          status: string
          success_criteria: string | null
          target_date: string | null
          target_level: number | null
          team_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          current_level?: number | null
          description?: string | null
          id?: string
          org_id?: string
          player_id: string
          skill_id?: string | null
          start_date?: string | null
          starting_level?: number | null
          status?: string
          success_criteria?: string | null
          target_date?: string | null
          target_level?: number | null
          team_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          current_level?: number | null
          description?: string | null
          id?: string
          org_id?: string
          player_id?: string
          skill_id?: string | null
          start_date?: string | null
          starting_level?: number | null
          status?: string
          success_criteria?: string | null
          target_date?: string | null
          target_level?: number | null
          team_id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_goals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goals_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goals_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "development_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_goals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      development_skills: {
        Row: {
          category: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          category: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      document_uploads: {
        Row: {
          category: string
          file_data: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          name: string | null
          org_id: string
          player_id: string | null
          player_name: string | null
          review_note: string | null
          reviewed_by: string | null
          reviewed_by_role: string | null
          status: string
          team_id: string
          type: string
          uploaded_at: string
        }
        Insert: {
          category?: string
          file_data?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          name?: string | null
          org_id?: string
          player_id?: string | null
          player_name?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_by_role?: string | null
          status?: string
          team_id: string
          type?: string
          uploaded_at?: string
        }
        Update: {
          category?: string
          file_data?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          name?: string | null
          org_id?: string
          player_id?: string | null
          player_name?: string | null
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_by_role?: string | null
          status?: string
          team_id?: string
          type?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_uploads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_uploads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_uploads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          age_max: number | null
          age_min: number | null
          category: string
          club_id: string
          coaching_points: string | null
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string | null
          duration_minutes: number | null
          equipment: string | null
          id: string
          name: string
          objective: string | null
          org_id: string
          player_max: number | null
          player_min: number | null
          skills: string[]
          theme: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          category: string
          club_id: string
          coaching_points?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string | null
          id?: string
          name: string
          objective?: string | null
          org_id?: string
          player_max?: number | null
          player_min?: number | null
          skills?: string[]
          theme?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          category?: string
          club_id?: string
          coaching_points?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          equipment?: string | null
          id?: string
          name?: string
          objective?: string | null
          org_id?: string
          player_max?: number | null
          player_min?: number | null
          skills?: string[]
          theme?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drills_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drills_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          club_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          expense_date: string
          id: string
          org_id: string
        }
        Insert: {
          amount: number
          category: string
          club_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          expense_date?: string
          id?: string
          org_id?: string
        }
        Update: {
          amount?: number
          category?: string
          club_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_charges: {
        Row: {
          amount: number
          club_id: string
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          fee_type: string
          guardian_id: string | null
          id: string
          org_id: string
          player_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          club_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          fee_type: string
          guardian_id?: string | null
          id?: string
          org_id?: string
          player_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          club_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          fee_type?: string
          guardian_id?: string | null
          id?: string
          org_id?: string
          player_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_charges_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          account_status: string
          contact_info: Json
          created_at: string
          created_by: string | null
          id: string
          invited_at: string | null
          name: string
          org_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_status?: string
          contact_info?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          invited_at?: string | null
          name: string
          org_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_status?: string
          contact_info?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          invited_at?: string | null
          name?: string
          org_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      live_embeds: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          label: string | null
          match_id: string | null
          org_id: string
          url: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          match_id?: string | null
          org_id?: string
          url: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          match_id?: string | null
          org_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_embeds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_embeds_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          id: string
          match_id: string
          minute: number | null
          official_id: string | null
          org_id: string
          player_id: string | null
          player_name: string | null
          player_off_id: string | null
          player_off_name: string | null
          team_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          minute?: number | null
          official_id?: string | null
          org_id?: string
          player_id?: string | null
          player_name?: string | null
          player_off_id?: string | null
          player_off_name?: string | null
          team_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          minute?: number | null
          official_id?: string | null
          org_id?: string
          player_id?: string | null
          player_name?: string | null
          player_off_id?: string | null
          player_off_name?: string | null
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "org_officials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "tournament_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_off_id_fkey"
            columns: ["player_off_id"]
            isOneToOne: false
            referencedRelation: "tournament_roster"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          actor_user_id: string
          club_id: string
          ended_at: string | null
          expires_at: string
          id: string
          org_id: string
          reason: string
          started_at: string
          target_user_id: string
        }
        Insert: {
          actor_user_id: string
          club_id: string
          ended_at?: string | null
          expires_at: string
          id?: string
          org_id: string
          reason: string
          started_at?: string
          target_user_id: string
        }
        Update: {
          actor_user_id?: string
          club_id?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          org_id?: string
          reason?: string
          started_at?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_roster_candidates: {
        Row: {
          added_at: string
          added_by: string | null
          entry_id: string
          id: string
          org_id: string
          player_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          entry_id: string
          id?: string
          org_id: string
          player_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          entry_id?: string
          id?: string
          org_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_roster_candidates_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "tournament_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_roster_candidates_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          bracket_position: number | null
          category_id: string | null
          created_at: string
          group_index: number | null
          home_score: number | null
          home_team_id: string | null
          id: string
          in_progress: boolean
          official_id: string | null
          org_id: string
          pitch: string | null
          played: boolean
          referee_id: string | null
          round_index: number | null
          scheduled_at: string | null
          stage: string
          tournament_id: string | null
          verified: boolean
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          bracket_position?: number | null
          category_id?: string | null
          created_at?: string
          group_index?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          in_progress?: boolean
          official_id?: string | null
          org_id: string
          pitch?: string | null
          played?: boolean
          referee_id?: string | null
          round_index?: number | null
          scheduled_at?: string | null
          stage?: string
          tournament_id?: string | null
          verified?: boolean
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          bracket_position?: number | null
          category_id?: string | null
          created_at?: string
          group_index?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          in_progress?: boolean
          official_id?: string | null
          org_id?: string
          pitch?: string | null
          played?: boolean
          referee_id?: string | null
          round_index?: number | null
          scheduled_at?: string | null
          stage?: string
          tournament_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "org_officials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          caption: string | null
          club_id: string
          content_type: string
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          org_id: string
          player_id: string | null
          storage_key: string
          team_id: string | null
          trip_id: string | null
        }
        Insert: {
          caption?: string | null
          club_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          org_id?: string
          player_id?: string | null
          storage_key: string
          team_id?: string | null
          trip_id?: string | null
        }
        Update: {
          caption?: string | null
          club_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          org_id?: string
          player_id?: string | null
          storage_key?: string
          team_id?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          meeting_id: string
          org_id: string
          status: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          meeting_id: string
          org_id?: string
          status?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          meeting_id?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_action_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          meeting_date: string
          notes: string | null
          org_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          notes?: string | null
          org_id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          notes?: string | null
          org_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_export_requests: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          export_file_id: string | null
          id: string
          org_id: string
          player_id: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          export_file_id?: string | null
          id?: string
          org_id?: string
          player_id: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          export_file_id?: string | null
          id?: string
          org_id?: string
          player_id?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_export_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_export_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_export_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_export_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_export_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_export_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          period_end: string | null
          period_start: string
          player_id: string
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          period_end?: string | null
          period_start: string
          player_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          period_end?: string | null
          period_start?: string
          player_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          failed_reason: string | null
          id: string
          link_path: string | null
          org_id: string
          payload: Json
          read_at: string | null
          recipient_email: string | null
          recipient_guardian_id: string | null
          recipient_phone: string | null
          recipient_user_id: string | null
          sent_at: string | null
          template: string
        }
        Insert: {
          channel?: string
          created_at?: string
          failed_reason?: string | null
          id?: string
          link_path?: string | null
          org_id: string
          payload?: Json
          read_at?: string | null
          recipient_email?: string | null
          recipient_guardian_id?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          template: string
        }
        Update: {
          channel?: string
          created_at?: string
          failed_reason?: string | null
          id?: string
          link_path?: string | null
          org_id?: string
          payload?: Json
          read_at?: string | null
          recipient_email?: string | null
          recipient_guardian_id?: string | null
          recipient_phone?: string | null
          recipient_user_id?: string | null
          sent_at?: string | null
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_guardian_id_fkey"
            columns: ["recipient_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      officiating_team: {
        Row: {
          created_at: string
          designation: string
          designation_other: string | null
          email: string | null
          id: string
          linked_referee_id: string | null
          name: string
          notes: string | null
          org_id: string
          org_level: number | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          designation?: string
          designation_other?: string | null
          email?: string | null
          id?: string
          linked_referee_id?: string | null
          name: string
          notes?: string | null
          org_id: string
          org_level?: number | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          designation?: string
          designation_other?: string | null
          email?: string | null
          id?: string
          linked_referee_id?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          org_level?: number | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officiating_team_linked_referee_id_fkey"
            columns: ["linked_referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officiating_team_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_entitlements: {
        Row: {
          created_at: string
          org_id: string
          product: string
          status: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          org_id: string
          product: string
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          org_id?: string
          product?: string
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          email: string
          org_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          org_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          org_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_officials: {
        Row: {
          active: boolean
          availability: string | null
          created_at: string
          created_by: string | null
          designation: string | null
          email: string | null
          full_name: string
          grade: string | null
          id: string
          notes: string | null
          org_id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          availability?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          email?: string | null
          full_name: string
          grade?: string | null
          id?: string
          notes?: string | null
          org_id: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          availability?: string | null
          created_at?: string
          created_by?: string | null
          designation?: string | null
          email?: string | null
          full_name?: string
          grade?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_officials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          status: string
        }
        Insert: {
          accent?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          status?: string
        }
        Update: {
          accent?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          fee_charge_id: string
          id: string
          method: string | null
          org_id: string
          paid_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          fee_charge_id: string
          id?: string
          method?: string | null
          org_id?: string
          paid_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          fee_charge_id?: string
          id?: string
          method?: string | null
          org_id?: string
          paid_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_fee_charge_id_fkey"
            columns: ["fee_charge_id"]
            isOneToOne: false
            referencedRelation: "fee_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      player_development_notes: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          evaluation_id: string | null
          goal_id: string | null
          id: string
          note: string
          org_id: string
          player_id: string
          session_id: string | null
          team_id: string
          visibility: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          evaluation_id?: string | null
          goal_id?: string | null
          id?: string
          note: string
          org_id?: string
          player_id: string
          session_id?: string | null
          team_id: string
          visibility?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          evaluation_id?: string | null
          goal_id?: string | null
          id?: string
          note?: string
          org_id?: string
          player_id?: string
          session_id?: string | null
          team_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_development_notes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "player_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "development_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_development_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_evaluations: {
        Row: {
          club_id: string
          coach_comments: string | null
          coach_id: string | null
          created_at: string
          created_by: string | null
          development_areas: string | null
          evaluation_date: string
          id: string
          mental_score: number | null
          org_id: string
          period: string | null
          physical_score: number | null
          player_id: string
          strengths: string | null
          tactical_score: number | null
          team_id: string
          technical_score: number | null
          visibility: string
        }
        Insert: {
          club_id: string
          coach_comments?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          development_areas?: string | null
          evaluation_date?: string
          id?: string
          mental_score?: number | null
          org_id?: string
          period?: string | null
          physical_score?: number | null
          player_id: string
          strengths?: string | null
          tactical_score?: number | null
          team_id: string
          technical_score?: number | null
          visibility?: string
        }
        Update: {
          club_id?: string
          coach_comments?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          development_areas?: string | null
          evaluation_date?: string
          id?: string
          mental_score?: number | null
          org_id?: string
          period?: string | null
          physical_score?: number | null
          player_id?: string
          strengths?: string | null
          tactical_score?: number | null
          team_id?: string
          technical_score?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_evaluations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_evaluations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_guardians: {
        Row: {
          created_at: string
          created_by: string | null
          guardian_id: string
          id: string
          is_primary_contact: boolean
          org_id: string
          payment_responsible: boolean
          player_id: string
          relationship: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          guardian_id: string
          id?: string
          is_primary_contact?: boolean
          org_id?: string
          payment_responsible?: boolean
          player_id: string
          relationship?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          guardian_id?: string
          id?: string
          is_primary_contact?: boolean
          org_id?: string
          payment_responsible?: boolean
          player_id?: string
          relationship?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_guardians_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_guardians_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_guardians_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_skill_ratings: {
        Row: {
          evaluation_id: string
          id: string
          org_id: string
          rating: number
          skill_id: string
        }
        Insert: {
          evaluation_id: string
          id?: string
          org_id?: string
          rating: number
          skill_id: string
        }
        Update: {
          evaluation_id?: string
          id?: string
          org_id?: string
          rating?: number
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_skill_ratings_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "player_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_skill_ratings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_skill_ratings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "development_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      player_tournament_results: {
        Row: {
          assists: number
          goals: number
          host_org_id: string | null
          id: string
          match_date: string | null
          match_id: string | null
          minutes: number | null
          org_id: string
          player_id: string
          recorded_at: string
          red_cards: number
          tournament_id: string
          tournament_name: string
          yellow_cards: number
        }
        Insert: {
          assists?: number
          goals?: number
          host_org_id?: string | null
          id?: string
          match_date?: string | null
          match_id?: string | null
          minutes?: number | null
          org_id: string
          player_id: string
          recorded_at?: string
          red_cards?: number
          tournament_id: string
          tournament_name: string
          yellow_cards?: number
        }
        Update: {
          assists?: number
          goals?: number
          host_org_id?: string | null
          id?: string
          match_date?: string | null
          match_id?: string | null
          minutes?: number | null
          org_id?: string
          player_id?: string
          recorded_at?: string
          red_cards?: number
          tournament_id?: string
          tournament_name?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_tournament_results_host_org_id_fkey"
            columns: ["host_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tournament_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tournament_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age: string | null
          club_id: string | null
          created_at: string
          development_status: string
          dob: string | null
          id: string
          jersey: string | null
          name: string
          notes: string | null
          org_id: string
          photo_url: string | null
          position: string | null
          preferred_foot: string | null
          secondary_position: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          age?: string | null
          club_id?: string | null
          created_at?: string
          development_status?: string
          dob?: string | null
          id?: string
          jersey?: string | null
          name: string
          notes?: string | null
          org_id?: string
          photo_url?: string | null
          position?: string | null
          preferred_foot?: string | null
          secondary_position?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          age?: string | null
          club_id?: string | null
          created_at?: string
          development_status?: string
          dob?: string | null
          id?: string
          jersey?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          photo_url?: string | null
          position?: string | null
          preferred_foot?: string | null
          secondary_position?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referees: {
        Row: {
          availability: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          phone: string | null
        }
        Insert: {
          availability?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          phone?: string | null
        }
        Update: {
          availability?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          category_id: string | null
          coach_name: string | null
          coach_phone: string | null
          id: string
          manager_email: string | null
          manager_name: string | null
          manager_phone: string | null
          org_id: string
          players: Json | null
          reject_reason: string | null
          status: string
          submitted_at: string
          team_name: string
        }
        Insert: {
          category_id?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          org_id: string
          players?: Json | null
          reject_reason?: string | null
          status?: string
          submitted_at?: string
          team_name: string
        }
        Update: {
          category_id?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          id?: string
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          org_id?: string
          players?: Json | null
          reject_reason?: string | null
          status?: string
          submitted_at?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignments: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          org_id: string | null
          role: string
          scope_id: string | null
          scope_type: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id?: string | null
          role: string
          scope_id?: string | null
          scope_type: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id?: string | null
          role?: string
          scope_id?: string | null
          scope_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_drills: {
        Row: {
          created_at: string
          drill_id: string
          id: string
          org_id: string
          session_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          drill_id: string
          id?: string
          org_id?: string
          session_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          drill_id?: string
          id?: string
          org_id?: string
          session_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_drills_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_drills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_drills_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          sort_order: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          sort_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          description: string | null
          key: string
          label: string
          scope: string
        }
        Insert: {
          category: string
          description?: string | null
          key: string
          label: string
          scope: string
        }
        Update: {
          category?: string
          description?: string | null
          key?: string
          label?: string
          scope?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permission_defaults: {
        Row: {
          permission_key: string
          role: string
        }
        Insert: {
          permission_key: string
          role: string
        }
        Update: {
          permission_key?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permission_defaults_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      guardian_permission_defaults: {
        Row: {
          permission_key: string
        }
        Insert: {
          permission_key: string
        }
        Update: {
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_permission_defaults_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      staff_permission_grants: {
        Row: {
          club_id: string
          granted: boolean
          granted_at: string
          granted_by: string | null
          id: string
          org_id: string
          permission_key: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          granted: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id: string
          permission_key: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          granted?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id?: string
          permission_key?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permission_grants_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permission_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_permission_grants_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "staff_permission_grants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_permission_grants: {
        Row: {
          granted: boolean
          granted_at: string
          granted_by: string | null
          id: string
          org_id: string
          permission_key: string
          player_guardian_id: string
        }
        Insert: {
          granted: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id: string
          permission_key: string
          player_guardian_id: string
        }
        Update: {
          granted?: boolean
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id?: string
          permission_key?: string
          player_guardian_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_permission_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_permission_grants_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "guardian_permission_grants_player_guardian_id_fkey"
            columns: ["player_guardian_id"]
            isOneToOne: false
            referencedRelation: "player_guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      team_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          from_date: string
          id: string
          jersey: string | null
          org_id: string
          player_id: string
          position: string | null
          team_id: string
          to_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_date?: string
          id?: string
          jersey?: string | null
          org_id?: string
          player_id: string
          position?: string | null
          team_id: string
          to_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_date?: string
          id?: string
          jersey?: string | null
          org_id?: string
          player_id?: string
          position?: string | null
          team_id?: string
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_staff: {
        Row: {
          id: string
          name: string
          org_id: string
          phone: string | null
          role: string | null
          role_other: string | null
          team_id: string
        }
        Insert: {
          id?: string
          name: string
          org_id?: string
          phone?: string | null
          role?: string | null
          role_other?: string | null
          team_id: string
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          role?: string | null
          role_other?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_staff_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_staff_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          birth_cert_status: string | null
          category_id: string | null
          club_id: string | null
          coach: string | null
          created_at: string
          id: string
          medical_status: string | null
          name: string
          org_id: string
          registration_status: string | null
          slug: string | null
          sport_id: string | null
          squad_type: string
        }
        Insert: {
          birth_cert_status?: string | null
          category_id?: string | null
          club_id?: string | null
          coach?: string | null
          created_at?: string
          id?: string
          medical_status?: string | null
          name: string
          org_id?: string
          registration_status?: string | null
          slug?: string | null
          sport_id?: string | null
          squad_type?: string
        }
        Update: {
          birth_cert_status?: string | null
          category_id?: string | null
          club_id?: string | null
          coach?: string | null
          created_at?: string
          id?: string
          medical_status?: string | null
          name?: string
          org_id?: string
          registration_status?: string | null
          slug?: string | null
          sport_id?: string | null
          squad_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_categories: {
        Row: {
          age_group: string | null
          created_at: string
          format: string | null
          id: string
          max_birth_year: number | null
          min_birth_year: number | null
          name: string
          org_id: string
          sort_order: number
          tournament_id: string
        }
        Insert: {
          age_group?: string | null
          created_at?: string
          format?: string | null
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name: string
          org_id?: string
          sort_order?: number
          tournament_id: string
        }
        Update: {
          age_group?: string | null
          created_at?: string
          format?: string | null
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name?: string
          org_id?: string
          sort_order?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_entries: {
        Row: {
          category_id: string | null
          club_id: string | null
          consent_at: string | null
          consent_by: string | null
          created_at: string
          created_by: string | null
          entrant_org_id: string | null
          host_org_id: string
          id: string
          roster_revision: number
          status: string
          team_id: string | null
          team_name: string
          tournament_id: string
        }
        Insert: {
          category_id?: string | null
          club_id?: string | null
          consent_at?: string | null
          consent_by?: string | null
          created_at?: string
          created_by?: string | null
          entrant_org_id?: string | null
          host_org_id: string
          id?: string
          roster_revision?: number
          status?: string
          team_id?: string | null
          team_name: string
          tournament_id: string
        }
        Update: {
          category_id?: string | null
          club_id?: string | null
          consent_at?: string | null
          consent_by?: string | null
          created_at?: string
          created_by?: string | null
          entrant_org_id?: string | null
          host_org_id?: string
          id?: string
          roster_revision?: number
          status?: string
          team_id?: string | null
          team_name?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_entrant_org_id_fkey"
            columns: ["entrant_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_host_org_id_fkey"
            columns: ["host_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_members: {
        Row: {
          created_at: string
          created_by: string | null
          entry_id: string | null
          id: string
          org_id: string
          role: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_id?: string | null
          id?: string
          org_id?: string
          role: string
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_id?: string | null
          id?: string
          org_id?: string
          role?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_members_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "tournament_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_officials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          official_id: string
          org_id: string
          role: string
          tournament_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          official_id: string
          org_id?: string
          role?: string
          tournament_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          official_id?: string
          org_id?: string
          role?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_officials_official_id_fkey"
            columns: ["official_id"]
            isOneToOne: false
            referencedRelation: "org_officials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_officials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_officials_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_officials_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_roster: {
        Row: {
          added_in_revision: number
          consent_on_file: boolean
          created_at: string
          created_by: string | null
          dob: string | null
          entry_id: string
          full_name: string
          id: string
          jersey: string | null
          org_id: string
          player_id: string | null
          position: string | null
          reject_reason: string | null
          source_org_id: string | null
          status: string
          tournament_id: string
          withdrawn_in_revision: number | null
        }
        Insert: {
          added_in_revision?: number
          consent_on_file?: boolean
          created_at?: string
          created_by?: string | null
          dob?: string | null
          entry_id: string
          full_name: string
          id?: string
          jersey?: string | null
          org_id?: string
          player_id?: string | null
          position?: string | null
          reject_reason?: string | null
          source_org_id?: string | null
          status?: string
          tournament_id: string
          withdrawn_in_revision?: number | null
        }
        Update: {
          added_in_revision?: number
          consent_on_file?: boolean
          created_at?: string
          created_by?: string | null
          dob?: string | null
          entry_id?: string
          full_name?: string
          id?: string
          jersey?: string | null
          org_id?: string
          player_id?: string | null
          position?: string | null
          reject_reason?: string | null
          source_org_id?: string | null
          status?: string
          tournament_id?: string
          withdrawn_in_revision?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_roster_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "tournament_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_roster_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_roster_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_roster_source_org_id_fkey"
            columns: ["source_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_roster_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "public_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_roster_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          data: Json | null
          event_date: string | null
          guest_access_enabled: boolean
          id: string
          name: string
          org_id: string | null
          poster_url: string | null
          publicly_listed: boolean
          slug: string | null
          sport_id: string | null
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_date?: string | null
          guest_access_enabled?: boolean
          id?: string
          name?: string
          org_id?: string | null
          poster_url?: string | null
          publicly_listed?: boolean
          slug?: string | null
          sport_id?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_date?: string | null
          guest_access_enabled?: boolean
          id?: string
          name?: string
          org_id?: string | null
          poster_url?: string | null
          publicly_listed?: boolean
          slug?: string | null
          sport_id?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          club_id: string
          coach_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string | null
          objective: string | null
          org_id: string
          starts_at: string
          status: string
          team_id: string
          theme: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          club_id: string
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          objective?: string | null
          org_id?: string
          starts_at: string
          status?: string
          team_id: string
          theme?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          club_id?: string
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          objective?: string | null
          org_id?: string
          starts_at?: string
          status?: string
          team_id?: string
          theme?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_passengers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          player_id: string
          seat: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          player_id: string
          seat?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          player_id?: string
          seat?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_passengers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_passengers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_passengers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_passengers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_transportation: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string | null
          dropoff_point: string | null
          id: string
          org_id: string
          pickup_point: string | null
          trip_id: string
          updated_at: string
          vehicle_info: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          dropoff_point?: string | null
          id?: string
          org_id?: string
          pickup_point?: string | null
          trip_id: string
          updated_at?: string
          vehicle_info?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          dropoff_point?: string | null
          id?: string
          org_id?: string
          pickup_point?: string | null
          trip_id?: string
          updated_at?: string
          vehicle_info?: Json
        }
        Relationships: [
          {
            foreignKeyName: "trip_transportation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_transportation_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_transportation_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_transportation_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          club_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          name: string
          org_id: string
          purpose: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name: string
          org_id?: string
          purpose?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          org_id?: string
          purpose?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "public_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assigned_teams: {
        Row: {
          is_primary: boolean
          org_id: string
          team_id: string
          user_id: string
        }
        Insert: {
          is_primary?: boolean
          org_id?: string
          team_id: string
          user_id: string
        }
        Update: {
          is_primary?: boolean
          org_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assigned_teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assigned_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assigned_teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          linked_referee_id: string | null
          name: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          linked_referee_id?: string | null
          name?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          linked_referee_id?: string | null
          name?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_linked_referee_id_fkey"
            columns: ["linked_referee_id"]
            isOneToOne: false
            referencedRelation: "referees"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          org_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_clubs: {
        Row: {
          about: string | null
          id: string | null
          location: string | null
          name: string | null
          org_accent: string | null
          org_name: string | null
          org_slug: string | null
          slug: string | null
          sport_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tournaments: {
        Row: {
          event_date: string | null
          id: string | null
          name: string | null
          org_accent: string | null
          org_logo_url: string | null
          org_name: string | null
          org_slug: string | null
          poster_url: string | null
          slug: string | null
          sport_id: string | null
          venue: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      age_on: { Args: { p_dob: string; p_on?: string }; Returns: number }
      approval_is_granted: {
        Args: { p_subject_id: string; p_subject_type: string }
        Returns: boolean
      }
      can_admin_club: {
        Args: { p_club: string; p_org: string }
        Returns: boolean
      }
      can_create_fees: {
        Args: { p_club: string; p_org: string }
        Returns: boolean
      }
      can_read_club: {
        Args: { p_club: string; p_org: string }
        Returns: boolean
      }
      current_dula_user_id: { Args: never; Returns: string }
      current_user_org_ids: { Args: never; Returns: string[] }
      current_user_role: { Args: never; Returns: string }
      current_user_team_ids: { Args: never; Returns: string[] }
      expire_stale_approvals: { Args: never; Returns: number }
      has_guardian_permission: {
        Args: { p_permission_key: string; p_player_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { p_roles: string[]; p_scope_id: string; p_scope_type: string }
        Returns: boolean
      }
      has_staff_permission: {
        Args: { p_club_id: string; p_permission_key: string; p_team_id?: string }
        Returns: boolean
      }
      is_assigned_to_team: { Args: { check_team_id: string }; Returns: boolean }
      is_club_manager: { Args: { check_club_id: string }; Returns: boolean }
      start_impersonation: {
        Args: {
          p_target_user_id: string
          p_club_id: string
          p_reason: string
          p_minutes?: number
        }
        Returns: string
      }
      end_impersonation: { Args: { p_session_id: string }; Returns: undefined }
      my_active_impersonation: {
        Args: never
        Returns: {
          session_id: string
          club_id: string
          target_user_id: string
          target_name: string | null
          reason: string
          expires_at: string
        }[]
      }
      effective_access_for: {
        Args: { p_target_user_id: string; p_club_id: string }
        Returns: Json
      }
      anon_executable_secdef_count: { Args: never; Returns: number }
      it_club_directory: {
        Args: { p_club_id: string }
        Returns: {
          user_id: string
          name: string | null
          email: string | null
          role: string
          is_platform_admin: boolean
        }[]
      }
      is_club_staff: { Args: { check_club_id: string }; Returns: boolean }
      is_guardian_of: { Args: { check_player_id: string }; Returns: boolean }
      is_org_admin: { Args: { org: string }; Returns: boolean }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_player_self: { Args: { check_player_id: string }; Returns: boolean }
      is_staff_in_org: { Args: { p_org: string }; Returns: boolean }
      my_guardian_permissions: {
        Args: { p_player_id: string }
        Returns: string[]
      }
      my_staff_permissions: {
        Args: { p_club_id: string; p_team_id?: string }
        Returns: string[]
      }
      org_has_product: {
        Args: { org: string; p_product: string }
        Returns: boolean
      }
      port_match_results_home: { Args: { p_match_id: string }; Returns: number }
      push_subscription_targets: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: { endpoint: string; p256dh: string; auth_key: string }[]
      }
      save_push_subscription: {
        Args: { p_endpoint: string; p_p256dh: string; p_auth_key: string }
        Returns: undefined
      }
      set_team_primary_coach: {
        Args: { p_team_id: string; p_user_id: string | null }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_org_id: string
          p_recipient_user_id: string | null
          p_recipient_guardian_id: string | null
          p_channel: string
          p_template: string
          p_payload: Json
          p_link_path: string | null
        }
        Returns: string
      }
      mark_notification_sent: {
        Args: { p_notification_id: string; p_failed_reason?: string | null }
        Returns: undefined
      }
      delete_stale_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      port_squad_to_tournament: {
        Args: { p_entry_id: string; p_player_ids: string[] }
        Returns: {
          outcome: string
          player_id: string
          roster_id: string
        }[]
      }
      recompute_fee_status: {
        Args: { p_fee_charge_id: string }
        Returns: undefined
      }
      transfer_player_to_team: {
        Args: { p_player_id: string; p_new_team_id: string }
        Returns: string
      }
      requires_guardian_consent: {
        Args: { p_on?: string; p_player_id: string }
        Returns: boolean
      }
      roster_consent_granted: {
        Args: { p_entry_id: string; p_player_id: string }
        Returns: boolean
      }
      withdraw_from_tournament_roster: {
        Args: {
          p_reason: string
          p_roster_id: string
        }
        Returns: {
          new_revision: number
          withdrawn_name: string
          withdrawn_player_id: string
        }[]
      }
      write_audit: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type?: string
          p_org_id: string
          p_scope_id?: string
          p_scope_type?: string
        }
        Returns: number
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
