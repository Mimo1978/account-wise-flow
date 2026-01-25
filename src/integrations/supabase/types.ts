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
          skills: Json | null
          source: string | null
          status: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
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
          skills?: Json | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
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
      companies: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          name: string
          owner_id: string | null
          size: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          name: string
          owner_id?: string | null
          size?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          name?: string
          owner_id?: string | null
          size?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
          id: string
          name: string
          owner_id: string | null
          phone: string | null
          team_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          name: string
          owner_id?: string | null
          phone?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          phone?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      seed_demo_workspace: {
        Args: { workspace_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      access_request_status: "pending" | "approved" | "rejected"
      app_role: "admin" | "manager" | "contributor" | "viewer"
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
      note_visibility: "public" | "team" | "private"
      opportunity_status:
        | "submitted"
        | "shortlisted"
        | "interviewing"
        | "offered"
        | "placed"
        | "dropped"
        | "rejected"
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
      workspace_mode: ["public_demo", "demo", "production"],
      workspace_type: ["real", "demo"],
    },
  },
} as const
