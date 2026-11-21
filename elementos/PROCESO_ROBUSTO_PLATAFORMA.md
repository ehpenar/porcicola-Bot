# Porcicola — Proceso robusto de plataforma (a partir de la descripción verbal)

Documento que toma la concepción actual del equipo y la convierte en un flujo operable, auditable y medible.

---

## 1. Resumen en una frase

> El bot captura → **Comercial valida** → Contable y Carnicero **ven** el pedido → **Contable pide y valida el pago** → Carnicero queda **liberado** para cortar → Contable **cierra y notifica** al cliente → ambos archivan en “trabajos realizados / procesados”.

La “duplicación” no es copiar el pedido dos veces: es **un solo Pedido** visible en dos colas a la vez, con **permisos distintos**.

---

## 2. Lo que ya dijeron (proceso concebido) — ordenado

| # | Etapa | Quién | Qué pasa |
|---|--------|-------|----------|
| 0 | Captura | WhatsApp + n8n | Cliente conversa; se genera comanda/JSON. **Ya está.** |
| 1 | Verificación comercial | Comercial | Revisa que lo tomado sea correcto → **Validado / Enviar** |
| 2 | Fan-out (misma info) | Plataforma | El pedido aparece **a la vez** en Carnicero y en Contable |
| 2a | Vista carnicero | Carnicero | Lo ve en **“Espera aprobación”** (aún no puede trabajar) |
| 2b | Vista contable | Contable | Revisa códigos, montos, datos → prepara cobro |
| 3 | Solicitud de pago | Contable → Bot → Cliente | Se envía cuenta/QR por WhatsApp (sin pasarela) |
| 4 | Comprobante | Cliente → Bot → Contable | Cliente paga y manda comprobante; llega a la misma orden |
| 5 | Liberación | Contable | Valida pago → **Aceptar / Validado / Enviar** → pasa a **orden de trabajo** |
| 6 | Producción | Carnicero | Pedido **Liberado**; corta y empaca. Contable ve **cronómetro** |
| 7 | Fin de corte | Carnicero → Contable | Carnicero envía “listo” |
| 8 | Cierre al cliente | Contable → Bot → Cliente | Mensaje: en unos momentos se envía el pedido |
| 9 | Archivo | Ambos | Carnicero: **Trabajos realizados** · Contable: **Trabajos procesados** (con fechas) |

Eso está **bien concebido** como flujo de **prepago + liberación humana**. Abajo se rigidiza para que no se rompa en la práctica.

---

## 3. Cómo lo haría yo (robusto): un Pedido, varias colas

### 3.1 No duplicar datos

| Idea verbal | Implementación robusta |
|-------------|------------------------|
| “Se duplica la información” | **Un registro Pedido** con `id` único |
| Vista carnicero / contable | Dos **filtros/colas** sobre el mismo Pedido |
| “Espera aprobación” vs “liberado” | Campo `status` + flags de permiso |

Así evitas que contable y carnicero editen dos copias distintas.

### 3.2 Máquina de estados (nombres claros para la UI)

| Status interno | Cómo se ve en Comercial | Contable | Carnicero |
|----------------|-------------------------|----------|-----------|
| `capturado` | Nuevo / por verificar | — | — |
| `verificado_comercial` | Verificado | **Por revisar / cobrar** | **Espera aprobación** (solo lectura) |
| `pago_solicitado` | Seguimiento | Esperando comprobante | Espera aprobación |
| `comprobante_recibido` | Seguimiento | **Validar pago** | Espera aprobación |
| `liberado_produccion` | En producción | En cronómetro / en proceso | **Liberado — trabajar** |
| `listo_despacho` | Listo | **Notificar cliente / cerrar** | Enviado a contable |
| `notificado_cliente` | Cerrado operativo | Por archivar | — |
| `archivado` | Histórico | **Trabajos procesados** | **Trabajos realizados** |
| `rechazado` / `cancelado` | Terminales | Terminales | Terminales |

### 3.3 Diagrama lógico del flujo feliz

```text
[WhatsApp + n8n] ──crea──► Pedido(capturado)
                              │
                              ▼
                     Comercial: Validar
                              │
                              ▼
                   Pedido(verificado_comercial)
                     ┌────────┴────────┐
                     ▼                 ▼
              Contable (activo)   Carnicero (solo mira:
              revisar / cobrar     "Espera aprobación")
                     │
                     ▼
              Contable: Solicitar pago ──► Bot ──► Cliente (cuenta/QR)
                     │
                     ▼
              Cliente paga + comprobante ──► Bot ──► Contable
                     │
                     ▼
              Contable: Validar pago / Liberar
                     │
                     ▼
              Pedido(liberado_produccion)
                     │
                     ▼
              Carnicero trabaja  ◄── Contable ve cronómetro
                     │
                     ▼
              Carnicero: Enviar listo
                     │
                     ▼
              Contable: Notificar cliente (Bot) + archivar
                     │
                     ▼
              Ambos: Trabajos realizados / procesados
```

