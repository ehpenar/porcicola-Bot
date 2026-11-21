# Porcicola — Análisis del proceso y sistema

**Fecha:** 2026-11-21  
**Fuentes:** `DiagramaConceptualPorcicola.json` + captura del diagrama  
**Leyenda del diagrama:** verde = hecho · amarillo = pendiente

---

## Veredicto corto

La idea general es **correcta** (captura → plataforma → roles), pero el diagrama **mezcla roles, avisos y puertas de control**.

El punto crítico es el **pago**: hoy el carnicero “debe esperar el pago” y a la vez el cliente paga al final tras aceptar cambios. Eso crea un **ciclo**. Hay que fijar **política de cobro** y **estados explícitos** del pedido.

**Principio recomendado:** un solo objeto **Pedido**. Cada rol solo ve acciones permitidas según el estado. Todo cambio genera un evento con quién, qué y cuándo.

---

## 1. Cómo se entiende el sistema

No es solo un bot: es un flujo de pedido de carnicería con captura por WhatsApp, revisión humana, preparación física, cobro y entrega.

La **plataforma** debe ser el centro; las “vistas” son filtros del mismo pedido, no tres sistemas separados.

| Bloque | Estado | Rol real | Qué produce |
|--------|--------|----------|-------------|
| wapp cliente | Hecho | Canal | Mensajes del comprador |
| sistema enlace (n8n) | Hecho | Captura asistida | Conversación + JSON de comanda |
| comercial | Pendiente | Dueño comercial del pedido | Revisión / pedido manual / aprobación |
| plataforma | Pendiente | Sistema de pedidos (SSOT) | Pedido estructurado + estados + historial |
| contable | Pendiente | Cobro y registro | Monto, pago, comprobante |
| carnicero | Pendiente | Cumplimiento físico | Corte, empaque, ajustes de peso |
| envio | Pendiente | Logística | Despacho / ruta / entrega |
| cliente (cierre) | Pendiente | Confirmación final | Acepta cambios / recibe / cierra |

---

## 2. Qué está bien planteado

1. **Entrada dual:** el cliente puede hablar con el bot o con el comercial. Realista y útil para excepciones.
2. **Plataforma como hub:** centralizar bot + comercial en un solo registro visible para carnicero y contable.
3. **Carnicero puede editar:** en carne el peso final suele variar; las novedades son indispensables.
4. **Contable con comprobante:** separar operación de registro contable permite auditoría y reportes.

---

## 3. Problemas / ambigüedades del diagrama

| # | Problema | Por qué importa | Ajuste |
|---|----------|-----------------|--------|
| 1 | Ciclo de pago | Carnicero espera pago; cliente paga al final tras cambios | Definir prepago / contraentrega / crédito con puertas distintas |
| 2 | Comercial = canal + revisor | Se mezcla atención WhatsApp con aprobación de pedidos | Misma vista, dos acciones claras: atender vs aprobar |
| 3 | Aviso paralelo sin gate | Carnicero y contable reciben a la vez sin saber quién bloquea a quién | Fan-out con estados: visible ≠ accionable |
| 4 | Quién crea el Pedido | Bot y comercial pueden escribir a la vez | Bot crea borrador; comercial publica/aprueba |
| 5 | Envío sin dueño | No hay vista ni estado de logística | Incluir `listo_envio` / `en_ruta` / `entregado` |
| 6 | Sin máquina de estados | No se puede auditar ni medir tiempos | Pedido con status + event log con timestamps |
| 7 | Aceptación de cambios tarde | Si carnicero cambia peso después de pago, hay reajuste | Separar monto estimado vs monto final facturado |

---

## 4. Proceso recomendado (máquina de estados)

| Estado | Quién actúa | Qué pasa | Siguiente |
|--------|-------------|----------|-----------|
| `borrador` | Bot / comercial | Se captura JSON/comanda | `en_revision` |
| `en_revision` | Comercial | Revisa chat/datos; corrige; aprueba o rechaza | `aprobado_comercial` |
| `aprobado_comercial` | Sistema | Visible a contable y carnicero | `pendiente_pago` o `en_preparacion`* |
| `pendiente_pago` | Contable / cliente | Cobra monto estimado; registra medio y ref | `pagado` |
| `pagado` | Sistema | Libera corte (si política = prepago) | `en_preparacion` |
| `en_preparacion` | Carnicero | Corta/empaca; puede ajustar líneas (peso real) | `ajustado` o `listo_envio` |
| `ajustado` | Cliente / comercial | Cliente acepta diferencia o se reajusta cobro | `listo_envio` |
| `listo_envio` | Envío | Despacho / ruta | `en_ruta` → `entregado` |
| `entregado` | Contable | Cierra comprobante / saldo / contraentrega | `cerrado` |
| `cerrado` | — | Inmutable para auditoría | — |

\* Si la política es **contraentrega** o **crédito**, `aprobado_comercial` puede pasar directo a `en_preparacion` y el pago se confirma en `entregado`.

### Políticas de cobro (elegir una por pedido)

