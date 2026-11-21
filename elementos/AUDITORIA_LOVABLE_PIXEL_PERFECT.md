# Auditoría — proyecto Lovable `pixel-perfect-replica`

**Repo:** https://github.com/ehpenar/pixel-perfect-replica  
**Fecha:** 2026-11-21  
**Comparado contra:** `PROCESO_ROBUSTO_PLATAFORMA.md` + `PROMPT_LOVABLE_PLATAFORMA.md`

---

## Veredicto

Lovable construyó **muy bien el núcleo (DB + reglas de negocio + componentes)**, pero **se quedó sin cablear las pantallas**.

Hoy, si corres la app, la ruta `/` sigue siendo el **placeholder vacío** de Lovable.  
El shell, las colas, el detalle y el admin **están pensados en el código**, pero **no existen las rutas** `/login`, `/general`, `/comercial`, `/contable`, `/carnicero`, `/pedidos/$id`, `/guia`.

**Actualización 2026-11-21 (post-completar):** las pantallas/rutas ya fueron cableadas y pusheadas a `main`. La app es navegable; falta crear usuarios demo en Auth y probar el happy path contra Supabase.

**Estimación anterior:** ~65–75 % dominio · ~0 % navegable → **ahora ~95 % MVP UI** (queda operación real + n8n).

---

## Qué quedó bueno (mantener)

### 1. Base de datos alineada al proceso

En `drizzle/migrations/0000_porcicola_ops_schema.sql`:

- Roles: `general | comercial | contable | carnicero`
- Estados del pedido (todos los del prompt)
- Tablas: `profiles`, `user_roles`, `pedidos`, `pedido_lineas`, `pedido_comprobantes`, `pedido_eventos`, `config_pago`
- Timestamps SLA: `verified_at`, `payment_requested_at`, `proof_received_at`, `released_at`, `prep_done_at`, `client_notified_at`, `archived_at`
- RLS por rol (carnicero no ve `capturado`, no ve comprobantes)
- Seed de pedidos históricos + config de pago (cuenta/QR texto)
- Realtime en `pedidos` / `pedido_eventos`
- Storage policies para bucket `comprobantes` (migración `0001`)

### 2. Máquina de estados en el servidor (lo más valioso)

Función `transicionar_pedido(...)`:

- Solo permite transiciones válidas
- Valida rol (o `general`)
- Exige nota cuando corresponde
- Exige `monto_pagado` al liberar
- Escribe eventos + mensajes WhatsApp **simulados**
- Setea timestamps automáticamente

Otras RPCs sólidas:

- `crear_pedido`, `actualizar_pedido`
- `registrar_comprobante`
- `actualizar_nota`, `actualizar_cantidad_real`
- `admin_set_role`, `admin_set_active`
- `actualizar_config_pago` (bug corregido en migración 0001)

### 3. Dominio frontend bien modelado

`src/lib/pedidos.ts`:

- Labels/estados/colores
- Tabla `TRANSITIONS` espejo de la DB
- `canSeeMoney` (oculta precios al carnicero)
- Formatos COP, duración, cronómetro
- Catálogo PLU-201…212

`src/lib/queries.ts`: guards `requireRole`, queries de me/pedidos/detalle/users  
`src/lib/stats.ts`: KPIs y series para dashboard  
`src/lib/admin.functions.ts`: crear usuarios (server fn + admin auth)

### 4. Componentes de UI del flujo (listos para montar)

| Componente | Qué hace |
|------------|----------|
| `AppShell` | Sidebar por rol + logout (ya apunta a rutas que **aún no existen**) |
| `ActionBar` | Botones canónicos exactos del prompt + diálogos |
| `PedidoDetail` | Header, timestamps, líneas, montos, comprobantes, timeline, timer |
| `CrearPedido` / `PedidoForm` | Manual + “Crear pedido demo (bot)” |
| `PedidosTable`, `QueueTabs`, `StatusBadge`, `LiveTimer` | Colas |

Esto significa: **completar no es rediseñar**, es **crear las páginas y conectar** estos componentes.

---

## Qué falta (bloquea usar la app)

### Crítico — sin esto no hay producto

