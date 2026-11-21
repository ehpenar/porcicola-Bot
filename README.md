# porcicola-Bot

Bot de WhatsApp para una carnicería de cerdo. Recibe mensajes vía **Green-API**, los procesa con un **AI Agent** en **n8n** (OpenAI) y responde al cliente por WhatsApp.

> **Versión recomendada: v5** (`workflows/wappBotPorcicola.json` o `workflows/wappBotPorcicola-v5.json`)
>
> Conversación **coherente** con el comprador: saluda, toma pedido, aclara cortes/cantidades y responde de forma natural. Validada en uso real.

---

## Archivos del repo

| Archivo | Descripción |
|---------|-------------|
| `workflows/wappBotPorcicola.json` | Workflow actual (**v5**) para importar en n8n |
| `workflows/wappBotPorcicola-v5.json` | Copia explícita de la v5 |
| `workflows/wappBotPorcicola-v4.json` | v4 anti-loop (referencia) |
| `workflows/archive/wappBotPorcicola-v4.json` | Archivo histórico de la v4 |
| `workflows/archive/wappBotPorcicola-v3.json` | v3 con bug de loop infinito |

---

## Comparación rápida

| Aspecto | v3 | v4 | **v5** |
|---------|----|----|--------|
| Vendedor + catálogo PLU | Sí | Sí | **Sí (prompt comercial completo)** |
| Memoria por chat | Sí | Sí (ventana 10) | **Sí (ventana 3)** |
| Filtro antes del agente | No | `incomingMessageReceived` + `textMessage` | **IF: existe texto del mensaje** |
| Anti-duplicado `idMessage` | No | Sí | No |
| Evitar JSON al cliente | No | Code “Salida segura” | **IF1: si output contiene `confirmado`, no envía por WhatsApp** |
| Interacción natural con cliente | Parcial / loop | Más corta / anti-bucle | **Buena (validada en producción)** |
| Loop infinito con "hola" | **Sí** | Mitigado | Mitigado con filtro de texto + IF de confirmación |

---

## Versión 5 — cambios (actual)

### Qué cambió respecto a la v4

1. **Prompt comercial completo restaurado**  
   Vuelve el system prompt detallado de vendedor (catálogo PLU, cantidades, preparación, bolsas, datos del cliente, flujo de atención y JSON de comanda). En la práctica el bot **interactúa bien** con el comprador: mensajes coherentes, no se pierde en el pedido.

2. **IF al inicio (filtro de texto)**  
   Solo continúa si existe `body.messageData.textMessageData.textMessage`. Ignora webhooks sin texto (ecos vacíos, eventos sin mensaje, etc.) y evita procesar basura.

3. **IF1 después del agente (no mandar JSON de pedido)**  
   Si la salida del agente **contiene** `"confirmado"` (típico del JSON de comanda), **no** se envía por WhatsApp.  
   Si es una respuesta conversacional normal (sin ese marcador), sí se envía al cliente.  
   Así el cliente recibe chat humano y el JSON interno no se “escupe” al chat.

4. **Memoria más corta**  
   `Simple Memory` con `contextWindowLength: 3` (menos contexto que la v4) para respuestas más enfocadas en el turno reciente.

5. **Estructura más simple**  
   Se eliminan los nodos Code de la v4 (`Anti-duplicado`, `Salida segura`). El flujo vuelve al patrón Webhook → Set → Agent → Set → HTTP, con los dos IF como control.

6. **Modelo**  
   OpenAI `gpt-5-mini` (como en v3).

### Flujo v5

```
Webhook Green-API
  → IF: ¿existe texto del mensaje?
       ├─ No  → fin
       └─ Sí  → Edit Fields (normaliza chatId, nombre, texto)
                → AI Agent (+ OpenAI + Simple Memory)
                → Edit Fields1 (output + chatId)
                → IF1: ¿output contiene "confirmado"?
                     ├─ Sí  → fin (no envía JSON de comanda al WhatsApp)
                     └─ No  → HTTP Request (sendMessage Green-API)
```

### Qué funciona bien en v5

- Respuestas coherentes y naturales con el cliente
- Toma de pedido con catálogo, aclaraciones y resumen
- Filtro básico para no procesar webhooks sin texto
- Evita enviar el JSON de pedido confirmado al chat

### Limitaciones / cuidados

- El IF1 se basa en la palabra `confirmado` en el output: si el agente la usa en un mensaje humano (“pedido confirmado”), ese mensaje **no** se enviaría. Conviene que la confirmación al cliente no dependa de esa palabra, o ajustar la condición.
- No hay dedupe por `idMessage` (sí lo tenía la v4).
- No hay herramienta real de stock / guardado de pedido.
- Configura tu propia URL Green-API (en el repo va con placeholders).

---

## Versión 4 — anti-loop (referencia)

Filtro estricto `incomingMessageReceived` + `textMessage`, anti-duplicado por `idMessage`, prompt corto anti-bucle y “Salida segura” en Code. Útil como referencia si reaparece el loop.

Archivos: `workflows/wappBotPorcicola-v4.json`, `workflows/archive/wappBotPorcicola-v4.json`

---

## Versión 3 — bug de mensajes infinitos

Sin filtro de eco: un *"hola"* podía disparar respuestas en bucle. Archivo: `workflows/archive/wappBotPorcicola-v3.json`

---

## Cómo importar en n8n

1. **Workflows → Import from File** → `workflows/wappBotPorcicola.json` (**v5**)
2. Conecta credenciales **OpenAI**
3. Sustituye la URL de envío:
   ```
   https://{{GREENAPI_ID_INSTANCE}}.api.greenapi.com/waInstance{{GREENAPI_ID_INSTANCE}}/sendMessage/{{GREENAPI_API_TOKEN}}
   ```
4. Copia la URL de producción del **Webhook Green-API** y pégala en Green-API
5. **Publish** + activa **solo** este workflow

### Prueba rápida

1. `hola` → un saludo coherente y pregunta qué desea.
2. Pedir un corte (ej. costilla) → aclara cantidad/preparación sin perder el hilo.
3. Confirmar pedido → el JSON interno no debería llegar crudo al WhatsApp.

---

## Seguridad

Los tokens reales de Green-API y datos de prueba (pinData) **no** van en el repo. Usa placeholders o credenciales de n8n.

---

## Requisitos

- n8n con nodos LangChain / AI Agent
- OpenAI
- Green-API (WhatsApp)

---

## Historial de commits del repo

1. **v3** — Bot de ventas + bug de mensajes infinitos
2. **v4** — Filtro entrante, anti-duplicado y salida segura anti-loop
3. **v5** (este commit) — Prompt comercial completo + IF texto + IF bloqueo de JSON; interacción coherente con el cliente
