import { CATALOGO } from "@/lib/pedidos";
import type { Pedido, PedidoLinea, Evento } from "@/lib/pedidos";
import { enlaceApiKey, isDemoMode } from "@/lib/demo-mode";
import {
  buildNotasComercial,
  empaqueToText,
  preparacionToText,
  type EnlacePedidoBody,
} from "@/lib/enlace/schema";
import { readServerDemoData, writeServerDemoData } from "@/lib/enlace/server-demo-store";

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function resolvePrecio(codigo: string, explicit?: number) {
  if (explicit != null && !Number.isNaN(explicit)) return explicit;
  const cat = CATALOGO.find((c) => c.codigo_plu === codigo);
  return cat?.precio ?? 0;
}

function mapLineas(body: EnlacePedidoBody, pedidoId: string): { lineas: PedidoLinea[]; monto: number } {
  let monto = 0;
  const lineas: PedidoLinea[] = body.productos.map((p, i) => {
    const unidad: PedidoLinea["unidad"] = p.unidad === "UND" ? "UND" : "KG";
    const precio = resolvePrecio(p.codigo, p.precio_unitario);
    monto += Math.round(p.cantidad * precio);
    const prepBits = [preparacionToText(p.preparacion), p.observaciones?.trim()].filter(Boolean);
    return {
      id: uid(),
      pedido_id: pedidoId,
      orden: i,
      codigo_plu: p.codigo,
      nombre: p.producto,
      cantidad: p.cantidad,
      unidad,
      preparacion: prepBits.join(" · ") || null,
      empaque: empaqueToText(p.empaque),
      precio_unitario: precio,
      cantidad_real: null,
    };
  });
  return { lineas, monto };
}

function mapCliente(body: EnlacePedidoBody) {
  return {
    cliente_nombre: body.cliente.nombre.trim(),
    cliente_telefono: body.cliente.telefono?.trim() || null,
    cliente_cedula: body.cliente.cedula?.trim() || null,
    cliente_direccion: body.cliente.direccion?.trim() || null,
    cliente_barrio: body.cliente.barrio?.trim() || null,
    cliente_ciudad: body.cliente.ciudad?.trim() || null,
    cliente_chat_id: (body.chatId || body.cliente_chat_id || "").trim() || null,
  };
}

async function crearEnDemo(body: EnlacePedidoBody) {
  const data = await readServerDemoData();
  const id = uid();
  const ts = now();
  const cliente = mapCliente(body);
  const { lineas, monto } = mapLineas(body, id);
  const codigo = `ORD-${String(2000 + data.pedidos.length + 1)}`;
  const pedido: Pedido = {
    id,
    codigo,
    origen: "bot",
    status: "capturado",
    ...cliente,
    monto_estimado: monto,
    monto_pagado: null,
    notas_comercial: buildNotasComercial(body),
    notas_contable: null,
    novedades_carnicero: null,
    verified_at: null,
    payment_requested_at: null,
    proof_received_at: null,
    released_at: null,
    prep_done_at: null,
    client_notified_at: null,
    archived_at: null,
    status_changed_at: ts,
    created_at: ts,
    updated_at: ts,
  };
  const evento: Evento = {
    id: uid(),
    pedido_id: id,
    actor_id: null,
    actor_role: null,
    accion: "pedido_creado",
    from_status: null,
    to_status: "capturado",
    detalle: `Enlace n8n${body.idMessage ? ` · idMessage=${body.idMessage}` : ""}`,
    created_at: ts,
  };
  data.pedidos.unshift(pedido);
  data.lineas.push(...lineas);
  data.eventos.push(evento);
  await writeServerDemoData(data);
  return { pedido, lineas, evento };
}

async function crearEnSupabase(body: EnlacePedidoBody) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cliente = mapCliente(body);
  const notas = buildNotasComercial(body);

  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .insert({
      origen: "bot",
      status: "capturado",
      ...cliente,
      notas_comercial: notas,
    })
    .select("*")
    .single();
  if (error || !pedido) throw new Error(error?.message ?? "No se pudo crear el pedido");

  const { lineas, monto } = mapLineas(body, pedido.id);
  const lineasDb = lineas.map(({ id: _id, ...rest }) => rest);
  const { error: lineErr } = await supabaseAdmin.from("pedido_lineas").insert(lineasDb);
  if (lineErr) throw new Error(lineErr.message);

  await supabaseAdmin.from("pedidos").update({ monto_estimado: monto, updated_at: now() }).eq("id", pedido.id);

  const { data: evento, error: evErr } = await supabaseAdmin
    .from("pedido_eventos")
    .insert({
      pedido_id: pedido.id,
      actor_id: null,
      actor_role: null,
      accion: "pedido_creado",
      from_status: null,
      to_status: "capturado",
      detalle: `Enlace n8n${body.idMessage ? ` · idMessage=${body.idMessage}` : ""}`,
    })
    .select("*")
    .single();
  if (evErr) throw new Error(evErr.message);

  const { data: pedidoFinal } = await supabaseAdmin.from("pedidos").select("*").eq("id", pedido.id).single();
  return { pedido: pedidoFinal ?? { ...pedido, monto_estimado: monto }, lineas, evento };
}

export async function crearPedidoDesdeEnlace(body: EnlacePedidoBody) {
  if (isDemoMode()) return crearEnDemo(body);
  return crearEnSupabase(body);
}

export function assertEnlaceAuth(request: Request) {
  const expected = enlaceApiKey();
  if (!expected) {
    throw new Response(JSON.stringify({ ok: false, error: "ENLACE_API_KEY no configurada en el servidor" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
  const header =
    request.headers.get("x-enlace-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  if (header !== expected) {
    throw new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
}
