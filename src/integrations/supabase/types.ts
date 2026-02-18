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
      companies: {
        Row: {
          account_manager: string | null
          ceo_contact_id: string | null
          created_at: string
          data_quality: string | null
          headquarters: string | null
          id: string
          industry: string | null
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
          headquarters?: string | null
          id?: string
          industry?: string | null
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
          headquarters?: string | null
          id?: string
          industry?: string | null
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
      outreach_scripts: {
        Row: {
          body: string
          campaign_id: string | null
          channel: Database["public"]["Enums"]["outreach_channel"]
          created_at: string
          created_by: string | null
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
            foreignKeyName: "outreach_targets_workspace_id_fkey"
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
          type: Database["public"]["Enums"]["workspace_type"] | null
          updated_at: string
          workspace_mode: Database["public"]["Enums"]["workspace_mode"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          type?: Database["public"]["Enums"]["workspace_type"] | null
          updated_at?: string
          workspace_mode?: Database["public"]["Enums"]["workspace_mode"]
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          type?: Database["public"]["Enums"]["workspace_type"] | null
          updated_at?: string
          workspace_mode?: Database["public"]["Enums"]["workspace_mode"]
        }
        Relationships: []
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
      workspace_branding: {
        Row: {
          company_name: string | null
          created_at: string
          id: string
          logo_path: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
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
          gap_threshold_months: number
          id: string
          short_tenure_threshold_months: number
          top_tier_companies: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contract_hop_lookback_months?: number
          contract_hop_min_stints?: number
          created_at?: string
          gap_threshold_months?: number
          id?: string
          short_tenure_threshold_months?: number
          top_tier_companies?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contract_hop_lookback_months?: number
          contract_hop_min_stints?: number
          created_at?: string
          gap_threshold_months?: number
          id?: string
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
      [_ in never]: never
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
      get_current_workspace_id: { Args: { _user_id: string }; Returns: string }
      get_entity_team_id: {
        Args: { _entity_id: string; _entity_type: string }
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
      is_demo_team: { Args: { _team_id: string }; Returns: boolean }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_public_demo_workspace: {
        Args: { workspace_uuid: string }
        Returns: boolean
      }
      join_demo_team: { Args: { _user_id: string }; Returns: string }
      leave_demo_team: { Args: { _user_id: string }; Returns: boolean }
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
      parse_status: "pending" | "parsed" | "failed"
      search_mode: "simple" | "boolean"
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
      ],
      parse_status: ["pending", "parsed", "failed"],
      search_mode: ["simple", "boolean"],
      workspace_mode: ["public_demo", "demo", "production"],
      workspace_type: ["real", "demo"],
    },
  },
} as const
