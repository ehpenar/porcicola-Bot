import { resolveClienteChatId } from "@/lib/enlace/schema";
import { formatCOP, type Pedido } from "@/lib/pedidos";
import type { StockLineaAjuste } from "@/lib/stock";

/** Mismo webhook n8n para avisos al cliente (stock, pago, etc.). */
export function clientWebhookUrl() {
  return (
    process.env.STOCK_WEBHOOK_URL ||
    process.env.PAGO_WEBHOOK_URL ||
    "https://ehpenar.app.n8n.cloud/webhook/b4d0784c-8649-4c78-bc0d-285b2476296e"
  );
}

export function publicSiteUrl() {
  return (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.VITE_SITE_URL ||
    "https://porcicolabot.netlify.app"
  ).replace(/\/$/, "");
}

export const NEQUI_PAGO = "3195658769";
export const QR_PAGO_PATH = "/pago/qr-nequi.webp";

export function buildMensajePago(pedido: Pedido) {
  const nombre = pedido.cliente_nombre?.split(" ")[0] || "cliente";
  return [
    `Hola ${nombre}, para pagar tu pedido ${pedido.codigo}:`,
    ``,
    `Nequi: ${NEQUI_PAGO}`,
    `Monto: ${formatCOP(pedido.monto_estimado)}`,
    ``,
    `Puedes escanear el QR o transferir a ese Nequi.`,
    `Cuando pagues, envíanos el comprobante por este chat.`,
  ].join("\n");
}

async function postClientWebhook(body: Record<string, unknown>) {
  const url = clientWebhookUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook cliente falló (${res.status}): ${text.slice(0, 200)}`);
  }
  return body;
}

export async function enviarAvisoStockWebhook(payload: {
  pedido: Pedido;
  ajustes: StockLineaAjuste[];
  mensaje: string;
}) {
  const chatId = resolveClienteChatId({
    cliente_chat_id: payload.pedido.cliente_chat_id,
    cliente_telefono: payload.pedido.cliente_telefono,
  });
  if (!chatId) throw new Error("No hay chatId ni teléfono del cliente para avisar por WhatsApp");
  return postClientWebhook({
    tipo: "stock_verificado",
    pedido_id: payload.pedido.id,
    codigo: payload.pedido.codigo,
    chatId,
    cliente_nombre: payload.pedido.cliente_nombre,
    cliente_telefono: payload.pedido.cliente_telefono,
    mensaje: payload.mensaje,
    todo_disponible: payload.ajustes.every((a) => a.estado === "ok"),
    ajustes: payload.ajustes,
  });
}

export async function enviarAvisoPagoWebhook(pedido: Pedido) {
  const chatId = resolveClienteChatId({
    cliente_chat_id: pedido.cliente_chat_id,
    cliente_telefono: pedido.cliente_telefono,
  });
  if (!chatId) throw new Error("No hay chatId ni teléfono del cliente para solicitar el pago");
  const mensaje = buildMensajePago(pedido);
  const qr_url = `${publicSiteUrl()}${QR_PAGO_PATH}`;
  return postClientWebhook({
    tipo: "pago_solicitado",
    pedido_id: pedido.id,
    codigo: pedido.codigo,
    chatId,
    cliente_nombre: pedido.cliente_nombre,
    cliente_telefono: pedido.cliente_telefono,
    mensaje,
    nequi: NEQUI_PAGO,
    monto_estimado: pedido.monto_estimado,
    qr_url,
    /** Green-API: sendMessage(mensaje) + sendFileByUrl(qr_url) */
  });
}
