import type { Pedido } from "@/lib/pedidos";
import { resolveClienteChatId } from "@/lib/enlace/schema";
import type { StockLineaAjuste } from "@/lib/stock";

/** Solo servidor — no importar desde componentes del cliente (evita secrets en el bundle). */
export function stockWebhookUrl() {
  return (
    process.env.STOCK_WEBHOOK_URL ||
    "https://ehpenar.app.n8n.cloud/webhook/b4d0784c-8649-4c78-bc0d-285b2476296e"
  );
}

export async function enviarAvisoStockWebhook(payload: {
  pedido: Pedido;
  ajustes: StockLineaAjuste[];
  mensaje: string;
}) {
  const url = stockWebhookUrl();
  // Preferir chat WhatsApp del cliente; si falta, armarlo desde el teléfono (nunca el wid del bot).
  const chatId = resolveClienteChatId({
    cliente_chat_id: payload.pedido.cliente_chat_id,
    cliente_telefono: payload.pedido.cliente_telefono,
  });
  if (!chatId) {
    throw new Error("No hay chatId ni teléfono del cliente para avisar por WhatsApp");
  }
  const body = {
    tipo: "stock_verificado",
    pedido_id: payload.pedido.id,
    codigo: payload.pedido.codigo,
    chatId,
    cliente_nombre: payload.pedido.cliente_nombre,
    cliente_telefono: payload.pedido.cliente_telefono,
    mensaje: payload.mensaje,
    todo_disponible: payload.ajustes.every((a) => a.estado === "ok"),
    ajustes: payload.ajustes,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webhook stock falló (${res.status}): ${text.slice(0, 200)}`);
  }
  return body;
}