| Política | Comportamiento |
|----------|----------------|
| **Prepago / anticipo** (recomendada al inicio) | Contable libera el corte. Carnicero solo corta si status ≥ `pagado`. Ajustes de peso = nota crédito/débito. |
| **Contraentrega** | Carnicero corta tras aprobación comercial. Contable marca pagado al entregar. |
| **Crédito cliente** | Contable autoriza cupo. Corte libre tras autorización; facturación al cierre. |

---

## 5. Las tres vistas de la herramienta

Una app, un Pedido, tres tableros. Misma data; distinta cola y permisos.

### Vista comercial
- **Cola:** borradores del bot + chats a revisar + pedidos manuales
- **Acciones:** abrir conversación, editar líneas, aprobar, rechazar, crear pedido sin bot, escalar al cliente
- **No hace:** no marca pago ni despacha

### Vista contable
- **Cola:** aprobados pendientes de cobro + saldos + entregados sin cierre
- **Acciones:** ver monto estimado/final, registrar pago, medio, referencia, emitir comprobante, autorizar crédito
- **No hace:** no edita cortes ni rutas

### Vista carnicero
- **Cola:** pedidos liberados para preparación (según política de pago)
- **Acciones:** ver comanda, marcar en preparación, ajustar peso/líneas, listo para envío
- **No hace:** no confirma pagos ni crea pedidos de cero

### Complemento: envío
No hace falta una vista grande al inicio: estados `listo_envio` / `en_ruta` / `entregado` en la misma plataforma bastan (operables por comercial o logística).

---

## 6. Modelo mínimo para auditar y medir

### Entidades

| Entidad | Campos clave |
|---------|--------------|
| Pedido | id, origen (`bot`\|`comercial`), cliente_id, status, politica_pago, montos, timestamps |
| LineaPedido | codigo PLU, cantidad pedida, cantidad real, unidad, prep, empaque, precio |
| Pago | pedido_id, monto, medio, referencia, status, registrado_por, at |
| EventoPedido | pedido_id, tipo, actor, from_status, to_status, payload, at |
| Conversacion | chatId, mensajes, link al pedido |

### Timestamps obligatorios (SLA)

| Marca | Métrica |
|-------|---------|
| `created_at` | Volumen de captura / hora |
| `reviewed_at` | Tiempo bot → aprobación comercial |
| `paid_at` | Tiempo aprobación → pago |
| `prep_started_at` / `prep_done_at` | Tiempo de corte/empaque |
| `shipped_at` / `delivered_at` | Lead time entrega |
| `closed_at` | Ciclo completo del pedido |

### KPIs sugeridos

**Velocidad**
- SLA revisión comercial (p50/p90)
- SLA pago
- SLA preparación
- Lead time total `created → delivered`

**Calidad / dinero**
- % pedidos con ajuste de peso
- Delta monto estimado vs final
- % rechazados en revisión
- % bot cerrados sin intervención humana

---

## 7. Cambios concretos al diagrama

| Hoy en el diagrama | Propuesta |
|--------------------|-----------|
| Bot y cliente apuntan a comercial como si fuera el hub | Bot escribe borrador en plataforma; comercial revisa desde su vista |
| Plataforma avisa a carnicero y contable en paralelo sin condiciones | Ambos ven el pedido; solo uno tiene acción habilitada según status |
| Cliente paga al final y carnicero espera pago | Elegir política por pedido; no mezclar ambos gates a la vez |
| Envío como caja suelta | Estados de logística en el mismo Pedido |
| Notas en cajas amarillas = proceso | Pasar esas notas a reglas de estado + permisos de vista |

---

## 8. Roadmap corto

| Fase | Entrega | Para qué |
|------|---------|----------|
| F0 (ya) | WhatsApp + n8n JSON | Captura |
| F1 | Plataforma + Pedido + Evento + vista Comercial | Dejar de perder comandas en el chat |
| F2 | Vista Contable + registro de pago | Gate financiero auditable |
| F3 | Vista Carnicero + ajustes de línea | Operación de corte medible |
| F4 | Estados de envío + aceptación de cambios | Cierre de ciclo con cliente |
| F5 | Dashboard SLA / reportes | Medición laboral continua |

### Encaje con el bot v5

El JSON de confirmación del agente **no debe ir al WhatsApp**: debe convertirse en **Pedido** en estado `borrador` / `en_revision` dentro de la plataforma. El comercial valida; ahí empieza el reloj auditable.

---

## 9. Resumen ejecutivo

El planteamiento es bueno como **mapa de actores**, insuficiente como **proceso operable**. Falta:

1. Máquina de estados  
2. Política de cobro explícita  
3. Event log  

Con eso, las tres vistas dejan de ser “pantallas” y pasan a ser **colas de trabajo** sobre el mismo Pedido, con tiempos medibles en cada transición.

---

## Archivos relacionados en este proyecto

| Archivo | Contenido |
|---------|-----------|
| `elementos/DiagramaConceptualPorcicola.json` | Diagrama original (draw.io) |
| `elementos/Captura de pantalla 2026-11-21 a la(s) 3.56.25 p.m..png` | Captura visual del diagrama |
| `elementos/ANALISIS_PROCESO_SISTEMA.md` | Este análisis (narrativo) |
| `elementos/PROCESO_ESTADOS_Y_VISTAS.md` | Contrato operativo de estados, vistas y campos |
