import { z } from "zod";

/** Línea tal como suele venir del agente n8n / JSON de comanda. */
const productoBotSchema = z.object({
  codigo: z.coerce.string().min(1),
  producto: z.string().min(1),
  cantidad: z.coerce.number().positive(),
  unidad: z
    .string()
    .min(1)
    .transform((u) => (u.trim().toUpperCase() === "UND" ? "UND" : "KG")),
  preparacion: z.union([z.array(z.string()), z.string()]).optional().nullable(),
  empaque: z
    .union([
      z.string(),
      z.object({
        tipo: z.string().optional().nullable(),
        distribucion: z.array(z.unknown()).optional().nullable(),
      }),
    ])
    .optional()
    .nullable(),
  observaciones: z.string().optional().nullable(),
  precio_unitario: z.coerce.number().nonnegative().optional(),
});

const clienteBotSchema = z.object({
  nombre: z.string().min(1, "El nombre del cliente es obligatorio"),
  cedula: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v == null ? null : String(v))),
  telefono: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v == null ? null : String(v))),
  direccion: z.string().optional().nullable(),
  barrio: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
});

/**
 * Cuerpo canónico tras normalizar lo que manda n8n.
 */
export const enlacePedidoBodySchema = z
  .object({
    estado: z.string().optional(),
    fecha_pedido: z.string().optional().nullable(),
    hora_pedido: z.string().optional().nullable(),
    fecha_entrega: z.string().optional().nullable(),
    ruta: z.string().optional().nullable(),
    cliente: clienteBotSchema,
    productos: z.array(productoBotSchema).min(1, "Debe haber al menos un producto"),
    observaciones_generales: z.string().optional().nullable(),
    datos_pendientes: z.array(z.unknown()).optional(),
    chatId: z.string().optional().nullable(),
    cliente_chat_id: z.string().optional().nullable(),
    senderName: z.string().optional().nullable(),
    idMessage: z.string().optional().nullable(),
  })
  .passthrough();

export type EnlacePedidoBody = z.infer<typeof enlacePedidoBodySchema>;

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

/**
 * Chat del CLIENTE (a quién responder), nunca el wid de la instancia (número del bot).
 * Green-API: senderData.chatId / sender = cliente; instanceData.wid = bot.
 */
function pickChatId(raw: Record<string, unknown>, pedido: Record<string, unknown>): string | null {
  const body = (raw.body && typeof raw.body === "object" ? raw.body : raw) as Record<string, unknown>;
  const senderData = (body.senderData || raw.senderData) as
    | { chatId?: string; sender?: string }
    | undefined;
  const candidates = [
    raw.chatId,
    raw.cliente_chat_id,
    pedido.chatId,
    pedido.cliente_chat_id,
    senderData?.chatId,
    senderData?.sender,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/** Convierte teléfono (319…) a chatId WhatsApp (57319…@c.us). */
export function telefonoToChatId(telefono: string | null | undefined): string | null {
  if (!telefono?.trim()) return null;
  const digits = telefono.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("57") ? digits : `57${digits}`;
  return `${withCountry}@c.us`;
}

export function resolveClienteChatId(opts: {
  cliente_chat_id?: string | null;
  chatId?: string | null;
  cliente_telefono?: string | null;
}): string | null {
  const direct = (opts.cliente_chat_id || opts.chatId || "").trim();
  if (direct) return direct.includes("@") ? direct : telefonoToChatId(direct) || direct;
  return telefonoToChatId(opts.cliente_telefono);
}

/**
 * Acepta:
 * - JSON de comanda directo
 * - { pedido, chatId }
 * - Item crudo de n8n: { output: "<json string>", body: { instanceData: { wid } } }
 * - Array de items (toma el primero)
 */
export function normalizeEnlaceBody(raw: unknown): EnlacePedidoBody {
  let current: unknown = raw;

  if (Array.isArray(current)) {
    if (current.length === 0) {
      throw new z.ZodError([
        { code: "custom", message: "Array vacío: no hay pedido", path: [] },
      ]);
    }
    current = current[0];
  }

  if (!current || typeof current !== "object") {
    throw new z.ZodError([{ code: "custom", message: "Body debe ser un objeto JSON", path: [] }]);
  }

  const root = current as Record<string, unknown>;

  // Item n8n: output es el JSON de comanda (string u objeto)
  if ("output" in root && root.output != null) {
    const parsed = tryParseJson(root.output);
    if (!parsed || typeof parsed !== "object") {
      throw new z.ZodError([
        { code: "custom", message: "output no es un JSON de pedido válido", path: ["output"] },
      ]);
    }
    const pedido = { ...(parsed as Record<string, unknown>) };
    const chatId = pickChatId(root, pedido);
    if (chatId) {
      pedido.chatId = chatId;
      pedido.cliente_chat_id = chatId;
    }
    return enlacePedidoBodySchema.parse(pedido);
  }

  // Envoltorio { pedido: {...}, chatId }
  if ("pedido" in root && root.pedido) {
    const inner = tryParseJson(root.pedido);
    const pedido =
      inner && typeof inner === "object" ? { ...(inner as Record<string, unknown>) } : {};
    const chatId = pickChatId(root, pedido);
    if (chatId) {
      pedido.chatId = chatId;
      pedido.cliente_chat_id = chatId;
    }
    return enlacePedidoBodySchema.parse(pedido);
  }

  // Ya es el JSON de comanda (tras expression en n8n)
  const pedido = { ...root };
  const chatId = pickChatId(root, pedido);
  if (chatId) {
    pedido.chatId = chatId;
    pedido.cliente_chat_id = chatId;
  }
  return enlacePedidoBodySchema.parse(pedido);
}

export function preparacionToText(prep: EnlacePedidoBody["productos"][number]["preparacion"]): string | null {
  if (prep == null || prep === "") return null;
  if (Array.isArray(prep)) return prep.filter(Boolean).join(", ") || null;
  return String(prep);
}

export function empaqueToText(empaque: EnlacePedidoBody["productos"][number]["empaque"]): string | null {
  if (empaque == null || empaque === "") return null;
  if (typeof empaque === "string") return empaque;
  const parts = [
    empaque.tipo,
    empaque.distribucion?.length ? JSON.stringify(empaque.distribucion) : null,
  ].filter(Boolean);
  return parts.join(" · ") || null;
}

export function buildNotasComercial(body: EnlacePedidoBody): string {
  const bits: string[] = [];
  if (body.observaciones_generales?.trim()) bits.push(body.observaciones_generales.trim());
  if (body.fecha_entrega) bits.push(`Fecha entrega: ${body.fecha_entrega}`);
  if (body.ruta) bits.push(`Ruta: ${body.ruta}`);
  if (body.fecha_pedido || body.hora_pedido) {
    bits.push(`Pedido WhatsApp: ${[body.fecha_pedido, body.hora_pedido].filter(Boolean).join(" ")}`);
  }
  if (body.datos_pendientes?.length) bits.push(`Datos pendientes: ${JSON.stringify(body.datos_pendientes)}`);
  bits.push("Origen: n8n / bot WhatsApp (enlace)");
  return bits.join("\n");
}