| # | Falta | Evidencia |
|---|--------|-----------|
| 1 | Rutas de la app | `src/routeTree.gen.ts` solo tiene `/`. `src/routes/index.tsx` es placeholder |
| 2 | `/login` | Referenciado en guards y logout; **archivo no existe** |
| 3 | `/unauthorized` | Idem |
| 4 | `/comercial`, `/contable`, `/carnicero` | Nav las espera; no hay pages |
| 5 | `/general`, `/general/pedidos`, `/general/estadisticas`, `/general/usuarios` | Idem |
| 6 | `/pedidos/$id` | Tables/crear navegan ahí; no existe |
| 7 | `/guia` | Link en shell; no existe |
| 8 | Redirect post-login por rol | `ROLE_HOME` está definido, falta usarlo en login |

### Importante — para operación real

| # | Falta |
|---|--------|
| 9 | Usuarios demo seed en Auth (el SQL siembra pedidos, **no** usuarios `admin@…`) |
| 10 | README real del proyecto (sigue el template “Pixel Perfect Replica”) |
| 11 | Página admin de estadísticas (lógica en `stats.ts` lista, UI no) |
| 12 | Página admin usuarios (RPC + `crearUsuario` listos, UI no) |
| 13 | Config de instrucciones de pago en UI General |
| 14 | Probar happy path end-to-end con 4 roles |

### Fuera de MVP (esperado)

| # | Pendiente posterior |
|---|---------------------|
| 15 | Webhook n8n → crear `pedido` en `capturado` |
| 16 | Comprobante real desde WhatsApp media → Storage |
| 17 | Envío real de mensajes (hoy solo evento `mensaje_simulado`) |
| 18 | `en_ruta` / `entregado` (fase 2 logística) |

---

## Bugs / riesgos detectados

1. **App no navegable** — home placeholder; todo el trabajo útil queda huérfano.  
2. **Bug SQL residual** en `0000`: `excluded.instructions` (typo). La migración `0001` lo corrige a `excluded.instrucciones` — aseguren que **0001 esté aplicada** en Supabase.  
3. **`drizzle/schema.ts` vacío** — no bloquea si usan SQL + types de Supabase, pero confunde.  
4. **Sin usuarios seed** — aunque la DB tenga pedidos, nadie puede entrar hasta crear users en Auth + `user_roles`.  
5. **`.env` en el repo clonado** — revisar que no se suban service role keys; rotar si hubo exposición.

---

## Mapa: hecho vs faltante

```text
[DB + RLS + RPC transiciones]     ████████████████████  DONE
[Seed pedidos + config pago]      ████████████████░░░░  DONE (faltan users auth)
[Lib dominio + queries + stats]   ████████████████████  DONE
[Componentes pedido/colas/shell]  ██████████████████░░  DONE
[Rutas / páginas por rol]         ░░░░░░░░░░░░░░░░░░░░  MISSING
[Login + redirect por rol]        ░░░░░░░░░░░░░░░░░░░░  MISSING
[Dashboard general / users UI]    ░░░░░░░░░░░░░░░░░░░░  MISSING
[Integración n8n real]            ░░░░░░░░░░░░░░░░░░░░  LUEGO
```

---

## Cómo completarlo (orden recomendado)

### Opción A — Continuar en Lovable (cuando haya créditos)

Pegar el prompt de continuación (ver `PROMPT_LOVABLE_CONTINUAR.md`).

### Opción B — Completar a mano / con Cursor sobre ese repo

1. Crear rutas TanStack:
   - `login.tsx`, `unauthorized.tsx`, `guia.tsx`
   - `comercial.tsx`, `contable.tsx`, `carnicero.tsx`
   - `general/index.tsx`, `general/pedidos.tsx`, `general/estadisticas.tsx`, `general/usuarios.tsx`
   - `pedidos/$id.tsx`
2. En cada cola: `AppShell` + `QueueTabs` + `PedidosTable` filtrando statuses del proceso.
3. Detalle: `PedidoDetail` + `ActionBar` con `requireRole`.
4. Login → `ROLE_HOME[role]`.
5. Crear 4 usuarios en Supabase Auth y filas en `user_roles`.
6. Probar flujo feliz completo.

---

## Criterio de “completo” (checklist)

- [ ] Login con 4 roles redirige a su home  
- [ ] Comercial verifica pedido demo  
- [ ] Contable solicita pago → adjunta comprobante → libera  
- [ ] Carnicero ve espera (solo lectura) y luego libera/trabaja → listo  
- [ ] Contable notifica y archiva  
- [ ] General ve KPIs + lista de usuarios + puede crear usuario  
- [ ] Event timeline refleja cada paso  
- [ ] Cronómetro visible en producción  

Cuando eso pase, el MVP de plataforma está cerrado; n8n es la siguiente fase.