---

## 4. Complementos que faltan en la descripción verbal (imprescindibles)

Sin estos, el proceso se cae en el día a día.

### 4.1 Excepciones

| Caso | Qué hacer |
|------|-----------|
| Comercial **rechaza** | Status `rechazado`; bot puede avisar al cliente; no llega a contable/carnicero como activo |
| Contable encuentra error de código/precio | Devuelve a Comercial (`capturado` o `en_correccion`) con nota; carnicero sigue sin liberar |
| Cliente **no paga** en X horas | Alerta en Contable; Comercial hace seguimiento; opcional auto-cancelar |
| Comprobante **ilegible / no cuadra** | Contable rechaza comprobante → sigue en `pago_solicitado`; bot pide reenvío |
| Cliente paga de **más/menos** | Contable registra monto real; libera solo si política lo permite (mínimo / exacto) |
| Carnicero detecta **falta de stock / cambio de peso** | Marca novedad; Contable (o Comercial) confirma con cliente **antes** de despachar |
| Cliente cancela después de pagar | Flujo de devolución / nota contable; carnicero no inicia o se detiene |

### 4.2 Quién “manda” el mensaje al cliente

Definición recomendada (robusta):

- **Solo Contable** dispara: “solicitar pago” y “pedido listo / se envía”.
- El **Bot** es el canal (WhatsApp), no decide solo.
- Comercial puede **reabrir chat** o mandar aclaraciones, pero no libera producción.

### 4.3 Envío / logística (hoy casi no está)

En su relato, el cierre es: carnicero listo → contable avisa al cliente → archivan.

Complemento mínimo:

| Subestado | Quién | Nota |
|-----------|-------|------|
| `listo_despacho` | Carnicero | Corte/empaque terminado |
| `en_ruta` (opcional v1) | Comercial o logística | Si aún no hay mensajero dedicado, Comercial marca “salió” |
| `entregado` (opcional v1) | Comercial / cliente | Cierra ciclo físico |

Si en v1 no hay mensajero, el mensaje “en unos momentos se envía” puede ser el cierre operativo y el archivo ocurre ahí; dejen `en_ruta/entregado` para fase 2.

### 4.4 Cronómetro (cómo medirlo bien)

No pongan un timer solo en pantalla: guarden timestamps.

| Evento | Timestamp |
|--------|-----------|
| Comercial valida | `verified_at` |
| Contable solicita pago | `payment_requested_at` |
| Comprobante llega | `proof_received_at` |
| Contable libera | `released_at` ← **inicio cronómetro producción** |
| Carnicero marca listo | `prep_done_at` ← **fin cronómetro** |
| Contable notifica cliente | `client_notified_at` |
| Archivo | `archived_at` |

**Tiempo de corte (el que quieren ver en Contable):**  
`prep_done_at - released_at`

Otros útiles: tiempo a primer pago, tiempo total captura→archivo.

---

## 5. Estructura de cada vista (pantallas / colas)

### 5.1 Vista Comercial

| Sección / cola | Status que muestra | Acciones |
|----------------|--------------------|----------|
| Por verificar | `capturado` | Abrir chat/comanda, editar, **Validar**, Rechazar |
| En proceso | desde `verificado_comercial` hasta `listo_despacho` | Solo seguimiento / aclarar con cliente |
| Histórico | `archivado`, `rechazado`, `cancelado` | Lectura |

**Rol:** dueño de la calidad del pedido capturado. No cobra ni libera corte.

### 5.2 Vista Contable (financiera)

| Sección / cola | Status | Acciones |
|----------------|--------|----------|
| Por revisar / cobrar | `verificado_comercial` | Revisar códigos/montos, **Solicitar pago** |
| Esperando / validar pago | `pago_solicitado`, `comprobante_recibido` | Ver comprobante, **Validar y liberar**, Rechazar comprobante |
| En producción (cronómetro) | `liberado_produccion` | Ver tiempo transcurrido |
| Por cerrar | `listo_despacho` | **Notificar cliente**, Archivar |
| Trabajos procesados | `archivado` | Buscar por fecha, cliente, monto, comprobante |

**Rol:** dueño del dinero y de la liberación a planta.

### 5.3 Vista Carnicero

| Sección / cola | Status | Acciones |
|----------------|--------|----------|
| Espera aprobación | `verificado_comercial` … `comprobante_recibido` | **Solo lectura** (anticipar carga de trabajo) |
| Liberados / en trabajo | `liberado_produccion` | Iniciar, registrar novedades, **Enviar listo** |
| Trabajos realizados | `archivado` (+ opcional `listo_despacho` reciente) | Histórico de lo ya cortado |

**Rol:** dueño del cumplimiento físico. No ve montos sensibles si no quieren (opcional ocultar precios).

---

## 6. Botones / acciones canónicas (para no marearse con “validado / enviar / aceptar”)

Unificar etiquetas en la UI:

