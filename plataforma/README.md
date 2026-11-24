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

## Deploy Netlify

Sitio: **https://porcicolabot.netlify.app**

Build (ya en `netlify.toml` del monorepo):

| Setting | Valor |
|---------|--------|
| Base directory | `plataforma` |
| Build command | `bun run build` |
| Publish directory | `dist` |

Variables de entorno en Netlify (Project configuration → Environment variables):

| Key | Value | Scopes |
|-----|--------|--------|
| `VITE_DEMO_MODE` | `true` | Builds + Functions |
| `ENLACE_API_KEY` | `porcicola-enlace-demo` | Builds + Functions |
| `VITE_ENLACE_API_KEY` | `porcicola-enlace-demo` | Builds + Functions |

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

| Rol | Ruta |
|-----|------|
| General | `/general` |
| Comercial | `/comercial` |
| Contable | `/contable` |
| Carnicero | `/carnicero` |

Stack: React 19 · TanStack Start/Router/Query · Tailwind · shadcn/ui · (Supabase preparado, demo activo).
