# porcicola-Bot

Bot de WhatsApp para una carnicería de cerdo. Recibe mensajes vía **Green-API**, los procesa con un **AI Agent** en **n8n** (OpenAI) y responde al cliente por WhatsApp.

> **Versión recomendada: v4** (`workflows/wappBotPorcicola.json` o `workflows/wappBotPorcicola-v4.json`)
>
> Corrige el **loop infinito de mensajes** que tenía la v3 cuando el cliente escribía algo como *"hola"*.

---

## Archivos del repo

| Archivo | Descripción |
|---------|-------------|
| `workflows/wappBotPorcicola.json` | Workflow actual (v4) para importar en n8n |
| `workflows/wappBotPorcicola-v4.json` | Copia explícita de la v4 |
| `workflows/archive/wappBotPorcicola-v3.json` | Versión anterior con el bug de loop (referencia histórica) |

---

## Comparación rápida v3 vs v4

| Aspecto | v3 | v4 |
|---------|----|----|
| Vendedor virtual + catálogo PLU | Sí | Sí |
| Memoria por chat | Sí | Sí (ventana de 10) |
| Filtro solo mensajes entrantes de texto | No | Sí (`incomingMessageReceived` + `textMessage`) |
| Anti-duplicado por `idMessage` | No | Sí |
| Bloqueo de JSON crudo hacia WhatsApp | No | Sí |
| Prompt anti-bucle / saludos cortos | No | Sí |
| Loop infinito con "hola" | **Sí (bug crítico)** | Mitigado |

---

## Versión 3 — qué hacía y qué fallaba

### Flujo v3

```
Webhook Green-API
  → Edit Fields
  → AI Agent (+ OpenAI + Simple Memory)
  → Edit Fields1
  → HTTP Request (sendMessage Green-API)
```

### Qué funcionaba

- Atención como vendedor de carne de cerdo
- Catálogo PLU-201 … PLU-212, cantidades, preparación, empaque, datos del cliente
- Memoria de conversación
- Envío de respuesta por WhatsApp vía Green-API

### Bug crítico: mensajes infinitos

**Síntoma:** el cliente escribe *"hola"* (u otro mensaje corto) y el bot **no para de responder**.

**Causas:**

1. **Sin filtro de evento.** Se procesaba cualquier webhook (incluidos ecos de mensajes salientes del propio bot).
2. **Eco → respuesta → eco.** `sendMessage` dispara otra notificación → el agente cree que es el cliente → responde otra vez → loop.
3. **Sin deduplicación** de `idMessage`.
4. **Saludos** podían disparar respuestas largas / menús, agravando el ciclo.
5. Posible **JSON de comanda** pegado en el chat, realimentando el flujo.

Archivo histórico: `workflows/archive/wappBotPorcicola-v3.json`

---

## Versión 4 — correcciones anti-loop (actual)

### Flujo v4

```
Webhook Green-API
  → IF: ¿es incomingMessageReceived + textMessage?
       ├─ No  → fin (ignora ecos, estados, no-texto)
       └─ Sí  → Normalizar campos
                → Anti-duplicado (idMessage)
                → AI Agent (+ OpenAI + Simple Memory)
                → Salida segura WhatsApp (limpia JSON / vacíos)
                → Enviar WhatsApp (Green-API)
```

### Nodos nuevos / clave

| Nodo | Función |
|------|---------|
| **Es mensaje entrante texto** | Solo deja pasar webhooks `incomingMessageReceived` con `typeMessage = textMessage`. **Corta el loop por eco.** |
| **Normalizar campos** | Extrae `chatId`, `mensaje`, `nombre`, `idMessage`, `sender` de forma segura |
| **Anti-duplicado** | Si ya se procesó ese `idMessage`, no responde otra vez; ignora mensajes vacíos |
| **AI Agent** | Mismo rol de vendedor, con reglas anti-bucle: saludo corto, una pregunta, sin JSON al cliente, máx. ~500 caracteres |
| **Salida segura WhatsApp** | Si el agente mete JSON de pedido, lo quita del mensaje al cliente y deja un texto humano |
| **Enviar WhatsApp** | POST a Green-API `sendMessage` |

### Qué mejora respecto a v3

- Un *"hola"* → **una** respuesta corta de saludo + una pregunta (no ráfaga infinita)
- Los mensajes que el bot envía **no** vuelven a entrar al agente
- Reintentos / duplicados de Green-API se descartan
- El cliente no recibe JSON técnico de comanda

### Limitaciones actuales de la v4

- No hay herramientas reales de stock / fecha / guardado de pedido (el prompt lo deja explícito)
- Solo procesa **mensajes de texto** (ignora audio, imagen, etc.)
- Hay que configurar instancia y token de Green-API (placeholders en el JSON)
- Si tienes **dos workflows activos** con el mismo webhook, puedes volver a ver dobles respuestas

---

## Cómo importar en n8n

1. **Workflows → Import from File** → `workflows/wappBotPorcicola.json` (v4)
2. Conecta credenciales **OpenAI**
3. Sustituye la URL de envío:
   ```
   https://{{GREENAPI_ID_INSTANCE}}.api.greenapi.com/waInstance{{GREENAPI_ID_INSTANCE}}/sendMessage/{{GREENAPI_API_TOKEN}}
   ```
4. Copia la URL de producción del nodo **Webhook Green-API** y pégala en Green-API
5. Activa **solo** este workflow (desactiva la v3 si la tenías)

### Prueba rápida

1. Escribe `hola` desde WhatsApp → debe llegar **un** saludo corto.
2. Escribe otro mensaje → una sola respuesta coherente con el contexto.
3. Si no hay loop tras 2–3 mensajes, el anti-eco está bien.

---

## Seguridad

Los tokens reales de Green-API **no** están en el repo (placeholders). No subas exports con API keys.

---

## Requisitos

- n8n con nodos LangChain / AI Agent
- OpenAI
- Green-API (WhatsApp)

---

## Historial de commits del repo

1. **v3** — Bot de ventas funcional + bug documentado de mensajes infinitos
2. **v4** (este commit) — Filtro entrante, anti-duplicado y salida segura para cortar el loop
