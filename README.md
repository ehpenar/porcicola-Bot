# porcicola-Bot

Monorepo de la **Porcicola**: automatización de ventas por WhatsApp (n8n) + documentación de proceso + plataforma web de operaciones (4 roles).

| Pieza | Estado |
|-------|--------|
| Bot WhatsApp (n8n) | **v5** — conversación coherente con el cliente |
| Documentación / proceso / prompts Lovable | En `elementos/` |
| Plataforma web (Comercial / Contable / Carnicero / General) | En `plataforma/` — **modo demo local (sin Supabase Auth)** |
| **Enlace n8n → plataforma** | **`POST /api/enlace/pedidos`** — pedidos confirmados del bot → cola Comercial |

Repo: [ehpenar/porcicola-Bot](https://github.com/ehpenar/porcicola-Bot)

---

## Estructura del repositorio

```text
porcicola-Bot/
├── workflows/          # Workflows n8n (v3 archive → v5 actual)
├── elementos/          # Proceso, análisis, diagramas, prompts Lovable
└── plataforma/         # App web Porcicola Ops (React / TanStack / demo mode)
```

### `workflows/` — bot WhatsApp

| Archivo | Descripción |
|---------|-------------|
| `workflows/wappBotPorcicola.json` | Workflow actual (**v5**) |
| `workflows/wappBotPorcicola-v5.json` | Copia explícita v5 |
| `workflows/wappBotPorcicola-v4.json` | v4 anti-loop |
| `workflows/archive/…` | Históricos v3 / v4 |

Ver detalle de v3→v5 más abajo.

### `elementos/` — proceso y prompts

| Archivo | Para qué |
|---------|----------|
| `PROCESO_ROBUSTO_PLATAFORMA.md` | Proceso oficial (prepago + liberación) |
| `PROCESO_ESTADOS_Y_VISTAS.md` | Estados, permisos, colas |
| `ANALISIS_PROCESO_SISTEMA.md` | Análisis del diagrama conceptual |
| `PROMPT_LOVABLE_PLATAFORMA.md` | Prompt inicial para generar la app en Lovable |
| `PROMPT_LOVABLE_CONTINUAR.md` | Prompt para retomar pantallas en Lovable |
| `AUDITORIA_LOVABLE_PIXEL_PERFECT.md` | Auditoría del export Lovable |
| **`ENLACE_N8N_PLATAFORMA.md`** | **Contrato HTTP n8n → plataforma** |
| `DiagramaConceptualPorcicola.json` + captura | Diagrama original |
| `README_ELEMENTOS.md` | Índice de lectura |

### `plataforma/` — app web + enlace del bot

App **Porcicola Ops** con 4 perfiles:

| Rol | Ruta | Función |
|-----|------|---------|
| General | `/general` | KPIs, todos los pedidos, usuarios, config pago |
| Comercial | `/comercial` | Verificar / rechazar / crear pedidos |
| Contable | `/contable` | Cobrar, validar comprobante, liberar, archivar |
| Carnicero | `/carnicero` | Espera (lectura) → producción → listo |

**Importante — modo demo (sin Supabase):**

- Por defecto la app corre con `VITE_DEMO_MODE=true`.
- En `/login` aparecen botones **Entrar como General / Comercial / Contable / Carnicero**.
- Auth y pedidos viven en `localStorage` del navegador (datos de prueba).
- Sirve para recorrer vistas y el flujo feliz **sin** crear usuarios en Supabase.
- Más adelante: `VITE_DEMO_MODE=false` + claves Supabase para Auth/DB reales.

#### Cómo correr la plataforma en local

```sh
cd plataforma
cp .env.example .env   # deja VITE_DEMO_MODE=true
bun install            # o npm install
bun run dev            # o npm run dev
```

Abre http://localhost:8080/login y elige un rol.

Flujo de prueba sugerido:

1. Comercial → Crear pedido demo → **Verificar pedido**
2. Contable → **Solicitar pago** → Adjuntar comprobante → **Validar pago y liberar**
3. Carnicero → **Marcar listo para despacho**
4. Contable → **Notificar cliente y archivar**
5. Cerrar sesión y entrar como otro rol para ver sus colas

#### Enlace n8n → plataforma (bot crea pedidos reales en la UI)

Cuando el workflow marca el pedido como **confirmado**, n8n debe llamar:

```text
POST http://localhost:8080/api/enlace/pedidos
Headers:
  Content-Type: application/json
  X-Enlace-Secret: porcicola-enlace-demo
Body: ={{ $json }}   # item del AI Agent (output + body.instanceData.wid)
```

- La plataforma parsea el JSON de comanda (aunque venga como string en `output`).
- Toma el WhatsApp id desde `body.instanceData.wid`.
- Crea el pedido en estado **`capturado`** / origen **`bot`**.
- En demo, Comercial lo ve en **Por verificar** (poll ~5s).

Detalle, curl y mapeo de campos: [`elementos/ENLACE_N8N_PLATAFORMA.md`](elementos/ENLACE_N8N_PLATAFORMA.md).

---

## Cambios de este commit (resumen)

1. **Endpoint enlace** — `POST /api/enlace/pedidos` (+ GET listado/detalle en demo).
2. **Ingesta flexible** — acepta el item crudo de n8n (`output` string + `wid`), comanda parseada o array.
3. **UI demo** — sincroniza pedidos del bot a `localStorage` y refresca colas cada ~5s.
4. **Docs** — `ENLACE_N8N_PLATAFORMA.md` + README actualizado.

Pendiente (fuera de este commit): Auth/DB Supabase real en producción (`VITE_DEMO_MODE=false` + service role).

---

## Bot WhatsApp — v5 (actual)

> Conversación coherente: saluda, toma pedido, aclara cortes/cantidades. Validada en uso real.

### Comparación rápida

| Aspecto | v3 | v4 | **v5** |
|---------|----|----|--------|
| Vendedor + catálogo PLU | Sí | Sí | **Sí (prompt completo)** |
| Memoria | Sí | Ventana 10 | **Ventana 3** |
| Filtro entrada | No | incoming + text | **IF: existe texto** |
| Anti-duplicado `idMessage` | No | Sí | No |
| Evitar JSON al cliente | No | Code salida segura | **IF1: contiene `confirmado`** |
| Loop con "hola" | **Sí** | Mitigado | Mitigado |

### Flujo v5 (+ enlace a plataforma)

```text
Webhook Green-API
  → IF texto existe?
       ├─ No → fin
       └─ Sí → Edit Fields → AI Agent → Edit Fields1
                → IF1 contiene "confirmado"?
                     ├─ Sí → HTTP Request → POST /api/enlace/pedidos
                     │         (no manda el JSON al WhatsApp)
                     └─ No → HTTP sendMessage (respuesta al cliente)
```

### Importar en n8n

1. Import `workflows/wappBotPorcicola.json`
2. Credenciales OpenAI
3. URL Green-API `sendMessage` (placeholders en el JSON)
4. Webhook URL de producción en Green-API
5. Activar solo este workflow

---

## Seguridad

- Tokens Green-API / `.env` reales **no** van en el repo.
- `plataforma/.env.example` solo activa demo mode.
- Originales locales `(3)`/`(4)`/`(5)` con secretos quedan en `.gitignore`.

---

## Historial de commits (orientativo)

1. v3 — bot + bug de loop documentado  
2. v4 — anti-loop  
3. v5 — prompt comercial + IF texto/JSON  
4. elementos + prompts Lovable + plataforma en modo demo  
5. **Este commit** — enlace n8n → `POST /api/enlace/pedidos` (pedidos del bot en Comercial)  

