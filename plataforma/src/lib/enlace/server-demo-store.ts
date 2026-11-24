import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Pedido, PedidoLinea, Evento } from "@/lib/pedidos";

type ServerDemoData = {
  pedidos: Pedido[];
  lineas: PedidoLinea[];
  eventos: Evento[];
};

const BLOB_STORE = "porcicola-enlace";
const BLOB_KEY = "pedidos.json";

function empty(): ServerDemoData {
  return { pedidos: [], lineas: [], eventos: [] };
}

function isNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_DEV || process.env.CONTEXT);
}

/** Local o /tmp en Functions; en Netlify preferimos Blobs (persistente entre instancias). */
function localDataFile() {
  const base = process.env.NETLIFY ? "/tmp" : join(process.cwd(), ".data");
  return { dir: base, file: join(base, "enlace-pedidos.json") };
}

function readLocalFile(): ServerDemoData {
  try {
    const { file } = localDataFile();
    if (!existsSync(file)) return empty();
    return JSON.parse(readFileSync(file, "utf8")) as ServerDemoData;
  } catch {
    return empty();
  }
}

function writeLocalFile(data: ServerDemoData) {
  const { dir, file } = localDataFile();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

async function readFromBlobs(): Promise<ServerDemoData | null> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(BLOB_STORE);
    const data = await store.get(BLOB_KEY, { type: "json" });
    if (!data || typeof data !== "object") return empty();
    return data as ServerDemoData;
  } catch (err) {
    console.warn("[enlace] Netlify Blobs read failed, using local/tmp fallback", err);
    return null;
  }
}

async function writeToBlobs(data: ServerDemoData): Promise<boolean> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(BLOB_STORE);
    await store.setJSON(BLOB_KEY, data);
    return true;
  } catch (err) {
    console.warn("[enlace] Netlify Blobs write failed, using local/tmp fallback", err);
    return false;
  }
}

export async function readServerDemoData(): Promise<ServerDemoData> {
  if (isNetlifyRuntime()) {
    const fromBlobs = await readFromBlobs();
    if (fromBlobs) return fromBlobs;
  }
  return readLocalFile();
}

export async function writeServerDemoData(data: ServerDemoData): Promise<void> {
  if (isNetlifyRuntime()) {
    const ok = await writeToBlobs(data);
    if (ok) return;
  }
  writeLocalFile(data);
}

export async function listServerDemoPedidos() {
  const data = await readServerDemoData();
  return [...data.pedidos].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getServerDemoPedidoDetail(id: string) {
  const data = await readServerDemoData();
  const pedido = data.pedidos.find((p) => p.id === id);
  if (!pedido) return null;
  return {
    pedido,
    lineas: data.lineas.filter((l) => l.pedido_id === id).sort((a, b) => a.orden - b.orden),
    comprobantes: [] as never[],
    eventos: data.eventos.filter((e) => e.pedido_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}