| Momento | Botón recomendado | Efecto |
|---------|-------------------|--------|
| Comercial OK | **Verificar pedido** | → `verificado_comercial` |
| Contable pide plata | **Solicitar pago al cliente** | → `pago_solicitado` + mensaje WhatsApp |
| Contable OK del comprobante | **Validar pago y liberar** | → `liberado_produccion` |
| Carnicero termina | **Marcar listo para despacho** | → `listo_despacho` |
| Contable cierra | **Notificar cliente y archivar** | → `notificado_cliente` → `archivado` |

Eviten tres sinónimos (“listo / enviar / aceptar”) para la misma acción: genera confusión y bugs de entrenamiento.

---

## 7. Datos mínimos del Pedido (orden de compra / orden de trabajo)

Trátenlo siempre como **una Orden** con dos “caras”:

1. **Orden comercial/financiera** (antes de liberar)  
2. **Orden de trabajo** (después de liberar) — mismo `id`

Campos mínimos:

```text
id
origen: bot | comercial_manual
status
cliente { nombre, telefono, chatId, direccion, ... }
lineas[] { codigo, nombre, cantidad, unidad, prep, empaque, precio }
monto_estimado
monto_pagado
comprobantes[] { url/archivo, recibido_at, validado_por, resultado }
notas_comercial / notas_contable / novedades_carnicero
timestamps { created, verified, payment_requested, proof_received, released, prep_done, notified, archived }
eventos[] { actor, accion, from, to, at, detalle }
```

El comprobante **no crea otro pedido**: se adjunta a la misma orden.

---

## 8. Relación con n8n / WhatsApp (puntos de integración)

| Trigger en plataforma | Acción del bot |
|----------------------|----------------|
| Contable: Solicitar pago | Envía texto + datos de cuenta/QR al `chatId` |
| Cliente manda imagen/PDF | n8n detecta media → adjunta a Pedido → status `comprobante_recibido` + avisa Contable |
| Contable: Notificar y archivar | Mensaje “tu pedido está listo / se enviará…” |
| Comercial rechaza / pide datos | Mensaje de aclaración (opcional) |

**Importante:** el bot de captura (v5) y estos mensajes de “cobro / listo” pueden ser el mismo workflow con ramas, o workflows hermanos; la plataforma es quien **ordena** cuándo hablar.

---

## 9. Métricas laborales (desde el día 1)

| KPI | Fórmula |
|-----|---------|
| Tiempo verificación comercial | `verified_at - created_at` |
| Tiempo hasta solicitar pago | `payment_requested_at - verified_at` |
| Tiempo de pago del cliente | `proof_received_at - payment_requested_at` |
| Tiempo validación de comprobante | `released_at - proof_received_at` |
| **Tiempo de producción (cronómetro)** | `prep_done_at - released_at` |
| Ciclo completo | `archived_at - created_at` |
| % comprobantes rechazados | rechazos / solicitados |
| % pedidos liberados sin novedad | sin `novedades_carnicero` |

Con eso Contable no solo “ve un reloj”: tienen histórico comparable por día/semana.

---

## 10. Qué está bien de su idea y qué afinar

### Mantener
- Verificación comercial **antes** de cobrar  
- Contable como dueño del cobro **sin pasarela** (cuenta/QR + comprobante)  
- Carnicero ve el pedido temprano pero **solo trabaja al liberar**  
- Cronómetro de producción visible para Contable  
- Archivos separados: trabajos realizados vs procesados  

### Afinar
- “Duplicar” → **un Pedido, dos colas**  
- Unificar nombres de botones/estados  
- Definir rechazos, comprobante malo, no-pago, novedades de stock  
- Decidir si v1 incluye `en_ruta/entregado` o cierra en “notificado + archivado”  
- Guardar timestamps, no solo un timer en pantalla  

---

## 11. Roadmap de construcción (alineado a este proceso)

| Fase | Entregar | Criterio de hecho |
|------|----------|-------------------|
| F0 | WhatsApp + n8n captura | Ya (bot v5) |
| F1 | Plataforma + Pedido + Vista Comercial (verificar) | Pedido entra y se verifica |
| F2 | Vista Contable: revisar + solicitar pago + adjuntar comprobante + liberar | Prepago completo |
| F3 | Vista Carnicero: espera / liberado / listo + cronómetro | Producción medible |
| F4 | Notificación al cliente + archivado en ambas vistas | Cierre operativo |
| F5 | Excepciones + reportes SLA | Robusto en operación real |

---

## 12. Conclusión

Su concepción verbal **ya es un flujo de prepago con liberación humana**. Para que sea robusto:

1. Un solo Pedido (no dos copias).  
2. Estados explícitos (espera ≠ liberado ≠ archivado).  
3. Contable libera; Carnicero ejecuta; Comercial valida calidad de captura.  
4. Bot solo como mensajero en cobro/cierre.  
5. Timestamps + historial de eventos.  
6. Excepciones escritas desde el diseño, no “después”.

Eso es el mapa conceptual listo para pasar a pantallas y a desarrollo.
