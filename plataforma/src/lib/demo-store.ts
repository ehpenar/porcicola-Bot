import { CATALOGO, findTransition, type AppRole, type Comprobante, type Evento, type Pedido, type PedidoLinea, type PedidoStatus } from "@/lib/pedidos";
import type { Me, PedidoDetail, UserRow } from "@/lib/queries";

const AUTH_KEY = "porcicola-demo-auth";
const DATA_KEY = "porcicola-demo-data";

export type DemoAuth = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
};

type DemoData = {
  pedidos: Pedido[];
  lineas: PedidoLinea[];
  comprobantes: Comprobante[];
  eventos: Evento[];
  users: UserRow[];
  configPago: { id: number; instrucciones: string; qr_url: string | null; updated_at: string };
};

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seedData(): DemoData {
  const t0 = hoursAgo(30);
  const mkPedido = (partial: Partial<Pedido> & Pick<Pedido, "codigo" | "status" | "cliente_nombre">): Pedido => ({
    id: uid(),
    origen: "bot",
    cliente_telefono: "+57 300 000 0000",
    cliente_chat_id: "wa-demo",
    cliente_direccion: "Calle 10 # 20-30",
    cliente_barrio: "Laureles",
    cliente_ciudad: "Medellín",
    cliente_cedula: "1234567890",
    monto_estimado: 0,
    monto_pagado: null,
    notas_comercial: null,
    notas_contable: null,
    novedades_carnicero: null,
    verified_at: null,
    payment_requested_at: null,
    proof_received_at: null,
    released_at: null,
    prep_done_at: null,
    client_notified_at: null,
    archived_at: null,
    status_changed_at: t0,
    created_at: t0,
    updated_at: t0,
    ...partial,
  });

  const pCapturado = mkPedido({
    codigo: "ORD-1001",
    status: "capturado",
    cliente_nombre: "María Fernanda Ospina",
    origen: "bot",
    created_at: hoursAgo(2),
    status_changed_at: hoursAgo(2),
  });
  const pVerificado = mkPedido({
    codigo: "ORD-1002",
    status: "verificado_comercial",
    cliente_nombre: "Restaurante El Fogón",
    verified_at: hoursAgo(5),
    created_at: hoursAgo(8),
    status_changed_at: hoursAgo(5),
  });
  const pPago = mkPedido({
    codigo: "ORD-1003",
    status: "pago_solicitado",
    cliente_nombre: "Carlos Restrepo",
    verified_at: hoursAgo(10),
    payment_requested_at: hoursAgo(3),
    created_at: hoursAgo(12),
    status_changed_at: hoursAgo(3),
  });
  const pComp = mkPedido({
    codigo: "ORD-1004",
    status: "comprobante_recibido",
    cliente_nombre: "Asadero La Brasa",
    verified_at: hoursAgo(20),
    payment_requested_at: hoursAgo(8),
    proof_received_at: hoursAgo(2),
    created_at: hoursAgo(22),
    status_changed_at: hoursAgo(2),
  });
  const pProd = mkPedido({
    codigo: "ORD-1005",
    status: "liberado_produccion",
    cliente_nombre: "Paula Zuluaga",
    verified_at: hoursAgo(18),
    payment_requested_at: hoursAgo(16),
    proof_received_at: hoursAgo(15),
    released_at: hoursAgo(1),
    monto_pagado: 185000,
    created_at: hoursAgo(24),
    status_changed_at: hoursAgo(1),
  });
  const pListo = mkPedido({
    codigo: "ORD-1006",
    status: "listo_despacho",
    cliente_nombre: "Tienda Doña Rosa",
    verified_at: hoursAgo(28),
    payment_requested_at: hoursAgo(26),
    proof_received_at: hoursAgo(25),
    released_at: hoursAgo(6),
    prep_done_at: hoursAgo(1),
    monto_pagado: 92000,
    created_at: hoursAgo(30),
    status_changed_at: hoursAgo(1),
  });
  const pArch = mkPedido({
    codigo: "ORD-1007",
    status: "archivado",
    cliente_nombre: "Hernán Pérez",
    verified_at: hoursAgo(48),
    payment_requested_at: hoursAgo(46),
    proof_received_at: hoursAgo(45),
    released_at: hoursAgo(40),
    prep_done_at: hoursAgo(36),
    client_notified_at: hoursAgo(35),
    archived_at: hoursAgo(34),
    monto_pagado: 150000,
    created_at: hoursAgo(50),
    status_changed_at: hoursAgo(34),
  });

  const pedidos = [pCapturado, pVerificado, pPago, pComp, pProd, pListo, pArch];
  const lineas: PedidoLinea[] = [];
  const eventos: Evento[] = [];
  let montoTotal = 0;

  for (const p of pedidos) {
    const items = CATALOGO.slice(0, 2 + (p.codigo.charCodeAt(7) % 2));
    let est = 0;
    items.forEach((c, i) => {
      const cantidad = c.unidad === "KG" ? 2 + i : 6 + i;
      est += Math.round(cantidad * c.precio);
      lineas.push({
        id: uid(),
        pedido_id: p.id,
        orden: i,
        codigo_plu: c.codigo_plu,
        nombre: c.nombre,
        cantidad,
        unidad: c.unidad,
        preparacion: i === 0 ? "Porcionado" : null,
        empaque: "Bolsa",
        precio_unitario: c.precio,
        cantidad_real: p.status === "archivado" || p.status === "listo_despacho" ? cantidad : null,
      });
    });
    p.monto_estimado = est;
    montoTotal += est;
    eventos.push({
      id: uid(),
      pedido_id: p.id,
      actor_id: null,
      actor_role: null,
      accion: "pedido_creado",
      from_status: null,
      to_status: "capturado",
      detalle: "Pedido demo local (sin Supabase)",
      created_at: p.created_at,
    });
    if (p.verified_at) {
      eventos.push({
        id: uid(),
        pedido_id: p.id,
        actor_id: null,
        actor_role: "comercial",
        accion: "verificar_pedido",
        from_status: "capturado",
        to_status: "verificado_comercial",
        detalle: null,
        created_at: p.verified_at,
      });
    }
  }
  void montoTotal;

  const comprobantes: Comprobante[] = [pComp, pProd, pListo, pArch].map((p) => ({
    id: uid(),
    pedido_id: p.id,
    file_path: null,
    recibido_at: p.proof_received_at ?? now(),
    validado_por: null,
    resultado: p.status === "comprobante_recibido" ? "pendiente" : "aceptado",
    nota: "Comprobante demo (sin archivo)",
    created_at: p.proof_received_at ?? now(),
  }));

  const users: UserRow[] = (
    [
      ["u-general", "Admin Demo", "admin@demo.local", "general"],
      ["u-comercial", "Comercial Demo", "comercial@demo.local", "comercial"],
      ["u-contable", "Contable Demo", "contable@demo.local", "contable"],
      ["u-carnicero", "Carnicero Demo", "carnicero@demo.local", "carnicero"],
    ] as const
  ).map(([id, full_name, email, role]) => ({
    id,
    full_name,
    email,
    active: true,
    created_at: t0,
    role,
  }));

  return {
    pedidos,
    lineas,
    comprobantes,
    eventos,
    users,
    configPago: {
      id: 1,
      instrucciones:
        "DEMO — Bancolombia ahorro 123-456789-01 a nombre de Porcicola S.A.S. Envía el comprobante por WhatsApp.",
      qr_url: null,
      updated_at: t0,
    },
  };
}

