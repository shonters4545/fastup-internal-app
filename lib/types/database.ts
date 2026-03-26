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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance_plans: {
        Row: {
          created_at: string | null
          date: string
          id: string
          planned: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          planned?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          planned?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attended_at: string | null
          book_id: string | null
          class_id: string
          created_at: string | null
          id: string
          instructor_name: string | null
          is_trial: boolean
          room_id: string | null
          round_checks: Json
          status: string | null
          student_name: string | null
          study_material: string | null
          subject_id: string | null
          user_id: string
        }
        Insert: {
          attended_at?: string | null
          book_id?: string | null
          class_id: string
          created_at?: string | null
          id?: string
          instructor_name?: string | null
          is_trial?: boolean
          room_id?: string | null
          round_checks?: Json
          status?: string | null
          student_name?: string | null
          study_material?: string | null
          subject_id?: string | null
          user_id: string
        }
        Update: {
          attended_at?: string | null
          book_id?: string | null
          class_id?: string
          created_at?: string | null
          id?: string
          instructor_name?: string | null
          is_trial?: boolean
          room_id?: string | null
          round_checks?: Json
          status?: string | null
          student_name?: string | null
          study_material?: string | null
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "class_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          created_at: string | null
          display_order: number | null
          division_id: string
          drive_url: string | null
          id: string
          image_url: string | null
          is_custom: boolean
          max_laps: number
          name: string
          remarks: string | null
          subject_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          division_id: string
          drive_url?: string | null
          id?: string
          image_url?: string | null
          is_custom?: boolean
          max_laps?: number
          name: string
          remarks?: string | null
          subject_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          division_id?: string
          drive_url?: string | null
          id?: string
          image_url?: string | null
          is_custom?: boolean
          max_laps?: number
          name?: string
          remarks?: string | null
          subject_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      class_rooms: {
        Row: {
          capacity: number
          class_id: string
          created_at: string | null
          id: string
          instructor_id: string | null
          instructor_name: string | null
          label: string
          room_type: string
        }
        Insert: {
          capacity?: number
          class_id: string
          created_at?: string | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          label: string
          room_type?: string
        }
        Update: {
          capacity?: number
          class_id?: string
          created_at?: string | null
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          label?: string
          room_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_rooms_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_rooms_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          instructor_id: string | null
          instructor_name: string | null
          passcode: string | null
          start_time: string
          survey_sent: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          passcode?: string | null
          start_time: string
          survey_sent?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          instructor_id?: string | null
          instructor_name?: string | null
          passcode?: string | null
          start_time?: string
          survey_sent?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          notes: string | null
          parent_email: string | null
          payment_method: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          notes?: string | null
          parent_email?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          notes?: string | null
          parent_email?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          subject_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          created_at: string | null
          form_data: Json | null
          id: string
          special_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          form_data?: Json | null
          id?: string
          special_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          form_data?: Json | null
          id?: string
          special_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_special_id_fkey"
            columns: ["special_id"]
            isOneToOne: false
            referencedRelation: "specials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          contract_end_date: string | null
          contract_start_date: string | null
          created_at: string | null
          email: string
          grade: string | null
          high_school: string | null
          id: string
          learning_location: string | null
          levels: Json | null
          name: string
          parent_email: string | null
          payment_method: string | null
          phone_number: string | null
          role: string | null
          status: string | null
          subjects: string[] | null
          target_college: string | null
          target_time: number | null
        }
        Insert: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          email: string
          grade?: string | null
          high_school?: string | null
          id?: string
          learning_location?: string | null
          levels?: Json | null
          name: string
          parent_email?: string | null
          payment_method?: string | null
          phone_number?: string | null
          role?: string | null
          status?: string | null
          subjects?: string[] | null
          target_college?: string | null
          target_time?: number | null
        }
        Update: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          created_at?: string | null
          email?: string
          grade?: string | null
          high_school?: string | null
          id?: string
          learning_location?: string | null
          levels?: Json | null
          name?: string
          parent_email?: string | null
          payment_method?: string | null
          phone_number?: string | null
          role?: string | null
          status?: string | null
          subjects?: string[] | null
          target_college?: string | null
          target_time?: number | null
        }
        Relationships: []
      }
      levels: {
        Row: {
          created_at: string | null
          id: string
          level: number
          subject_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level: number
          subject_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: number
          subject_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "levels_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      memos: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memos_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      personal_entries: {
        Row: {
          additional_desired_subject: string | null
          contracted_subjects: string[] | null
          created_at: string | null
          desired_subjects: string[] | null
          id: string
          notes: string | null
          phone_number: string | null
          preferred_date: string | null
          status: string | null
          subject: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_desired_subject?: string | null
          contracted_subjects?: string[] | null
          created_at?: string | null
          desired_subjects?: string[] | null
          id?: string
          notes?: string | null
          phone_number?: string | null
          preferred_date?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_desired_subject?: string | null
          contracted_subjects?: string[] | null
          created_at?: string | null
          desired_subjects?: string[] | null
          id?: string
          notes?: string | null
          phone_number?: string | null
          preferred_date?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      progress: {
        Row: {
          book_id: string | null
          created_at: string | null
          id: string
          lap: number
          score: number | null
          status: string | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string | null
          id?: string
          lap?: number
          score?: number | null
          status?: string | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          book_id?: string | null
          created_at?: string | null
          id?: string
          lap?: number
          score?: number | null
          status?: string | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      specials: {
        Row: {
          capacity: number | null
          created_at: string | null
          description: string | null
          end_date: string
          form_fields: Json | null
          id: string
          start_date: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          end_date: string
          form_fields?: Json | null
          id?: string
          start_date: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          description?: string | null
          end_date?: string
          form_fields?: Json | null
          id?: string
          start_date?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      survey_models: {
        Row: {
          created_at: string | null
          delivery_status: string | null
          delivery_time: string | null
          form_fields: Json
          id: string
          title: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_status?: string | null
          delivery_time?: string | null
          form_fields: Json
          id?: string
          title: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_status?: string | null
          delivery_time?: string | null
          form_fields?: Json
          id?: string
          title?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      survey_requests: {
        Row: {
          class_id: string | null
          id: string
          requested_at: string | null
          status: string | null
          survey_model_id: string
          type: string | null
          user_id: string
        }
        Insert: {
          class_id?: string | null
          id?: string
          requested_at?: string | null
          status?: string | null
          survey_model_id: string
          type?: string | null
          user_id: string
        }
        Update: {
          class_id?: string | null
          id?: string
          requested_at?: string | null
          status?: string | null
          survey_model_id?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_requests_survey_model_id_fkey"
            columns: ["survey_model_id"]
            isOneToOne: false
            referencedRelation: "survey_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          class_id: string | null
          id: string
          request_id: string
          responses: Json
          submitted_at: string | null
          survey_model_id: string
          type: string | null
          user_id: string
        }
        Insert: {
          class_id?: string | null
          id?: string
          request_id: string
          responses: Json
          submitted_at?: string | null
          survey_model_id: string
          type?: string | null
          user_id: string
        }
        Update: {
          class_id?: string | null
          id?: string
          request_id?: string
          responses?: Json
          submitted_at?: string | null
          survey_model_id?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "survey_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_model_id_fkey"
            columns: ["survey_model_id"]
            isOneToOne: false
            referencedRelation: "survey_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          book_id: string
          created_at: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          book_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          book_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          created_at: string | null
          curriculum_id: string
          duration_seconds: number
          ended_at: string
          id: string
          started_at: string
          subject_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          curriculum_id: string
          duration_seconds: number
          ended_at: string
          id?: string
          started_at: string
          subject_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          curriculum_id?: string
          duration_seconds?: number
          ended_at?: string
          id?: string
          started_at?: string
          subject_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "user_curriculum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_posts: {
        Row: {
          author_id: string
          author_name: string | null
          category_id: string | null
          content: string
          created_at: string | null
          excerpt: string | null
          id: string
          published: boolean | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          author_name?: string | null
          category_id?: string | null
          content: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          author_name?: string | null
          category_id?: string | null
          content?: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          published?: boolean | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_curriculum: {
        Row: {
          book_id: string
          created_at: string | null
          display_order: number | null
          id: string
          notes: string | null
          status: string | null
          subject_id: string
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          subject_id: string
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          notes?: string | null
          status?: string | null
          subject_id?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_curriculum_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_curriculum_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_curriculum_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_curriculum_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subjects: {
        Row: {
          created_at: string | null
          id: string
          level: number | null
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level?: number | null
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: number | null
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string
          created_at: string | null
          display_name: string
          email: string
          grade: string | null
          high_school: string | null
          id: string
          learning_location: string | null
          nickname: string | null
          parent_email: string | null
          phone_number: string | null
          photo_url: string | null
          profile_completed: boolean | null
          role: string
          stream: string | null
          target_college: string | null
          target_time: number | null
          updated_at: string | null
        }
        Insert: {
          auth_id: string
          created_at?: string | null
          display_name: string
          email: string
          grade?: string | null
          high_school?: string | null
          id?: string
          learning_location?: string | null
          nickname?: string | null
          parent_email?: string | null
          phone_number?: string | null
          photo_url?: string | null
          profile_completed?: boolean | null
          role?: string
          stream?: string | null
          target_college?: string | null
          target_time?: number | null
          updated_at?: string | null
        }
        Update: {
          auth_id?: string
          created_at?: string | null
          display_name?: string
          email?: string
          grade?: string | null
          high_school?: string | null
          id?: string
          learning_location?: string | null
          nickname?: string | null
          parent_email?: string | null
          phone_number?: string | null
          photo_url?: string | null
          profile_completed?: boolean | null
          role?: string
          stream?: string | null
          target_college?: string | null
          target_time?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      distribute_scheduled_surveys: { Args: never; Returns: undefined }
      get_point_balance: { Args: { p_user_id: string }; Returns: number }
      get_user_id: { Args: { p_auth_id: string }; Returns: string }
      get_user_role: { Args: { p_auth_id: string }; Returns: string }
      process_new_user_invite: {
        Args: {
          p_auth_id: string
          p_display_name: string
          p_email: string
          p_photo_url?: string
        }
        Returns: Json
      }
      send_survey_on_class_end: { Args: never; Returns: undefined }
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
    Enums: {},
  },
} as const
