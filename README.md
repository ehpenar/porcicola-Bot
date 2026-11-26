# porcicola-Bot

Monorepo de la **Porcicola**: bot WhatsApp (n8n) + plataforma web de operaciones (4 roles) + enlace entre ambos.

| Pieza | Estado |
|-------|--------|
| Bot WhatsApp (n8n) | **v5** — conversación coherente con el cliente |
| Documentación / proceso / prompts | En `elementos/` |
| Plataforma web | En `plataforma/` — demo en https://porcicolabot.netlify.app |
| Enlace n8n → plataforma | `POST /api/enlace/pedidos` |
| Aviso stock → cliente | `POST` webhook n8n tras verificación del Carnicero |

Repo: [ehpenar/porcicola-Bot](https://github.com/ehpenar/porcicola-Bot)

---

## Flujo de compra y verificaciones (oficial)

Un solo pedido cambia de estado. Cada rol solo actúa en su turno.

```text
Cliente (WhatsApp)
        │  bot confirma comanda
        ▼
   capturado          ← llega a Comercial («Por verificar»)
        │
        │  ① Comercial verifica (o rechaza / manda a corrección)
        ▼
 verificado_comercial ← llega a Carnicero («Verificar stock»)
        │
        │  ② Carnicero marca por línea: Disponible / Hay menos / No hay
        │     → Confirmar disponibilidad
        │     → webhook n8n avisa al cliente (faltantes o cantidades menores)
        ▼
  stock_verificado    ← llega a Contable («Por revisar / cobrar»)
        │
        │  ③ Contable solicita pago → cliente recibe cuenta/QR
        ▼
  pago_solicitado
        │  cliente paga + comprobante
        ▼
 comprobante_recibido
        │  ④ Contable valida pago y libera
        ▼
 liberado_produccion  ← Carnicero corta / empaca
        │  ⑤ Carnicero: listo para despacho
        ▼
  listo_despacho
        │  ⑥ Contable notifica cliente y archiva
        ▼
    archivado
```

### Quién verifica qué

| # | Verificación | Quién | Qué decide | Estado resultante |
|---|--------------|-------|------------|-------------------|
| 1 | Datos del pedido | **Comercial** | ¿La comanda es correcta? (cliente, productos, cantidades) | `verificado_comercial` o rechazo / corrección |
| 2 | Stock / disponibilidad | **Carnicero** | Por cada producto: hay, hay menos, o no hay | `stock_verificado` + aviso WhatsApp |
| 3 | Cobro | **Contable** | Solicitar pago al cliente | `pago_solicitado` |
| 4 | Pago recibido | **Contable** | ¿El comprobante cuadra? → liberar a producción | `liberado_produccion` |
| 5 | Producción | **Carnicero** | Corte y empaque terminados | `listo_despacho` |
| 6 | Cierre | **Contable** | Avisar al cliente y archivar | `archivado` |

### Detalle de la verificación de stock (Carnicero)

1. Tras Comercial, el pedido aparece en **Carnicero → Verificar stock**.
2. Al abrir el pedido hay un panel con el listado de productos.
3. Por cada línea el carnicero elige:
   - **Disponible** — se confirma la cantidad pedida  
   - **Hay menos** — indica la cantidad real disponible  
   - **No hay** — cantidad disponible = 0  
4. Al **Confirmar disponibilidad**:
   - el monto estimado se recalcula con lo disponible  
   - el pedido pasa a Contable (`stock_verificado`)  
   - la plataforma hace `POST` al webhook n8n (`STOCK_WEBHOOK_URL`) con `chatId` + `mensaje` para el cliente  

Webhook (test actual):  
`https://ehpenar.app.n8n.cloud/webhook-test/b4d0784c-8649-4c78-bc0d-285b2476296e`  

Detalle del payload: [`elementos/ENLACE_N8N_PLATAFORMA.md`](elementos/ENLACE_N8N_PLATAFORMA.md).

---

## Estructura del repositorio

```text
porcicola-Bot/
├── workflows/          # Workflows n8n (v3 archive → v5 actual)
├── elementos/          # Proceso, análisis, diagramas, prompts Lovable
├── plataforma/         # App web Porcicola Ops
└── netlify.toml        # Deploy Netlify (base: plataforma)
```

### Roles en la plataforma

| Rol | Ruta | Función en el flujo |
|-----|------|---------------------|
| General | `/general` | KPIs, todos los pedidos, usuarios, config pago |
| Comercial | `/comercial` | Verificar / rechazar / corregir / crear pedidos |
| Carnicero | `/carnicero` | Verificar stock → (luego) producción → listo |
| Contable | `/contable` | Cobrar (solo tras stock), validar pago, liberar, archivar |

### Modo demo

- `VITE_DEMO_MODE=true` (por defecto).
- Login por rol, sin Supabase Auth.
- Pedidos del bot se sincronizan a la UI cada ~5s.

```sh
cd plataforma
cp .env.example .env
bun install
bun run dev   # http://localhost:8080
```

Flujo de prueba sugerido:

1. Comercial → Crear pedido demo → **Verificar pedido**
2. Carnicero → **Verificar stock** (marcar disponibilidad) → Confirmar
3. Contable → **Solicitar pago** → Adjuntar comprobante → **Validar pago y liberar**
4. Carnicero → **Marcar listo para despacho**
5. Contable → **Notificar cliente y archivar**

### Enlace n8n → plataforma

**Producción:** https://porcicolabot.netlify.app  

```text
POST https://porcicolabot.netlify.app/api/enlace/pedidos
Headers:
  Content-Type: application/json
  X-Enlace-Secret: porcicola-enlace-demo
Body: ={{ $json }}
```

Crea el pedido en **`capturado`**. Guía: [`elementos/ENLACE_N8N_PLATAFORMA.md`](elementos/ENLACE_N8N_PLATAFORMA.md).

### Netlify (env)

| Variable | ¿Secret? | Uso |
|----------|----------|-----|
| `VITE_DEMO_MODE=true` | No | Demo UI |
| `ENLACE_API_KEY` | Sí | Auth del POST de pedidos |
| `STOCK_WEBHOOK_URL` | No | Aviso al cliente tras stock |

Build: base `plataforma`, `bun run build`, publish `dist` (`netlify.toml`).

---

## Cambios recientes (stock + flujo)

1. Nuevo estado **`stock_verificado`** entre Comercial y Contable.
2. Cola **Carnicero → Verificar stock** con panel por producto (disponible / menos / no hay).
3. Contable solo ve pedidos **después** de la confirmación de stock.
4. `POST /api/enlace/aviso-stock` → webhook n8n con mensaje para WhatsApp.
5. README y docs actualizados con el flujo de compra y verificaciones.

---

## Bot WhatsApp — v5

| Aspecto | v3 | v4 | **v5** |
|---------|----|----|--------|
| Vendedor + catálogo PLU | Sí | Sí | **Sí** |
| Memoria | Sí | Ventana 10 | **Ventana 3** |
| Filtro entrada | No | incoming + text | **IF: existe texto** |
| Evitar JSON al cliente | No | Code | **IF1: `confirmado`** |
| Loop con "hola" | **Sí** | Mitigado | Mitigado |

```text
Webhook Green-API
  → IF texto?
       └─ Sí → AI Agent → IF1 confirmado?
              ├─ Sí → POST /api/enlace/pedidos  (no manda JSON al chat)
              └─ No → sendMessage al cliente
```

---

## Seguridad

- Tokens Green-API / `.env` reales **no** van en el repo.
- No marques variables `VITE_*` como secret en Netlify (rompe el build).
- `ENLACE_API_KEY` sí puede ir como secret.

---

## Historial (orientativo)

1. v3 — bot  
2. v4 — anti-loop  
3. v5 — prompt + IF texto/JSON  
4. elementos + plataforma demo  
5. enlace n8n → pedidos  
6. Netlify + Blobs  
7. **Verificación de stock (Carnicero) antes de Contable + webhook al cliente**  
