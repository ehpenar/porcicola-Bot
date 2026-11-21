# Prompt para Lovable — Plataforma Porcicola

Copia todo el bloque de abajo y pégalo en Lovable.

---

```text
Build a production-ready web app called **Porcicola Ops** — an internal operations platform for a pork butcher shop (carnicería de cerdo) in Colombia.

Language of the UI: **Spanish (Colombia)**.
Stack preference: React + TypeScript + Tailwind + shadcn/ui + Supabase (Auth + Postgres). Use a clean, operational B2B look (dense but readable). No playful/consumer marketing style. Dark sidebar + light content is fine. Avoid purple gradients, glassmorphism, and emoji-heavy UI.

============================================================
CORE CONCEPT
============================================================

There is ONE central entity: **Pedido** (Order).
It is NOT duplicated per role. Each role sees the SAME pedido in different queues with different permissions.

Happy path (prepago / payment before production):

1. Order arrives as `capturado` (from WhatsApp bot / n8n — simulate with seed data + “Crear pedido demo” for MVP)
2. **Comercial** verifies quality → `verificado_comercial`
3. At that moment the pedido appears simultaneously:
   - Contable: active work (review / charge)
   - Carnicero: read-only queue **“Espera aprobación”**
4. **Contable** requests payment → `pago_solicitado` (in real life WhatsApp sends bank account/QR; for MVP show toast + log an “outbound message” event; allow manual upload of payment proof)
5. Payment proof attached → `comprobante_recibido`
6. Contable validates payment and releases → `liberado_produccion`
7. Carnicero can now work; Contable sees a live production timer
8. Carnicero marks ready → `listo_despacho`
9. Contable notifies client + archives → `archivado`
10. Appears in histories: Carnicero “Trabajos realizados”, Contable “Trabajos procesados”

============================================================
AUTH & 4 ROLES (PROFILES)
============================================================

Use Supabase Auth email/password.

Roles (enum `app_role`):
- `general` (admin)
- `comercial`
- `contable`
- `carnicero`

Rules:
- After login, redirect ONLY to that role’s home. Do not show other role nav items.
- `general` can open ALL views + admin.
- A user has exactly one primary role (MVP). General can invite users and assign role.
- RLS / permission checks must enforce actions server-side (or via Supabase RLS + RPC). UI hiding is not enough.

Seed users for demo (document passwords in README on screen):
- admin@porcicola.local → general
- comercial@porcicola.local → comercial
- contable@porcicola.local → contable
- carnicero@porcicola.local → carnicero

============================================================
ORDER STATUS MACHINE (STRICT)
============================================================

Statuses:
- capturado
- verificado_comercial
- pago_solicitado
- comprobante_recibido
- liberado_produccion
- listo_despacho
- notificado_cliente
- archivado
- en_correccion
- rechazado
- cancelado

Allowed transitions (only these):

capturado → verificado_comercial (Comercial: Verificar pedido)
capturado → rechazado (Comercial: Rechazar)
capturado → en_correccion (optional)

verificado_comercial → pago_solicitado (Contable: Solicitar pago al cliente)
verificado_comercial → en_correccion (Contable returns to Comercial with note)
en_correccion → capturado or verificado_comercial (Comercial fixes)

pago_solicitado → comprobante_recibido (proof uploaded / received)
pago_solicitado → cancelado

comprobante_recibido → liberado_produccion (Contable: Validar pago y liberar)
comprobante_recibido → pago_solicitado (Contable rejects proof → ask again)

liberado_produccion → listo_despacho (Carnicero: Marcar listo para despacho)

listo_despacho → notificado_cliente (Contable: Notificar cliente)
notificado_cliente → archivado (Contable: Archivar) 
OR combine into one button: “Notificar cliente y archivar” → archivado

Every transition MUST append an event to `pedido_eventos` with: actor, role, from_status, to_status, note, created_at.

Timestamps to set on transitions:
- verified_at
- payment_requested_at
- proof_received_at
- released_at   ← start production timer
- prep_done_at  ← end production timer
- client_notified_at
- archived_at

Production duration = prep_done_at - released_at

============================================================
DATA MODEL (MINIMUM)
============================================================

profiles: id (auth user), full_name, role, active, created_at

pedidos:
- id (human readable ORD-0001 also ok)
- origen: bot | comercial_manual
- status
- cliente_nombre, cliente_telefono, cliente_chat_id, cliente_direccion, cliente_barrio, cliente_ciudad, cliente_cedula
- monto_estimado, monto_pagado
- notas_comercial, notas_contable, novedades_carnicero
- timestamps listed above
- created_at, updated_at

pedido_lineas:
- pedido_id, codigo_plu, nombre, cantidad, unidad (KG|UND), preparacion, empaque, precio_unitario, cantidad_real (nullable)

pedido_comprobantes:
- pedido_id, file_url, recibido_at, validado_por, resultado (pendiente|aceptado|rechazado), nota

pedido_eventos:
- pedido_id, actor_id, actor_role, accion, from_status, to_status, detalle, created_at

Optional config table for payment instructions text shown when requesting payment (bank account / QR image URL).

Seed 8–12 demo pedidos in different statuses so each queue looks alive.

Catalog reference (for display / manual create):
PLU-201 Lomo sin hueso, PLU-202 Chuleta ahumada, PLU-203 Chuleta fresca, PLU-204 Costilla, PLU-205 Bondiola, PLU-206 Tocino, PLU-207 Pernil, PLU-208 Solomito, PLU-209 Molida, PLU-210 Manitas, PLU-211 Espinazo, PLU-212 Chorizo.

============================================================
APP STRUCTURE / ROUTES
============================================================

/login
/unauthorized

Role homes:
/general            → dashboard + admin
/comercial
/contable
/carnicero

Shared detail:
/pedidos/:id        → role-aware detail (show only actions allowed for current role)

General also:
/general/usuarios
/general/estadisticas
/general/pedidos    → all pedidos

============================================================
VIEW: GENERAL (ADMIN)
============================================================

Power:
- See ALL pedidos and ALL role queues summary
- Statistics / KPIs
- Invite/create users, activate/deactivate, assign role
- Optional: edit payment instructions (account/QR)

Dashboard KPIs cards:
- Pedidos capturados hoy
- Por verificar (comercial)
- Esperando pago
- En producción
- Archivados hoy
- SLA: tiempo promedio verificación, tiempo promedio pago, tiempo promedio producción
- % comprobantes rechazados

Charts (simple):
- Pedidos por día (last 7–14 days)
- Distribución por status
- Tiempo promedio producción por día

Users admin table: name, email, role, active, created — create/edit role.

============================================================
VIEW: COMERCIAL
============================================================

Tabs/queues:
1) Por verificar (status = capturado)
2) En proceso (verificado_comercial … listo_despacho)
3) Histórico (archivado, rechazado, cancelado)

List columns: ID, cliente, teléfono, origen, monto estimado, status badge, created_at, tiempo en cola.

Detail actions:
- Edit lines / client data while capturado or en_correccion
- Button **Verificar pedido**
- Button **Rechazar** (require note)
- Create manual pedido (origen comercial_manual)
- Read-only tracking afterwards (no payment release)

Comercial does NOT charge and does NOT release production.

============================================================
VIEW: CONTABLE
============================================================

Tabs/queues:
1) Por revisar / cobrar (verificado_comercial)
2) Esperando / validar pago (pago_solicitado, comprobante_recibido)
3) En producción (liberado_produccion) — show LIVE timer since released_at
4) Por cerrar (listo_despacho / notificado_cliente)
5) Trabajos procesados (archivado) — filter by date range, client, amount

Detail actions (canonical button labels — use EXACTLY these):
- **Solicitar pago al cliente**
- Upload/attach comprobante manually (MVP) + mark received
- **Validar pago y liberar** (set monto_pagado)
- **Rechazar comprobante** (back to pago_solicitado + note)
- **Devolver a comercial** (en_correccion + note)
- **Notificar cliente y archivar**

Show payment proof image/pdf preview.
Show event timeline.
Show production chronometer while liberado_produccion.

Contable owns money + release gate.

============================================================
VIEW: CARNICERO
============================================================

Tabs/queues:
1) Espera aprobación (verificado_comercial, pago_solicitado, comprobante_recibido) — READ ONLY
2) Liberados / en trabajo (liberado_produccion)
3) Trabajos realizados (archivado; optionally also recent listo_despacho)

In espera aprobación: show client, lines, prep/empaque notes — NO prices if easy to hide (preferred), or show prices but disable all action buttons.

In liberados:
- Start working (optional subflag or just use status)
- Add novedades_carnicero (stock/weight issues)
- Edit cantidad_real per line
- Button **Marcar listo para despacho**

Carnicero cannot validate payment or archive.

============================================================
PEDIDO DETAIL PAGE (ROLE-AWARE)
============================================================

Sections:
- Header: ID, status badge, origin, timestamps summary
- Cliente
- Líneas (table)
- Montos (hide from carnicero if possible)
- Comprobantes
- Notas / novedades
- Timeline de eventos (always)
- Action bar sticky bottom with ONLY permitted buttons

Use clear status badges with distinct colors.
Empty states per queue with helpful text.

============================================================
MVP INTEGRATIONS (SIMULATED)
============================================================

Do NOT integrate real WhatsApp/n8n yet.
Instead:
- Button actions that would message WhatsApp create an event + toast: “Mensaje simulado enviado al cliente”.
- Admin page note: “Webhook n8n creará pedidos en capturado; comprobantes llegarán por bot”.
- Provide “Crear pedido demo (bot)” on Comercial/General to insert a capturado pedido.

============================================================
UX REQUIREMENTS
============================================================

- Mobile-friendly tables (card list on small screens) — carnicero often on phone/tablet
- Confirm dialogs for irreversible actions (rechazar, liberar, archivar)
- Optimistic UI + error toasts
- Loading skeletons
- Spanish labels everywhere
- Accessibility: buttons with clear names

Canonical buttons (do not invent synonyms):
1. Verificar pedido
2. Solicitar pago al cliente
3. Validar pago y liberar
4. Marcar listo para despacho
5. Notificar cliente y archivar

============================================================
SECURITY
============================================================

- Row Level Security by role
- Contable-only can transition to liberado_produccion
- Carnicero-only can transition to listo_despacho from liberado_produccion
- Comercial-only verifies from capturado
- General can do all + manage users
- Never expose other roles’ action endpoints in UI for wrong role

============================================================
DELIVERABLES IN THIS BUILD
============================================================

1. Auth + role redirect
2. Four role apps/views as specified
3. Full pedido lifecycle with enforced transitions
4. Seed data + demo users
5. Admin stats dashboard
6. Event timeline + production timer
7. Short in-app “Guía rápida” page explaining the flow in Spanish

Start by creating the schema, seed data, auth, and the Contable + Carnicero + Comercial queues working end-to-end with demo orders. Then add General dashboard and user admin.
```

---

## Cómo usarlo

1. Abre [Lovable](https://lovable.dev) → nuevo proyecto.  
2. Pega el bloque completo (desde `Build a production-ready...` hasta el final).  
3. Cuando genere la base, pide en un segundo mensaje: *“Walk me through testing the full happy path with demo users”*.  
4. Más adelante: conectar webhook n8n → insert `pedidos` en `capturado`, y media de comprobantes.

## Notas

- El prompt pide **simular** WhatsApp en el MVP (correcto para Lovable).  
- Roles: **general, comercial, contable, carnicero**.  
- Un Pedido, cuatro vistas con permisos distintos.
