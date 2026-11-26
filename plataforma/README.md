# Porcicola Ops (plataforma)

App web interna de la carnicería. Parte del monorepo [porcicola-Bot](https://github.com/ehpenar/porcicola-Bot).

## Modo demo (actual)

Sin Supabase Auth. En login elige el rol. Datos en `localStorage` (+ pedidos del bot sincronizados desde el servidor).

```sh
cp .env.example .env
bun install   # o npm i / bun i
bun run dev   # http://localhost:8080
```

`VITE_DEMO_MODE=true` en `.env`. Pon `false` cuando conectes Auth real.

## Flujo de compra y verificaciones

```text
Cliente (bot) → capturado
  → ① Comercial verifica → verificado_comercial
  → ② Carnicero confirma stock (disponible / menos / no hay) → stock_verificado
       + webhook n8n avisa al cliente
  → ③ Contable cobra y valida pago → liberado_produccion
  → ④ Carnicero produce → listo_despacho
  → ⑤ Contable notifica y archiva
```

| Verificación | Rol | Resultado |
|--------------|-----|-----------|
| Datos del pedido | Comercial | `verificado_comercial` |
| Stock por producto | Carnicero | `stock_verificado` + mensaje WhatsApp |
| Pago | Contable | libera a producción |

Detalle completo en el [README del monorepo](../README.md#flujo-de-compra-y-verificaciones-oficial).

## Deploy Netlify

Sitio: **https://porcicolabot.netlify.app**

Build (ya en `netlify.toml` del monorepo):

| Setting | Valor |
|---------|--------|
| Base directory | `plataforma` |
| Build command | `bun run build` |
| Publish directory | `dist` |

Variables de entorno en Netlify (Project configuration → Environment variables):

| Key | Value | ¿Secret? |
|-----|--------|----------|
| `VITE_DEMO_MODE` | `true` | No |
| `ENLACE_API_KEY` | `porcicola-enlace-demo` | Sí |
| `STOCK_WEBHOOK_URL` | URL webhook n8n (aviso stock) | No |

No uses `VITE_ENLACE_API_KEY` como secret en Netlify (rompe el build).

Tras el deploy, el enlace del bot es:

`https://porcicolabot.netlify.app/api/enlace/pedidos`

## Enlace n8n → plataforma

El bot WhatsApp (n8n), cuando el pedido queda **`confirmado`**, hace `POST` a este endpoint y la app crea el pedido en estado **`capturado`** (cola Comercial → Por verificar).

```
POST https://porcicolabot.netlify.app/api/enlace/pedidos
Header: Content-Type: application/json
Header: X-Enlace-Secret: porcicola-enlace-demo
Body: ={{ $json }}   # item crudo del AI Agent (output string + wid)
```

| Qué acepta | Ejemplo |
|------------|---------|
| Item crudo n8n | `{ "output": "{...comanda...}", "body": { "instanceData": { "wid": "57…@c.us" } } }` |
| Comanda parseada | `{ "estado": "confirmado", "cliente": {...}, "productos": [...] }` |
| Array de items | Usa el primero |

En demo:

- Los pedidos viven en `.data/enlace-pedidos.json` (gitignored).
- La UI los importa a `localStorage` y refresca cada ~5s.
- Secreto por defecto: `porcicola-enlace-demo` (`ENLACE_API_KEY` / `VITE_ENLACE_API_KEY`).

Guía completa (nodo HTTP Request, curl, mapeo de campos):  
[`elementos/ENLACE_N8N_PLATAFORMA.md`](../elementos/ENLACE_N8N_PLATAFORMA.md)

## Roles

| Rol | Ruta | En el flujo |
|-----|------|-------------|
| General | `/general` | Admin / KPIs |
| Comercial | `/comercial` | Verifica datos del pedido |
| Carnicero | `/carnicero` | Verifica stock → luego produce |
| Contable | `/contable` | Cobra solo tras stock OK |

Stack: React 19 · TanStack Start/Router/Query · Tailwind · shadcn/ui · (Supabase preparado, demo activo).
