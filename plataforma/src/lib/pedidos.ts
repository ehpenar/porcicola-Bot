import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type PedidoStatus = Database["public"]["Enums"]["pedido_status"];
export type PedidoOrigen = Database["public"]["Enums"]["pedido_origen"];
export type Unidad = Database["public"]["Enums"]["unidad_medida"];
export type Pedido = Database["public"]["Tables"]["pedidos"]["Row"];
export type PedidoLinea = Database["public"]["Tables"]["pedido_lineas"]["Row"];
export type Comprobante = Database["public"]["Tables"]["pedido_comprobantes"]["Row"];
export type Evento = Database["public"]["Tables"]["pedido_eventos"]["Row"];

export const ROLE_LABEL: Record<AppRole, string> = {
  general: "General (admin)",
  comercial: "Comercial",
  contable: "Contable",
  carnicero: "Carnicero",
};

export const ROLE_HOME: Record<AppRole, "/general" | "/comercial" | "/contable" | "/carnicero"> = {
  general: "/general",
  comercial: "/comercial",
  contable: "/contable",
  carnicero: "/carnicero",
};

export const STATUS_LABEL: Record<PedidoStatus, string> = {
  capturado: "Capturado",
  verificado_comercial: "Verificado comercial",
  pago_solicitado: "Pago solicitado",
  comprobante_recibido: "Comprobante recibido",
  liberado_produccion: "En producción",
  listo_despacho: "Listo para despacho",
  notificado_cliente: "Cliente notificado",
  archivado: "Archivado",
  en_correccion: "En corrección",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

/** Static class strings so Tailwind picks them up. */
export const STATUS_CLASS: Record<PedidoStatus, string> = {
  capturado: "bg-status-capturado/10 text-status-capturado border-status-capturado/30",
  verificado_comercial: "bg-status-verificado/10 text-status-verificado border-status-verificado/30",
  pago_solicitado: "bg-status-pago/12 text-status-pago border-status-pago/35",
  comprobante_recibido: "bg-status-comprobante/12 text-status-comprobante border-status-comprobante/35",
  liberado_produccion: "bg-status-produccion/10 text-status-produccion border-status-produccion/35",
  listo_despacho: "bg-status-listo/10 text-status-listo border-status-listo/30",
  notificado_cliente: "bg-status-notificado/10 text-status-notificado border-status-notificado/30",
  archivado: "bg-status-archivado/10 text-status-archivado border-status-archivado/25",
  en_correccion: "bg-status-correccion/15 text-status-correccion border-status-correccion/40",
  rechazado: "bg-status-rechazado/10 text-status-rechazado border-status-rechazado/30",
  cancelado: "bg-status-cancelado/10 text-status-cancelado border-status-cancelado/30",
};

export const STATUS_DOT: Record<PedidoStatus, string> = {
  capturado: "bg-status-capturado",
  verificado_comercial: "bg-status-verificado",
  pago_solicitado: "bg-status-pago",
  comprobante_recibido: "bg-status-comprobante",
  liberado_produccion: "bg-status-produccion",
  listo_despacho: "bg-status-listo",
  notificado_cliente: "bg-status-notificado",
  archivado: "bg-status-archivado",
  en_correccion: "bg-status-correccion",
  rechazado: "bg-status-rechazado",
  cancelado: "bg-status-cancelado",
};

export const ALL_STATUSES = Object.keys(STATUS_LABEL) as PedidoStatus[];

export const ORIGEN_LABEL: Record<PedidoOrigen, string> = {
  bot: "Bot WhatsApp",
  comercial_manual: "Manual",
};

export const ACCION_LABEL: Record<string, string> = {
  pedido_creado: "Pedido creado",
  pedido_editado: "Pedido editado",
  verificar_pedido: "Verificar pedido",
  rechazar_pedido: "Pedido rechazado",
  enviar_a_correccion: "Enviado a corrección",
  regresar_a_captura: "Regresado a captura",
  solicitar_pago: "Solicitar pago al cliente",
  devolver_a_comercial: "Devuelto a comercial",
  marcar_comprobante_recibido: "Comprobante recibido",
  comprobante_adjuntado: "Comprobante adjuntado",
  cancelar_pedido: "Pedido cancelado",
  validar_pago_y_liberar: "Validar pago y liberar",
  rechazar_comprobante: "Comprobante rechazado",
  marcar_listo_despacho: "Marcar listo para despacho",
  notificar_cliente: "Cliente notificado",
  notificar_cliente_y_archivar: "Notificar cliente y archivar",
  archivar: "Archivado",
  mensaje_simulado: "Mensaje WhatsApp (simulado)",
  nota_actualizada: "Nota actualizada",
};

/** Mirror of the transition table enforced in the database (transicionar_pedido). */
export type Transition = {
  from: PedidoStatus;
  to: PedidoStatus;
  role: Exclude<AppRole, "general">;
  accion: string;
  requiresNote: boolean;
};

export const TRANSITIONS: Transition[] = [
  { from: "capturado", to: "verificado_comercial", role: "comercial", accion: "verificar_pedido", requiresNote: false },
  { from: "capturado", to: "rechazado", role: "comercial", accion: "rechazar_pedido", requiresNote: true },
  { from: "capturado", to: "en_correccion", role: "comercial", accion: "enviar_a_correccion", requiresNote: true },
  { from: "verificado_comercial", to: "pago_solicitado", role: "contable", accion: "solicitar_pago", requiresNote: false },
  { from: "verificado_comercial", to: "en_correccion", role: "contable", accion: "devolver_a_comercial", requiresNote: true },
  { from: "en_correccion", to: "capturado", role: "comercial", accion: "regresar_a_captura", requiresNote: false },
  { from: "en_correccion", to: "verificado_comercial", role: "comercial", accion: "verificar_pedido", requiresNote: false },
  { from: "pago_solicitado", to: "comprobante_recibido", role: "contable", accion: "marcar_comprobante_recibido", requiresNote: false },
  { from: "pago_solicitado", to: "cancelado", role: "contable", accion: "cancelar_pedido", requiresNote: true },
  { from: "comprobante_recibido", to: "liberado_produccion", role: "contable", accion: "validar_pago_y_liberar", requiresNote: false },
  { from: "comprobante_recibido", to: "pago_solicitado", role: "contable", accion: "rechazar_comprobante", requiresNote: true },
  { from: "liberado_produccion", to: "listo_despacho", role: "carnicero", accion: "marcar_listo_despacho", requiresNote: false },
  { from: "listo_despacho", to: "notificado_cliente", role: "contable", accion: "notificar_cliente", requiresNote: false },
  { from: "listo_despacho", to: "archivado", role: "contable", accion: "notificar_cliente_y_archivar", requiresNote: false },
  { from: "notificado_cliente", to: "archivado", role: "contable", accion: "archivar", requiresNote: false },
];

export function findTransition(from: PedidoStatus, to: PedidoStatus) {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function canTransition(role: AppRole | null | undefined, from: PedidoStatus, to: PedidoStatus) {
  if (!role) return false;
  const t = findTransition(from, to);
  if (!t) return false;
  return role === "general" || role === t.role;
}

export function allowedTransitions(role: AppRole | null | undefined, from: PedidoStatus) {
  return TRANSITIONS.filter((t) => t.from === from && canTransition(role, t.from, t.to));
}

/** Prices are hidden from the butcher. */
export function canSeeMoney(role: AppRole | null | undefined) {
  return role === "general" || role === "comercial" || role === "contable";
}

export function canEditPedido(role: AppRole | null | undefined, status: PedidoStatus) {
  return (role === "general" || role === "comercial") && (status === "capturado" || status === "en_correccion");
}

/** Production duration = prep_done_at − released_at (ms), or null when not finished. */
export function productionDurationMs(p: Pick<Pedido, "released_at" | "prep_done_at">) {
  if (!p.released_at || !p.prep_done_at) return null;
  return new Date(p.prep_done_at).getTime() - new Date(p.released_at).getTime();
}

export type CatalogItem = { codigo_plu: string; nombre: string; unidad: Unidad; precio: number };
export const CATALOGO: CatalogItem[] = [
  { codigo_plu: "PLU-201", nombre: "Lomo sin hueso", unidad: "KG", precio: 26000 },
  { codigo_plu: "PLU-202", nombre: "Chuleta ahumada", unidad: "KG", precio: 24000 },
  { codigo_plu: "PLU-203", nombre: "Chuleta fresca", unidad: "KG", precio: 21000 },
  { codigo_plu: "PLU-204", nombre: "Costilla", unidad: "KG", precio: 19000 },
  { codigo_plu: "PLU-205", nombre: "Bondiola", unidad: "KG", precio: 23000 },
  { codigo_plu: "PLU-206", nombre: "Tocino", unidad: "KG", precio: 17000 },
  { codigo_plu: "PLU-207", nombre: "Pernil", unidad: "KG", precio: 20000 },
  { codigo_plu: "PLU-208", nombre: "Solomito", unidad: "KG", precio: 32000 },
  { codigo_plu: "PLU-209", nombre: "Molida", unidad: "KG", precio: 18000 },
  { codigo_plu: "PLU-210", nombre: "Manitas", unidad: "UND", precio: 4500 },
  { codigo_plu: "PLU-211", nombre: "Espinazo", unidad: "KG", precio: 12000 },
  { codigo_plu: "PLU-212", nombre: "Chorizo", unidad: "UND", precio: 3500 },
];

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
export function formatCOP(n: number | null | undefined) {
  if (n == null) return "—";
  return copFormatter.format(n);
}

export function formatCantidad(n: number | null | undefined, unidad?: Unidad) {
  if (n == null) return "—";
  const s = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n);
  return unidad ? `${s} ${unidad === "KG" ? "kg" : "und"}` : s;
}

/** "1 h 05 min", "12 min", "45 s" */
export function formatDuration(ms: number | null | undefined) {
  if (ms == null || Number.isNaN(ms)) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

/** HH:MM:SS chronometer */
export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

const dtFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return dtFormatter.format(new Date(iso));
}

export function errorMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Ocurrió un error inesperado";
}
