# Prompt Lovable — CONTINUAR (créditos nuevos)

El repo ya tiene DB, RPCs, libs y componentes. **No reinicies el proyecto.**  
Solo faltan **rutas/páginas** y cableado. Pega esto en Lovable sobre el mismo proyecto.

---

```text
CONTINUE the existing Porcicola Ops project. DO NOT rebuild from scratch. DO NOT replace the database schema, RPCs, or existing components in src/components and src/lib — they are already correct.

CRITICAL PROBLEM RIGHT NOW:
- src/routes/index.tsx is still the blank Lovable placeholder
- routeTree only has "/"
- AppShell, ActionBar, PedidoDetail, PedidosTable, queries, stats, admin.functions already exist and expect these routes:
  /login, /unauthorized, /guia,
  /comercial, /contable, /carnicero,
  /general, /general/pedidos, /general/estadisticas, /general/usuarios,
  /pedidos/$id

YOUR ONLY JOB: wire the app so it is usable end-to-end.

============================================================
1) CREATE FILE-BASED ROUTES (TanStack Start)
============================================================

Create these files under src/routes/ (follow existing TanStack conventions in src/routes/README.md):

- login.tsx
- unauthorized.tsx
- guia.tsx
- comercial.tsx
- contable.tsx
- carnicero.tsx
- general/index.tsx
- general/pedidos.tsx
- general/estadisticas.tsx
- general/usuarios.tsx
- pedidos/$id.tsx

Update index.tsx:
- If logged out → redirect /login
- If logged in → redirect to ROLE_HOME[role] from src/lib/pedidos.ts
- Never show the blank placeholder image again

============================================================
2) LOGIN + ROLE REDIRECT
============================================================

- Email/password with supabase.auth
- On success, load meQueryOptions and navigate to ROLE_HOME[role]
- If no role or inactive → /unauthorized
- Show Spanish UI; include a small demo hint area listing intended demo accounts (create them if missing)

Create these Auth users if they don't exist (Supabase), confirm email, profiles + user_roles:
- admin@porcicola.local / Porcicola123! → general
- comercial@porcicola.local / Porcicola123! → comercial
- contable@porcicola.local / Porcicola123! → contable
- carnicero@porcicola.local / Porcicola123! → carnicero

============================================================
3) ROLE QUEUE PAGES — REUSE COMPONENTS
============================================================

Wrap with AppShell + requireRole from src/lib/queries.ts.

COMERCIAL (allowed: comercial):
Tabs via QueueTabs:
- Por verificar: statuses capturado, en_correccion — actions via detail
- En proceso: verificado_comercial … listo_despacho
- Histórico: archivado, rechazado, cancelado
Include CrearPedido (manual + demo bot) from src/components/pedido/crear-pedido.tsx
Use PedidosTable; row click → /pedidos/$id

CONTABLE (allowed: contable):
Tabs:
- Por revisar/cobrar: verificado_comercial
- Esperando/validar pago: pago_solicitado, comprobante_recibido
- En producción: liberado_produccion (show LiveTimer using released_at)
- Por cerrar: listo_despacho, notificado_cliente
- Trabajos procesados: archivado (date filters if easy)

CARNICERO (allowed: carnicero):
Tabs:
- Espera aprobación: verificado_comercial, pago_solicitado, comprobante_recibido (read-only)
- Liberados/en trabajo: liberado_produccion
- Trabajos realizados: archivado
Hide money in lists if role is carnicero (PedidosTable already supports showMoney=false pattern if present; otherwise pass prop)

GENERAL (allowed: general only for admin pages; general can also open other role routes):
- /general → KPI cards using computeKpis + charts from stats.ts (recharts already in package)
- /general/pedidos → all pedidos
- /general/estadisticas → deeper charts (por día, por status, producción)
- /general/usuarios → users table + create user via crearUsuario server fn + admin_set_role / admin_set_active RPCs; edit config_pago instrucciones/QR

============================================================
4) PEDIDO DETAIL
============================================================

/pedidos/$id
- requireRole any authenticated role that can see the pedido
- Load pedidoQueryOptions
- Render DetailHeader, ProduccionPanel, client/lines/money/comprobantes/timeline from pedido-detail.tsx
- Sticky ActionBar with current role
- Support editing when canEditPedido
- Support cantidad_real + novedades for carnicero when liberado_produccion

============================================================
5) GUIA RAPIDA
============================================================

/guia — short Spanish explanation of happy path + button labels:
Verificar pedido → Solicitar pago al cliente → Validar pago y liberar → Marcar listo para despacho → Notificar cliente y archivar

============================================================
6) DO NOT
============================================================

- Do not recreate schema or rewrite transicionar_pedido
- Do not rename canonical action buttons
- Do not remove RLS
- Do not leave the blank placeholder on /

============================================================
7) DONE WHEN
============================================================

I can log in as each demo user, run the full happy path on a demo pedido, see timers/events, and admin can open stats + create a user.
```

---

## Después de que Lovable termine

Probar checklist en `AUDITORIA_LOVABLE_PIXEL_PERFECT.md` (sección final).