function readData(): DemoData {
  if (typeof window === "undefined") return seedData();
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) {
      const seeded = seedData();
      localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as DemoData;
  } catch {
    const seeded = seedData();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeData(data: DemoData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export function getDemoAuth(): DemoAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as DemoAuth) : null;
  } catch {
    return null;
  }
}

export function setDemoAuth(auth: DemoAuth | null) {
  if (typeof window === "undefined") return;
  if (!auth) localStorage.removeItem(AUTH_KEY);
  else localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function demoMeFromAuth(auth: DemoAuth): Me {
  return {
    userId: auth.userId,
    email: auth.email,
    fullName: auth.fullName,
    role: auth.role,
    active: true,
  };
}

export const DEMO_ACCOUNTS: { role: AppRole; email: string; fullName: string; userId: string }[] = [
  { role: "general", email: "admin@demo.local", fullName: "Admin Demo", userId: "u-general" },
  { role: "comercial", email: "comercial@demo.local", fullName: "Comercial Demo", userId: "u-comercial" },
  { role: "contable", email: "contable@demo.local", fullName: "Contable Demo", userId: "u-contable" },
  { role: "carnicero", email: "carnicero@demo.local", fullName: "Carnicero Demo", userId: "u-carnicero" },
];

export function loginDemoRole(role: AppRole) {
  const acc = DEMO_ACCOUNTS.find((a) => a.role === role)!;
  setDemoAuth(acc);
  return demoMeFromAuth(acc);
}

export function logoutDemo() {
  setDemoAuth(null);
}

export function resetDemoData() {
  const seeded = seedData();
  writeData(seeded);
  return seeded;
}

export function listDemoPedidos(statuses: PedidoStatus[] | "all") {
  const { pedidos } = readData();
  if (statuses === "all") return [...pedidos].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return pedidos.filter((p) => statuses.includes(p.status)).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getDemoPedidoDetail(id: string): PedidoDetail | null {
  const data = readData();
  const pedido = data.pedidos.find((p) => p.id === id);
  if (!pedido) return null;
  return {
    pedido,
    lineas: data.lineas.filter((l) => l.pedido_id === id).sort((a, b) => a.orden - b.orden),
    comprobantes: data.comprobantes
      .filter((c) => c.pedido_id === id)
      .sort((a, b) => b.recibido_at.localeCompare(a.recibido_at)),
    eventos: data.eventos.filter((e) => e.pedido_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

/**
 * Importa un pedido creado por /api/enlace/pedidos al localStorage demo
 * para que la UI (Comercial, etc.) lo muestre y pueda transicionar.
 * Si ya existe el id, no pisa cambios locales.
 */
export function upsertEnlacePedidoIntoDemo(detail: PedidoDetail): PedidoDetail {
  const data = readData();
  if (data.pedidos.some((p) => p.id === detail.pedido.id)) {
    return getDemoPedidoDetail(detail.pedido.id)!;
  }
  data.pedidos.unshift(detail.pedido);
  for (const linea of detail.lineas) {
    if (!data.lineas.some((l) => l.id === linea.id)) data.lineas.push(linea);
  }
  for (const evento of detail.eventos ?? []) {
    if (!data.eventos.some((e) => e.id === evento.id)) data.eventos.push(evento);
  }
  for (const comp of detail.comprobantes ?? []) {
    if (!data.comprobantes.some((c) => c.id === comp.id)) data.comprobantes.push(comp);
  }
  writeData(data);
  return getDemoPedidoDetail(detail.pedido.id)!;
}

export function listDemoUsers() {
  return readData().users;
}

export function getDemoConfigPago() {
  return readData().configPago;
}

export function listDemoComprobantes() {
  return readData().comprobantes.map((c) => ({ resultado: c.resultado, recibido_at: c.recibido_at }));
}

function pushEvent(
  data: DemoData,
  pedidoId: string,
  auth: DemoAuth | null,
  accion: string,
  from: PedidoStatus | null,
  to: PedidoStatus | null,
  detalle: string | null,
) {
  data.eventos.push({
    id: uid(),
    pedido_id: pedidoId,
    actor_id: auth?.userId ?? null,
    actor_role: auth?.role ?? null,
    accion,
    from_status: from,
    to_status: to,
    detalle,
    created_at: now(),
  });
}

export function demoTransicionar(
  pedidoId: string,
  to: PedidoStatus,
  nota: string,
  montoPagado: number | null,
  actorRole?: AppRole | null,
) {
  const data = readData();
  let auth = getDemoAuth();
  // Si la UI tiene rol (p.ej. comercial) pero localStorage quedó vacío/desfasado, alinear auth.
  if (actorRole && (!auth || auth.role !== actorRole)) {
    const acc = DEMO_ACCOUNTS.find((a) => a.role === actorRole);
    if (acc) {
      setDemoAuth(acc);
      auth = acc;
    }
  }
  const p = data.pedidos.find((x) => x.id === pedidoId);
  if (!p) throw new Error("Pedido no encontrado");
  const t = findTransition(p.status, to);
  if (!t) throw new Error(`Transición no permitida: ${p.status} → ${to}`);
  const effectiveRole = actorRole || auth?.role || null;
  if (effectiveRole && effectiveRole !== "general" && effectiveRole !== t.role) {
    throw new Error(`Tu rol (${effectiveRole}) no puede realizar esta acción (requiere ${t.role})`);
  }
  if (t.requiresNote && !nota.trim()) throw new Error("Debes escribir una nota para esta acción");
  if (to === "liberado_produccion" && !(montoPagado != null && montoPagado > 0)) throw new Error("Indica el monto pagado");

  const from = p.status;
  const ts = now();
  p.status = to;
  p.status_changed_at = ts;
  p.updated_at = ts;
  if (to === "verificado_comercial") p.verified_at = ts;
  if (to === "pago_solicitado") p.payment_requested_at = ts;
  if (to === "comprobante_recibido") p.proof_received_at = ts;
  if (to === "liberado_produccion") {
    p.released_at = ts;
    p.monto_pagado = montoPagado;
    for (const c of data.comprobantes) {
      if (c.pedido_id === pedidoId && c.resultado === "pendiente") {
        c.resultado = "aceptado";
        c.validado_por = auth?.userId ?? null;
      }
    }
  }
  if (from === "comprobante_recibido" && to === "pago_solicitado") {
    for (const c of data.comprobantes) {
      if (c.pedido_id === pedidoId && c.resultado === "pendiente") {
        c.resultado = "rechazado";
        c.nota = nota || c.nota;
        c.validado_por = auth?.userId ?? null;
      }
    }
  }
  if (to === "listo_despacho") p.prep_done_at = ts;
  if (to === "notificado_cliente" || (to === "archivado" && !p.client_notified_at)) p.client_notified_at = ts;
  if (to === "archivado") p.archived_at = ts;

  pushEvent(data, pedidoId, auth, t.accion, from, to, nota.trim() || null);
  if (to === "pago_solicitado") {
    pushEvent(data, pedidoId, auth, "mensaje_simulado", null, null, "Mensaje simulado: instrucciones de pago");
  }
  if (to === "notificado_cliente" || (to === "archivado" && from === "listo_despacho")) {
    pushEvent(data, pedidoId, auth, "mensaje_simulado", null, null, "Mensaje simulado: pedido listo / se envía");
  }
  writeData(data);
  return p;
}

export function demoRegistrarComprobante(pedidoId: string, nota: string) {
  const data = readData();
  const auth = getDemoAuth();
  const p = data.pedidos.find((x) => x.id === pedidoId);
  if (!p) throw new Error("Pedido no encontrado");
  if (!["pago_solicitado", "comprobante_recibido"].includes(p.status)) {
    throw new Error("Solo se pueden adjuntar comprobantes cuando el pago fue solicitado");
  }
  data.comprobantes.unshift({
    id: uid(),
    pedido_id: pedidoId,
    file_path: null,
    recibido_at: now(),
    validado_por: null,
    resultado: "pendiente",
    nota: nota || "Comprobante demo",
    created_at: now(),
  });
  writeData(data);
  if (p.status === "pago_solicitado") {
    return demoTransicionar(pedidoId, "comprobante_recibido", nota, null);
  }
  pushEvent(data, pedidoId, auth, "comprobante_adjuntado", null, null, nota || null);
  writeData(data);
  return p;
}

export function demoCrearPedido(origen: "bot" | "comercial_manual", cliente: Record<string, string>, lineasIn: Array<Record<string, unknown>>, notas?: string) {
  const data = readData();
  const auth = getDemoAuth();
  const id = uid();
  const codigo = `ORD-${String(1000 + data.pedidos.length + 1)}`;
  const ts = now();
  let monto = 0;
  const lineas: PedidoLinea[] = lineasIn.map((l, i) => {
    const cantidad = Number(l.cantidad ?? 1);
    const precio = Number(l.precio_unitario ?? 0);
    monto += Math.round(cantidad * precio);
    return {
      id: uid(),
      pedido_id: id,
      orden: i,
      codigo_plu: String(l.codigo_plu ?? ""),
      nombre: String(l.nombre ?? ""),
      cantidad,
      unidad: (l.unidad as "KG" | "UND") ?? "KG",
      preparacion: (l.preparacion as string) || null,
      empaque: (l.empaque as string) || null,
      precio_unitario: precio,
      cantidad_real: null,
    };
  });
  const pedido: Pedido = {
    id,
    codigo,
    origen,
    status: "capturado",
    cliente_nombre: cliente.cliente_nombre || "Cliente",
    cliente_telefono: cliente.cliente_telefono || null,
    cliente_chat_id: cliente.cliente_chat_id || null,
    cliente_direccion: cliente.cliente_direccion || null,
    cliente_barrio: cliente.cliente_barrio || null,
    cliente_ciudad: cliente.cliente_ciudad || null,
    cliente_cedula: cliente.cliente_cedula || null,
    monto_estimado: monto,
    monto_pagado: null,
    notas_comercial: notas || null,
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
  data.pedidos.unshift(pedido);
  data.lineas.push(...lineas);
  pushEvent(
    data,
    id,
    auth,
    "pedido_creado",
    null,
    "capturado",
    origen === "bot" ? "Pedido demo (bot simulado)" : "Pedido manual demo",
  );
  writeData(data);
  return pedido;
}

export function demoActualizarPedido(pedidoId: string, cliente: Record<string, string>, lineasIn: Array<Record<string, unknown>> | null, notas?: string) {
  const data = readData();
  const auth = getDemoAuth();
  const p = data.pedidos.find((x) => x.id === pedidoId);
  if (!p) throw new Error("Pedido no encontrado");
  if (!["capturado", "en_correccion"].includes(p.status)) throw new Error("Solo se puede editar un pedido capturado o en corrección");
  p.cliente_nombre = cliente.cliente_nombre || p.cliente_nombre;
  p.cliente_telefono = cliente.cliente_telefono || null;
  p.cliente_direccion = cliente.cliente_direccion || null;
  p.cliente_barrio = cliente.cliente_barrio || null;
  p.cliente_ciudad = cliente.cliente_ciudad || null;
  p.cliente_cedula = cliente.cliente_cedula || null;
  p.notas_comercial = notas || null;
  p.updated_at = now();
  if (lineasIn) {
    data.lineas = data.lineas.filter((l) => l.pedido_id !== pedidoId);
    let monto = 0;
    lineasIn.forEach((l, i) => {
      const cantidad = Number(l.cantidad ?? 1);
      const precio = Number(l.precio_unitario ?? 0);
      monto += Math.round(cantidad * precio);
      data.lineas.push({
        id: uid(),
        pedido_id: pedidoId,
        orden: i,
        codigo_plu: String(l.codigo_plu ?? ""),
        nombre: String(l.nombre ?? ""),
        cantidad,
        unidad: (l.unidad as "KG" | "UND") ?? "KG",
        preparacion: (l.preparacion as string) || null,
        empaque: (l.empaque as string) || null,
        precio_unitario: precio,
        cantidad_real: null,
      });
    });
    p.monto_estimado = monto;
  }
  pushEvent(data, pedidoId, auth, "pedido_editado", null, null, "Datos actualizados (demo)");
  writeData(data);
  return p;
}

export function demoActualizarNota(pedidoId: string, campo: string, valor: string) {
  const data = readData();
  const auth = getDemoAuth();
  const p = data.pedidos.find((x) => x.id === pedidoId);
  if (!p) throw new Error("Pedido no encontrado");
  if (campo === "notas_contable") p.notas_contable = valor || null;
  else if (campo === "novedades_carnicero") p.novedades_carnicero = valor || null;
  else if (campo === "notas_comercial") p.notas_comercial = valor || null;
  else throw new Error("Campo no válido");
  p.updated_at = now();
  pushEvent(data, pedidoId, auth, "nota_actualizada", null, null, valor || "(vacía)");
  writeData(data);
  return p;
}

export function demoActualizarCantidadReal(lineaId: string, cantidad: number | null) {
  const data = readData();
  const linea = data.lineas.find((l) => l.id === lineaId);
  if (!linea) throw new Error("Línea no encontrada");
  const p = data.pedidos.find((x) => x.id === linea.pedido_id);
  if (!p || p.status !== "liberado_produccion") throw new Error("Solo durante producción");
  linea.cantidad_real = cantidad;
  p.updated_at = now();
  writeData(data);
}

/** Carnicero confirma stock → stock_verificado + novedades + cantidad_real por línea. */
export function demoVerificarStock(
  pedidoId: string,
  ajustes: Array<{ linea_id: string; estado: "ok" | "no_disponible" | "cantidad_menor"; cantidad_disponible: number }>,
  novedades: string,
) {
  const data = readData();
  const auth = getDemoAuth();
  const p = data.pedidos.find((x) => x.id === pedidoId);
  if (!p) throw new Error("Pedido no encontrado");
  if (p.status !== "verificado_comercial") throw new Error("El pedido no está pendiente de verificación de stock");
  if (auth && auth.role !== "general" && auth.role !== "carnicero") {
    throw new Error("Solo el carnicero puede verificar stock");
  }
  for (const a of ajustes) {
    const linea = data.lineas.find((l) => l.id === a.linea_id && l.pedido_id === pedidoId);
    if (!linea) continue;
    if (a.estado === "ok") linea.cantidad_real = linea.cantidad;
    else if (a.estado === "no_disponible") linea.cantidad_real = 0;
    else linea.cantidad_real = a.cantidad_disponible;
  }
  // Recalcular estimado con lo disponible
  const lineasPedido = data.lineas.filter((l) => l.pedido_id === pedidoId);
  p.monto_estimado = lineasPedido.reduce(
    (sum, l) => sum + Math.round((l.cantidad_real ?? l.cantidad) * l.precio_unitario),
    0,
  );
  p.novedades_carnicero = novedades;
  const from = p.status;
  const ts = now();
  p.status = "stock_verificado";
  p.status_changed_at = ts;
  p.updated_at = ts;
  pushEvent(data, pedidoId, auth, "verificar_stock", from, "stock_verificado", novedades);
  writeData(data);
  return getDemoPedidoDetail(pedidoId)!;
}

export function demoSetConfigPago(instrucciones: string, qrUrl: string) {
  const data = readData();
  data.configPago.instrucciones = instrucciones;
  data.configPago.qr_url = qrUrl || null;
  data.configPago.updated_at = now();
  writeData(data);
}

export function demoSetUserRole(userId: string, role: AppRole) {
  const data = readData();
  const u = data.users.find((x) => x.id === userId);
  if (!u) throw new Error("Usuario no encontrado");
  u.role = role;
  writeData(data);
}

export function demoSetUserActive(userId: string, active: boolean) {
  const data = readData();
  const u = data.users.find((x) => x.id === userId);
  if (!u) throw new Error("Usuario no encontrado");
  u.active = active;
  writeData(data);
}
