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

/** Cache en memoria de la instancia (Functions warm). */
let memoryCache: ServerDemoData | null = null;

function empty(): ServerDemoData {
  return { pedidos: [], lineas: [], eventos: [] };
}

function clone(data: ServerDemoData): ServerDemoData {
  return JSON.parse(JSON.stringify(data)) as ServerDemoData;
}

/** Netlify / Lambda / cualquier runtime serverless. */
function isServerlessRuntime() {
  return Boolean(
    process.env.NETLIFY ||
      process.env.NETLIFY_DEV ||
      process.env.CONTEXT ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT,
  );
}

function localDataFile() {
  // En Functions el cwd (/var/task) es de solo lectura → siempre /tmp ahí.
  const base = isServerlessRuntime() ? "/tmp" : join(process.cwd(), ".data");
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

async function openBlobStore() {
  const { getStore, getDeployStore } = await import("@netlify/blobs");
  try {
    return getStore(BLOB_STORE);
  } catch {
    // Algunas runtimes Nitro no inyectan contexto de site store.
  }
  try {
    return getDeployStore(BLOB_STORE);
  } catch {
    // último recurso abajo
  }
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID || process.env.BLOBS_SITE_ID;
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.BLOBS_TOKEN ||
    process.env.NETLIFY_API_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    return getStore({ name: BLOB_STORE, siteID, token });
  }
  throw new Error("No hay contexto Netlify Blobs disponible");
}

async function readFromBlobs(): Promise<ServerDemoData | null> {
  try {
    const store = await openBlobStore();
    const data = await store.get(BLOB_KEY, { type: "json" });
    if (data == null) return empty();
    if (typeof data !== "object") return empty();
    return data as ServerDemoData;
  } catch (err) {
    console.warn("[enlace] Blobs read failed → memory/tmp", err instanceof Error ? err.message : err);
    return null;
  }
}

async function writeToBlobs(data: ServerDemoData): Promise<boolean> {
  try {
    const store = await openBlobStore();
    await store.setJSON(BLOB_KEY, data);
    return true;
  } catch (err) {
    console.warn("[enlace] Blobs write failed → memory/tmp", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function readServerDemoData(): Promise<ServerDemoData> {
  if (memoryCache) return clone(memoryCache);

  if (isServerlessRuntime()) {
    const fromBlobs = await readFromBlobs();
    if (fromBlobs) {
      memoryCache = clone(fromBlobs);
      return clone(fromBlobs);
    }
  }

  const local = readLocalFile();
  memoryCache = clone(local);
  return clone(local);
}

export async function writeServerDemoData(data: ServerDemoData): Promise<void> {
  memoryCache = clone(data);

  if (isServerlessRuntime()) {
    const ok = await writeToBlobs(data);
    if (ok) {
      try {
        writeLocalFile(data);
      } catch {
        /* /tmp opcional */
      }
      return;
    }
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
