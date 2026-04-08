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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          entity_id: string
          entity_type: string
          id: string
          message: string | null
          rejection_reason: string | null
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["access_request_status"]
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["access_request_status"]
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          message?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["access_request_status"]
        }
        Relationships: []
      }
      activity_summaries: {
        Row: {
          ai_summary: string | null
          company_id: string | null
          concerns: string[] | null
          created_at: string
          highlights: string[] | null
          id: string
          metrics: Json
          period_end: string
          period_start: string
          summary_type: string
          workspace_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          company_id?: string | null
          concerns?: string[] | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          metrics?: Json
          period_end: string
          period_start: string
          summary_type: string
          workspace_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          company_id?: string | null
          concerns?: string[] | null
          created_at?: string
          highlights?: string[] | null
          id?: string
          metrics?: Json
          period_end?: string
          period_start?: string
          summary_type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_summaries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          context: Json
          diff: Json
          entity_id: string
          entity_type: string
          id: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          context?: Json
          diff?: Json
          entity_id: string
          entity_type: string
          id?: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          context?: Json
          diff?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_pipelines: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          job_id: string
          run_by: string | null
          started_at: string | null
          status: string
          steps_completed: Json
          steps_failed: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          job_id: string
          run_by?: string | null
          started_at?: string | null
          status?: string
          steps_completed?: Json
          steps_failed?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          job_id?: string
          run_by?: string | null
          started_at?: string | null
          status?: string
          steps_completed?: Json
          steps_failed?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_pipelines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          pipeline_id: string
          started_at: string | null
          status: string
          step_name: string
          step_number: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          pipeline_id: string
          started_at?: string | null
          status?: string
          step_name: string
          step_number: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          pipeline_id?: string
          started_at?: string | null
          status?: string
          step_name?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "automation_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          billing_mode: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          day_rate: number | null
          end_date: string | null
          engagement_id: string
          estimated_days: number | null
          fixed_amount: number | null
          frequency: string
          id: string
          included_days: number | null
          invoice_day_of_month: number | null
          last_run_at: string | null
          next_run_date: string | null
          notes: string | null
          plan_name: string
          plan_type: string
          po_number: string | null
          status: string
          updated_at: string
          vat_rate: number | null
          workspace_id: string
        }
        Insert: {
          billing_mode?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          day_rate?: number | null
          end_date?: string | null
          engagement_id: string
          estimated_days?: number | null
          fixed_amount?: number | null
          frequency?: string
          id?: string
          included_days?: number | null
          invoice_day_of_month?: number | null
          last_run_at?: string | null
          next_run_date?: string | null
          notes?: string | null
          plan_name: string
          plan_type?: string
          po_number?: string | null
          status?: string
          updated_at?: string
          vat_rate?: number | null
          workspace_id: string
        }
        Update: {
          billing_mode?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          day_rate?: number | null
          end_date?: string | null
          engagement_id?: string
          estimated_days?: number | null
          fixed_amount?: number | null
          frequency?: string
          id?: string
          included_days?: number | null
          invoice_day_of_month?: number | null
          last_run_at?: string | null
          next_run_date?: string | null
          notes?: string | null
          plan_name?: string
          plan_type?: string
          po_number?: string | null
          status?: string
          updated_at?: string
          vat_rate?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_plans_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token_encrypted: string | null
          auto_schedule_enabled: boolean
          calendar_id: string | null
          created_at: string
          id: string
          is_active: boolean
          provider: string
          provider_account_email: string | null
          refresh_token_encrypted: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          auto_schedule_enabled?: boolean
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider: string
          provider_account_email?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          auto_schedule_enabled?: boolean
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          provider_account_email?: string | null
          refresh_token_encrypted?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      call_outcomes: {
        Row: {
          ai_transcript: Json | null
          availability_date: string | null
          best_callback_time: string | null
          call_type: string | null
          called_at: string
          caller_id: string | null
          candidate_id: string | null
          contact_id: string | null
          created_at: string
          duration_seconds: number | null
          engagement_id: string | null
          event_id: string | null
          follow_up_action: string | null
          follow_up_due: string | null
          id: string
          interest_level: string | null
          notes: string | null
          notice_period: string | null
          outcome: Database["public"]["Enums"]["call_outcome_type"]
          structured_answers: Json | null
          target_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_transcript?: Json | null
          availability_date?: string | null
          best_callback_time?: string | null
          call_type?: string | null
          called_at?: string
          caller_id?: string | null
          candidate_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          engagement_id?: string | null
          event_id?: string | null
          follow_up_action?: string | null
          follow_up_due?: string | null
          id?: string
          interest_level?: string | null
          notes?: string | null
          notice_period?: string | null
          outcome: Database["public"]["Enums"]["call_outcome_type"]
          structured_answers?: Json | null
          target_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_transcript?: Json | null
          availability_date?: string | null
          best_callback_time?: string | null
          call_type?: string | null
          called_at?: string
          caller_id?: string | null
          candidate_id?: string | null
          contact_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          engagement_id?: string | null
          event_id?: string | null
          follow_up_action?: string | null
          follow_up_due?: string | null
          id?: string
          interest_level?: string | null
          notes?: string | null
          notice_period?: string | null
          outcome?: Database["public"]["Enums"]["call_outcome_type"]
          structured_answers?: Json | null
          target_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_outcomes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_outcomes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_outcomes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_outcomes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "outreach_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_outcomes_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "outreach_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_outcomes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_interviews: {
        Row: {
          candidate_id: string
          company_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          interviewer: string | null
          interviewer_user_id: string | null
          next_action: string | null
          notes: string | null
          opportunity_id: string | null
          outcome: Database["public"]["Enums"]["interview_outcome"] | null
          owner_id: string | null
          scheduled_at: string | null
          stage: Database["public"]["Enums"]["interview_stage"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interviewer?: string | null
          interviewer_user_id?: string | null
          next_action?: string | null
          notes?: string | null
          opportunity_id?: string | null
          outcome?: Database["public"]["Enums"]["interview_outcome"] | null
          owner_id?: string | null
          scheduled_at?: string | null
          stage: Database["public"]["Enums"]["interview_stage"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interviewer?: string | null
          interviewer_user_id?: string | null
          next_action?: string | null
          notes?: string | null
          opportunity_id?: string | null
          outcome?: Database["public"]["Enums"]["interview_outcome"] | null
          owner_id?: string | null
          scheduled_at?: string | null
          stage?: Database["public"]["Enums"]["interview_stage"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_interviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_interviews_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "candidate_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_notes: {
        Row: {
          body: string
          candidate_id: string
          created_at: string
          deletion_requested_at: string | null
          deletion_requested_by: string | null
          id: string
          is_deleted: boolean | null
          owner_id: string | null
          pinned: boolean
          tags: string[] | null
          team_id: string | null
          title: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["note_visibility"] | null
        }
        Insert: {
          body: string
          candidate_id: string
          created_at?: string
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          id?: string
          is_deleted?: boolean | null
          owner_id?: string | null
          pinned?: boolean
          tags?: string[] | null
          team_id?: string | null
          title?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"] | null
        }
        Update: {
          body?: string
          candidate_id?: string
          created_at?: string
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          id?: string
          is_deleted?: boolean | null
          owner_id?: string | null
          pinned?: boolean
          tags?: string[] | null
          team_id?: string | null
          title?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_opportunities: {
        Row: {
          candidate_id: string
          company_id: string | null
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          owner_id: string | null
          project_name: string | null
          rate: string | null
          role_name: string
          start_date: string | null
          status: Database["public"]["Enums"]["opportunity_status"] | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          project_name?: string | null
          rate?: string | null
          role_name: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"] | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          company_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          project_name?: string | null
          rate?: string | null
          role_name?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"] | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_opportunities_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          ai_overview: string | null
          availability_status: string | null
          created_at: string
          current_company: string | null
          current_title: string | null
          cv_storage_path: string | null
          education: Json | null
          email: string | null
          experience: Json | null
          headline: string | null
          id: string
          linkedin_url: string | null
          location: string | null
          name: string
          owner_id: string | null
          phone: string | null
          raw_cv_text: string | null
          search_vector: unknown
          skills: Json | null
          source: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          ai_overview?: string | null
          availability_status?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          cv_storage_path?: string | null
          education?: Json | null
          email?: string | null
          experience?: Json | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name: string
          owner_id?: string | null
          phone?: string | null
          raw_cv_text?: string | null
          search_vector?: unknown
          skills?: Json | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_overview?: string | null
          availability_status?: string | null
          created_at?: string
          current_company?: string | null
          current_title?: string | null
          cv_storage_path?: string | null
          education?: Json | null
          email?: string | null
          experience?: Json | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          location?: string | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          raw_cv_text?: string | null
          search_vector?: unknown
          skills?: Json | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_edges: {
        Row: {
          company_id: string | null
          created_at: string
          from_node_id: string
          id: string
          relationship_type: string | null
          to_node_id: string
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          from_node_id: string
          id?: string
          relationship_type?: string | null
          to_node_id: string
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          from_node_id?: string
          id?: string
          relationship_type?: string | null
          to_node_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_edges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "canvas_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "canvas_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_edges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_nodes: {
        Row: {
          candidate_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          department: string | null
          id: string
          label_name: string | null
          label_title: string | null
          updated_at: string
          verification_status: string | null
          workspace_id: string
          x: number
          y: number
        }
        Insert: {
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          department?: string | null
          id?: string
          label_name?: string | null
          label_title?: string | null
          updated_at?: string
          verification_status?: string | null
          workspace_id: string
          x?: number
          y?: number
        }
        Update: {
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          department?: string | null
          id?: string
          label_name?: string | null
          label_title?: string | null
          updated_at?: string
          verification_status?: string | null
          workspace_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_nodes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_documents: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          deal_id: string | null
          deletion_scheduled_purge_at: string | null
          end_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          name: string
          notes: string | null
          signed_date: string | null
          start_date: string | null
          status: string | null
          type: string
          updated_at: string | null
          value: number | null
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deal_id?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name: string
          notes?: string | null
          signed_date?: string | null
          start_date?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          value?: number | null
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          deal_id?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          signed_date?: string | null
          start_date?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          value?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          account_manager: string | null
          ceo_contact_id: string | null
          created_at: string
          data_quality: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          headquarters: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          notes: string | null
          owner_id: string | null
          regions: string[] | null
          relationship_status: string | null
          size: string | null
          switchboard: string | null
          team_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager?: string | null
          ceo_contact_id?: string | null
          created_at?: string
          data_quality?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          regions?: string[] | null
          relationship_status?: string | null
          size?: string | null
          switchboard?: string | null
          team_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager?: string | null
          ceo_contact_id?: string | null
          created_at?: string
          data_quality?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          regions?: string[] | null
          relationship_status?: string | null
          size?: string | null
          switchboard?: string | null
          team_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_ceo_contact_id_fkey"
            columns: ["ceo_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      company_billing_profiles: {
        Row: {
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_contact_id: string | null
          billing_country: string | null
          billing_email: string | null
          billing_postcode: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          po_number: string | null
          updated_at: string
          vat_number: string | null
          workspace_id: string
        }
        Insert: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_contact_id?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_postcode?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          po_number?: string | null
          updated_at?: string
          vat_number?: string | null
          workspace_id: string
        }
        Update: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_contact_id?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_postcode?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          po_number?: string | null
          updated_at?: string
          vat_number?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_billing_profiles_billing_contact_id_fkey"
            columns: ["billing_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_billing_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_billing_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      company_team_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_team_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_team_members: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_team_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          department: string | null
          email: string | null
          email_private: string | null
          id: string
          location: string | null
          manager_id: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          seniority: string | null
          status: string | null
          team_id: string | null
          title: string | null
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          department?: string | null
          email?: string | null
          email_private?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          seniority?: string | null
          status?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          department?: string | null
          email?: string | null
          email_private?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          seniority?: string | null
          status?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          body: string | null
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          direction: string | null
          id: string
          opportunity_id: string | null
          scheduled_at: string | null
          status: string
          subject: string | null
          type: string
        }
        Insert: {
          body?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          direction?: string | null
          id?: string
          opportunity_id?: string | null
          scheduled_at?: string | null
          status?: string
          subject?: string | null
          type: string
        }
        Update: {
          body?: string | null
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          direction?: string | null
          id?: string
          opportunity_id?: string | null
          scheduled_at?: string | null
          status?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ai_audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          input_summary: string | null
          ip_address: string | null
          output_summary: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          input_summary?: string | null
          ip_address?: string | null
          output_summary?: string | null
          user_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          input_summary?: string | null
          ip_address?: string | null
          output_summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_companies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          size: string | null
          source_company_id: string | null
          team_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          size?: string | null
          source_company_id?: string | null
          team_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          size?: string | null
          source_company_id?: string | null
          team_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_source_company_id_fkey"
            columns: ["source_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_companies_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          email: string | null
          first_name: string
          gdpr_consent: boolean
          gdpr_consent_date: string | null
          gdpr_consent_method: string | null
          id: string
          job_title: string | null
          last_name: string
          linkedin_url: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          preferred_contact: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          email?: string | null
          first_name: string
          gdpr_consent?: boolean
          gdpr_consent_date?: string | null
          gdpr_consent_method?: string | null
          id?: string
          job_title?: string | null
          last_name: string
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          email?: string | null
          first_name?: string
          gdpr_consent?: boolean
          gdpr_consent_date?: string | null
          gdpr_consent_method?: string | null
          id?: string
          job_title?: string | null
          last_name?: string
          linkedin_url?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          billing_email: string | null
          candidate_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          day_rate: number | null
          deal_type: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          end_date: string | null
          engagement_id: string | null
          expected_close_date: string | null
          fee_percentage: number | null
          id: string
          next_step: string | null
          next_step_due: string | null
          notes: string | null
          opportunity_id: string | null
          owner_id: string | null
          payment_terms: string | null
          probability: number | null
          project_id: string | null
          salary: number | null
          signed_date: string | null
          source: string | null
          stage: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
          value: number
          workspace_id: string | null
        }
        Insert: {
          billing_email?: string | null
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          day_rate?: number | null
          deal_type?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          engagement_id?: string | null
          expected_close_date?: string | null
          fee_percentage?: number | null
          id?: string
          next_step?: string | null
          next_step_due?: string | null
          notes?: string | null
          opportunity_id?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          probability?: number | null
          project_id?: string | null
          salary?: number | null
          signed_date?: string | null
          source?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          value?: number
          workspace_id?: string | null
        }
        Update: {
          billing_email?: string | null
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          day_rate?: number | null
          deal_type?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          engagement_id?: string | null
          expected_close_date?: string | null
          fee_percentage?: number | null
          id?: string
          next_step?: string | null
          next_step_due?: string | null
          notes?: string | null
          opportunity_id?: string | null
          owner_id?: string | null
          payment_terms?: string | null
          probability?: number | null
          project_id?: string | null
          salary?: number | null
          signed_date?: string | null
          source?: string | null
          stage?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          value?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_documents: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string | null
          deal_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          end_date: string | null
          file_name: string | null
          file_url: string | null
          id: string
          name: string | null
          notes: string | null
          sent_at: string | null
          signed_at: string | null
          start_date: string | null
          status: string
          title: string
          type: string
          updated_at: string
          value: number | null
          version: number
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          sent_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
          value?: number | null
          version?: number
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          sent_at?: string | null
          signed_at?: string | null
          start_date?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          value?: number | null
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invoice_line_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "crm_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_invoices: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          currency: string
          deal_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          project_id: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          currency: string
          expected_close_date: string | null
          id: string
          notes: string | null
          probability: number
          project_id: string | null
          stage: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          probability?: number
          project_id?: string | null
          stage?: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          notes?: string | null
          probability?: number
          project_id?: string | null
          stage?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_projects: {
        Row: {
          assigned_to: string | null
          budget: number | null
          company_id: string | null
          created_at: string
          created_by: string
          currency: string
          deal_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          project_type: string | null
          start_date: string | null
          status: string
          updated_at: string
          workflow_completed_stages: Json | null
          workflow_stage: string | null
          workflow_started_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          budget?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          workflow_completed_stages?: Json | null
          workflow_stage?: string | null
          workflow_started_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          budget?: number | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_type?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          workflow_completed_stages?: Json | null
          workflow_stage?: string | null
          workflow_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          error_summary: string | null
          fail_count: number
          id: string
          processed_files: number
          source: Database["public"]["Enums"]["cv_batch_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["cv_batch_status"]
          success_count: number
          tenant_id: string
          total_files: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          error_summary?: string | null
          fail_count?: number
          id?: string
          processed_files?: number
          source?: Database["public"]["Enums"]["cv_batch_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["cv_batch_status"]
          success_count?: number
          tenant_id: string
          total_files?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          error_summary?: string | null
          fail_count?: number
          id?: string
          processed_files?: number
          source?: Database["public"]["Enums"]["cv_batch_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["cv_batch_status"]
          success_count?: number
          tenant_id?: string
          total_files?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_import_items: {
        Row: {
          batch_id: string
          candidate_id: string | null
          checksum_sha256: string | null
          completed_at: string | null
          created_at: string
          dedupe_candidate_ids: Json | null
          error_message: string | null
          extracted_data: Json | null
          field_confidence: Json | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id: string
          parse_confidence: number | null
          search_tags: string[] | null
          search_vector: unknown
          started_at: string | null
          status: Database["public"]["Enums"]["cv_item_status"]
          storage_path: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          candidate_id?: string | null
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          dedupe_candidate_ids?: Json | null
          error_message?: string | null
          extracted_data?: Json | null
          field_confidence?: Json | null
          file_name: string
          file_size_bytes?: number
          file_type: string
          id?: string
          parse_confidence?: number | null
          search_tags?: string[] | null
          search_vector?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["cv_item_status"]
          storage_path?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          candidate_id?: string | null
          checksum_sha256?: string | null
          completed_at?: string | null
          created_at?: string
          dedupe_candidate_ids?: Json | null
          error_message?: string | null
          extracted_data?: Json | null
          field_confidence?: Json | null
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          parse_confidence?: number | null
          search_tags?: string[] | null
          search_vector?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["cv_item_status"]
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_import_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cv_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_import_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      data_change_requests: {
        Row: {
          applied_at: string | null
          canonical_contact_id: string | null
          company_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          duplicate_contact_ids: string[]
          id: string
          merge_data: Json | null
          reason: string | null
          rejection_reason: string | null
          request_type: string
          requested_at: string
          requested_by: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          applied_at?: string | null
          canonical_contact_id?: string | null
          company_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          duplicate_contact_ids?: string[]
          id?: string
          merge_data?: Json | null
          reason?: string | null
          rejection_reason?: string | null
          request_type: string
          requested_at?: string
          requested_by: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          applied_at?: string | null
          canonical_contact_id?: string | null
          company_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          duplicate_contact_ids?: string[]
          id?: string
          merge_data?: Json | null
          reason?: string | null
          rejection_reason?: string | null
          request_type?: string
          requested_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_change_requests_canonical_contact_id_fkey"
            columns: ["canonical_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_change_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_change_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          engagement_id: string | null
          expected_close_date: string | null
          id: string
          name: string
          next_step: string | null
          next_step_due: string | null
          owner_id: string | null
          probability: number
          stage: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          engagement_id?: string | null
          expected_close_date?: string | null
          id?: string
          name: string
          next_step?: string | null
          next_step_due?: string | null
          owner_id?: string | null
          probability?: number
          stage?: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          engagement_id?: string | null
          expected_close_date?: string | null
          id?: string
          name?: string
          next_step?: string | null
          next_step_due?: string | null
          owner_id?: string | null
          probability?: number
          stage?: string
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          created_at: string
          id: string
          reason: string
          record_id: string
          record_name: string
          record_type: string
          requested_at: string
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_purge_at: string | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          record_id: string
          record_name: string
          record_type: string
          requested_at?: string
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_purge_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          record_id?: string
          record_name?: string
          record_type?: string
          requested_at?: string
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_purge_at?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_events: {
        Row: {
          candidate_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          end_time: string
          event_type: string
          id: string
          job_id: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          event_type?: string
          id?: string
          job_id?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string
          id?: string
          job_id?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          entity_id: string
          entity_type: string
          file_size_bytes: number
          file_type: string
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
          raw_text: string | null
          storage_path: string
          tenant_id: string
          text_extracted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          entity_id: string
          entity_type: string
          file_size_bytes?: number
          file_type: string
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
          raw_text?: string | null
          storage_path: string
          tenant_id: string
          text_extracted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          entity_id?: string
          entity_type?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
          raw_text?: string | null
          storage_path?: string
          tenant_id?: string
          text_extracted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_rate_limits: {
        Row: {
          function_name: string
          id: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          function_name: string
          id?: string
          request_count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          function_name?: string
          id?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body_html?: string
          created_at?: string
          id?: string
          name: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body_html?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      engagements: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          description: string | null
          end_date: string | null
          engagement_type: string
          forecast_value: number
          health: string
          hiring_manager_id: string | null
          id: string
          name: string
          owner_id: string | null
          stage: string
          start_date: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          description?: string | null
          end_date?: string | null
          engagement_type?: string
          forecast_value?: number
          health?: string
          hiring_manager_id?: string | null
          id?: string
          name: string
          owner_id?: string | null
          stage?: string
          start_date?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          description?: string | null
          end_date?: string | null
          engagement_type?: string
          forecast_value?: number
          health?: string
          hiring_manager_id?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          stage?: string
          start_date?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_insights: {
        Row: {
          company_id: string | null
          created_at: string
          data: Json
          description: string
          dismissed_at: string | null
          dismissed_by: string | null
          expires_at: string | null
          id: string
          insight_type: string
          is_dismissed: boolean
          related_contact_ids: string[] | null
          related_entity_ids: string[] | null
          severity: string
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          data?: Json
          description: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          expires_at?: string | null
          id?: string
          insight_type: string
          is_dismissed?: boolean
          related_contact_ids?: string[] | null
          related_entity_ids?: string[] | null
          severity?: string
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          data?: Json
          description?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          expires_at?: string | null
          id?: string
          insight_type?: string
          is_dismissed?: boolean
          related_contact_ids?: string[] | null
          related_entity_ids?: string[] | null
          severity?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_insights_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_queries: {
        Row: {
          created_at: string
          feedback_rating: number | null
          id: string
          query_text: string
          query_type: string | null
          response_data: Json | null
          response_summary: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          feedback_rating?: number | null
          id?: string
          query_text: string
          query_type?: string | null
          response_data?: Json | null
          response_summary?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          feedback_rating?: number | null
          id?: string
          query_text?: string
          query_type?: string | null
          response_data?: Json | null
          response_summary?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_queries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_consent_log: {
        Row: {
          action: string
          contact_id: string
          created_at: string
          id: string
          method: string | null
          recorded_by: string
        }
        Insert: {
          action: string
          contact_id: string
          created_at?: string
          id?: string
          method?: string | null
          recorded_by: string
        }
        Update: {
          action?: string
          contact_id?: string
          created_at?: string
          id?: string
          method?: string | null
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_consent_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_exports: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string | null
          executive_summary: string | null
          file_type: string
          id: string
          included_sections: Json | null
          job_spec_id: string | null
          storage_path: string
          template_style: string
          workspace_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by?: string | null
          executive_summary?: string | null
          file_type?: string
          id?: string
          included_sections?: Json | null
          job_spec_id?: string | null
          storage_path: string
          template_style?: string
          workspace_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          executive_summary?: string | null
          file_type?: string
          id?: string
          included_sections?: Json | null
          job_spec_id?: string | null
          storage_path?: string
          template_style?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_exports_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_exports_job_spec_id_fkey"
            columns: ["job_spec_id"]
            isOneToOne: false
            referencedRelation: "job_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_exports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      import_entities: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          batch_id: string
          confidence: number | null
          created_at: string
          created_record_id: string | null
          created_record_type: string | null
          duplicate_of_id: string | null
          duplicate_of_type: string | null
          edited_json: Json | null
          entity_type: Database["public"]["Enums"]["import_entity_type"]
          extracted_json: Json
          id: string
          item_id: string | null
          missing_fields: string[] | null
          rejected_reason: string | null
          status: Database["public"]["Enums"]["import_entity_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id: string
          confidence?: number | null
          created_at?: string
          created_record_id?: string | null
          created_record_type?: string | null
          duplicate_of_id?: string | null
          duplicate_of_type?: string | null
          edited_json?: Json | null
          entity_type: Database["public"]["Enums"]["import_entity_type"]
          extracted_json?: Json
          id?: string
          item_id?: string | null
          missing_fields?: string[] | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["import_entity_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string
          confidence?: number | null
          created_at?: string
          created_record_id?: string | null
          created_record_type?: string | null
          duplicate_of_id?: string | null
          duplicate_of_type?: string | null
          edited_json?: Json | null
          entity_type?: Database["public"]["Enums"]["import_entity_type"]
          extracted_json?: Json
          id?: string
          item_id?: string | null
          missing_fields?: string[] | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["import_entity_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_entities_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cv_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_entities_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "cv_import_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          created_at: string
          id: string
          is_configured: boolean
          key_name: string
          key_value: string
          service: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_configured?: boolean
          key_name: string
          key_value?: string
          service: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_configured?: boolean
          key_name?: string
          key_value?: string
          service?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number
          quantity: number
          sort_order: number
          unit_price: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number
          quantity?: number
          sort_order?: number
          unit_price?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          unit_price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_plans: {
        Row: {
          amount_mode: string
          auto_send: boolean
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          description: string | null
          draft_auto_create: boolean
          end_date: string | null
          engagement_id: string | null
          estimated_days: number | null
          fixed_amount: number | null
          frequency: string
          id: string
          interval_count: number
          invoice_day_of_month: number | null
          invoice_day_of_week: number | null
          name: string
          next_run_date: string | null
          plan_type: string
          rate_per_day: number | null
          sow_id: string | null
          start_date: string
          status: string
          updated_at: string
          vat_rate: number | null
          workspace_id: string
        }
        Insert: {
          amount_mode?: string
          auto_send?: boolean
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          description?: string | null
          draft_auto_create?: boolean
          end_date?: string | null
          engagement_id?: string | null
          estimated_days?: number | null
          fixed_amount?: number | null
          frequency?: string
          id?: string
          interval_count?: number
          invoice_day_of_month?: number | null
          invoice_day_of_week?: number | null
          name: string
          next_run_date?: string | null
          plan_type?: string
          rate_per_day?: number | null
          sow_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          vat_rate?: number | null
          workspace_id: string
        }
        Update: {
          amount_mode?: string
          auto_send?: boolean
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          description?: string | null
          draft_auto_create?: boolean
          end_date?: string | null
          engagement_id?: string | null
          estimated_days?: number | null
          fixed_amount?: number | null
          frequency?: string
          id?: string
          interval_count?: number
          invoice_day_of_month?: number | null
          invoice_day_of_week?: number | null
          name?: string
          next_run_date?: string | null
          plan_type?: string
          rate_per_day?: number | null
          sow_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          vat_rate?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_plans_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_plans_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_plans_sow_id_fkey"
            columns: ["sow_id"]
            isOneToOne: false
            referencedRelation: "sows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_runs: {
        Row: {
          billing_plan_id: string
          created_at: string
          created_by: string | null
          dedupe_key: string
          due_date: string | null
          engagement_id: string
          error_message: string | null
          errors: Json | null
          id: string
          invoice_id: string | null
          invoices_created: number | null
          invoices_skipped: number | null
          period_end: string
          period_start: string
          plans_processed: number | null
          ran_at: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          billing_plan_id: string
          created_at?: string
          created_by?: string | null
          dedupe_key: string
          due_date?: string | null
          engagement_id: string
          error_message?: string | null
          errors?: Json | null
          id?: string
          invoice_id?: string | null
          invoices_created?: number | null
          invoices_skipped?: number | null
          period_end: string
          period_start: string
          plans_processed?: number | null
          ran_at?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          billing_plan_id?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string
          due_date?: string | null
          engagement_id?: string
          error_message?: string | null
          errors?: Json | null
          id?: string
          invoice_id?: string | null
          invoices_created?: number | null
          invoices_skipped?: number | null
          period_end?: string
          period_start?: string
          plans_processed?: number | null
          ran_at?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_runs_billing_plan_id_fkey"
            columns: ["billing_plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_runs_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_runs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_to_address: Json | null
          billing_to_email: string | null
          billing_to_name: string | null
          company_id: string
          created_at: string
          currency: string
          document_id: string | null
          due_date: string | null
          engagement_id: string | null
          id: string
          invoice_number: string | null
          invoice_plan_id: string | null
          issued_date: string | null
          notes: string | null
          paid_date: string | null
          pdf_url: string | null
          po_number: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
          vat_number: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          billing_to_address?: Json | null
          billing_to_email?: string | null
          billing_to_name?: string | null
          company_id: string
          created_at?: string
          currency?: string
          document_id?: string | null
          due_date?: string | null
          engagement_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_plan_id?: string | null
          issued_date?: string | null
          notes?: string | null
          paid_date?: string | null
          pdf_url?: string | null
          po_number?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          vat_number?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          billing_to_address?: Json | null
          billing_to_email?: string | null
          billing_to_name?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          document_id?: string | null
          due_date?: string | null
          engagement_id?: string | null
          id?: string
          invoice_number?: string | null
          invoice_plan_id?: string | null
          issued_date?: string | null
          notes?: string | null
          paid_date?: string | null
          pdf_url?: string | null
          po_number?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          vat_number?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_invoice_plan_id_fkey"
            columns: ["invoice_plan_id"]
            isOneToOne: false
            referencedRelation: "invoice_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_adverts: {
        Row: {
          board: string | null
          board_job_id: string | null
          character_count: number | null
          content: string | null
          created_at: string | null
          expires_at: string | null
          generated_at: string | null
          id: string
          job_id: string
          last_posted_at: string | null
          published_at: string | null
          status: string | null
          user_edits: string | null
          word_count: number | null
          workspace_id: string
        }
        Insert: {
          board?: string | null
          board_job_id?: string | null
          character_count?: number | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          job_id: string
          last_posted_at?: string | null
          published_at?: string | null
          status?: string | null
          user_edits?: string | null
          word_count?: number | null
          workspace_id: string
        }
        Update: {
          board?: string | null
          board_job_id?: string | null
          character_count?: number | null
          content?: string | null
          created_at?: string | null
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          job_id?: string
          last_posted_at?: string | null
          published_at?: string | null
          status?: string | null
          user_edits?: string | null
          word_count?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_adverts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_adverts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          ai_gaps: string[] | null
          ai_match_score: number | null
          ai_recommended_action: string | null
          ai_strengths: string[] | null
          ai_summary: string | null
          applicant_email: string | null
          applicant_name: string | null
          applicant_phone: string | null
          candidate_id: string | null
          cover_letter: string | null
          created_at: string | null
          cv_url: string | null
          gdpr_consent: boolean
          id: string
          job_id: string
          linkedin_url: string | null
          processed_at: string | null
          source: string | null
          status: string | null
          workspace_id: string
        }
        Insert: {
          ai_gaps?: string[] | null
          ai_match_score?: number | null
          ai_recommended_action?: string | null
          ai_strengths?: string[] | null
          ai_summary?: string | null
          applicant_email?: string | null
          applicant_name?: string | null
          applicant_phone?: string | null
          candidate_id?: string | null
          cover_letter?: string | null
          created_at?: string | null
          cv_url?: string | null
          gdpr_consent?: boolean
          id?: string
          job_id: string
          linkedin_url?: string | null
          processed_at?: string | null
          source?: string | null
          status?: string | null
          workspace_id: string
        }
        Update: {
          ai_gaps?: string[] | null
          ai_match_score?: number | null
          ai_recommended_action?: string | null
          ai_strengths?: string[] | null
          ai_summary?: string | null
          applicant_email?: string | null
          applicant_name?: string | null
          applicant_phone?: string | null
          candidate_id?: string | null
          cover_letter?: string | null
          created_at?: string | null
          cv_url?: string | null
          gdpr_consent?: boolean
          id?: string
          job_id?: string
          linkedin_url?: string | null
          processed_at?: string | null
          source?: string | null
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_board_formats: {
        Row: {
          board: string | null
          created_at: string | null
          id: string
          max_characters: number | null
          max_words: number | null
          notes: string | null
          required_sections: string[] | null
          template: string | null
          workspace_id: string
        }
        Insert: {
          board?: string | null
          created_at?: string | null
          id?: string
          max_characters?: number | null
          max_words?: number | null
          notes?: string | null
          required_sections?: string[] | null
          template?: string | null
          workspace_id: string
        }
        Update: {
          board?: string | null
          created_at?: string | null
          id?: string
          max_characters?: number | null
          max_words?: number | null
          notes?: string | null
          required_sections?: string[] | null
          template?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_board_formats_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_board_subscriptions: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          id: string
          plan: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          id?: string
          plan?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          id?: string
          plan?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_board_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_board_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_searches: {
        Row: {
          ai_rationale: string | null
          boolean_string: string | null
          id: string
          job_id: string
          pool_size: number | null
          results_by_pass: Json | null
          run_at: string
          run_by: string | null
          search_params: Json
          total_found: number | null
          workspace_id: string
        }
        Insert: {
          ai_rationale?: string | null
          boolean_string?: string | null
          id?: string
          job_id: string
          pool_size?: number | null
          results_by_pass?: Json | null
          run_at?: string
          run_by?: string | null
          search_params?: Json
          total_found?: number | null
          workspace_id: string
        }
        Update: {
          ai_rationale?: string | null
          boolean_string?: string | null
          id?: string
          job_id?: string
          pool_size?: number | null
          results_by_pass?: Json | null
          run_at?: string
          run_by?: string | null
          search_params?: Json
          total_found?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_searches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_shortlist: {
        Row: {
          availability_confirmed: string | null
          availability_warning: string | null
          candidate_id: string | null
          candidate_interest: string | null
          concerns: string[] | null
          created_at: string | null
          id: string
          interview_booked_at: string | null
          job_id: string
          match_breakdown: Json | null
          match_pass: number | null
          match_reasons: string[] | null
          match_score: number | null
          notes: string | null
          outreach_sent_at: string | null
          priority: number | null
          response_received_at: string | null
          status: string | null
          workspace_id: string
        }
        Insert: {
          availability_confirmed?: string | null
          availability_warning?: string | null
          candidate_id?: string | null
          candidate_interest?: string | null
          concerns?: string[] | null
          created_at?: string | null
          id?: string
          interview_booked_at?: string | null
          job_id: string
          match_breakdown?: Json | null
          match_pass?: number | null
          match_reasons?: string[] | null
          match_score?: number | null
          notes?: string | null
          outreach_sent_at?: string | null
          priority?: number | null
          response_received_at?: string | null
          status?: string | null
          workspace_id: string
        }
        Update: {
          availability_confirmed?: string | null
          availability_warning?: string | null
          candidate_id?: string | null
          candidate_interest?: string | null
          concerns?: string[] | null
          created_at?: string | null
          id?: string
          interview_booked_at?: string | null
          job_id?: string
          match_breakdown?: Json | null
          match_pass?: number | null
          match_reasons?: string[] | null
          match_score?: number | null
          notes?: string | null
          outreach_sent_at?: string | null
          priority?: number | null
          response_received_at?: string | null
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_shortlist_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_shortlist_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_shortlist_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_spec_matches: {
        Row: {
          created_at: string
          id: string
          job_spec_id: string
          match_reasoning: string | null
          overall_score: number
          recency_score: number
          risk_flags: string[]
          score_breakdown: Json
          sector_company_score: number
          skill_match_score: number
          status: string
          suggested_questions: string[]
          talent_id: string
          tenure_score: number
          top_evidence_snippets: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_spec_id: string
          match_reasoning?: string | null
          overall_score?: number
          recency_score?: number
          risk_flags?: string[]
          score_breakdown?: Json
          sector_company_score?: number
          skill_match_score?: number
          status?: string
          suggested_questions?: string[]
          talent_id: string
          tenure_score?: number
          top_evidence_snippets?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_spec_id?: string
          match_reasoning?: string | null
          overall_score?: number
          recency_score?: number
          risk_flags?: string[]
          score_breakdown?: Json
          sector_company_score?: number
          skill_match_score?: number
          status?: string
          suggested_questions?: string[]
          talent_id?: string
          tenure_score?: number
          top_evidence_snippets?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_spec_matches_job_spec_id_fkey"
            columns: ["job_spec_id"]
            isOneToOne: false
            referencedRelation: "job_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_spec_matches_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_spec_matches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      job_specs: {
        Row: {
          client_company_id: string | null
          created_at: string
          created_by: string | null
          day_rate_range: string | null
          description_text: string | null
          id: string
          key_skills: string[] | null
          location: string | null
          salary_range: string | null
          sector: string | null
          title: string
          type: Database["public"]["Enums"]["job_spec_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_company_id?: string | null
          created_at?: string
          created_by?: string | null
          day_rate_range?: string | null
          description_text?: string | null
          id?: string
          key_skills?: string[] | null
          location?: string | null
          salary_range?: string | null
          sector?: string | null
          title: string
          type?: Database["public"]["Enums"]["job_spec_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_company_id?: string | null
          created_at?: string
          created_by?: string | null
          day_rate_range?: string | null
          description_text?: string | null
          id?: string
          key_skills?: string[] | null
          location?: string | null
          salary_range?: string | null
          sector?: string | null
          title?: string
          type?: Database["public"]["Enums"]["job_spec_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_specs_client_company_id_fkey"
            columns: ["client_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_specs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          automation_enabled: boolean | null
          company_id: string | null
          created_at: string | null
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_scheduled_purge_at: string | null
          end_date: string | null
          full_spec: string | null
          hiring_manager_id: string | null
          id: string
          is_confidential: boolean
          job_type: string | null
          location: string | null
          pipeline_type: string
          raw_brief: string | null
          remote_policy: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          shortlist_count: number
          shortlist_locked: boolean
          shortlist_locked_at: string | null
          shortlist_params: Json | null
          shortlist_run_at: string | null
          shortlist_search_string: string | null
          spec_approved: boolean
          spec_must_have_skills: string[] | null
          spec_sectors: string[] | null
          spec_seniority: string | null
          spec_work_location: string | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          automation_enabled?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          full_spec?: string | null
          hiring_manager_id?: string | null
          id?: string
          is_confidential?: boolean
          job_type?: string | null
          location?: string | null
          pipeline_type?: string
          raw_brief?: string | null
          remote_policy?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          shortlist_count?: number
          shortlist_locked?: boolean
          shortlist_locked_at?: string | null
          shortlist_params?: Json | null
          shortlist_run_at?: string | null
          shortlist_search_string?: string | null
          spec_approved?: boolean
          spec_must_have_skills?: string[] | null
          spec_sectors?: string[] | null
          spec_seniority?: string | null
          spec_work_location?: string | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          automation_enabled?: boolean | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_scheduled_purge_at?: string | null
          end_date?: string | null
          full_spec?: string | null
          hiring_manager_id?: string | null
          id?: string
          is_confidential?: boolean
          job_type?: string | null
          location?: string | null
          pipeline_type?: string
          raw_brief?: string | null
          remote_policy?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          shortlist_count?: number
          shortlist_locked?: boolean
          shortlist_locked_at?: string | null
          shortlist_params?: Json | null
          shortlist_run_at?: string | null
          shortlist_search_string?: string | null
          spec_approved?: boolean
          spec_must_have_skills?: string[] | null
          spec_sectors?: string[] | null
          spec_seniority?: string | null
          spec_work_location?: string | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_projects: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_projects_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          deal_id: string | null
          id: string
          notes: string | null
          source: string
          status: string
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          owner_id: string | null
          pinned: boolean
          source: string | null
          team_id: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["note_visibility"]
        }
        Insert: {
          content: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          owner_id?: string | null
          pinned?: boolean
          source?: string | null
          team_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Update: {
          content?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          owner_id?: string | null
          pinned?: boolean
          source?: string | null
          team_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chart_edges: {
        Row: {
          child_contact_id: string
          company_id: string
          created_at: string
          id: string
          parent_contact_id: string | null
          position_index: number
          updated_at: string
        }
        Insert: {
          child_contact_id: string
          company_id: string
          created_at?: string
          id?: string
          parent_contact_id?: string | null
          position_index?: number
          updated_at?: string
        }
        Update: {
          child_contact_id?: string
          company_id?: string
          created_at?: string
          id?: string
          parent_contact_id?: string | null
          position_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chart_edges_child_contact_id_fkey"
            columns: ["child_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chart_edges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chart_edges_parent_contact_id_fkey"
            columns: ["parent_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_automation_settings: {
        Row: {
          ai_acknowledge_responses: boolean
          ai_response_processing_enabled: boolean
          ai_send_confirmations: boolean
          auto_classify_responses: boolean
          auto_log_feedback: boolean
          auto_schedule_callbacks: boolean
          auto_schedule_meetings: boolean
          campaign_id: string
          created_at: string
          default_meeting_duration: number | null
          id: string
          meeting_buffer_minutes: number | null
          preferred_calendar_connection_id: string | null
          require_human_approval: boolean
          scheduling_window_days: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_acknowledge_responses?: boolean
          ai_response_processing_enabled?: boolean
          ai_send_confirmations?: boolean
          auto_classify_responses?: boolean
          auto_log_feedback?: boolean
          auto_schedule_callbacks?: boolean
          auto_schedule_meetings?: boolean
          campaign_id: string
          created_at?: string
          default_meeting_duration?: number | null
          id?: string
          meeting_buffer_minutes?: number | null
          preferred_calendar_connection_id?: string | null
          require_human_approval?: boolean
          scheduling_window_days?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_acknowledge_responses?: boolean
          ai_response_processing_enabled?: boolean
          ai_send_confirmations?: boolean
          auto_classify_responses?: boolean
          auto_log_feedback?: boolean
          auto_schedule_callbacks?: boolean
          auto_schedule_meetings?: boolean
          campaign_id?: string
          created_at?: string
          default_meeting_duration?: number | null
          id?: string
          meeting_buffer_minutes?: number | null
          preferred_calendar_connection_id?: string | null
          require_human_approval?: boolean
          scheduling_window_days?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_automation_settings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_automation_settings_preferred_calendar_connection_fkey"
            columns: ["preferred_calendar_connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_automation_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_campaigns: {
        Row: {
          calendar_connection_id: string | null
          call_script_id: string | null
          calling_hours_end: string | null
          calling_hours_start: string | null
          calling_timezone: string | null
          channel: Database["public"]["Enums"]["outreach_channel"]
          contacted_count: number
          created_at: string
          description: string | null
          email_script_id: string | null
          end_date: string | null
          engagement_id: string | null
          id: string
          job_spec_id: string | null
          max_call_attempts: number | null
          name: string
          opt_out_required: boolean | null
          owner_id: string | null
          response_count: number
          sms_script_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["outreach_campaign_status"]
          target_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          calendar_connection_id?: string | null
          call_script_id?: string | null
          calling_hours_end?: string | null
          calling_hours_start?: string | null
          calling_timezone?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"]
          contacted_count?: number
          created_at?: string
          description?: string | null
          email_script_id?: string | null
          end_date?: string | null
          engagement_id?: string | null
          id?: string
          job_spec_id?: string | null
          max_call_attempts?: number | null
          name: string
          opt_out_required?: boolean | null
          owner_id?: string | null
          response_count?: number
          sms_script_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["outreach_campaign_status"]
          target_count?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          calendar_connection_id?: string | null
          call_script_id?: string | null
          calling_hours_end?: string | null
          calling_hours_start?: string | null
          calling_timezone?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"]
          contacted_count?: number
          created_at?: string
          description?: string | null
          email_script_id?: string | null
          end_date?: string | null
          engagement_id?: string | null
          id?: string
          job_spec_id?: string | null
          max_call_attempts?: number | null
          name?: string
          opt_out_required?: boolean | null
          owner_id?: string | null
          response_count?: number
          sms_script_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["outreach_campaign_status"]
          target_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_call_script_id_fkey"
            columns: ["call_script_id"]
            isOneToOne: false
            referencedRelation: "outreach_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_email_script_id_fkey"
            columns: ["email_script_id"]
            isOneToOne: false
            referencedRelation: "outreach_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_job_spec_id_fkey"
            columns: ["job_spec_id"]
            isOneToOne: false
            referencedRelation: "job_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_sms_script_id_fkey"
            columns: ["sms_script_id"]
            isOneToOne: false
            referencedRelation: "outreach_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_events: {
        Row: {
          body: string | null
          campaign_id: string | null
          candidate_id: string | null
          channel: Database["public"]["Enums"]["outreach_channel"] | null
          contact_id: string | null
          created_at: string
          engagement_id: string | null
          event_type: Database["public"]["Enums"]["outreach_event_type"]
          id: string
          metadata: Json
          performed_at: string
          performed_by: string | null
          subject: string | null
          target_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          campaign_id?: string | null
          candidate_id?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"] | null
          contact_id?: string | null
          created_at?: string
          engagement_id?: string | null
          event_type: Database["public"]["Enums"]["outreach_event_type"]
          id?: string
          metadata?: Json
          performed_at?: string
          performed_by?: string | null
          subject?: string | null
          target_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          campaign_id?: string | null
          candidate_id?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"] | null
          contact_id?: string | null
          created_at?: string
          engagement_id?: string | null
          event_type?: Database["public"]["Enums"]["outreach_event_type"]
          id?: string
          metadata?: Json
          performed_at?: string
          performed_by?: string | null
          subject?: string | null
          target_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "outreach_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_inbound_responses: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          ai_confidence: number | null
          ai_intent: string | null
          ai_processed_at: string | null
          ai_raw_analysis: Json | null
          ai_sentiment: string | null
          ai_summary: string | null
          campaign_id: string | null
          candidate_id: string | null
          channel: string
          contact_id: string | null
          created_at: string
          follow_up_calendar_event_id: string | null
          follow_up_scheduled_at: string | null
          follow_up_status: string | null
          follow_up_type: string | null
          id: string
          raw_content: string
          received_at: string
          sender_identifier: string | null
          status: string
          target_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          ai_processed_at?: string | null
          ai_raw_analysis?: Json | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          campaign_id?: string | null
          candidate_id?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string
          follow_up_calendar_event_id?: string | null
          follow_up_scheduled_at?: string | null
          follow_up_status?: string | null
          follow_up_type?: string | null
          id?: string
          raw_content: string
          received_at?: string
          sender_identifier?: string | null
          status?: string
          target_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          ai_confidence?: number | null
          ai_intent?: string | null
          ai_processed_at?: string | null
          ai_raw_analysis?: Json | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          campaign_id?: string | null
          candidate_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          follow_up_calendar_event_id?: string | null
          follow_up_scheduled_at?: string | null
          follow_up_status?: string | null
          follow_up_type?: string | null
          id?: string
          raw_content?: string
          received_at?: string
          sender_identifier?: string | null
          status?: string
          target_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_inbound_responses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_inbound_responses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_inbound_responses_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_inbound_responses_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "outreach_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_inbound_responses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          ai_call_script: string | null
          automation_level: string
          body: string | null
          body_html: string | null
          campaign_name: string | null
          candidate_email: string | null
          candidate_id: string | null
          candidate_name: string | null
          candidate_phone: string | null
          channel: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          from_email: string | null
          from_name: string | null
          id: string
          job_id: string | null
          opened_at: string | null
          parsed_availability_date: string | null
          parsed_availability_text: string | null
          parsed_interest: string | null
          parsed_preferred_contact: string | null
          parsed_questions: Json | null
          parsed_sentiment: string | null
          replied_at: string | null
          reply_content: string | null
          sent_at: string | null
          shortlist_id: string | null
          sms_body: string | null
          status: string | null
          subject: string | null
          twilio_sid: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_call_script?: string | null
          automation_level?: string
          body?: string | null
          body_html?: string | null
          campaign_name?: string | null
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_phone?: string | null
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          job_id?: string | null
          opened_at?: string | null
          parsed_availability_date?: string | null
          parsed_availability_text?: string | null
          parsed_interest?: string | null
          parsed_preferred_contact?: string | null
          parsed_questions?: Json | null
          parsed_sentiment?: string | null
          replied_at?: string | null
          reply_content?: string | null
          sent_at?: string | null
          shortlist_id?: string | null
          sms_body?: string | null
          status?: string | null
          subject?: string | null
          twilio_sid?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_call_script?: string | null
          automation_level?: string
          body?: string | null
          body_html?: string | null
          campaign_name?: string | null
          candidate_email?: string | null
          candidate_id?: string | null
          candidate_name?: string | null
          candidate_phone?: string | null
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          job_id?: string | null
          opened_at?: string | null
          parsed_availability_date?: string | null
          parsed_availability_text?: string | null
          parsed_interest?: string | null
          parsed_preferred_contact?: string | null
          parsed_questions?: Json | null
          parsed_sentiment?: string | null
          replied_at?: string | null
          reply_content?: string | null
          sent_at?: string | null
          shortlist_id?: string | null
          sms_body?: string | null
          status?: string | null
          subject?: string | null
          twilio_sid?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "job_shortlist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_scheduled_actions: {
        Row: {
          action_type: string
          approved_at: string | null
          approved_by: string | null
          calendar_connection_id: string | null
          calendar_event_id: string | null
          campaign_id: string | null
          created_at: string
          executed_at: string | null
          execution_result: Json | null
          id: string
          inbound_response_id: string | null
          meeting_duration_minutes: number | null
          meeting_notes: string | null
          meeting_title: string | null
          requires_approval: boolean
          scheduled_for: string
          status: string
          target_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          approved_by?: string | null
          calendar_connection_id?: string | null
          calendar_event_id?: string | null
          campaign_id?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          inbound_response_id?: string | null
          meeting_duration_minutes?: number | null
          meeting_notes?: string | null
          meeting_title?: string | null
          requires_approval?: boolean
          scheduled_for: string
          status?: string
          target_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          approved_by?: string | null
          calendar_connection_id?: string | null
          calendar_event_id?: string | null
          campaign_id?: string | null
          created_at?: string
          executed_at?: string | null
          execution_result?: Json | null
          id?: string
          inbound_response_id?: string | null
          meeting_duration_minutes?: number | null
          meeting_notes?: string | null
          meeting_title?: string | null
          requires_approval?: boolean
          scheduled_for?: string
          status?: string
          target_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_scheduled_actions_calendar_connection_id_fkey"
            columns: ["calendar_connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_scheduled_actions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_scheduled_actions_inbound_response_id_fkey"
            columns: ["inbound_response_id"]
            isOneToOne: false
            referencedRelation: "outreach_inbound_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_scheduled_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "outreach_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_scheduled_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_scripts: {
        Row: {
          body: string
          campaign_id: string | null
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at: string
          created_by: string | null
          engagement_id: string | null
          id: string
          is_default: boolean
          name: string
          subject: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          created_by?: string | null
          engagement_id?: string | null
          id?: string
          is_default?: boolean
          name: string
          subject?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["outreach_channel"]
          created_at?: string
          created_by?: string | null
          engagement_id?: string | null
          id?: string
          is_default?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_scripts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_scripts_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_scripts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_targets: {
        Row: {
          added_by: string | null
          assigned_to: string | null
          availability_date: string | null
          booked_meeting_id: string | null
          call_attempts: number
          calling_hours_end: string | null
          calling_hours_start: string | null
          calling_timezone: string | null
          campaign_id: string
          candidate_id: string | null
          consent_status: string | null
          contact_id: string | null
          created_at: string
          do_not_call: boolean
          do_not_contact: boolean
          engagement_id: string | null
          entity_company: string | null
          entity_email: string | null
          entity_name: string
          entity_phone: string | null
          entity_title: string | null
          entity_type: Database["public"]["Enums"]["outreach_entity_type"]
          id: string
          last_contacted_at: string | null
          max_call_attempts: number
          next_action: string | null
          next_action_at: string | null
          next_action_due: string | null
          notes: string | null
          opt_out_reason: string | null
          priority: number
          snooze_until: string | null
          state: Database["public"]["Enums"]["outreach_target_state"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          added_by?: string | null
          assigned_to?: string | null
          availability_date?: string | null
          booked_meeting_id?: string | null
          call_attempts?: number
          calling_hours_end?: string | null
          calling_hours_start?: string | null
          calling_timezone?: string | null
          campaign_id: string
          candidate_id?: string | null
          consent_status?: string | null
          contact_id?: string | null
          created_at?: string
          do_not_call?: boolean
          do_not_contact?: boolean
          engagement_id?: string | null
          entity_company?: string | null
          entity_email?: string | null
          entity_name: string
          entity_phone?: string | null
          entity_title?: string | null
          entity_type?: Database["public"]["Enums"]["outreach_entity_type"]
          id?: string
          last_contacted_at?: string | null
          max_call_attempts?: number
          next_action?: string | null
          next_action_at?: string | null
          next_action_due?: string | null
          notes?: string | null
          opt_out_reason?: string | null
          priority?: number
          snooze_until?: string | null
          state?: Database["public"]["Enums"]["outreach_target_state"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          added_by?: string | null
          assigned_to?: string | null
          availability_date?: string | null
          booked_meeting_id?: string | null
          call_attempts?: number
          calling_hours_end?: string | null
          calling_hours_start?: string | null
          calling_timezone?: string | null
          campaign_id?: string
          candidate_id?: string | null
          consent_status?: string | null
          contact_id?: string | null
          created_at?: string
          do_not_call?: boolean
          do_not_contact?: boolean
          engagement_id?: string | null
          entity_company?: string | null
          entity_email?: string | null
          entity_name?: string
          entity_phone?: string | null
          entity_title?: string | null
          entity_type?: Database["public"]["Enums"]["outreach_entity_type"]
          id?: string
          last_contacted_at?: string | null
          max_call_attempts?: number
          next_action?: string | null
          next_action_at?: string | null
          next_action_due?: string | null
          notes?: string | null
          opt_out_reason?: string | null
          priority?: number
          snooze_until?: string | null
          state?: Database["public"]["Enums"]["outreach_target_state"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_targets_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_targets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_targets_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_targets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_invoices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          invoice_id: string | null
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          placement_id: string
          rate_per_day: number
          sent_at: string | null
          status: string
          subtotal: number
          total: number
          total_days: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          placement_id: string
          rate_per_day?: number
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          total_days?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          placement_id?: string
          rate_per_day?: number
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          total_days?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "placement_invoices_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placement_invoices_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          billing_contact_email: string | null
          candidate_id: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          end_date: string | null
          engagement_id: string | null
          fee_percentage: number | null
          id: string
          invoice_frequency: string | null
          job_id: string | null
          notes: string | null
          placement_fee: number | null
          placement_type: string
          po_number: string | null
          rate_per_day: number | null
          salary: number | null
          start_date: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_contact_email?: string | null
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          end_date?: string | null
          engagement_id?: string | null
          fee_percentage?: number | null
          id?: string
          invoice_frequency?: string | null
          job_id?: string | null
          notes?: string | null
          placement_fee?: number | null
          placement_type?: string
          po_number?: string | null
          rate_per_day?: number | null
          salary?: number | null
          start_date: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          billing_contact_email?: string | null
          candidate_id?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          end_date?: string | null
          engagement_id?: string | null
          fee_percentage?: number | null
          id?: string
          invoice_frequency?: string | null
          job_id?: string | null
          notes?: string | null
          placement_fee?: number | null
          placement_type?: string
          po_number?: string | null
          rate_per_day?: number | null
          salary?: number | null
          start_date?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          onboarding_phase: number
          preferred_name: string | null
          primary_use: string | null
          team_size: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          job_title?: string | null
          last_name?: string | null
          onboarding_phase?: number
          preferred_name?: string | null
          primary_use?: string | null
          team_size?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          onboarding_phase?: number
          preferred_name?: string | null
          primary_use?: string | null
          team_size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_stage_events: {
        Row: {
          completed_by: string | null
          created_at: string
          id: string
          next_stage: string | null
          notes: string | null
          project_id: string
          stage_completed_at: string | null
          stage_entered_at: string
          stage_name: string
          workspace_id: string
        }
        Insert: {
          completed_by?: string | null
          created_at?: string
          id?: string
          next_stage?: string | null
          notes?: string | null
          project_id: string
          stage_completed_at?: string | null
          stage_entered_at?: string
          stage_name: string
          workspace_id: string
        }
        Update: {
          completed_by?: string | null
          created_at?: string
          id?: string
          next_stage?: string | null
          notes?: string | null
          project_id?: string
          stage_completed_at?: string | null
          stage_entered_at?: string
          stage_name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stage_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "crm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_coverage: {
        Row: {
          blocker_count: number
          calculated_at: string
          champion_count: number
          company_id: string | null
          coverage_score: number
          created_at: string
          department: string | null
          engaged_contacts: number
          executive_coverage: boolean
          gap_analysis: Json
          id: string
          last_engagement_date: string | null
          total_contacts: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          blocker_count?: number
          calculated_at?: string
          champion_count?: number
          company_id?: string | null
          coverage_score?: number
          created_at?: string
          department?: string | null
          engaged_contacts?: number
          executive_coverage?: boolean
          gap_analysis?: Json
          id?: string
          last_engagement_date?: string | null
          total_contacts?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          blocker_count?: number
          calculated_at?: string
          champion_count?: number
          company_id?: string | null
          coverage_score?: number
          created_at?: string
          department?: string | null
          engaged_contacts?: number
          executive_coverage?: boolean
          gap_analysis?: Json
          id?: string
          last_engagement_date?: string | null
          total_contacts?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relationship_coverage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationship_coverage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_signals: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          is_resolved: boolean
          recommended_actions: string[] | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          risk_level: string
          risk_type: string
          title: string
          trigger_data: Json
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          is_resolved?: boolean
          recommended_actions?: string[] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level?: string
          risk_type: string
          title: string
          trigger_data?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          is_resolved?: boolean
          recommended_actions?: string[] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          risk_level?: string
          risk_type?: string
          title?: string
          trigger_data?: Json
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_signals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          mode: Database["public"]["Enums"]["search_mode"]
          name: string
          query_string: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          mode?: Database["public"]["Enums"]["search_mode"]
          name: string
          query_string: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          mode?: Database["public"]["Enums"]["search_mode"]
          name?: string
          query_string?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sows: {
        Row: {
          billing_model: string
          company_id: string
          created_at: string
          currency: string
          document_id: string | null
          end_date: string | null
          engagement_id: string | null
          id: string
          notes: string | null
          renewal_date: string | null
          sow_ref: string | null
          start_date: string | null
          status: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          billing_model?: string
          company_id: string
          created_at?: string
          currency?: string
          document_id?: string | null
          end_date?: string | null
          engagement_id?: string | null
          id?: string
          notes?: string | null
          renewal_date?: string | null
          sow_ref?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          billing_model?: string
          company_id?: string
          created_at?: string
          currency?: string
          document_id?: string | null
          end_date?: string | null
          engagement_id?: string | null
          id?: string
          notes?: string | null
          renewal_date?: string | null
          sow_ref?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sows_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sows_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_company_engagements: {
        Row: {
          company_id: string
          created_at: string
          department: string | null
          end_date: string | null
          id: string
          notes: string | null
          role_type: string | null
          start_date: string | null
          status: string
          talent_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          role_type?: string | null
          start_date?: string | null
          status?: string
          talent_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          role_type?: string | null
          start_date?: string | null
          status?: string
          talent_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_company_engagements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_company_engagements_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_company_engagements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_documents: {
        Row: {
          created_at: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          parse_status: Database["public"]["Enums"]["parse_status"]
          parsed_text: string | null
          pdf_conversion_status: string | null
          pdf_storage_path: string | null
          talent_id: string
          text_hash: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          file_name: string
          file_path: string
          file_size?: number
          file_type: string
          id?: string
          parse_status?: Database["public"]["Enums"]["parse_status"]
          parsed_text?: string | null
          pdf_conversion_status?: string | null
          pdf_storage_path?: string | null
          talent_id: string
          text_hash?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          parse_status?: Database["public"]["Enums"]["parse_status"]
          parsed_text?: string | null
          pdf_conversion_status?: string | null
          pdf_storage_path?: string | null
          talent_id?: string
          text_hash?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_documents_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_questions: {
        Row: {
          created_at: string
          cv_hash: string | null
          id: string
          job_spec_id: string | null
          questions: Json
          spec_hash: string | null
          talent_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          cv_hash?: string | null
          id?: string
          job_spec_id?: string | null
          questions?: Json
          spec_hash?: string | null
          talent_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          cv_hash?: string | null
          id?: string
          job_spec_id?: string | null
          questions?: Json
          spec_hash?: string | null
          talent_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_questions_job_spec_id_fkey"
            columns: ["job_spec_id"]
            isOneToOne: false
            referencedRelation: "job_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_questions_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_signals: {
        Row: {
          created_at: string
          description: string
          dismissed_at: string | null
          dismissed_by: string | null
          evidence: Json
          id: string
          is_dismissed: boolean
          severity: string
          signal_type: string
          talent_id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence?: Json
          id?: string
          is_dismissed?: boolean
          severity?: string
          signal_type: string
          talent_id: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          evidence?: Json
          id?: string
          is_dismissed?: boolean
          severity?: string
          signal_type?: string
          talent_id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_signals_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_signals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_expires_at: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          type: Database["public"]["Enums"]["workspace_type"] | null
          updated_at: string
          workspace_mode: Database["public"]["Enums"]["workspace_mode"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          type?: Database["public"]["Enums"]["workspace_type"] | null
          updated_at?: string
          workspace_mode?: Database["public"]["Enums"]["workspace_mode"]
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          type?: Database["public"]["Enums"]["workspace_type"] | null
          updated_at?: string
          workspace_mode?: Database["public"]["Enums"]["workspace_mode"]
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          description: string | null
          id: string
          logged_by: string | null
          placement_id: string
          status: string
          updated_at: string
          week_start: string
          work_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          description?: string | null
          id?: string
          logged_by?: string | null
          placement_id: string
          status?: string
          updated_at?: string
          week_start: string
          work_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          description?: string | null
          id?: string
          logged_by?: string | null
          placement_id?: string
          status?: string
          updated_at?: string
          week_start?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_billing_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_sort_code: string | null
          bank_swift: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          id: string
          invoice_prefix: string
          legal_name: string | null
          logo_url: string | null
          next_invoice_number: number
          payment_terms_days: number
          postcode: string | null
          tax_label: string
          trading_name: string | null
          updated_at: string
          vat_number: string | null
          workspace_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_sort_code?: string | null
          bank_swift?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_prefix?: string
          legal_name?: string | null
          logo_url?: string | null
          next_invoice_number?: number
          payment_terms_days?: number
          postcode?: string | null
          tax_label?: string
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          workspace_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_sort_code?: string | null
          bank_swift?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          id?: string
          invoice_prefix?: string
          legal_name?: string | null
          logo_url?: string | null
          next_invoice_number?: number
          payment_terms_days?: number
          postcode?: string | null
          tax_label?: string
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_billing_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_branding: {
        Row: {
          app_name: string | null
          company_name: string | null
          created_at: string
          email_signature_footer: string | null
          id: string
          logo_path: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          app_name?: string | null
          company_name?: string | null
          created_at?: string
          email_signature_footer?: string | null
          id?: string
          logo_path?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          app_name?: string | null
          company_name?: string | null
          created_at?: string
          email_signature_footer?: string | null
          id?: string
          logo_path?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_branding_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          contract_hop_lookback_months: number
          contract_hop_min_stints: number
          created_at: string
          data_quality_rules: Json
          gap_threshold_months: number
          id: string
          jarvis_settings: Json
          outreach_rules: Json
          short_tenure_threshold_months: number
          top_tier_companies: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contract_hop_lookback_months?: number
          contract_hop_min_stints?: number
          created_at?: string
          data_quality_rules?: Json
          gap_threshold_months?: number
          id?: string
          jarvis_settings?: Json
          outreach_rules?: Json
          short_tenure_threshold_months?: number
          top_tier_companies?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contract_hop_lookback_months?: number
          contract_hop_min_stints?: number
          created_at?: string
          data_quality_rules?: Json
          gap_threshold_months?: number
          id?: string
          jarvis_settings?: Json
          outreach_rules?: Json
          short_tenure_threshold_months?: number
          top_tier_companies?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_workspace"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      integration_status: {
        Row: {
          is_fully_configured: boolean | null
          service: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_with_demo_isolation: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_executive_features: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_approve_request: {
        Args: { _entity_id: string; _entity_type: string; _user_id: string }
        Returns: boolean
      }
      can_edit_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      can_edit_contact: {
        Args: { _contact_id: string; _user_id: string }
        Returns: boolean
      }
      can_insert_with_team: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_audit: {
        Args: { _entity_id: string; _entity_type: string; _user_id: string }
        Returns: boolean
      }
      can_view_note: {
        Args: { _note_id: string; _user_id: string }
        Returns: boolean
      }
      check_demo_isolation: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      execute_schema_inventory: { Args: never; Returns: Json }
      get_current_workspace_id: { Args: { _user_id: string }; Returns: string }
      get_entity_team_id: {
        Args: { _entity_id: string; _entity_type: string }
        Returns: string
      }
      get_org_parent: {
        Args: { p_company_id: string; p_contact_id: string }
        Returns: string
      }
      get_pending_requests_count: {
        Args: { _user_id: string }
        Returns: number
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_team_id: { Args: { _user_id: string }; Returns: string }
      get_user_workspaces: {
        Args: { _user_id: string }
        Returns: {
          is_demo: boolean
          role: Database["public"]["Enums"]["app_role"]
          workspace_id: string
          workspace_name: string
          workspace_type: Database["public"]["Enums"]["workspace_type"]
        }[]
      }
      get_workspace_details: {
        Args: { _workspace_id: string }
        Returns: {
          id: string
          is_demo: boolean
          name: string
          type: Database["public"]["Enums"]["workspace_type"]
        }[]
      }
      get_workspace_mode: { Args: { _user_id: string }; Returns: string }
      has_real_workspace: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_campaign_target_count: {
        Args: { p_campaign_id: string; p_count: number }
        Returns: undefined
      }
      is_demo_team: { Args: { _team_id: string }; Returns: boolean }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_premium_workspace: {
        Args: { _workspace_id: string }
        Returns: boolean
      }
      is_public_demo_workspace: {
        Args: { workspace_uuid: string }
        Returns: boolean
      }
      join_demo_team: { Args: { _user_id: string }; Returns: string }
      leave_demo_team: { Args: { _user_id: string }; Returns: boolean }
      log_email_sent_and_touch_target: {
        Args: {
          p_body?: string
          p_campaign_id: string
          p_candidate_id?: string
          p_contact_id?: string
          p_metadata?: Json
          p_performed_by?: string
          p_subject?: string
          p_target_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      lookup_user_id_by_email: { Args: { _email: string }; Returns: string }
      reset_demo_data: { Args: { _user_id: string }; Returns: boolean }
      search_candidates: {
        Args: {
          include_cv?: boolean
          query_text: string
          use_tsquery?: boolean
          workspace_id?: string
        }
        Returns: {
          current_title: string
          email: string
          headline: string
          highlight_cv: string
          highlight_headline: string
          highlight_name: string
          id: string
          location: string
          match_breakdown: Json
          match_score: number
          name: string
          rank: number
          skills: Json
        }[]
      }
      seed_demo_workspace: {
        Args: { workspace_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      access_request_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "manager" | "contributor" | "viewer"
      call_outcome_type:
        | "connected"
        | "voicemail"
        | "no_answer"
        | "busy"
        | "wrong_number"
        | "interested"
        | "not_interested"
        | "callback_requested"
        | "meeting_booked"
      cv_batch_source: "ui_upload" | "background_import"
      cv_batch_status:
        | "queued"
        | "processing"
        | "completed"
        | "failed"
        | "partial"
      cv_item_status:
        | "queued"
        | "processing"
        | "parsed"
        | "dedupe_review"
        | "merged"
        | "failed"
      doc_kind: "cv" | "cover_letter" | "certification" | "other"
      import_entity_status:
        | "pending_review"
        | "approved"
        | "rejected"
        | "needs_input"
      import_entity_type: "candidate" | "contact" | "org_node" | "note"
      interview_outcome: "pending" | "passed" | "failed" | "hold" | "cancelled"
      interview_stage:
        | "screening"
        | "first"
        | "second"
        | "final"
        | "offer"
        | "rejected"
        | "withdrawn"
      job_spec_type: "permanent" | "contract"
      note_visibility: "public" | "team" | "private"
      opportunity_status:
        | "submitted"
        | "shortlisted"
        | "interviewing"
        | "offered"
        | "placed"
        | "dropped"
        | "rejected"
      outreach_campaign_status:
        | "draft"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      outreach_channel: "email" | "sms" | "call" | "linkedin" | "other"
      outreach_entity_type: "candidate" | "contact"
      outreach_event_type:
        | "email_sent"
        | "sms_sent"
        | "call_made"
        | "call_scheduled"
        | "call_completed"
        | "responded"
        | "booked"
        | "snoozed"
        | "opted_out"
        | "note_added"
        | "status_changed"
        | "added_to_campaign"
      outreach_target_state:
        | "queued"
        | "contacted"
        | "responded"
        | "booked"
        | "snoozed"
        | "opted_out"
        | "converted"
        | "closed"
      parse_status: "pending" | "parsed" | "failed"
      search_mode: "simple" | "boolean"
      subscription_tier: "free" | "starter" | "professional" | "premium"
      workspace_mode: "public_demo" | "demo" | "production"
      workspace_type: "real" | "demo"
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
      access_request_status: ["pending", "approved", "rejected"],
      app_role: ["admin", "manager", "contributor", "viewer"],
      call_outcome_type: [
        "connected",
        "voicemail",
        "no_answer",
        "busy",
        "wrong_number",
        "interested",
        "not_interested",
        "callback_requested",
        "meeting_booked",
      ],
      cv_batch_source: ["ui_upload", "background_import"],
      cv_batch_status: [
        "queued",
        "processing",
        "completed",
        "failed",
        "partial",
      ],
      cv_item_status: [
        "queued",
        "processing",
        "parsed",
        "dedupe_review",
        "merged",
        "failed",
      ],
      doc_kind: ["cv", "cover_letter", "certification", "other"],
      import_entity_status: [
        "pending_review",
        "approved",
        "rejected",
        "needs_input",
      ],
      import_entity_type: ["candidate", "contact", "org_node", "note"],
      interview_outcome: ["pending", "passed", "failed", "hold", "cancelled"],
      interview_stage: [
        "screening",
        "first",
        "second",
        "final",
        "offer",
        "rejected",
        "withdrawn",
      ],
      job_spec_type: ["permanent", "contract"],
      note_visibility: ["public", "team", "private"],
      opportunity_status: [
        "submitted",
        "shortlisted",
        "interviewing",
        "offered",
        "placed",
        "dropped",
        "rejected",
      ],
      outreach_campaign_status: [
        "draft",
        "active",
        "paused",
        "completed",
        "archived",
      ],
      outreach_channel: ["email", "sms", "call", "linkedin", "other"],
      outreach_entity_type: ["candidate", "contact"],
      outreach_event_type: [
        "email_sent",
        "sms_sent",
        "call_made",
        "call_scheduled",
        "call_completed",
        "responded",
        "booked",
        "snoozed",
        "opted_out",
        "note_added",
        "status_changed",
        "added_to_campaign",
      ],
      outreach_target_state: [
        "queued",
        "contacted",
        "responded",
        "booked",
        "snoozed",
        "opted_out",
        "converted",
        "closed",
      ],
      parse_status: ["pending", "parsed", "failed"],
      search_mode: ["simple", "boolean"],
      subscription_tier: ["free", "starter", "professional", "premium"],
      workspace_mode: ["public_demo", "demo", "production"],
      workspace_type: ["real", "demo"],
    },
  },
} as const
