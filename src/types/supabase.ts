export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      estimation_submissions: {
        Row: {
          city: string
          created_at: string | null
          email: string
          id: string
          message: string | null
          nom: string
          nombre_chambres: number | null
          nombre_pieces: number | null
          prenom: string
          property_type: string
          surface_habitable: number | null
          surface_terrain: number | null
          telephone: string
        }
        Insert: {
          city: string
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
          nom: string
          nombre_chambres?: number | null
          nombre_pieces?: number | null
          prenom: string
          property_type: string
          surface_habitable?: number | null
          surface_terrain?: number | null
          telephone: string
        }
        Update: {
          city?: string
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
          nom?: string
          nombre_chambres?: number | null
          nombre_pieces?: number | null
          prenom?: string
          property_type?: string
          surface_habitable?: number | null
          surface_terrain?: number | null
          telephone?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          bien_ref: string | null
          created_at: string | null
          email: string
          id: string
          message: string | null
          nom: string
          telephone: string | null
          type_contact: string | null
        }
        Insert: {
          bien_ref?: string | null
          created_at?: string | null
          email: string
          id?: string
          message?: string | null
          nom: string
          telephone?: string | null
          type_contact?: string | null
        }
        Update: {
          bien_ref?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string | null
          nom?: string
          telephone?: string | null
          type_contact?: string | null
        }
        Relationships: []
      }
      offmarket_submissions: {
        Row: {
          budget: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          property_type: string | null
          sector: string | null
        }
        Insert: {
          budget?: string | null
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone: string
          property_type?: string | null
          sector?: string | null
        }
        Update: {
          budget?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string
          property_type?: string | null
          sector?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  T extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<
  T extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][T]["Insert"]
