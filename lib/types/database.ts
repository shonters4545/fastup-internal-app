export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'student' | 'admin' | 'super';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string;
          display_name: string;
          nickname: string | null;
          email: string;
          photo_url: string | null;
          role: UserRole;
          target_college: string | null;
          grade: string | null;
          target_time: number | null;
          phone_number: string | null;
          high_school: string | null;
          learning_location: string | null;
          profile_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id: string;
          display_name: string;
          nickname?: string | null;
          email: string;
          photo_url?: string | null;
          role?: UserRole;
          target_college?: string | null;
          grade?: string | null;
          target_time?: number | null;
          phone_number?: string | null;
          high_school?: string | null;
          learning_location?: string | null;
          profile_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string;
          display_name?: string;
          nickname?: string | null;
          email?: string;
          photo_url?: string | null;
          role?: UserRole;
          target_college?: string | null;
          grade?: string | null;
          target_time?: number | null;
          phone_number?: string | null;
          high_school?: string | null;
          learning_location?: string | null;
          profile_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      user_subjects: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string;
          created_at?: string;
        };
      };
      divisions: {
        Row: {
          id: string;
          subject_id: string;
          name: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_id: string;
          name: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          subject_id?: string;
          name?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      books: {
        Row: {
          id: string;
          division_id: string;
          subject_id: string;
          name: string;
          image_url: string | null;
          display_order: number;
          max_laps: number;
          is_custom: boolean;
          drive_url: string | null;
          remarks: string | null;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          division_id: string;
          subject_id: string;
          name: string;
          image_url?: string | null;
          display_order?: number;
          max_laps?: number;
          is_custom?: boolean;
          drive_url?: string | null;
          remarks?: string | null;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          division_id?: string;
          subject_id?: string;
          name?: string;
          image_url?: string | null;
          display_order?: number;
          max_laps?: number;
          is_custom?: boolean;
          drive_url?: string | null;
          remarks?: string | null;
          user_id?: string | null;
          created_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          book_id: string;
          name: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          name: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          name?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      levels: {
        Row: {
          id: string;
          user_id: string;
          subject_id: string;
          level: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject_id: string;
          level: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject_id?: string;
          level?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_curriculum: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          book_id: string;
          subject_id: string;
          status: string;
          display_order: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          book_id: string;
          subject_id: string;
          status?: string;
          display_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          book_id?: string;
          subject_id?: string;
          status?: string;
          display_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invites: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: UserRole;
          status: string;
          target_college: string | null;
          grade: string | null;
          target_time: number | null;
          phone_number: string | null;
          high_school: string | null;
          learning_location: string | null;
          subjects: string[] | null;
          levels: Json | null;
          parent_email: string | null;
          payment_method: string | null;
          contract_start_date: string;
          contract_end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: UserRole;
          status?: string;
          target_college?: string | null;
          grade?: string | null;
          target_time?: number | null;
          phone_number?: string | null;
          high_school?: string | null;
          learning_location?: string | null;
          subjects?: string[] | null;
          levels?: Json | null;
          parent_email?: string | null;
          payment_method?: string | null;
          contract_start_date: string;
          contract_end_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: UserRole;
          status?: string;
          target_college?: string | null;
          grade?: string | null;
          target_time?: number | null;
          phone_number?: string | null;
          high_school?: string | null;
          learning_location?: string | null;
          subjects?: string[] | null;
          levels?: Json | null;
          parent_email?: string | null;
          payment_method?: string | null;
          contract_start_date?: string;
          contract_end_date?: string;
          created_at?: string;
        };
      };
      contracts: {
        Row: {
          id: string;
          user_id: string;
          parent_email: string | null;
          payment_method: string | null;
          status: string;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_email?: string | null;
          payment_method?: string | null;
          status?: string;
          current_period_start: string;
          current_period_end: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_email?: string | null;
          payment_method?: string | null;
          status?: string;
          current_period_start?: string;
          current_period_end?: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          title: string;
          instructor_id: string | null;
          instructor_name: string | null;
          passcode: string | null;
          start_time: string;
          end_time: string;
          survey_sent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          instructor_id?: string | null;
          instructor_name?: string | null;
          passcode?: string | null;
          start_time: string;
          end_time: string;
          survey_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          instructor_id?: string | null;
          instructor_name?: string | null;
          passcode?: string | null;
          start_time?: string;
          end_time?: string;
          survey_sent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      attendance_records: {
        Row: {
          id: string;
          class_id: string;
          user_id: string;
          status: string;
          instructor_name: string | null;
          student_name: string | null;
          study_material: string | null;
          attended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          user_id: string;
          status?: string;
          instructor_name?: string | null;
          student_name?: string | null;
          study_material?: string | null;
          attended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          user_id?: string;
          status?: string;
          instructor_name?: string | null;
          student_name?: string | null;
          study_material?: string | null;
          attended_at?: string | null;
          created_at?: string;
        };
      };
      attendance_plans: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          planned: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          planned?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          planned?: boolean;
          created_at?: string;
        };
      };
      survey_models: {
        Row: {
          id: string;
          title: string;
          type: string;
          form_fields: Json;
          delivery_status: string | null;
          delivery_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type?: string;
          form_fields: Json;
          delivery_status?: string | null;
          delivery_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          type?: string;
          form_fields?: Json;
          delivery_status?: string | null;
          delivery_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      survey_requests: {
        Row: {
          id: string;
          user_id: string;
          class_id: string | null;
          survey_model_id: string;
          type: string;
          status: string;
          requested_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_id?: string | null;
          survey_model_id: string;
          type?: string;
          status?: string;
          requested_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_id?: string | null;
          survey_model_id?: string;
          type?: string;
          status?: string;
          requested_at?: string;
        };
      };
      survey_responses: {
        Row: {
          id: string;
          user_id: string;
          class_id: string | null;
          survey_model_id: string;
          request_id: string;
          type: string;
          responses: Json;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_id?: string | null;
          survey_model_id: string;
          request_id: string;
          type?: string;
          responses: Json;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_id?: string | null;
          survey_model_id?: string;
          request_id?: string;
          type?: string;
          responses?: Json;
          submitted_at?: string;
        };
      };
      time_logs: {
        Row: {
          id: string;
          user_id: string;
          curriculum_id: string;
          duration_seconds: number;
          started_at: string;
          ended_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          curriculum_id: string;
          duration_seconds: number;
          started_at: string;
          ended_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          curriculum_id?: string;
          duration_seconds?: number;
          started_at?: string;
          ended_at?: string;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      timeline_posts: {
        Row: {
          id: string;
          title: string;
          content: string;
          thumbnail_url: string | null;
          author_name: string | null;
          excerpt: string | null;
          category_id: string | null;
          author_id: string;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          thumbnail_url?: string | null;
          author_name?: string | null;
          excerpt?: string | null;
          category_id?: string | null;
          author_id: string;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string;
          thumbnail_url?: string | null;
          author_name?: string | null;
          excerpt?: string | null;
          category_id?: string | null;
          author_id?: string;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      specials: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_date: string;
          end_date: string;
          capacity: number | null;
          thumbnail_url: string | null;
          form_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          start_date: string;
          end_date: string;
          capacity?: number | null;
          thumbnail_url?: string | null;
          form_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          start_date?: string;
          end_date?: string;
          capacity?: number | null;
          thumbnail_url?: string | null;
          form_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      entries: {
        Row: {
          id: string;
          special_id: string;
          user_id: string;
          status: string;
          form_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          special_id: string;
          user_id: string;
          status?: string;
          form_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          special_id?: string;
          user_id?: string;
          status?: string;
          form_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      personal_entries: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          preferred_date: string;
          notes: string | null;
          status: string;
          contracted_subjects: string[] | null;
          phone_number: string | null;
          desired_subjects: string[] | null;
          additional_desired_subject: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          preferred_date: string;
          notes?: string | null;
          status?: string;
          contracted_subjects?: string[] | null;
          phone_number?: string | null;
          desired_subjects?: string[] | null;
          additional_desired_subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject?: string;
          preferred_date?: string;
          notes?: string | null;
          status?: string;
          contracted_subjects?: string[] | null;
          phone_number?: string | null;
          desired_subjects?: string[] | null;
          additional_desired_subject?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      memos: {
        Row: {
          id: string;
          user_id: string;
          author_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          author_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      progress: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          book_id: string | null;
          lap: number;
          status: string;
          score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          book_id?: string | null;
          lap?: number;
          status?: string;
          score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string;
          book_id?: string | null;
          lap?: number;
          status?: string;
          score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Functions: {
      get_user_role: {
        Args: { auth_id: string };
        Returns: UserRole;
      };
      process_new_user_invite: {
        Args: {
          p_auth_id: string;
          p_email: string;
          p_display_name: string;
          p_photo_url: string | null;
        };
        Returns: Json;
      };
      send_survey_on_class_end: {
        Args: Record<string, never>;
        Returns: void;
      };
      distribute_scheduled_surveys: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
  };
}
