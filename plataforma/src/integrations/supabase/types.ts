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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      config_pago: {
        Row: {
          id: number
          instrucciones: string
          qr_url: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          instrucciones?: string
          qr_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          instrucciones?: string
          qr_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pedido_comprobantes: {
        Row: {
          created_at: string
          file_path: string | null
          id: string
          nota: string | null
          pedido_id: string
          recibido_at: string
          resultado: Database["public"]["Enums"]["comprobante_resultado"]
          validado_por: string | null
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: string
          nota?: string | null
          pedido_id: string
          recibido_at?: string
          resultado?: Database["public"]["Enums"]["comprobante_resultado"]
          validado_por?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: string
          nota?: string | null
          pedido_id?: string
          recibido_at?: string
          resultado?: Database["public"]["Enums"]["comprobante_resultado"]
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_comprobantes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_eventos: {
        Row: {
          accion: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          created_at: string
          detalle: string | null
          from_status: Database["public"]["Enums"]["pedido_status"] | null
          id: string
          pedido_id: string
          to_status: Database["public"]["Enums"]["pedido_status"] | null
        }
        Insert: {
          accion: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          detalle?: string | null
          from_status?: Database["public"]["Enums"]["pedido_status"] | null
          id?: string
          pedido_id: string
          to_status?: Database["public"]["Enums"]["pedido_status"] | null
        }
        Update: {
          accion?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          created_at?: string
          detalle?: string | null
          from_status?: Database["public"]["Enums"]["pedido_status"] | null
          id?: string
          pedido_id?: string
          to_status?: Database["public"]["Enums"]["pedido_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_eventos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_lineas: {
        Row: {
          cantidad: number
          cantidad_real: number | null
          codigo_plu: string
          empaque: string | null
          id: string
          nombre: string
          orden: number
          pedido_id: string
          precio_unitario: number
          preparacion: string | null
          unidad: Database["public"]["Enums"]["unidad_medida"]
        }
        Insert: {
          cantidad?: number
          cantidad_real?: number | null
          codigo_plu: string
          empaque?: string | null
          id?: string
          nombre: string
          orden?: number
          pedido_id: string
          precio_unitario?: number
          preparacion?: string | null
          unidad?: Database["public"]["Enums"]["unidad_medida"]
        }
        Update: {
          cantidad?: number
          cantidad_real?: number | null
          codigo_plu?: string
          empaque?: string | null
          id?: string
          nombre?: string
          orden?: number
          pedido_id?: string
          precio_unitario?: number
          preparacion?: string | null
          unidad?: Database["public"]["Enums"]["unidad_medida"]
        }
        Relationships: [
          {
            foreignKeyName: "pedido_lineas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          archived_at: string | null
          client_notified_at: string | null
          cliente_barrio: string | null
          cliente_cedula: string | null
          cliente_chat_id: string | null
          cliente_ciudad: string | null
          cliente_direccion: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          codigo: string
          created_at: string
          id: string
          monto_estimado: number
          monto_pagado: number | null
          notas_comercial: string | null
          notas_contable: string | null
          novedades_carnicero: string | null
          origen: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at: string | null
          prep_done_at: string | null
          proof_received_at: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          status_changed_at: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          archived_at?: string | null
          client_notified_at?: string | null
          cliente_barrio?: string | null
          cliente_cedula?: string | null
          cliente_chat_id?: string | null
          cliente_ciudad?: string | null
          cliente_direccion?: string | null
          cliente_nombre?: string
          cliente_telefono?: string | null
          codigo?: string
          created_at?: string
          id?: string
          monto_estimado?: number
          monto_pagado?: number | null
          notas_comercial?: string | null
          notas_contable?: string | null
          novedades_carnicero?: string | null
          origen?: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at?: string | null
          prep_done_at?: string | null
          proof_received_at?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          status_changed_at?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          archived_at?: string | null
          client_notified_at?: string | null
          cliente_barrio?: string | null
          cliente_cedula?: string | null
          cliente_chat_id?: string | null
          cliente_ciudad?: string | null
          cliente_direccion?: string | null
          cliente_nombre?: string
          cliente_telefono?: string | null
          codigo?: string
          created_at?: string
          id?: string
          monto_estimado?: number
          monto_pagado?: number | null
          notas_comercial?: string | null
          notas_contable?: string | null
          novedades_carnicero?: string | null
          origen?: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at?: string | null
          prep_done_at?: string | null
          proof_received_at?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          status_changed_at?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
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
      _insertar_lineas: {
        Args: { p_lineas: Json; p_pedido: string }
        Returns: undefined
      }
      _recalcular_monto: { Args: { p_pedido: string }; Returns: undefined }
      actualizar_cantidad_real: {
        Args: { p_cantidad: number; p_linea: string }
        Returns: undefined
      }
      actualizar_config_pago: {
        Args: { p_instrucciones: string; p_qr_url: string }
        Returns: undefined
      }
      actualizar_nota: {
        Args: { p_campo: string; p_pedido: string; p_valor: string }
        Returns: {
          archived_at: string | null
          client_notified_at: string | null
          cliente_barrio: string | null
          cliente_cedula: string | null
          cliente_chat_id: string | null
          cliente_ciudad: string | null
          cliente_direccion: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          codigo: string
          created_at: string
          id: string
          monto_estimado: number
          monto_pagado: number | null
          notas_comercial: string | null
          notas_contable: string | null
          novedades_carnicero: string | null
          origen: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at: string | null
          prep_done_at: string | null
          proof_received_at: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          status_changed_at: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      actualizar_pedido: {
        Args: {
          p_cliente: Json
          p_lineas?: Json
          p_notas_comercial?: string
          p_pedido: string
        }
        Returns: {
          archived_at: string | null
          client_notified_at: string | null
          cliente_barrio: string | null
          cliente_cedula: string | null
          cliente_chat_id: string | null
          cliente_ciudad: string | null
          cliente_direccion: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          codigo: string
          created_at: string
          id: string
          monto_estimado: number
          monto_pagado: number | null
          notas_comercial: string | null
          notas_contable: string | null
          novedades_carnicero: string | null
          origen: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at: string | null
          prep_done_at: string | null
          proof_received_at: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          status_changed_at: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_active: {
        Args: { p_active: boolean; p_user: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user: string
        }
        Returns: undefined
      }
      crear_pedido: {
        Args: {
          p_cliente: Json
          p_lineas: Json
          p_notas?: string
          p_origen: Database["public"]["Enums"]["pedido_origen"]
        }
        Returns: {
          archived_at: string | null
          client_notified_at: string | null
          cliente_barrio: string | null
          cliente_cedula: string | null
          cliente_chat_id: string | null
          cliente_ciudad: string | null
          cliente_direccion: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          codigo: string
          created_at: string
          id: string
          monto_estimado: number
          monto_pagado: number | null
          notas_comercial: string | null
          notas_contable: string | null
          novedades_carnicero: string | null
          origen: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at: string | null
          prep_done_at: string | null
          proof_received_at: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          status_changed_at: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      registrar_comprobante: {
        Args: { p_file_path?: string; p_nota?: string; p_pedido: string }
        Returns: {
          archived_at: string | null
          client_notified_at: string | null
          cliente_barrio: string | null
          cliente_cedula: string | null
          cliente_chat_id: string | null
          cliente_ciudad: string | null
          cliente_direccion: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          codigo: string
          created_at: string
          id: string
          monto_estimado: number
          monto_pagado: number | null
          notas_comercial: string | null
          notas_contable: string | null
          novedades_carnicero: string | null
          origen: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at: string | null
          prep_done_at: string | null
          proof_received_at: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          status_changed_at: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transicionar_pedido: {
        Args: {
          p_monto_pagado?: number
          p_nota?: string
          p_pedido: string
          p_to: Database["public"]["Enums"]["pedido_status"]
        }
        Returns: {
          archived_at: string | null
          client_notified_at: string | null
          cliente_barrio: string | null
          cliente_cedula: string | null
          cliente_chat_id: string | null
          cliente_ciudad: string | null
          cliente_direccion: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          codigo: string
          created_at: string
          id: string
          monto_estimado: number
          monto_pagado: number | null
          notas_comercial: string | null
          notas_contable: string | null
          novedades_carnicero: string | null
          origen: Database["public"]["Enums"]["pedido_origen"]
          payment_requested_at: string | null
          prep_done_at: string | null
          proof_received_at: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          status_changed_at: string
          updated_at: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "general" | "comercial" | "contable" | "carnicero"
      comprobante_resultado: "pendiente" | "aceptado" | "rechazado"
      pedido_origen: "bot" | "comercial_manual"
      pedido_status:
        | "capturado"
        | "verificado_comercial"
        | "pago_solicitado"
        | "comprobante_recibido"
        | "liberado_produccion"
        | "listo_despacho"
        | "notificado_cliente"
        | "archivado"
        | "en_correccion"
        | "rechazado"
        | "cancelado"
      unidad_medida: "KG" | "UND"
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
      app_role: ["general", "comercial", "contable", "carnicero"],
      comprobante_resultado: ["pendiente", "aceptado", "rechazado"],
      pedido_origen: ["bot", "comercial_manual"],
      pedido_status: [
        "capturado",
        "verificado_comercial",
        "pago_solicitado",
        "comprobante_recibido",
        "liberado_produccion",
        "listo_despacho",
        "notificado_cliente",
        "archivado",
        "en_correccion",
        "rechazado",
        "cancelado",
      ],
      unidad_medida: ["KG", "UND"],
    },
  },
} as const
