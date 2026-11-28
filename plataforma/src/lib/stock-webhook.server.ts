/** @deprecated Usar `@/lib/client-webhook.server` — se mantiene por imports existentes. */
export {
  clientWebhookUrl as stockWebhookUrl,
  enviarAvisoStockWebhook,
  enviarAvisoPagoWebhook,
  buildMensajePago,
  NEQUI_PAGO,
  QR_PAGO_PATH,
  publicSiteUrl,
} from "@/lib/client-webhook.server";
