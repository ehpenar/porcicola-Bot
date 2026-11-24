import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Pedido, PedidoLinea, Evento } from "@/lib/pedidos";

type ServerDemoData = {
  pedidos: Pedido[];
  lineas: PedidoLinea[];
  eventos: Evento[];
};

const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "enlace-pedidos.json");

function empty(): ServerDemoData {
  return { pedidos: [], lineas: [], eventos: [] };
}

export function readServerDemoData(): ServerDemoData {
  try {
    if (!existsSync(DATA_FILE)) return empty();
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as ServerDemoData;
  } catch {
    return empty();
  }
}

export function writeServerDemoData(data: ServerDemoData) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export function listServerDemoPedidos() {
  const data = readServerDemoData();
  return [...data.pedidos].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getServerDemoPedidoDetail(id: string) {
  const data = readServerDemoData();
  const pedido = data.pedidos.find((p) => p.id === id);
  if (!pedido) return null;
  return {
    pedido,
    lineas: data.lineas.filter((l) => l.pedido_id === id).sort((a, b) => a.orden - b.orden),
    comprobantes: [] as never[],
    eventos: data.eventos.filter((e) => e.pedido_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}
