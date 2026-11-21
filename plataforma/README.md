# Porcicola Ops (plataforma)

App web interna de la carnicería. Parte del monorepo [porcicola-Bot](https://github.com/ehpenar/porcicola-Bot).

## Modo demo (actual)

Sin Supabase Auth. En login elige el rol. Datos en `localStorage`.

```sh
cp .env.example .env
bun install   # o npm i / bun i
bun run dev   # http://localhost:8080
```

`VITE_DEMO_MODE=true` en `.env`. Pon `false` cuando conectes Auth real.

## Roles

| Rol | Ruta |
|-----|------|
| General | `/general` |
| Comercial | `/comercial` |
| Contable | `/contable` |
| Carnicero | `/carnicero` |

Stack: React 19 · TanStack Start/Router/Query · Tailwind · shadcn/ui · (Supabase preparado, demo activo).
