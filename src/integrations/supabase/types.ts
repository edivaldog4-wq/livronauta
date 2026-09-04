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
      audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          diff: Json | null
          id: string
          operation: string
          row_id: string | null
          summary: string | null
          table_name: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          operation: string
          row_id?: string | null
          summary?: string | null
          table_name: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          operation?: string
          row_id?: string | null
          summary?: string | null
          table_name?: string
        }
        Relationships: []
      }
      books: {
        Row: {
          ano: number | null
          autor: string
          capa_url: string | null
          categoria_id: string | null
          created_at: string
          editora: string | null
          id: string
          idioma: string | null
          isbn: string | null
          localizacao_prateleira: string | null
          numero_paginas: number | null
          quantidade_disponivel: number
          quantidade_total: number
          sinopse: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ano?: number | null
          autor?: string
          capa_url?: string | null
          categoria_id?: string | null
          created_at?: string
          editora?: string | null
          id?: string
          idioma?: string | null
          isbn?: string | null
          localizacao_prateleira?: string | null
          numero_paginas?: number | null
          quantidade_disponivel?: number
          quantidade_total?: number
          sinopse?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ano?: number | null
          autor?: string
          capa_url?: string | null
          categoria_id?: string | null
          created_at?: string
          editora?: string | null
          id?: string
          idioma?: string | null
          isbn?: string | null
          localizacao_prateleira?: string | null
          numero_paginas?: number | null
          quantidade_disponivel?: number
          quantidade_total?: number
          sinopse?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          errors: Json
          filename: string | null
          id: string
          imported: number
          merged: number
          selected_rows: number
          skipped: number
          total_rows: number
          updated: number
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          errors?: Json
          filename?: string | null
          id?: string
          imported?: number
          merged?: number
          selected_rows?: number
          skipped?: number
          total_rows?: number
          updated?: number
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          errors?: Json
          filename?: string | null
          id?: string
          imported?: number
          merged?: number
          selected_rows?: number
          skipped?: number
          total_rows?: number
          updated?: number
        }
        Relationships: []
      }
      labels: {
        Row: {
          book_id: string
          codigo_barras: string | null
          data_geracao: string
          id: string
        }
        Insert: {
          book_id: string
          codigo_barras?: string | null
          data_geracao?: string
          id?: string
        }
        Update: {
          book_id?: string
          codigo_barras?: string | null
          data_geracao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_requests: {
        Row: {
          book_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          observacao: string | null
          status: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          observacao?: string | null
          status?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          observacao?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_requests_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          book_id: string
          created_at: string
          data_devolucao_prevista: string
          data_devolucao_real: string | null
          data_emprestimo: string
          devolucao_condicao: string | null
          devolucao_observacao: string | null
          id: string
          multa: number | null
          status: Database["public"]["Enums"]["loan_status"]
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          data_devolucao_prevista: string
          data_devolucao_real?: string | null
          data_emprestimo?: string
          devolucao_condicao?: string | null
          devolucao_observacao?: string | null
          id?: string
          multa?: number | null
          status?: Database["public"]["Enums"]["loan_status"]
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          data_devolucao_prevista?: string
          data_devolucao_real?: string | null
          data_emprestimo?: string
          devolucao_condicao?: string | null
          devolucao_observacao?: string | null
          id?: string
          multa?: number | null
          status?: Database["public"]["Enums"]["loan_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          data_cadastro: string
          email: string
          endereco: string | null
          id: string
          nome: string
          numero: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_cadastro?: string
          email?: string
          endereco?: string | null
          id: string
          nome?: string
          numero?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_cadastro?: string
          email?: string
          endereco?: string | null
          id?: string
          nome?: string
          numero?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          book_id: string
          data_reserva: string
          id: string
          status: Database["public"]["Enums"]["reservation_status"]
          user_id: string
        }
        Insert: {
          book_id: string
          data_reserva?: string
          id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          user_id: string
        }
        Update: {
          book_id?: string
          data_reserva?: string
          id?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      shelves: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      approve_loan_request: {
        Args: { _dias?: number; _request_id: string }
        Returns: string
      }
      bootstrap_first_admin: { Args: never; Returns: boolean }
      cancel_loan_request: { Args: { _request_id: string }; Returns: boolean }
      create_loan: {
        Args: { _book_id: string; _dias?: number; _user_id: string }
        Returns: string
      }
      generate_profile_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_books_batch: { Args: { _items: Json }; Returns: Json }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      merge_books: {
        Args: { _source_id: string; _target_id: string }
        Returns: Json
      }
      normalize_book_text: { Args: { _value: string }; Returns: string }
      reject_loan_request: { Args: { _request_id: string }; Returns: boolean }
      request_loan: {
        Args: { _book_id: string; _observacao?: string }
        Returns: string
      }
      return_loan:
        | { Args: { _loan_id: string }; Returns: number }
        | {
            Args: { _condicao?: string; _loan_id: string; _observacao?: string }
            Returns: number
          }
      update_loan_due_date: {
        Args: { _loan_id: string; _new_date: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "bibliotecario" | "membro"
      loan_status: "ativo" | "concluido"
      reservation_status: "ativa" | "cancelada" | "concluida"
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
    Enums: {
      app_role: ["admin", "bibliotecario", "membro"],
      loan_status: ["ativo", "concluido"],
      reservation_status: ["ativa", "cancelada", "concluida"],
    },
  },
} as const
