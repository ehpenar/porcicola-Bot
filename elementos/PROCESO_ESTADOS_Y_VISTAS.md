# Porcicola — Contrato de estados, vistas y campos

Documento operativo derivado del análisis. Sirve como base para diseñar la plataforma de 3 vistas.

---

## 1. Objeto central: Pedido

```text
Pedido
├── origen: bot | comercial
├── status: (máquina de estados)
├── politica_pago: prepago | contraentrega | credito
├── cliente: nombre, cedula, telefono, direccion, barrio, ciudad
├── montos: estimado, final, saldo
├── lineas[]: PLU, cantidad_pedida, cantidad_real, unidad, prep, empaque, precio
├── pago?: medio, referencia, pagado_at, registrado_por
├── envio?: ruta, shipped_at, delivered_at
└── eventos[]: historial auditable
```

---

## 2. Estados permitidos

```text
borrador
  → en_revision
  → rechazado

en_revision
  → aprobado_comercial
  → borrador          (devolver a corrección)
  → rechazado

aprobado_comercial
  → pendiente_pago    (si politica = prepago)
  → en_preparacion    (si politica = contraentrega | credito autorizado)

pendiente_pago
  → pagado
  → cancelado

pagado
  → en_preparacion

en_preparacion
  → ajustado          (si hubo novedad de peso/líneas)
  → listo_envio

ajustado
  → pendiente_pago    (si hay saldo por diferencia)
  → listo_envio       (si cliente/comercial acepta)

listo_envio
  → en_ruta
  → entregado

en_ruta
  → entregado

entregado
  → cerrado           (contable cierra comprobante/saldo)

cerrado               (terminal)
cancelado / rechazado (terminales)
```

---

## 3. Quién puede hacer qué

| Acción | Comercial | Contable | Carnicero | Sistema/Bot |
|--------|:---------:|:--------:|:---------:|:-----------:|
| Crear borrador | ✓ | | | ✓ |
| Editar líneas en revisión | ✓ | | | |
| Aprobar / rechazar | ✓ | | | |
| Registrar pago | | ✓ | | |
| Autorizar crédito | | ✓ | | |
| Iniciar preparación | | | ✓* | |
| Ajustar cantidad real | | | ✓ | |
| Marcar listo envío | | | ✓ | |
| Marcar en ruta / entregado | ✓** | | | |
| Cerrar pedido | | ✓ | | |

\* Solo si el pedido está liberado según `politica_pago`.  
\*\* O rol logística; al inicio puede hacerlo comercial.

### Regla clave

**Visible ≠ accionable.** Carnicero y contable pueden *ver* el pedido temprano, pero solo ejecutan cuando el `status` lo permite.

---

## 4. Colas por vista

### Comercial
Filtros sugeridos:
- `borrador` / `en_revision` (prioridad)
- Pedidos creados por bot sin revisar > N minutos
- `ajustado` pendiente de aceptación con cliente

### Contable
- `pendiente_pago`
- `entregado` con saldo
- Créditos por autorizar
- Pedidos `ajustado` con diferencia de monto

### Carnicero
- `pagado` o `en_preparacion` (según política)
- En preparación a medias
- Listos para empaque / envío

---

## 5. Evento auditable (obligatorio en cada transición)

```json
{
  "pedido_id": "ORD-...",
  "tipo": "status_change",
  "actor": { "id": "...", "rol": "comercial" },
  "from_status": "en_revision",
  "to_status": "aprobado_comercial",
  "payload": { "nota": "ok, cliente habitual" },
  "at": "2026-11-21T16:00:00-05:00"
}
```

Sin este log **no hay auditoría ni SLA**.

---

## 6. Timestamps del Pedido

| Campo | Cuándo se setea |
|-------|-----------------|
| `created_at` | Al crear borrador |
| `reviewed_at` | Primera aprobación comercial |
| `paid_at` | Pago confirmado (o abono que libera corte) |
| `prep_started_at` | Carnicero inicia |
| `prep_done_at` | Carnicero marca listo envío |
| `shipped_at` | Sale a ruta |
| `delivered_at` | Entregado |
| `closed_at` | Cierre contable |

### Métricas derivadas

- `reviewed_at - created_at` → SLA comercial  
- `paid_at - reviewed_at` → SLA cobro  
- `prep_done_at - prep_started_at` → tiempo de corte  
- `delivered_at - created_at` → lead time total  

---

## 7. Integración con n8n (bot v5)

1. Cliente confirma en WhatsApp.  
2. Agente genera JSON interno (`estado: confirmado`).  
3. n8n **no** manda ese JSON al chat; lo **POSTea a la plataforma**.  
4. Plataforma crea `Pedido` en `borrador` o `en_revision`.  
5. Comercial ve la cola y aprueba.  
6. A partir de ahí corre el proceso de las 3 vistas.

### Payload mínimo desde el bot

Reutilizar la estructura del system prompt del workflow v5:

- `cliente` (nombre, cedula, telefono, direccion, barrio, ciudad)
- `productos[]` (codigo, producto, cantidad, unidad, preparacion, empaque)
- `fecha_pedido`, `hora_pedido`, `fecha_entrega`, `observaciones_generales`
- `chatId` / id de conversación Green-API (para auditoría)

---

## 8. Decisiones abiertas (definir con el negocio)

1. ¿Política default: prepago, contraentrega o crédito?  
2. ¿Quién opera “envío” al inicio: comercial o rol aparte?  
3. ¿El cliente acepta ajustes por WhatsApp o solo el comercial en su nombre?  
4. ¿Precios del catálogo PLU son fijos o se recalculan al peso real?

Hasta no cerrar (1), el gate carnicero/contable seguirá ambiguo.
